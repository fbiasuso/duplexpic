use std::fmt;

/// Error types for the print composition pipeline.
///
/// Each variant maps to a spec-coded error code.
#[derive(Debug)]
pub enum PrintError {
    /// Image path does not exist on disk.
    ImageNotFound(String),
    /// Image file could not be decoded.
    ImageDecode(String),
    /// Pixel-level composition failure (resize, crop, etc.).
    Composition(String),
    /// PDF generation or temp file write failure.
    Pdf(String),
    /// System print spawn (PowerShell) failure.
    PrintSpawn(String),
    /// DPI value not supported (must be 150, 300, or 600).
    DpiUnsupported(u16),
    /// Validation failure (e.g. bad orientation, invalid fit mode).
    Validation(String),
    /// General I/O error.
    Io(std::io::Error),
}

impl fmt::Display for PrintError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PrintError::ImageNotFound(path) => write!(f, "IMAGE_NOT_FOUND: {}", path),
            PrintError::ImageDecode(msg) => write!(f, "IMAGE_DECODE_FAIL: {}", msg),
            PrintError::Composition(msg) => write!(f, "COMPOSITION_FAIL: {}", msg),
            PrintError::Pdf(msg) => write!(f, "PDF_GENERATION_FAIL: {}", msg),
            PrintError::PrintSpawn(msg) => write!(f, "PRINT_SPAWN_FAIL: {}", msg),
            PrintError::DpiUnsupported(dpi) => write!(f, "DPI_UNSUPPORTED: {} (must be 150, 300, or 600)", dpi),
            PrintError::Validation(msg) => write!(f, "VALIDATION_ERROR: {}", msg),
            PrintError::Io(err) => write!(f, "IO_ERROR: {}", err),
        }
    }
}

impl std::error::Error for PrintError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            PrintError::Io(err) => Some(err),
            _ => None,
        }
    }
}

impl From<std::io::Error> for PrintError {
    fn from(err: std::io::Error) -> Self {
        PrintError::Io(err)
    }
}

impl From<image::ImageError> for PrintError {
    fn from(err: image::ImageError) -> Self {
        PrintError::ImageDecode(err.to_string())
    }
}

/// Maps a `PrintError` to its spec error code string.
pub fn error_code(err: &PrintError) -> &'static str {
    match err {
        PrintError::ImageNotFound(_) => "IMAGE_NOT_FOUND",
        PrintError::ImageDecode(_) => "IMAGE_DECODE_FAIL",
        PrintError::Composition(_) => "COMPOSITION_FAIL",
        PrintError::Pdf(_) => "PDF_GENERATION_FAIL",
        PrintError::PrintSpawn(_) => "PRINT_SPAWN_FAIL",
        PrintError::DpiUnsupported(_) => "DPI_UNSUPPORTED",
        PrintError::Validation(_) => "VALIDATION_ERROR",
        PrintError::Io(_) => "IO_ERROR",
    }
}
