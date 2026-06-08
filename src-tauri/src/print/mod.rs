mod composition;
mod error;
mod pdf;

use image::RgbaImage;

use composition::{SlotData, compose};
pub use composition::{Orientation, FitMode, Margins};
pub use error::{PrintError, error_code};
pub use pdf::{PdfDocumentBuilder, PdfDocument};

/// Parameters for the composition pipeline.
pub struct PrintParams {
    pub slot_top: String,
    pub slot_bottom: String,
    pub margins: Margins,
    pub orientation: Orientation,
    pub fit_top: FitMode,
    pub fit_bottom: FitMode,
    pub rotate_top: u32,
    pub rotate_bottom: u32,
    pub mirror_top: bool,
    pub mirror_bottom: bool,
    pub dpi: u32,
    pub copies: u32,
    pub selected_slots: String,
    pub grayscale: bool,
    pub crop_marks: bool,
    pub page_size: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_slot_data(p: &PrintParams) -> SlotData {
    SlotData {
        top_path: if p.selected_slots == "bottom" { String::new() } else { p.slot_top.clone() },
        bottom_path: if p.selected_slots == "top" { String::new() } else { p.slot_bottom.clone() },
        top_fit: p.fit_top,
        bottom_fit: p.fit_bottom,
        top_rotation: p.rotate_top,
        bottom_rotation: p.rotate_bottom,
        top_mirrored: p.mirror_top,
        bottom_mirrored: p.mirror_bottom,
    }
}

/// Build the composited RGBA canvas from params, applying all post-compose
/// options (grayscale, crop marks).
fn build_canvas(params: &PrintParams) -> Result<RgbaImage, PrintError> {
    let slot_data = build_slot_data(params);
    let mut canvas = compose(slot_data, params.dpi, params.orientation, params.margins, &params.page_size)?;

    // Grayscale conversion
    if params.grayscale {
        canvas = image::DynamicImage::ImageRgba8(canvas)
            .grayscale()
            .into_rgba8();
    }

    // Crop marks: thin lines at the inner corners of each slot
    if params.crop_marks {
        add_crop_marks(&mut canvas, &params.margins, params.orientation, params.dpi, &params.page_size);
    }

    Ok(canvas)
}

/// Draw thin crop marks at the four inner corners of each slot.
fn add_crop_marks(
    canvas: &mut RgbaImage,
    margins: &Margins,
    orientation: Orientation,
    dpi: u32,
    page_size: &str,
) {
    let (_w_mm, _h_mm) = orientation.page_mm(page_size);
    let w = canvas.width();
    let h = canvas.height();
    let top_px = composition::mm_to_px(margins.top, dpi as f64);
    let bottom_px = composition::mm_to_px(margins.bottom, dpi as f64);
    let left_px = composition::mm_to_px(margins.left, dpi as f64);
    let right_px = composition::mm_to_px(margins.right, dpi as f64);
    let gutter_px = composition::mm_to_px(margins.gutter, dpi as f64);
    let mark_len = composition::mm_to_px(3.0, dpi as f64).max(2);

    // First slot: from top-left margin to gutter/2, horizontally centered
    // Second slot: from gutter/2 to bottom margin
    let mid_y = h / 2;
    let half_gap = gutter_px / 2;

    // Helper: draw a single crop mark segment
    let mut draw_mark = |x: u32, y: u32, dx: i32, dy: i32| {
        for i in 0..mark_len {
            let px = (x as i32 + dx * i as i32).clamp(0, w as i32 - 1) as u32;
            let py = (y as i32 + dy * i as i32).clamp(0, h as i32 - 1) as u32;
            if px < w && py < h {
                canvas.put_pixel(px, py, image::Rgba([0, 0, 0, 200]));
            }
        }
    };

    // ── Top slot corners (inner) ──
    // Top-left
    draw_mark(left_px + 1, top_px + 1, 1, 0);
    draw_mark(left_px + 1, top_px + 1, 0, 1);
    // Top-right
    draw_mark(w - right_px - 1, top_px + 1, -1, 0);
    draw_mark(w - right_px - 1, top_px + 1, 0, 1);
    // Bottom-left (touching gutter)
    let top_bottom_y = mid_y - half_gap;
    if top_bottom_y > top_px {
        draw_mark(left_px + 1, top_bottom_y, 1, 0);
        draw_mark(left_px + 1, top_bottom_y, 0, -1);
        // Bottom-right
        draw_mark(w - right_px - 1, top_bottom_y, -1, 0);
        draw_mark(w - right_px - 1, top_bottom_y, 0, -1);
    }

    // ── Bottom slot corners (inner) ──
    let bottom_top_y = mid_y + half_gap;
    if bottom_top_y + bottom_px < h {
        // Top-left
        draw_mark(left_px + 1, bottom_top_y + 1, 1, 0);
        draw_mark(left_px + 1, bottom_top_y + 1, 0, 1);
        // Top-right
        draw_mark(w - right_px - 1, bottom_top_y + 1, -1, 0);
        draw_mark(w - right_px - 1, bottom_top_y + 1, 0, 1);
        // Bottom-left
        draw_mark(left_px + 1, h - bottom_px - 1, 1, 0);
        draw_mark(left_px + 1, h - bottom_px - 1, 0, -1);
        // Bottom-right
        draw_mark(w - right_px - 1, h - bottom_px - 1, -1, 0);
        draw_mark(w - right_px - 1, h - bottom_px - 1, 0, -1);
    }
}

/// Generate a multi-page PDF document (one page per copy).
pub(crate) fn build_pdf(canvas: &RgbaImage, copies: u32, dpi: u32, orientation: Orientation) -> Result<PdfDocument, PrintError> {
    let builder = PdfDocumentBuilder::new(dpi, orientation);
    let (width_mm, height_mm) = orientation.page_mm(&builder.get_page_size());
    let width_pt = printpdf::Mm(width_mm as f32);
    let height_pt = printpdf::Mm(height_mm as f32);

    // Build raw image bytes once, reuse for each copy
    let raw_pixels: Vec<u8> = canvas
        .pixels()
        .flat_map(|p| vec![p[0], p[1], p[2], p[3]])
        .collect();
    use printpdf::*;

    let mut doc = PdfDocument::new("DuplexPic");

    // Add each copy's image to the SAME document, collecting image IDs
    let image_ids: Vec<XObjectId> = (0..copies)
        .map(|_| {
            let image = RawImage {
                pixels: RawImageData::U8(raw_pixels.clone()),
                width: canvas.width() as usize,
                height: canvas.height() as usize,
                data_format: RawImageFormat::RGBA8,
                tag: vec![],
            };
            doc.add_image(&image)
        })
        .collect();

    let pages: Vec<PdfPage> = image_ids
        .into_iter()
        .map(|id| {
            PdfPage::new(
                width_pt,
                height_pt,
                vec![Op::UseXobject {
                    id,
                    transform: XObjectTransform {
                        translate_x: None,
                        translate_y: None,
                        rotate: None,
                        scale_x: None,
                        scale_y: None,
                        dpi: Some(dpi as f32),
                    },
                }],
            )
        })
        .collect();

    doc.with_pages(pages);
    Ok(doc)
}

/// Shared temp-PDF generation for all output modes.
fn render_temp_pdf(canvas: &RgbaImage, params: &PrintParams) -> Result<std::path::PathBuf, PrintError> {
    let doc = build_pdf(canvas, params.copies, params.dpi, params.orientation)?;
    PdfDocumentBuilder::save_to_temp(&doc)
}

/// Shared PDF output: compose → (grayscale|crop marks) → PDF temp → return path.
fn compose_to_temp(params: &PrintParams) -> Result<std::path::PathBuf, PrintError> {
    let canvas = build_canvas(params)?;
    render_temp_pdf(&canvas, params)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Compose both images, generate a PDF, and open in the default PDF viewer.
pub fn compose_open(params: PrintParams) -> Result<String, PrintError> {
    let temp_path = compose_to_temp(&params)?;
    PdfDocumentBuilder::spawn_open(&temp_path)?;
    Ok(temp_path.to_string_lossy().to_string())
}

/// Compose both images, generate a PDF, and print via system dialog.
pub fn compose_print(params: PrintParams) -> Result<String, PrintError> {
    let temp_path = compose_to_temp(&params)?;
    PdfDocumentBuilder::spawn_print(&temp_path)?;
    Ok(temp_path.to_string_lossy().to_string())
}

/// Compose both images, generate a PDF, and save directly to `dest_path`.
pub fn compose_save(params: PrintParams, dest_path: &str) -> Result<String, PrintError> {
    let canvas = build_canvas(&params)?;
    let doc = build_pdf(&canvas, params.copies, params.dpi, params.orientation)?;
    PdfDocumentBuilder::save_to_path(&doc, std::path::Path::new(dest_path))?;
    Ok(dest_path.to_string())
}
