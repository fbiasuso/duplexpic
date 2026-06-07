use std::path::{Path, PathBuf};

use ::image::RgbaImage;

use printpdf::*;

use crate::print::error::PrintError;
use crate::print::composition::Orientation;

// ---------------------------------------------------------------------------
// CMYK conversion
// ---------------------------------------------------------------------------

/// Convert RGBA pixel to CMYK using the standard formula (no ICC).
///
/// Returns `[C, M, Y, K]` each in 0..255.
///
/// NOTE: kept for future lopdf integration — not currently exposed in the UI.
#[allow(dead_code)]
pub fn rgba_to_cmyk(r: u8, g: u8, b: u8) -> [u8; 4] {
    let rf = r as f32 / 255.0;
    let gf = g as f32 / 255.0;
    let bf = b as f32 / 255.0;

    let k = 1.0 - rf.max(gf).max(bf);

    // Avoid division by zero when K ≈ 1 (pure black)
    if k > 0.9999 {
        return [0, 0, 0, 255];
    }

    let denom = 1.0 - k;
    let c = (1.0 - rf - k) / denom;
    let m = (1.0 - gf - k) / denom;
    let y = (1.0 - bf - k) / denom;

    [
        (c * 255.0).round() as u8,
        (m * 255.0).round() as u8,
        (y * 255.0).round() as u8,
        (k * 255.0).round() as u8,
    ]
}

// ---------------------------------------------------------------------------
// PdfDocumentBuilder
// ---------------------------------------------------------------------------

/// Builds a single-page A4 PDF from a composited RGBA image.
///
/// Images are embedded as RGBA (RGB color space in PDF).
/// Future CMYK support will use lopdf for true /DeviceCMYK output.
pub struct PdfDocumentBuilder {
    dpi: u32,
    orientation: Orientation,
}

impl PdfDocumentBuilder {
    pub fn new(dpi: u32, orientation: Orientation) -> Self {
        PdfDocumentBuilder { dpi, orientation }
    }

    /// Add the composited RGBA image to the PDF document.
    ///
    /// If `preview` is true, skip PDF generation entirely (just return Ok).
    pub fn add_image(
        &self,
        canvas: &RgbaImage,
        preview: bool,
    ) -> Result<(PdfDocument, XObjectId), PrintError> {
        if preview {
            // not reached — caller should handle preview separately
            return Err(PrintError::Pdf("preview mode should skip PDF".into()));
        }

        let (width_mm, height_mm) = self.orientation.a4_mm();
        let width_pt = Mm(width_mm as f32);
        let height_pt = Mm(height_mm as f32);

        let mut doc = PdfDocument::new("DuplexPic");

        // Pass RGBA pixels as-is (RGB color space in PDF).
        let raw_pixels: Vec<u8> = canvas
            .pixels()
            .flat_map(|p| vec![p[0], p[1], p[2], p[3]])
            .collect();

        let image = RawImage {
            pixels: RawImageData::U8(raw_pixels),
            width: canvas.width() as usize,
            height: canvas.height() as usize,
            data_format: RawImageFormat::RGBA8,
            tag: vec![],
        };

        let image_id = doc.add_image(&image);

        // --- Page with image ---
        // Scale the image to fill the page.
        // The image is at {dpi} DPI, the PDF page is in mm.
        // 1 inch = 25.4 mm, 1 point = 1/72 inch
        // At 300 DPI, 1 pixel = 1/300 inch = 72/300 points = 0.24 pt
        // To fill A4 (595pt × 842pt), image of 2480px needs scale_x = 595/2480 ≈ 0.24
        // But we let printpdf handle the DPI scaling via the dpi field in XObjectTransform.

        let transform = XObjectTransform {
            translate_x: None,
            translate_y: None,
            rotate: None,
            scale_x: None,
            scale_y: None,
            dpi: Some(self.dpi as f32),
        };

        let page = PdfPage::new(
            width_pt,
            height_pt,
            vec![Op::UseXobject { id: image_id.clone(), transform }],
        );

        doc.with_pages(vec![page]);

        Ok((doc, image_id))
    }

    /// Save the PDF document to a temporary file and return its path.
    pub fn save_to_temp(doc: &PdfDocument) -> Result<PathBuf, PrintError> {
        let mut temp_dir = std::env::temp_dir();
        let unique_name = format!("duplexpic_{}.pdf", uuid_v4());
        temp_dir.push(unique_name);

        let mut file = std::fs::File::create(&temp_dir)
            .map_err(|e| PrintError::Pdf(format!("Failed to create temp file: {}", e)))?;

        let warnings = &mut Vec::new();
        doc.save_writer(&mut file, &PdfSaveOptions::default(), warnings);

        Ok(temp_dir)
    }

