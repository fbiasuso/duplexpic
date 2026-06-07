# Proposal: Rust Pixel Transforms

## Intent

CSS `transform: rotate(Xdeg) scaleX(-1)` rotates the visual rendering, but `object-fit` still computes against the *original* pixel orientation. Rotate 90° + "fill" mode stretches the wrong axis. The WebView2 context menu also persists despite JS `preventDefault`.

Move rotation and mirror to Rust (image crate, already in deps) at the pixel level, cache the result as a data URL, and suppress the context menu via the WebView2 host, not JS.

## Scope

### In Scope
- Rust command `transform_image(path, rotation, mirrored) → data_url`
- `SlotConfig.transformedUrl` field for caching
- Frontend calls Rust for rotation/mirror, drops CSS transforms for those ops
- `tauri-plugin-prevent-default` to kill context menu at WebView2 level
- Swap becomes instant (swaps cached data URLs)

### Out of Scope
- No new image operations (crop, resize, filters)
- No PDF generation
- No multi-page or batch printing
- No print path changes — `window.print()` still works as before

## Capabilities

### New Capabilities
- `image-transforms`: Pixel-level rotation (0/90/180/270) and horizontal mirror via the `image` crate, returned as base64 PNG data URL
- `context-menu`: Suppress WebView2 context menu at the host level via `tauri-plugin-prevent-default`

### Modified Capabilities
- None

## Approach

### Architecture

The A4 canvas renders two `<img>` elements. Currently, each img applies CSS `transform` + `object-fit`. The new flow:

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  User    │     │  Frontend    │     │  Rust    │
│ clicks   │────>│ AppState     │────>│ transform│
│ rotate/  │     │ sets rot/    │     │ _image   │
│ mirror   │     │ mirror,      │     │ (image   │
│          │     │ calls invoke │     │  crate)  │
└──────────┘     └──────────────┘     └──────────┘
                       │                    │
                       ▼                    ▼
                 ┌──────────────┐    decode, rotate,
                 │ SlotConfig   │    flip, encode
                 │ .transformed │    to PNG base64
                 │ Url (cached) │
                 └──────────────┘
                       │
                       ▼
                 ┌──────────────┐
                 │ <img src=    │
                 │ transformed  │
                 │ Url>         │
                 │ no CSS       │
                 │ transform    │
                 └──────────────┘
```

### Caching Strategy

- `SlotConfig` gains `transformedUrl: string | null`
- Set to `null` on `imagePath` change; re-computed on next render
- Re-computed only when `rotation` or `mirrored` changes after a load
- Swap copies the cached URL — zero Rust calls
- **Tradeoff**: data URLs are large (RAM). Only 2 slots → ~20-40 MB peak. Acceptable. Could switch to blob URLs later.

### Context Menu Fix

Add `tauri-plugin-prevent-default` to `Cargo.toml`. Register with `Flags::CONTEXT_MENU` only. The plugin hooks the WebView2 `ICoreWebView2Controller` and suppresses the native context menu at the COM level — no JS event handling needed.

```rust
// src-tauri/src/lib.rs
.plugin(
    tauri_plugin_prevent_default::Builder::new()
        .with_flags(tauri_plugin_prevent_default::Flags::CONTEXT_MENU)
        .build()
)
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/lib.rs` | Modified | Add `transform_image` command + prevent-default plugin |
| `src-tauri/Cargo.toml` | Modified | Add `tauri-plugin-prevent-default` dep |
| `src-tauri/capabilities/default.json` | Modified | Add permission for prevent-default |
| `src/modules/state.js` | Modified | `SlotConfig` gains `transformedUrl` field |
| `src/modules/canvas.js` | Modified | Render uses `transformedUrl` instead of CSS transforms |
| `src/modules/controls.js` | Modified | After rotate/mirror, wait for invoke result before notify |
| `src/modules/fileLoader.js` | — | Unchanged (path still stored) |
| `src/styles.css` | — | CSS transform/contextmenu rules may be removed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large images block UI during transform | Medium | Run in async Tauri command (already async from JS). Could add loading spinner if needed. |
| Data URL memory overhead | Low | Only 2 slots. ~10-20 MB peak. |
| `tauri-plugin-prevent-default` Windows compat | Low | Plugin requires `unstable-windows` feature. Verified working on WebView2. |
| Print breaks because no CSS transform | Low | `object-fit` still works on pixel-transformed image. Print CSS unchanged. |

## Rollback Plan

1. Revert `src-tauri/Cargo.toml` — remove `tauri-plugin-prevent-default`
2. Revert `src-tauri/src/lib.rs` — remove the command and plugin registration
3. Revert `src/modules/state.js` — remove `transformedUrl`
4. Revert `src/modules/canvas.js` and `controls.js` — restore CSS transform path
5. Revert capabilities JSON

## Dependencies

- `image = "0.25"` — already in `Cargo.toml` (unused)
- `tauri-plugin-prevent-default` — needs `unstable-windows` feature for Windows

## Success Criteria

- [ ] Rotate 90° + "fill" mode stretches the rotated orientation, not the original
- [ ] Mirror flips pixel data — `img.src` alone renders correctly without CSS transform
- [ ] Context menu never appears anywhere in the app window
- [ ] Swap between top/bottom is instant (< 16ms perceived, no Rust call needed)
- [ ] All existing print CSS still produces correct A4 output
