# Design: Rust Print Composition

## Technical Approach

Replace CSS-based `window.print()` with a Rust-native `compose_print` Tauri command that composites both slot images onto an A4 canvas at configurable DPI, embeds into a PDF via `printpdf`, and spawns system print via PowerShell. A preview path returns the composite as a base64 PNG for frontend display. Composition is extracted into a dedicated `print/` module behind `lib.rs`.

## Architecture Decisions

### Decision: Module extraction vs. inline in lib.rs

| Option | Tradeoff | Decision |
|--------|----------|----------|
| All in `lib.rs` | Simple now, but ~400+ lines; breaks existing pattern |
| **New `print/` module** | Clean separation, testable in isolation, matches growth direction | **Adopt** — `print/mod.rs` as public facade |

### Decision: In-memory composition vs. layered printpdf approach

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Embed each image as separate PDF layer | More flexible, but printer drivers may misalign layers |
| **Composite pixels first, embed single image** | WYSIWYG, one image in PDF = predictable output | **Adopt** — compose the full A4 canvas in `image` crate first, then embed once |

### Decision: Preview vs. Print as one command

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Two commands (`compose_preview`, `compose_print`) | Duplicates composition logic |
| **One command with `mode` param** | Shared composition path, switch on mode at final step | **Adopt** — `mode: "preview"` returns PNG, `mode: "print"` writes PDF + spawns print |

## Data Flow

```
User clicks "Print" / "Preview"
        │
        ▼
Frontend: invoke('compose_print', payload)
        │
        ▼
lib.rs: compose_print()
  ├── validate_inputs() → DPI, paths, orientation
  ├── new A4Canvas(dpi, orientation)
  │     └── mm_to_px(margins, gutter)
  ├── for each slot:
  │     ├── image::open() → DynamicImage
  │     ├── apply rotation & mirror
  │     ├── compute slot bounding box
  │     ├── scale to fit (contain/fill/cover)
  │     └── composite onto canvas
  ├── if mode == "preview":
  │     └── encode canvas → PNG → base64 → return
  └── if mode == "print":
        ├── build PdfDocument (RGB)
        ├── embed canvas as single image
        ├── write to temp file
        ├── spawn "powershell Start-Process -Verb Print"
        └── return { ok: true }
```

## Module Structure

```
src-tauri/src/
├── lib.rs                  # compose_print command, existing commands, run()
├── print/
│   ├── mod.rs              # Public API: compose_and_preview(), compose_and_print()
│   ├── composition.rs      # A4Canvas, bbox calc, fitMode scale, mm→px
│   ├── pdf.rs              # PdfDocumentBuilder — page, image embed
│   └── error.rs            # PrintError enum → String for Tauri IPC
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | Modify | Add `printpdf` dependency |
| `src-tauri/src/lib.rs` | Modify | Add `compose_print` command, register in `invoke_handler`, add `print` module |
| `src-tauri/src/print/mod.rs` | Create | Public facade: `compose_preview()`, `compose_print()` |
| `src-tauri/src/print/composition.rs` | Create | `A4Canvas` struct, bounding box logic, fitMode implementations |
| `src-tauri/src/print/pdf.rs` | Create | PDF builder wrapping `printpdf` with RGB/CMYK support |
| `src-tauri/src/print/error.rs` | Create | `PrintError` enum with spec-coded variants |
| `src/modules/state.js` | Modify | Add `dpi`, `printPreviewMode`, `composedUrl` |
| `src/modules/controls.js` | Modify | Replace `window.print()` with `invoke('compose_print', ...)` |
| `src/modules/properties.js` | Modify | Add print tab with DPI slider, preview/print buttons |
| `src/modules/sidebar.js` | Modify | Register "print" tab in nav |
| `src/index.html` | Modify | Add `#tab-print` pane with DPI controller, buttons |
| `src/styles.css` | Modify | Styling for print tab controls and preview overlay |

## Interfaces

### Rust — Tauri command contract