    /// Spawn the system print dialog for the given PDF file.
    ///
    /// On Windows: uses `PowerShell Start-Process -Verb Print`.
    /// On other platforms: returns an error.
    pub fn spawn_print(temp_path: &Path) -> Result<(), PrintError> {
        #[cfg(target_os = "windows")]
        {
            let status = std::process::Command::new("powershell")
                .args([
                    "-Command",
                    "Start-Process",
                    "-FilePath",
                    &temp_path.to_string_lossy(),
                    "-Verb",
                    "Print",
                ])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .map_err(|e| {
                    PrintError::PrintSpawn(format!("Failed to launch PowerShell: {}", e))
                })?;

            if !status.success() {
                return Err(PrintError::PrintSpawn(format!(
                    "PowerShell exited with code: {:?}",
                    status.code()
                )));
            }

            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err(PrintError::PrintSpawn(
                "Print not supported on this platform".into(),
            ))
        }
    }
}

/// Generate a simple v4 UUID (not cryptographically secure, but unique enough).
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        now.as_secs(),
        now.subsec_nanos() as u16,
        now.subsec_nanos() as u16 % 0xfff,
        (now.as_secs() ^ now.subsec_nanos() as u64) as u16,
        (now.as_secs() * 7919 + now.subsec_nanos() as u64) & 0xffff_ffff_ffff,
    )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgba_to_cmyk_white() {
        // White → C=0, M=0, Y=0, K=0
        let cmyk = rgba_to_cmyk(255, 255, 255);
        assert_eq!(cmyk, [0, 0, 0, 0]);
    }

    #[test]
    fn test_rgba_to_cmyk_black() {
        // Black → C=0, M=0, Y=0, K=255
        let cmyk = rgba_to_cmyk(0, 0, 0);
        assert_eq!(cmyk, [0, 0, 0, 255]);
    }

    #[test]
    fn test_rgba_to_cmyk_red() {
        // Red (255,0,0) → C=0, M=255, Y=255, K=0
        let cmyk = rgba_to_cmyk(255, 0, 0);
        assert_eq!(cmyk, [0, 255, 255, 0]);
    }

    #[test]
    fn test_rgba_to_cmyk_green() {
        // Green (0,255,0) → C=255, M=0, Y=255, K=0
        let cmyk = rgba_to_cmyk(0, 255, 0);
        assert_eq!(cmyk, [255, 0, 255, 0]);
    }

    #[test]
    fn test_rgba_to_cmyk_blue() {
        // Blue (0,0,255) → C=255, M=255, Y=0, K=0
        let cmyk = rgba_to_cmyk(0, 0, 255);
        assert_eq!(cmyk, [255, 255, 0, 0]);
    }

    #[test]
    fn test_add_image_rgb_creates_valid_doc() {
        let builder = PdfDocumentBuilder::new(300, Orientation::Portrait);
        let canvas = RgbaImage::from_pixel(100, 100, ::image::Rgba([128u8, 128, 128, 255]));
        let result = builder.add_image(&canvas, false);
        assert!(result.is_ok(), "add_image failed: {:?}", result.err());
        let (doc, _id) = result.unwrap();
        let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());
        assert!(bytes.len() > 100, "PDF too short");
        // Check for PDF header
        assert!(bytes.starts_with(b"%PDF"), "Not a valid PDF");
    }

    #[test]
    fn test_save_to_temp_creates_file() {
        let builder = PdfDocumentBuilder::new(150, Orientation::Portrait);
        let canvas = RgbaImage::from_pixel(10, 10, ::image::Rgba([0u8, 0, 0, 255]));
        let (doc, _id) = builder.add_image(&canvas, false).unwrap();
        let path = PdfDocumentBuilder::save_to_temp(&doc).unwrap();
        assert!(path.exists(), "Temp file should exist");
        assert!(
            path.file_name().unwrap().to_string_lossy().starts_with("duplexpic_"),
            "Unexpected filename"
        );
        // Cleanup
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_pdf_save_orientation_portrait() {
        let builder = PdfDocumentBuilder::new(300, Orientation::Portrait);
        let canvas = RgbaImage::from_pixel(2480, 3508, ::image::Rgba([255u8, 255, 255, 255]));
        let result = builder.add_image(&canvas, false);
        assert!(result.is_ok(), "Portrait PDF failed: {:?}", result.err());
    }
}
