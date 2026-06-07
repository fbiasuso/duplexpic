# Proposal: Rust Print Composition

## Intent

Current print uses `window.print()` with `@media print` CSS. This breaks on many printer drivers (CSS transforms ignored, fitMode not respected, margins/gutter cosmetic only). Users get misaligned output or different results from what they see on screen. We need full Rust pipeline: compose images on an A4 canvas, embed in a PDF, and send directly to the system printer.

## Scope

### In Scope
- New Tauri command `compose_print` in `lib.rs` that produces:
  - An A4 PDF with all content embedded (no external dependencies for viewing)
  - Image composition with margins, gutter, rotations, mirrors, fitMode baked into pixels
- **PDF generation** via `printpdf` crate
- **Direct system print** via PowerShell `Start-Process -Verb Print` on the generated PDF
- **Configurable DPI** (150 / 300 / 600) — slider in sidebar
- ~~**Optional CMYK color space** toggle~~ → moved to tech-debt.md (requires lopdf for true /DeviceCMYK support)
- Frontend "Print Preview" mode showing the composed result via rasterized PNG preview
- Margins and gutter converted from mm to pixels based on selected DPI
- fitMode (`contain`/`fill`/`cover`) respected during pixel composition
- Rotations and mirrors baked into pixel data per slot
- Orientation (portrait/landscape) handled at composition level

### Out of Scope
- Bleed marks, crop marks, or registration marks
- Multi-page composition (always single A4 sheet)
- Automatic printer capability detection (driver color support, duplex, etc.)
- ICC color profiles (CMYK uses default `printpdf` profile)
- Print queue management (just opens print dialog with the PDF)

## Capabilities

### New Capabilities
- `print-composition`: Server-side A4 composition, PDF generation, and system print from two image slots with margins, gutter, fitMode, rotation, mirror, orientation, DPI, and CMYK options

### Modified Capabilities
- None

## Approach

### Backend (`src-tauri/src/lib.rs`)
New `compose_print` command accepting:
- `slot_top`, `slot_bottom`: paths to already-transformed images
- `margins`: `{ top, bottom, left, right, gutter }` in mm
- `orientation`: `"portrait"` | `"landscape"`
- `fit_top`, `fit_bottom`: `"contain"` | `"fill"` | `"cover"`
- `dpi`: `150` | `300` | `600`
- `cmyk`: `bool`

Algorithm:
1. Select DPI (pixel dimensions: 150 = 1240x1754, 300 = 2480x3508, 600 = 4960x7016 for portrait)
2. Convert margins/gutter to pixels: `mm * dpi / 25.4`
3. Create A4 canvas at selected DPI
4. Compute each slot bounding box (half the canvas minus margins/gutter)
5. For each slot: decode image → rotate → mirror → scale to fit per fitMode → composite onto canvas
6. **Preview path**: encode canvas as PNG → return `data:image/png;base64,..`
7. **Print path**: encode canvas into PDF via `printpdf` crate:
   - If `cmyk: true`, use CMYK color space in PDF (images converted from RGB to CMYK)
   - If `cmyk: false`, use RGB color space
   - Embed the composited image at full DPI
   - Write PDF to temp file
   - Spawn `powershell Start-Process -FilePath "path\to\temp.pdf" -Verb Print` (or `cmd /c start /print`)

### Frontend (`src/app.js`, `src/modules/`)
- **Print Preview mode**: toggle separate from edit view. When active, shows the PNG preview from Rust composition.
- Zoom is locked to "fit to canvas" in print preview mode.
- **Print button**: calls `compose_print` with print path (generates PDF + opens print dialog)
- **Preview button** (or auto-update on margin change): calls `compose_print` with preview path (returns PNG)
- **DPI / CMYK controls** added to the properties panel (visible in new print tab or existing margins tab)

### New Crate Dependencies
- `printpdf` — PDF generation with CMYK and RGB support
- (Optional) `windows` or PowerShell approach for print — no extra crate if using shell

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Preview mode | Separate toggle | Edit workflow unaffected; user compares before printing |
| Gutter | Vertical gap in portrait, horizontal in landscape | Part of margins struct; applied as pixel gap between slots |
| DPI | Configurable 150/300/600 slider | Higher DPI = quality vs file size tradeoff; user chooses |
| mm→px conversion | `mm * DPI / 25.4` at composition time | UI shows mm; conversion handles any DPI |
| FitMode impl | Scale image to slot bounds, then crop/pad | `contain` = letterbox, `fill` = stretch, `cover` = crop to fill |
| Zoom in preview | Locked to fit | Preview is WYSIWYG — zoom would misrepresent output size |
| CMYK | Removed from scope — kept as tech debt | Requires lopdf for true /DeviceCMYK; rgba_to_cmyk() function kept in code for future use |
| Print mechanism | `Start-Process -Verb Print` via PowerShell | Simple, no extra deps; opens print dialog with PDF |
| PDF vs direct spool | PDF intermediate | Lets user review before printing; works with any driver |
| CMYK default profile | `printpdf` built-in | No ICC profile management — good enough for home/office printing |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | **Modified** | Add `compose_print` command, PDF generation, print spooling |
| `src-tauri/Cargo.toml` | **Modified** | Add `printpdf` dependency |
| `src/modules/state.js` | **Modified** | Add `printPreviewMode`, `composedUrl`, `dpi`, `cmyk` fields |
| `src/modules/canvas.js` | **Modified** | Handle print preview rendering path |
| `src/modules/controls.js` | **Modified** | Update `print` action; add `apply-composition` action |
| `src/modules/properties.js` | **Modified** | Add DPI slider, CMYK toggle, print preview trigger |
| `src/modules/sidebar.js` | **Modified** | Add print tab or preview controls |
| `src/index.html` | **Modified** | Add DPI/CMYK controls, print preview target |
| `src/styles.css` | **Modified** | Print preview and controls styling |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large images cause OOM in Rust | Low | Resize source images before composition if > A4 at max DPI |
| Composed image too large for IPC | Medium | Temp file fallback for both preview and PDF |
| `printpdf` API incompatible with image crate types | Low | Convert `DynamicImage` to raw RGB/CYMK bytes for PDF embedding |
| PowerShell print command blocked by security policy | Low | Fallback: open PDF in system viewer for manual print |
| Landscape orientation in PDF flips page vs content | Low | Unit test + explicit page size setting in `printpdf` |

## Rollback Plan

1. Revert `lib.rs` to previous `invoke_handler` (remove `compose_print`)
2. Remove `printpdf` from `Cargo.toml`
3. Revert frontend state and module changes
4. Print falls back to `window.print()` CSS rendering (current behavior)

## Dependencies

- `image` crate at 0.25 (already present)
- `printpdf` — new dependency for PDF generation
- `base64` at 0.22 (already present)
- Test with: `cargo test`

## Success Criteria

- [ ] `compose_print` unit tests pass for both orientations, all fitModes, all DPI levels, with margins/gutter
- [ ] Generated PDF renders correctly in system PDF viewer (Adobe, Edge, etc.)
- [ ] Print preview shows exact pixel composition before sending to printer
- [ ] Printed output matches preview (measure with ruler — margins correct to ±1mm)
- [ ] No regression in existing image loading, rotation, mirror, swap, or clear operations
