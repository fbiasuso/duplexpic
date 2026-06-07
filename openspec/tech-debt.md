# Technical Debt Register

## TD-001: True CMYK /DeviceCMYK support via lopdf

**Status**: Open  
**Reported**: 2026-06-07  
**Priority**: Low  
**Effort**: Medium (~2-3 days)

### Problem

`printpdf` 0.9.x does not support `RawImageFormat::Cmyk`. When the user toggles CMYK, we convert RGB pixels to CMYK values mathematically but store them in an RGBA8 container. The PDF declares RGB color space even though the pixel values are CMYK-correct. Professional color printers expect `/DeviceCMYK` color space for accurate color reproduction.

A `rgba_to_cmyk()` function exists in `src-tauri/src/print/pdf.rs` (tested, `#[allow(dead_code)]`) ready for future use.

### Solution

Replace `printpdf` PDF generation with `lopdf` when CMYK is needed:

1. Add `lopdf` crate to Cargo.toml
2. Build PDF manually with:
   - `/ColorSpace /DeviceCMYK` in the image dictionary
   - Raw CMYK pixel data (4 bytes per pixel: C, M, Y, K)
3. For RGB path, keep `printpdf` as-is (simpler, works well)

### Acceptance Criteria

- [ ] PDF with `cmyk: true` contains `/ColorSpace /DeviceCMYK`
- [ ] PDF opens correctly in Adobe Acrobat / professional RIP software
- [ ] RGB path unchanged (still uses printpdf)

---

## TD-002: Temp PDF file cleanup after async print

**Status**: Open  
**Reported**: 2026-06-07  
**Priority**: Low  
**Effort**: Small (~half day)

### Problem

`Start-Process -Verb Print` is asynchronous — it opens the Windows print dialog and returns immediately. If we delete the temp PDF file right after the spawn call, the printer driver reads an empty file and the print job fails.

Currently, temp PDFs accumulate in `%TEMP%` with names like `duplexpic_*.pdf`. Windows eventually cleans these up via disk cleanup, but they linger.

### Solution

Use Windows API `FILE_FLAG_DELETE_ON_CLOSE` via `CreateFileW` to schedule deletion when the file handle closes. Or spawn a background thread that waits 30 seconds before deleting.

### Option A: Background deletion thread (simpler)

```rust
let temp_path = save_to_temp(&doc)?;
let weak = Arc::new(temp_path.clone());
std::thread::spawn(move || {
    std::thread::sleep(std::time::Duration::from_secs(30));
    let _ = std::fs::remove_file(&weak);
});
PdfDocumentBuilder::spawn_print(&temp_path)?;
```

### Option B: Windows FILE_FLAG_DELETE_ON_CLOSE (more robust)

Use `windows-sys` or raw Win32 FFI to create the temp file with `FILE_FLAG_DELETE_ON_CLOSE`. The OS deletes it automatically when the last handle is closed (after the print spooler reads it).

### Acceptance Criteria

- [ ] No temp PDF files left behind after print completes
- [ ] Print still works (file exists long enough for the driver)
- [ ] Cross-platform safe (the Windows-only solution degrades gracefully)
