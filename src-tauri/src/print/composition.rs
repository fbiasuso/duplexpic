use image::{
    imageops,
    DynamicImage, RgbaImage,
};
use crate::print::error::PrintError;

/// A4 page orientation.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Orientation {
    Portrait,
    Landscape,
}

impl Orientation {
    pub fn from_str(s: &str) -> Result<Self, PrintError> {
        match s {
            "portrait" => Ok(Orientation::Portrait),
            "landscape" => Ok(Orientation::Landscape),
            _ => Err(PrintError::Validation(format!(
                "Invalid orientation '{}': must be 'portrait' or 'landscape'",
                s
            ))),
        }
    }

    /// A4 dimensions in mm: (width, height)
    pub fn a4_mm(&self) -> (f64, f64) {
        match self {
            Orientation::Portrait => (210.0, 297.0),
            Orientation::Landscape => (297.0, 210.0),
        }
    }
}

/// Which half of the sheet a slot occupies.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Slot {
    Top,
    Bottom,
}



/// How to fit an image into its slot.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FitMode {
    /// Fit entirely within bounds, preserve aspect ratio, white letterbox.
    Contain,
    /// Stretch to fill bounds exactly, aspect ratio NOT preserved.
    Fill,
    /// Scale to cover bounds proportionally, crop overflow.
    Cover,
}

impl FitMode {
    pub fn from_str(s: &str) -> Result<Self, PrintError> {
        match s {
            "contain" => Ok(FitMode::Contain),
            "fill" => Ok(FitMode::Fill),
            "cover" => Ok(FitMode::Cover),
            _ => Err(PrintError::Validation(format!(
                "Invalid fit mode '{}': must be 'contain', 'fill', or 'cover'",
                s
            ))),
        }
    }
}

/// Margin and gutter values in millimetres.
#[derive(Debug, Clone, Copy)]
pub struct Margins {
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
    /// Gap between the two slots in mm.
    pub gutter: f64,
}

/// Image data and settings for both slots.
pub struct SlotData {
    pub top_path: String,
    pub bottom_path: String,
    pub top_fit: FitMode,
    pub bottom_fit: FitMode,
    pub top_rotation: u32,
    pub bottom_rotation: u32,
    pub top_mirrored: bool,
    pub bottom_mirrored: bool,
}

// ---------------------------------------------------------------------------
// A4Canvas
// ---------------------------------------------------------------------------

/// An A4-sized pixel canvas at a given DPI.
#[allow(dead_code)]
pub struct A4Canvas {
    pub dpi: u32,
    pub width_px: u32,
    pub height_px: u32,
    orientation: Orientation,
    margins: Margins,
    buffer: RgbaImage,
}

impl A4Canvas {
    /// Create a new white A4 canvas.
    pub fn new(dpi: u32, orientation: Orientation, margins: Margins) -> Self {
        let (w_mm, h_mm) = orientation.a4_mm();
        let width_px = mm_to_px(w_mm, dpi as f64);
        let height_px = mm_to_px(h_mm, dpi as f64);
        let buffer = RgbaImage::from_pixel(width_px, height_px, image::Rgba([255u8, 255, 255, 255]));
        A4Canvas {
            dpi,
            width_px,
            height_px,
            orientation,
            margins,
            buffer,
        }
    }

    /// Return the raw RGBA pixel buffer.
    #[allow(dead_code)]
    pub fn as_rgba(&self) -> &[u8] {
        self.buffer.as_raw()
    }

    /// Encode the canvas as PNG bytes.
    #[allow(dead_code)]
    pub fn encode_png(&self) -> Result<Vec<u8>, PrintError> {
        let mut buf = std::io::Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(self.buffer.clone())
            .write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| PrintError::Composition(format!("PNG encode failed: {}", e)))?;
        Ok(buf.into_inner())
    }

    /// Consume the canvas and return the RGBA image.
    #[allow(dead_code)]
    pub fn into_buffer(self) -> RgbaImage {
        self.buffer
    }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/// Convert millimetres to pixels at the given DPI.
pub fn mm_to_px(mm: f64, dpi: f64) -> u32 {
    (mm * dpi / 25.4).round() as u32
}