```rust
#[derive(Deserialize)]
struct ComposeInput {
    slot_top: String,         // absolute path
    slot_bottom: String,
    margins: Margins,         // { top, bottom, left, right, gutter } in mm
    orientation: String,      // "portrait" | "landscape"
    fit_top: String,          // "contain" | "fill" | "cover"
    fit_bottom: String,
    rotate_top: u32,          // 0 | 90 | 180 | 270
    rotate_bottom: u32,
    mirror_top: bool,
    mirror_bottom: bool,
    dpi: u16,                 // 150 | 300 | 600
    mode: String,             // "preview" | "print"
}

#[derive(Serialize)]
struct ComposeResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview: Option<String>,  // data:image/png;base64,...
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}
```

### A4Canvas

```rust
struct A4Canvas {
    dpi: u16,
    width_px: u32,
    height_px: u32,
    buffer: RgbaImage,
}

impl A4Canvas {
    fn new(dpi: u16, orientation: &str) -> Self;
    fn mm_to_px(&self, mm: f64) -> u32;
    fn slot_bbox(&self, slot: &str, margins: &Margins) -> Rect;
    fn composite(&mut self, slot: &str, image: &DynamicImage, fit_mode: &str, rotation: u32, mirrored: bool, margins: &Margins);
    fn as_rgba(&self) -> &[u8];        // raw RGBA bytes for PDF
    fn encode_png(&self) -> Vec<u8>;   // for preview
}
```

### PrintError variants

| Code | Variant | Condition |
|------|---------|-----------|
| `IMAGE_NOT_FOUND` | `ImageNotFound(String)` | `fs::metadata()` fails on slot path |
| `IMAGE_DECODE_FAIL` | `ImageDecode(String)` | `image::open()` returns error |
| `COMPOSITION_FAIL` | `Composition(String)` | Pixel math error (resize/crop) |
| `PDF_GENERATION_FAIL` | `Pdf(String)` | `printpdf` or temp file write failure |
| `PRINT_SPAWN_FAIL` | `PrintSpawn(String)` | PowerShell `Start-Process` fails |
| `DPI_UNSUPPORTED` | `DpiUnsupported(u16)` | DPI not 150/300/600 |

## Key Algorithms

### Slot bounding box (portrait)

```rust
fn slot_bbox(&self, slot: &str, margins: &Margins) -> Rect {
    let top = self.mm_to_px(margins.top);
    let bottom = self.mm_to_px(margins.bottom);
    let left = self.mm_to_px(margins.left);
    let right = self.mm_to_px(margins.right);
    let gutter = self.mm_to_px(margins.gutter);

    let inner_w = self.width_px.saturating_sub(left + right);
    let inner_h = self.height_px.saturating_sub(top + bottom);
    let slot_h = (inner_h.saturating_sub(gutter)) / 2;

    match slot {
        "top" => Rect {
            x: left, y: top,
            w: inner_w, h: slot_h,
        },
        "bottom" => Rect {
            x: left, y: top + slot_h + gutter,
            w: inner_w, h: slot_h,
        },
        _ => unreachable!(),
    }
}
```

For landscape: same calculation but slots are side-by-side — `slot_w = (inner_w - gutter) / 2`, first slot x = left, second slot x = left + slot_w + gutter.

### fitMode `contain` (letterbox)

Resize image proportionally to fit **within** slot bounds. Place centered. Fill remaining with white (255,255,255).

```rust
fn fit_contain(image: &DynamicImage, bbox: &Rect) -> RgbaImage {
    let ratio = (bbox.w as f64 / image.width() as f64)
        .min(bbox.h as f64 / image.height() as f64);
    let new_w = (image.width() as f64 * ratio).round() as u32;
    let new_h = (image.height() as f64 * ratio).round() as u32;
    let resized = image.resize_exact(new_w, new_h, image::imageops::Lanczos3);
    // paste centered onto white canvas of bbox size
    image::imageops::paste(&mut white_canvas, &resized, ox, oy);
}
```

### fitMode `fill` (stretch)

```rust
fn fit_fill(image: &DynamicImage, bbox: &Rect) -> RgbaImage {
    image.resize_exact(bbox.w, bbox.h, image::imageops::Lanczos3).to_rgba8()
}
```

