mod print;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use print::{Orientation, FitMode, Margins, PrintParams, PrintError, error_code};
use serde::Serialize;
use std::fs;

fn mime_from_path(path: &str) -> &str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else {
        "image/png"
    }
}

#[tauri::command]
fn read_image(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Error leyendo archivo: {}", e))?;
    let mime = mime_from_path(&path);
    let b64 = BASE64.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Apply pixel-level transforms (rotate then mirror) to an image file.
///
/// Transform order: decode → rotate (clockwise) → horizontal mirror → encode PNG → base64 data URL.
///
/// # Arguments
/// * `path` — Absolute filesystem path to the image
/// * `rotation` — 0, 90, 180, or 270 degrees clockwise
/// * `mirrored` — Whether to flip the pixel buffer horizontally
///
/// # Returns
/// A `data:image/png;base64,...` string on success, or an error message.
#[tauri::command]
fn transform_image(path: String, rotation: u32, mirrored: bool) -> Result<String, String> {
    let rotation = rotation % 360;
    match rotation {
        0 | 90 | 180 | 270 => {}
        _ => return Err("rotation must be 0, 90, 180, or 270".to_string()),
    }

    let mut img = image::open(&path).map_err(|e| format!("Error opening image: {}", e))?;

    // Rotate first, then mirror (deterministic order per design decision)
    img = match rotation {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    };

    if mirrored {
        img = img.fliph();
    }

    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("Error encoding PNG: {}", e))?;

    let b64 = BASE64.encode(buf.into_inner());
    Ok(format!("data:image/png;base64,{}", b64))
}

/// Structured response for the `compose_print` command.
#[derive(Serialize)]
struct ComposeResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}

/// Validate DPI — only 150, 300, 600 are accepted.
fn validate_dpi(dpi: u32) -> Result<(), PrintError> {
    match dpi {
        150 | 300 | 600 => Ok(()),
        other => Err(PrintError::DpiUnsupported(other as u16)),
    }
}