/// Compute the bounding box of a slot within the A4 canvas.
///
/// Returns `(x, y, width, height)` in pixels.
pub fn slot_bbox(
    orientation: Orientation,
    width_px: u32,
    height_px: u32,
    slot: Slot,
    margins: &Margins,
    dpi: u32,
) -> (u32, u32, u32, u32) {
    let top = mm_to_px(margins.top, dpi as f64);
    let bottom = mm_to_px(margins.bottom, dpi as f64);
    let left = mm_to_px(margins.left, dpi as f64);
    let right = mm_to_px(margins.right, dpi as f64);
    let gutter = mm_to_px(margins.gutter, dpi as f64);

    match orientation {
        Orientation::Portrait => {
            let inner_w = width_px.saturating_sub(left + right);
            let inner_h = height_px.saturating_sub(top + bottom);
            let slot_h = (inner_h.saturating_sub(gutter)) / 2;

            match slot {
                Slot::Top => (left, top, inner_w, slot_h),
                Slot::Bottom => (left, top + slot_h + gutter, inner_w, slot_h),
            }
        }
        Orientation::Landscape => {
            let inner_w = width_px.saturating_sub(left + right);
            let inner_h = height_px.saturating_sub(top + bottom);
            let slot_w = (inner_w.saturating_sub(gutter)) / 2;

            match slot {
                Slot::Top => (left, top, slot_w, inner_h),
                Slot::Bottom => (left + slot_w + gutter, top, slot_w, inner_h),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Fit modes
// ---------------------------------------------------------------------------

/// Resize image to fit **within** bounds, preserving aspect ratio.
/// Remaining area filled with white. Returns an RGBA image.
pub fn fit_contain(img: &DynamicImage, bounds: (u32, u32)) -> DynamicImage {
    let (bw, bh) = bounds;
    let ratio = (bw as f64 / img.width() as f64).min(bh as f64 / img.height() as f64);
    let new_w = (img.width() as f64 * ratio).round() as u32;
    let new_h = (img.height() as f64 * ratio).round() as u32;
    let resized = img.resize_exact(new_w, new_h, imageops::Lanczos3);

    let mut canvas = RgbaImage::from_pixel(bw, bh, image::Rgba([255u8, 255, 255, 255]));
    let ox = (bw.saturating_sub(new_w)) / 2;
    let oy = (bh.saturating_sub(new_h)) / 2;
    imageops::overlay(&mut canvas, &resized.to_rgba8(), ox as i64, oy as i64);
    DynamicImage::ImageRgba8(canvas)
}

/// Stretch image to fill bounds exactly (aspect ratio NOT preserved).
pub fn fit_fill(img: &DynamicImage, bounds: (u32, u32)) -> DynamicImage {
    let (bw, bh) = bounds;
    DynamicImage::ImageRgba8(img.resize_exact(bw, bh, imageops::Lanczos3).to_rgba8())
}

/// Scale to cover bounds proportionally, cropping overflow from centre.
pub fn fit_cover(img: &DynamicImage, bounds: (u32, u32)) -> DynamicImage {
    let (bw, bh) = bounds;
    let ratio = (bw as f64 / img.width() as f64).max(bh as f64 / img.height() as f64);
    let new_w = (img.width() as f64 * ratio).round() as u32;
    let new_h = (img.height() as f64 * ratio).round() as u32;
    let resized = img.resize_exact(new_w, new_h, imageops::Lanczos3);

    let cx = (new_w.saturating_sub(bw)) / 2;
    let cy = (new_h.saturating_sub(bh)) / 2;
    DynamicImage::ImageRgba8(imageops::crop_imm(&resized, cx, cy, bw, bh).to_image())
}

// ---------------------------------------------------------------------------
// Composite a single slot onto the canvas
// ---------------------------------------------------------------------------

/// Load an image, apply transforms, scale to fit mode, and paste onto the
/// canvas at the given slot position.
pub fn composite_slot(
    canvas: &mut RgbaImage,
    path: &str,
    slot: Slot,
    fit: FitMode,
    rotation: u32,
    mirrored: bool,
    margins: &Margins,
    orientation: Orientation,
    dpi: u32,
) -> Result<(), PrintError> {
    // 1. Check file exists
    if !std::path::Path::new(path).exists() {
        return Err(PrintError::ImageNotFound(path.to_string()));
    }

    // 2. Open and decode
    let mut img = image::open(path).map_err(|e| {
        PrintError::ImageDecode(format!("Failed to open '{}': {}", path, e))
    })?;

    // 3. Apply rotation (clockwise)
    img = match rotation % 360 {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    };

    // 4. Apply horizontal mirror
    if mirrored {
        img = img.fliph();
    }

    // 5. Compute slot bounding box
    let (sx, sy, sw, sh) = slot_bbox(orientation, canvas.width(), canvas.height(), slot, margins, dpi);

    // 6. Scale to fit mode
    let fitted = match fit {
        FitMode::Contain => fit_contain(&img, (sw, sh)),
        FitMode::Fill => fit_fill(&img, (sw, sh)),
        FitMode::Cover => fit_cover(&img, (sw, sh)),
    };

    // 7. Composite onto canvas
    imageops::overlay(canvas, &fitted.to_rgba8(), sx as i64, sy as i64);

    Ok(())
}

// ---------------------------------------------------------------------------
// Main composition entry
// ---------------------------------------------------------------------------

/// Compose both slots onto a single A4 canvas and return the RGBA image.
pub fn compose(data: SlotData, dpi: u32, orientation: Orientation, margins: Margins) -> Result<RgbaImage, PrintError> {
    let mut canvas = A4Canvas::new(dpi, orientation, margins);

    // Composite top slot
    composite_slot(
        &mut canvas.buffer,
        &data.top_path,
        Slot::Top,
        data.top_fit,
        data.top_rotation,
        data.top_mirrored,
        &margins,
        orientation,
        dpi,
    )?;

    // Composite bottom slot
    composite_slot(
        &mut canvas.buffer,
        &data.bottom_path,
        Slot::Bottom,
        data.bottom_fit,
        data.bottom_rotation,
        data.bottom_mirrored,
        &margins,
        orientation,
        dpi,
    )?;

    Ok(canvas.buffer)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn make_test_png(width: u32, height: u32) -> std::path::PathBuf {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("duplexpic_composition_test_{}x{}.png", width, height));
        let img = DynamicImage::new_rgba8(width, height);
        let mut buf = std::io::Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png).unwrap();
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(buf.get_ref()).unwrap();
        drop(f);
        path
    }

    #[test]
    fn test_mm_to_px() {
        // 10 mm at 300 DPI -> 10 * 300 / 25.4 ≈ 118.11 → 118
        assert_eq!(mm_to_px(10.0, 300.0), 118);
        // 0 mm -> 0 px
        assert_eq!(mm_to_px(0.0, 300.0), 0);
        // 25.4 mm at 72 DPI -> 72 px
        assert_eq!(mm_to_px(25.4, 72.0), 72);
    }

    #[test]
    fn test_canvas_dimensions_portrait_300() {
        let margins = Margins { top: 0.0, bottom: 0.0, left: 0.0, right: 0.0, gutter: 0.0 };
        let canvas = A4Canvas::new(300, Orientation::Portrait, margins);
        // 210 * 300 / 25.4 = 2480.3... → 2480
        // 297 * 300 / 25.4 = 3507.8... → 3508
        assert_eq!(canvas.width_px, 2480);
        assert_eq!(canvas.height_px, 3508);
    }

    #[test]
    fn test_canvas_dimensions_landscape_600() {
        let margins = Margins { top: 0.0, bottom: 0.0, left: 0.0, right: 0.0, gutter: 0.0 };
        let canvas = A4Canvas::new(600, Orientation::Landscape, margins);
        // 297 * 600 / 25.4 = 7015.7... → 7016
        // 210 * 600 / 25.4 = 4960.6... → 4961
        assert_eq!(canvas.width_px, 7016);
        assert_eq!(canvas.height_px, 4961);
    }

    #[test]
    fn test_slot_bbox_portrait_with_margins() {
        let margins = Margins { top: 10.0, bottom: 10.0, left: 10.0, right: 10.0, gutter: 5.0 };
        let dpi = 300;
        let (wp, hp) = (2480, 3508);
        let (x, y, w, h) = slot_bbox(Orientation::Portrait, wp, hp, Slot::Top, &margins, dpi);
        // left = 10*300/25.4 = 118
        assert_eq!(x, 118);
        assert_eq!(y, 118);
        // inner_w = 2480 - 118 - 118 = 2244
        assert_eq!(w, 2244);
        // inner_h = 3508 - 118 - 118 = 3272
        // gutter_px = 5*300/25.4 = 59
        // slot_h = (3272 - 59) / 2 = 1606
        assert_eq!(h, 1606);
    }

    #[test]
    fn test_slot_bbox_landscape() {
        let margins = Margins { top: 5.0, bottom: 5.0, left: 5.0, right: 5.0, gutter: 5.0 };
        let dpi = 300;
        let (wp, hp) = (3508, 2480);
        let (x, y, w, h) = slot_bbox(Orientation::Landscape, wp, hp, Slot::Top, &margins, dpi);
        // left = 5*300/25.4 = 59
        assert_eq!(x, 59);
        assert_eq!(y, 59);
        // inner_w = 3508 - 59 - 59 = 3390
        // slot_w = (3390 - 59) / 2 = 1665
        assert_eq!(w, 1665);
        // inner_h = 2480 - 59 - 59 = 2362
        assert_eq!(h, 2362);
    }

    #[test]
    fn test_fit_contain_preserves_aspect() {
        let img = DynamicImage::new_rgba8(200, 100);
        let result = fit_contain(&img, (100, 100));
        // Ratio = min(100/200, 100/100) = min(0.5, 1.0) = 0.5
        // new_w = 200*0.5 = 100, new_h = 100*0.5 = 50
        // Result canvas = 100x100
        assert_eq!(result.width(), 100);
        assert_eq!(result.height(), 100);
    }

    #[test]
    fn test_fit_fill_stretches() {
        let img = DynamicImage::new_rgba8(200, 100);
        let result = fit_fill(&img, (50, 80));
        assert_eq!(result.width(), 50);
        assert_eq!(result.height(), 80);
    }

    #[test]
    fn test_fit_cover_crops() {
        let img = DynamicImage::new_rgba8(200, 100);
        let result = fit_cover(&img, (100, 100));
        // Ratio = max(100/200, 100/100) = max(0.5, 1.0) = 1.0
        // new_w = 200, new_h = 100 — exactly the same size since 1.0 ratio
        // crop center: cx = (200-100)/2 = 50, cy = (100-100)/2 = 0
        assert_eq!(result.width(), 100);
        assert_eq!(result.height(), 100);
    }

    #[test]
    fn test_composite_slot_creates_valid_output() {
        let top_path = make_test_png(100, 200);
        let bottom_path = make_test_png(200, 100);

        let margins = Margins { top: 5.0, bottom: 5.0, left: 5.0, right: 5.0, gutter: 5.0 };
        let data = SlotData {
            top_path: top_path.to_string_lossy().to_string(),
            bottom_path: bottom_path.to_string_lossy().to_string(),
            top_fit: FitMode::Contain,
            bottom_fit: FitMode::Contain,
            top_rotation: 0,
            bottom_rotation: 0,
            top_mirrored: false,
            bottom_mirrored: false,
        };

        let result = compose(data, 150, Orientation::Portrait, margins);
        assert!(result.is_ok(), "Composition failed: {:?}", result.err());
        let canvas = result.unwrap();
        // At 150 DPI: 1240x1754
        assert_eq!(canvas.width(), 1240);
        assert_eq!(canvas.height(), 1754);

        // Cleanup
        let _ = std::fs::remove_file(&top_path);
        let _ = std::fs::remove_file(&bottom_path);
    }

    #[test]
    fn test_composite_missing_file() {
        let margins = Margins { top: 0.0, bottom: 0.0, left: 0.0, right: 0.0, gutter: 0.0 };
        let data = SlotData {
            top_path: "C:/nonexistent/path.png".to_string(),
            bottom_path: make_test_png(10, 10).to_string_lossy().to_string(),
            top_fit: FitMode::Contain,
            bottom_fit: FitMode::Contain,
            top_rotation: 0,
            bottom_rotation: 0,
            top_mirrored: false,
            bottom_mirrored: false,
        };

        let result = compose(data, 150, Orientation::Portrait, margins);
        assert!(result.is_err());
        match result.err().unwrap() {
            PrintError::ImageNotFound(_) => {} // expected
            other => panic!("Expected ImageNotFound, got: {:?}", other),
        }
    }

    #[test]
    fn test_composite_with_rotation_and_mirror() {
        let path = make_test_png(50, 100);
        let path2 = make_test_png(100, 50);

        let margins = Margins { top: 0.0, bottom: 0.0, left: 0.0, right: 0.0, gutter: 0.0 };
        let data = SlotData {
            top_path: path.to_string_lossy().to_string(),
            bottom_path: path2.to_string_lossy().to_string(),
            top_fit: FitMode::Cover,
            bottom_fit: FitMode::Fill,
            top_rotation: 90,
            bottom_rotation: 180,
            top_mirrored: true,
            bottom_mirrored: false,
        };

        let result = compose(data, 150, Orientation::Portrait, margins);
        assert!(result.is_ok(), "Composition failed: {:?}", result.err());

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&path2);
    }
}
