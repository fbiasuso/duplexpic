# Design: Rust Pixel Transforms

## Technical Approach

Move rotation and mirror from CSS `transform` to Rust pixel-level operations using the `image` crate. The frontend caches transformed results as base64 data URLs in a new `SlotConfig.transformedUrl` field. The WebView2 context menu is suppressed at the host level via `tauri-plugin-prevent-default` with `Flags::CONTEXT_MENU`.

## Architecture Decisions

### Decision: Transform order (rotation THEN mirror)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Rotate then mirror | Matches spatial expectation: object rotates around its center, then flips horizontally | **Adopted** |
| Mirror then rotate | Produces different visual result for certain compositions | Rejected — deterministic order is the requirement per spec E-02 |

The fixed order guarantees that any sequence of user operations produces the same pixel output (mirror-first-then-rotate vs rotate-first-then-mirror converge).

### Decision: Cache invalidation strategy

Invalidate `transformedUrl` to `null` inside `state.js` `setRotation()` and `setMirrored()` — the same setters that already call `_notify`. This keeps cache logic co-located with state mutation. `renderSlot()` only invokes Rust when `transformedUrl === null`.

### Decision: Always call `transform_image` on load (no first-load shortcut)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Always invoke | Single code path, negligible cost for small files | **Adopted** |
| Skip if rot=0, mirr=false | Saves one invoke on initial load but branches the render path | Rejected — complexity not worth the marginal gain |

### Decision: Context menu suppression at host (not JS)

`tauri-plugin-prevent-default` hooks WebView2's `ICoreWebView2Controller` at the COM level — the native menu never instantiates. JS `contextmenu` listener remains for custom file-dialog behavior (plugin only suppresses the native menu, not the DOM event).

## Data Flow

```
rotate/mirror click
       │
       ▼
controls.js → appState.setRotation() / setMirrored()
                    │
                    ├─ set transformedUrl = null (invalidate)
                    └─ _notify() → app.js listener → renderSlot()
                                                         │
                                                         ├─ transformedUrl !== null? → set img.src, skip invoke
                                                         └─ transformedUrl === null? → invoke('transform_image')
                                                                                              │
                                                                                              ▼
                                                                                       lib.rs: transform_image()
                                                                                         image::open() → rotate90/180/270
                                                                                         → fliph() → encode PNG → base64
                                                                                              │
                                                                                              ▼
                                                                                       canvas.js stores in transformedUrl
                                                                                       img.src = transformedUrl
                                                                                       (no CSS transform property)
```

Swap exchanges entire `SlotConfig` objects (including `transformedUrl`) — zero Rust calls.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | Modify | Add `tauri-plugin-prevent-default` dep with `unstable-windows` feature |
| `src-tauri/src/lib.rs` | Modify | Add `transform_image` command + register prevent-default plugin + expose in handler |
| `src-tauri/capabilities/default.json` | Modify | Add `"prevent-default:default"` permission |
| `src/modules/state.js` | Modify | `SlotConfig`: add `transformedUrl` field + null it in `setRotation`/`setMirrored` + update `clone()` |
| `src/modules/canvas.js` | Modify | `renderSlot`: check cache → invoke if needed → drop CSS `transform` for rot/mirror |
| `src/modules/controls.js` | Modify | Remove CSS-transform-related logic (none currently, just verify) |
| `src/styles.css` | Modify | Remove `.slot-image` CSS `transform` rules (if any) — verify `transform-origin` stays |

## Interfaces / Contracts

### Rust command (lib.rs)

```rust
#[tauri::command]
fn transform_image(path: String, rotation: u32, mirrored: bool) -> Result<String, String>
```

- **Input**: `path` — absolute filesystem path to image; `rotation` — 0, 90, 180, or 270; `mirrored` — horizontal flip flag
- **Output**: `data:image/png;base64,...` string on success, `Err(String)` on failure
- **Error cases**: file not found, decode failure (corrupt/unrecognized), invalid rotation value, PNG encode failure
- **Transform order**: decode → rotate (clockwise) → mirror (horizontal flip) → encode PNG → base64

### State shape (state.js)

```javascript
class SlotConfig {
    imagePath: string | null;
    rotation: number;       // 0 | 90 | 180 | 270
    mirrored: boolean;
    fitMode: 'cover' | 'contain' | 'fill';
    transformedUrl: string | null;  // data URL cache
}
```

### Cache lifecycle

| Event | `transformedUrl` action |
|-------|------------------------|
| `setImage(path)` | Set to `null` (new `SlotConfig`) |
| `setRotation(n)` | Set to `null` (explicit) |
| `setMirrored(b)` | Set to `null` (explicit) |
| `swap()` | Copied intact as part of `SlotConfig.clone()` |
| `clearSlot(slot)` | Set to `null` (new `SlotConfig`) |
| After `invoke` resolves | Set to returned data URL string |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Rust unit | `transform_image` with valid/invalid paths, rotation values, corrupt images | `#[cfg(test)]` in `lib.rs` — test binary output prefix, error messages |
| Frontend unit | Cache invalidation on rotation/mirror change, swap copies URL | `state.js` module tests (plain JS, no DOM) |
| Integration | `renderSlot` invokes on cache miss, skips on cache hit `tauri-plugin-prevent-default` is registered | Verify via `tauri::Builder` plugin chain; front-end mock invoke |
| Manual | Context menu never appears; print CSS unchanged | Manual test with right-click everywhere; print preview |

## Migration / Rollout

No migration required. All state is ephemeral (in-memory JS). Existing `renderSlot` signature unchanged — only internal logic changes. The `read_image` command remains available (not removed) for backward compatibility during transition.

## Open Questions

- None.
