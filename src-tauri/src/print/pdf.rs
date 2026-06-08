use std::path::{Path, PathBuf};

use ::image::RgbaImage;

use printpdf::*;

use crate::print::error::PrintError;
use crate::print::composition::Orientation;
pub use printpdf::PdfDocument;

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

/// Builds a single-page PDF from a composited RGBA image.
///
/// Images are embedded as RGBA (RGB color space in PDF).
/// Future CMYK support will use lopdf for true /DeviceCMYK output.
pub struct PdfDocumentBuilder {
    dpi: u32,
    #[allow(dead_code)]
    orientation: Orientation,
    page_size: String,
}

impl PdfDocumentBuilder {
    pub fn new(dpi: u32, orientation: Orientation) -> Self {
        PdfDocumentBuilder {
            dpi,
            orientation,
            page_size: "A4".to_string(),
        }
    }

    pub fn get_page_size(&self) -> &str {
        &self.page_size
    }

    #[allow(dead_code)]
    pub fn new_with_size(dpi: u32, orientation: Orientation, page_size: &str) -> Self {
        PdfDocumentBuilder {
            dpi,
            orientation,
            page_size: page_size.to_string(),
        }
    }

    /// Add the image to a document (no pages created).
    /// Used by `create_single_page` and callers that need multi-page.
    pub fn add_image_to_doc(&self, canvas: &RgbaImage) -> Result<(PdfDocument, XObjectId), PrintError> {
        let mut doc = PdfDocument::new("DuplexPic");

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
        Ok((doc, image_id))
    }

    /// Build a page with the given image_id and page dimensions.
    pub fn make_page(
        &self,
        image_id: &XObjectId,
        width_pt: Mm,
        height_pt: Mm,
    ) -> PdfPage {
        PdfPage::new(
            width_pt,
            height_pt,
            vec![Op::UseXobject {
                id: image_id.clone(),
                transform: XObjectTransform {
                    translate_x: None,
                    translate_y: None,
                    rotate: None,
                    scale_x: None,
                    scale_y: None,
                    dpi: Some(self.dpi as f32),
                },
            }],
        )
    }

    /// Save the PDF document to a temporary file and return its path.
    pub fn save_to_temp(doc: &PdfDocument) -> Result<PathBuf, PrintError> {
        let mut temp_dir = std::env::temp_dir();
        let unique_name = format!("duplexpic_{}.pdf", uuid_v4());
        temp_dir.push(unique_name);

        Self::save_to_path(doc, &temp_dir)?;

        Ok(temp_dir)
    }

    /// Save the PDF document to the given destination path.
    ///
    /// Creates parent directories if they don't exist. Overwrites any existing file.
    pub fn save_to_path(doc: &PdfDocument, dest: &Path) -> Result<(), PrintError> {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| PrintError::Pdf(format!("Failed to create output directory: {}", e)))?;
        }

        let mut file = std::fs::File::create(dest)
            .map_err(|e| PrintError::Pdf(format!("Failed to create output file: {}", e)))?;

        let warnings = &mut Vec::new();
        doc.save_writer(&mut file, &PdfSaveOptions::default(), warnings);

        Ok(())
    }

    /// Open the PDF in the default viewer (user can print from there).
    ///
    /// On Windows: uses `PowerShell Start-Process`.
    /// On Linux: uses `xdg-open`.
    pub fn spawn_open(temp_path: &Path) -> Result<(), PrintError> {
        #[cfg(target_os = "windows")]
        {
            let status = std::process::Command::new("powershell")
                .args([
                    "-Command",
                    "Start-Process",
                    "-FilePath",
                    &temp_path.to_string_lossy(),
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

        #[cfg(target_os = "linux")]
        {
            let status = std::process::Command::new("xdg-open")
                .arg(&temp_path.to_string_lossy())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .map_err(|e| {
                    PrintError::PrintSpawn(format!("Failed to launch xdg-open: {}", e))
                })?;

            if !status.success() {
                return Err(PrintError::PrintSpawn(format!(
                    "xdg-open exited with code: {:?}",
                    status.code()
                )));
            }

            Ok(())
        }

        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        {
            Err(PrintError::PrintSpawn(
                "Opening PDF is not supported on this platform".into(),
            ))
        }
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

    fn make_single_page_doc(
        builder: &PdfDocumentBuilder,
        canvas: &RgbaImage,
    ) -> PdfDocument {
        let (mut doc, image_id) = builder.add_image_to_doc(canvas).unwrap();
        let (w_mm, h_mm) = crate::print::composition::Orientation::Portrait.page_mm("A4");
        let page = builder.make_page(
            &image_id,
            printpdf::Mm(w_mm as f32),
            printpdf::Mm(h_mm as f32),
        );
        doc.with_pages(vec![page]);
        doc
    }

    #[test]
    fn test_add_image_rgb_creates_valid_doc() {
        let builder = PdfDocumentBuilder::new(300, Orientation::Portrait);
        let canvas = RgbaImage::from_pixel(100, 100, ::image::Rgba([128u8, 128, 128, 255]));
        let doc = make_single_page_doc(&builder, &canvas);
        let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());
        assert!(bytes.len() > 100, "PDF too short");
        // Check for PDF header
        assert!(bytes.starts_with(b"%PDF"), "Not a valid PDF");
    }

    #[test]
    fn test_save_to_temp_creates_file() {
        let builder = PdfDocumentBuilder::new(150, Orientation::Portrait);
        let canvas = RgbaImage::from_pixel(10, 10, ::image::Rgba([0u8, 0, 0, 255]));
        let doc = make_single_page_doc(&builder, &canvas);
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
        let doc = make_single_page_doc(&builder, &canvas);
        let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());
        assert!(bytes.len() > 100, "PDF should be valid");
        assert!(bytes.starts_with(b"%PDF"), "Not a valid PDF");
    }

    #[test]
    fn test_build_pdf_single_copy() {
        use crate::print::composition::Orientation;
        use crate::print::build_pdf;
        let canvas = RgbaImage::from_pixel(50, 50, ::image::Rgba([0u8, 0, 0, 255]));
        let doc = build_pdf(&canvas, 1, 150, Orientation::Portrait).unwrap();
        let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());
        assert!(bytes.len() > 100, "Single-page PDF too short");
        assert!(bytes.starts_with(b"%PDF"), "Not a valid PDF");
    }

    #[test]
    fn test_build_pdf_multi_copy_grows() {
        use crate::print::composition::Orientation;
        use crate::print::build_pdf;
        let canvas = RgbaImage::from_pixel(10, 10, ::image::Rgba([255u8, 255, 255, 255]));
        // 3 copies should be noticeably larger than 1 copy
        let doc1 = build_pdf(&canvas, 1, 150, Orientation::Portrait).unwrap();
        let doc3 = build_pdf(&canvas, 3, 150, Orientation::Portrait).unwrap();
        let bytes1 = doc1.save(&PdfSaveOptions::default(), &mut Vec::new());
        let bytes3 = doc3.save(&PdfSaveOptions::default(), &mut Vec::new());
        assert!(bytes3.len() > bytes1.len(),
            "3-copy PDF ({} bytes) should be larger than 1-copy ({} bytes)",
            bytes3.len(), bytes1.len());
    }
}