/// Tauri command: compose both images onto an A4 canvas and produce a
/// preview PNG or a printable PDF with system print spawn.
#[tauri::command]
fn compose_print(
    slot_top: String,
    slot_bottom: String,
    margins_top: f64,
    margins_bottom: f64,
    margins_left: f64,
    margins_right: f64,
    gutter: f64,
    orientation: String,
    fit_top: String,
    fit_bottom: String,
    rotate_top: u32,
    rotate_bottom: u32,
    mirror_top: bool,
    mirror_bottom: bool,
    dpi: u32,
    mode: String,
) -> Result<ComposeResult, String> {
    // ---- Validate inputs ----
    let orientation = Orientation::from_str(&orientation).map_err(|e| e.to_string())?;
    let fit_top = FitMode::from_str(&fit_top).map_err(|e| e.to_string())?;
    let fit_bottom = FitMode::from_str(&fit_bottom).map_err(|e| e.to_string())?;
    validate_dpi(dpi).map_err(|e| e.to_string())?;

    if mode != "preview" && mode != "print" {
        return Err(format!("VALIDATION_ERROR: mode must be 'preview' or 'print', got '{}'", mode));
    }

    let margins = Margins {
        top: margins_top,
        bottom: margins_bottom,
        left: margins_left,
        right: margins_right,
        gutter,
    };

    let params = PrintParams {
        slot_top,
        slot_bottom,
        margins,
        orientation,
        fit_top,
        fit_bottom,
        rotate_top,
        rotate_bottom,
        mirror_top,
        mirror_bottom,
        dpi,
    };

    // ---- Dispatch ----
    match mode.as_str() {
        "preview" => {
            let png_bytes = print::compose_preview(params).map_err(|e| {
                format!("{}: {}", error_code(&e), e)
            })?;
            let b64 = BASE64.encode(&png_bytes);
            Ok(ComposeResult {
                ok: true,
                preview: Some(format!("data:image/png;base64,{}", b64)),
                message: None,
                error: None,
                code: None,
            })
        }
        "print" => {
            print::compose_print(params).map_err(|e| {
                format!("{}: {}", error_code(&e), e)
            })?;
            Ok(ComposeResult {
                ok: true,
                preview: None,
                message: Some("Print dialog opened".to_string()),
                error: None,
                code: None,
            })
        }
        _ => unreachable!(), // validated above
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_prevent_default::Builder::new()
                .with_flags(tauri_plugin_prevent_default::Flags::CONTEXT_MENU)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![read_image, transform_image, compose_print])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use print::PrintError;
    use std::io::Write;

    // -----------------------------------------------------------------------
    // error_code mapping — covers all spec-coded variants
    // -----------------------------------------------------------------------
    #[test]
    fn test_error_code_dpi_unsupported() {
        assert_eq!(error_code(&PrintError::DpiUnsupported(200)), "DPI_UNSUPPORTED");
    }

    #[test]
    fn test_error_code_image_not_found() {
        assert_eq!(error_code(&PrintError::ImageNotFound("x".into())), "IMAGE_NOT_FOUND");
    }

    #[test]
    fn test_error_code_image_decode_fail() {
        assert_eq!(error_code(&PrintError::ImageDecode("x".into())), "IMAGE_DECODE_FAIL");
    }

    #[test]
    fn test_error_code_composition_fail() {
        assert_eq!(error_code(&PrintError::Composition("x".into())), "COMPOSITION_FAIL");
    }

    #[test]
    fn test_error_code_pdf_generation_fail() {
        assert_eq!(error_code(&PrintError::Pdf("x".into())), "PDF_GENERATION_FAIL");
    }

    #[test]
    fn test_error_code_print_spawn_fail() {
        assert_eq!(error_code(&PrintError::PrintSpawn("x".into())), "PRINT_SPAWN_FAIL");
    }

    #[test]
    fn test_error_code_validation() {
        assert_eq!(error_code(&PrintError::Validation("x".into())), "VALIDATION_ERROR");
    }

    #[test]
    fn test_error_code_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::Other, "x");
        assert_eq!(error_code(&PrintError::Io(io_err)), "IO_ERROR");
    }

    // -----------------------------------------------------------------------
    // DPI validation
    // -----------------------------------------------------------------------
    #[test]
    fn test_validate_dpi_valid_values() {
        assert!(validate_dpi(150).is_ok());
        assert!(validate_dpi(300).is_ok());
        assert!(validate_dpi(600).is_ok());
    }

    #[test]
    fn test_validate_dpi_invalid_200() {
        let err = validate_dpi(200).unwrap_err();
        assert!(matches!(err, PrintError::DpiUnsupported(200)));
    }

    #[test]
    fn test_validate_dpi_invalid_zero() {
        let err = validate_dpi(0).unwrap_err();
        assert!(matches!(err, PrintError::DpiUnsupported(0)));
    }

    fn write_png_to(path: &std::path::Path, width: u32, height: u32) {
        let img = image::RgbaImage::new(width, height);
        let mut buf = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut buf, image::ImageFormat::Png)
            .expect("failed to encode test PNG");
        let mut f = std::fs::File::create(path).expect("failed to write temp file");
        f.write_all(buf.get_ref()).expect("failed to write PNG bytes");
    }

    #[test]
    fn test_transform_valid_no_rotation() {
        let path = std::env::temp_dir().join("duplexpic_test_no_rot.png");
        write_png_to(&path, 100, 50);

        let result = transform_image(path.to_string_lossy().to_string(), 0, false);
        assert!(result.is_ok(), "Expected Ok, got Err: {:?}", result.err());
        let data_url = result.unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"), "Expected PNG data URL prefix");
        assert!(data_url.len() > 30, "Data URL too short");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_rotate_90_mirrored() {
        let path = std::env::temp_dir().join("duplexpic_test_rot90_mirr.png");
        write_png_to(&path, 100, 50);

        let result = transform_image(path.to_string_lossy().to_string(), 90, true);
        assert!(result.is_ok(), "Expected Ok, got Err: {:?}", result.err());
        let data_url = result.unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"), "Expected PNG data URL prefix");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_rotate_180() {
        let path = std::env::temp_dir().join("duplexpic_test_rot180.png");
        write_png_to(&path, 100, 50);

        let result = transform_image(path.to_string_lossy().to_string(), 180, false);
        assert!(result.is_ok(), "Expected Ok, got Err: {:?}", result.err());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_rotate_270() {
        let path = std::env::temp_dir().join("duplexpic_test_rot270.png");
        write_png_to(&path, 100, 50);

        let result = transform_image(path.to_string_lossy().to_string(), 270, false);
        assert!(result.is_ok(), "Expected Ok, got Err: {:?}", result.err());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_non_existent_path() {
        let path = std::env::temp_dir().join("duplexpic_test_nonexistent.png");
        // Ensure file does NOT exist
        let _ = std::fs::remove_file(&path);

        let result = transform_image(path.to_string_lossy().to_string(), 0, false);
        assert!(result.is_err(), "Expected Err for non-existent path");
        let err = result.err().unwrap();
        assert!(err.contains("Error opening image"), "Unexpected error: {}", err);
    }

    #[test]
    fn test_transform_invalid_rotation() {
        let path = std::env::temp_dir().join("duplexpic_test_invrot.png");
        write_png_to(&path, 100, 50);

        let result = transform_image(path.to_string_lossy().to_string(), 45, false);
        assert!(result.is_err(), "Expected Err for rotation=45");
        assert_eq!(
            result.err().unwrap(),
            "rotation must be 0, 90, 180, or 270"
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_corrupt_file() {
        let path = std::env::temp_dir().join("duplexpic_test_corrupt.png");
        let mut f = std::fs::File::create(&path).expect("failed to create temp file");
        f.write_all(b"this is not a valid image file").expect("write failed");
        drop(f);

        let result = transform_image(path.to_string_lossy().to_string(), 0, false);
        assert!(result.is_err(), "Expected Err for corrupt file");
        let err = result.err().unwrap();
        assert!(err.contains("Error opening image"), "Unexpected error: {}", err);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_transform_normalizes_rotation_mod_360() {
        let path = std::env::temp_dir().join("duplexpic_test_mod360.png");
        write_png_to(&path, 100, 50);

        // 450 = 90 mod 360 — should work as rotation=90
        let result = transform_image(path.to_string_lossy().to_string(), 450, false);
        assert!(result.is_ok(), "Expected Ok for rotation=450 (90 mod 360)");

        let _ = std::fs::remove_file(&path);
    }
}
