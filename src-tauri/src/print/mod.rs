mod composition;
mod error;
mod pdf;

use composition::{SlotData, compose};
pub use composition::{Orientation, FitMode, Margins};
pub use error::{PrintError, error_code};
pub use pdf::PdfDocumentBuilder;

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
}

/// Compose both images and return PNG bytes for preview.
///
/// If `dpi > 300`, the composition is rendered at 300 DPI to avoid
/// oversized IPC payloads.
pub fn compose_preview(params: PrintParams) -> Result<Vec<u8>, PrintError> {
    // Downsample preview to max 300 DPI
    let preview_dpi = params.dpi.min(300);

    let slot_data = SlotData {
        top_path: params.slot_top,
        bottom_path: params.slot_bottom,
        top_fit: params.fit_top,
        bottom_fit: params.fit_bottom,
        top_rotation: params.rotate_top,
        bottom_rotation: params.rotate_bottom,
        top_mirrored: params.mirror_top,
        bottom_mirrored: params.mirror_bottom,
    };

    let canvas_rgba = compose(slot_data, preview_dpi, params.orientation, params.margins)?;

    // Encode as PNG
    let mut buf = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(canvas_rgba)
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| PrintError::Composition(format!("Preview PNG encode failed: {}", e)))?;

    Ok(buf.into_inner())
}

/// Compose both images, generate a PDF, and spawn the system print dialog.
pub fn compose_print(params: PrintParams) -> Result<(), PrintError> {
    let slot_data = SlotData {
        top_path: params.slot_top,
        bottom_path: params.slot_bottom,
        top_fit: params.fit_top,
        bottom_fit: params.fit_bottom,
        top_rotation: params.rotate_top,
        bottom_rotation: params.rotate_bottom,
        top_mirrored: params.mirror_top,
        bottom_mirrored: params.mirror_bottom,
    };

    let canvas_rgba = compose(slot_data, params.dpi, params.orientation, params.margins)?;

    // Build PDF
    let builder = PdfDocumentBuilder::new(params.dpi, params.orientation);
    let (doc, _image_id) = builder.add_image(&canvas_rgba, false)?;

    // Save to temp
    let temp_path = PdfDocumentBuilder::save_to_temp(&doc)?;

    // Spawn print
    PdfDocumentBuilder::spawn_print(&temp_path)?;

    // NOTE: The temp file is NOT deleted here because the print is async.
    // It will be cleaned up by the OS temp directory mechanism.
    // A future enhancement could schedule deletion after a delay.

    Ok(())
}