### fitMode `cover` (crop)

```rust
fn fit_cover(image: &DynamicImage, bbox: &Rect) -> RgbaImage {
    let ratio = (bbox.w as f64 / image.width() as f64)
        .max(bbox.h as f64 / image.height() as f64);
    let new_w = (image.width() as f64 * ratio).round() as u32;
    let new_h = (image.height() as f64 * ratio).round() as u32;
    let resized = image.resize_exact(new_w, new_h, image::imageops::Lanczos3);
    // crop center to bbox size
    image::imageops::crop(&mut resized, cx, cy, bbox.w, bbox.h).to_image()
}
```

### DPI-dependent dimensions

```
A4 portrait:  width_px = round(210 * dpi / 25.4)
              height_px = round(297 * dpi / 25.4)
A4 landscape: width_px = round(297 * dpi / 25.4)
              height_px = round(210 * dpi / 25.4)
```

At 300 DPI: 2480×3508 (portrait), 3508×2480 (landscape).

## Printpdf Integration

- **RGB path**: Build `RawImage` with RGBA8 pixel data from composited canvas, add via `doc.add_image(&image)`
- **Output**: write document bytes to temp file via `doc.save_writer(&mut file, &options, warnings)`
- **Future CMYK**: Will use `lopdf` to produce true `/DeviceCMYK` PDFs (see tech-debt.md)
- **Print spawn**: `std::process::Command::new("powershell").args(["-Command", "Start-Process", "-FilePath", &temp_path, "-Verb", "Print"])`

## Error Handling Strategy

- `print/error.rs` defines `PrintError` enum with spec-coded variants.
- Each variant implements `Display` and `Into<tauri::InvokeError>`.
- The `compose_print` command returns `Result<ComposeResult, String>` — the `String` maps from `PrintError`.
- Frontend receives `{ ok: false, error: "...", code: "DIP_UNSUPPORTED" }` and shows the code + message in a toast or inline error.

## Performance Considerations

| Concern | Strategy |
|---------|----------|
| 600 DPI = 4960×7016 px canvas | ~139 MB RGBA in memory. Acceptable for desktop. |
| Large source images > canvas | Downscale source before composite: decode at max (canvas dimensions + margin) |
| IPC payload (preview PNG) | For 300 DPI, PNG is ~3-6 MB. Acceptable. For 600 DPI, ~15-20 MB — **use temp file path instead of inline base64** |
| Temp file cleanup | Use `tempfile::Builder` with auto-clean; catch `Drop` to delete print PDF after spawn |

For preview at 600 DPI, we could downsample the preview PNG to 300 DPI equivalent (the preview is on-screen, not printed — 300 DPI is more than enough for display).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `mm_to_px` | Table-driven: known mm + DPI → expected px |
| Unit | `slot_bbox` | Portrait + landscape, with/without margins/gutter |
| Unit | `fit_contain`, `fit_fill`, `fit_cover` | Known input sizes → expected output dimensions |
| Unit | `rgba_to_cmyk` | White, black, pure red → known CMYK values |
| Unit | DPI validation | 150/300/600 OK, 200 → `DPI_UNSUPPORTED` |
| Unit | Error paths | Missing file → `IMAGE_NOT_FOUND`, corrupt → `IMAGE_DECODE_FAIL` |
| Integration | PNG preview output | `compose_preview` → valid PNG (check magic bytes) |
| Integration | PDF output | `compose_print` → valid PDF (check `%PDF` header, page count = 1) |


All tests live in `src-tauri/src/print/` alongside source files. Use `tempfile::TempDir` for temp file cleanup, matching the existing `std::env::temp_dir()` pattern from `lib.rs` tests.

## Open Questions

- [x] Preview at 600 DPI: **downsampled to 300 DPI** for preview, full resolution for PDF — resolved during implementation
- [ ] Temp file cleanup timing: `Start-Process -Verb Print` is async — deleting the temp file immediately would break the print. See tech-debt.md for deferred cleanup strategy.
