use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
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
        .invoke_handler(tauri::generate_handler![read_image, transform_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

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
