# Tasks: Rust Pixel Transforms

Move rotation/mirror from CSS `transform` to Rust pixel-level ops (`image` crate). Cache as base64 data URLs in `SlotConfig.transformedUrl`. Suppress WebView2 context menu via `tauri-plugin-prevent-default`.

---

## Dependency Graph

```
1.1 ──┐
       ├──→ 1.3 ──→ 2.2 ──→ 2.3
1.2 ──┘       │        │
              │        └──→ 3.2
              └──→ 3.1
2.1 ──────────→ 2.2
```

## Phase 1: Rust Backend

- [x] **1.1** Add `tauri-plugin-prevent-default = { version = "2", features = ["unstable-windows"] }` to Cargo.toml. (~3 lines, deps: none, AC: `cargo check` passes)
- [x] **1.2** Add `"prevent-default:default"` to `default.json` permissions. (~3 lines, deps: none, AC: valid JSON)
- [x] **1.3** Implement `transform_image(path, rotation, mirrored) -> String` in lib.rs: `image::open()` → `rotate90/180/270` → `fliph()` → encode PNG → base64 data URL. Register `tauri-plugin-prevent-default` with `Flags::CONTEXT_MENU`. Append to `invoke_handler`. Keep `read_image`. (~45 lines, deps: 1.1, 1.2, AC: returns valid data URL for valid input, `Err` for corrupt/invalid)

## Phase 2: Frontend

- [x] **2.1** Add `transformedUrl: null` to `SlotConfig` constructor. Null it in `setRotation()` and `setMirrored()`. Update `clone()`. (~10 lines, deps: none, AC: field exists, null on mutation, copied on swap)
- [x] **2.2** Rewrite `renderSlot`: check `transformedUrl` — if null, `invoke('transform_image')`, store result, set `img.src`. If non-null, set `img.src` directly. Remove `buildTransformString`. No CSS `transform` set. `object-fit` from `config.fitMode` still applied. (~35 lines, deps: 1.3, 2.1, AC: no `style.transform`, cache hits skip invoke, swap copies URLs)
- [x] **2.3** Verify `.slot-image` has no CSS `transform` rule. Keep `transform-origin`. (~3 lines, deps: 2.2, AC: no transform rules)

## Phase 3: Testing

- [x] **3.1** Rust unit tests: valid path + rot=0, rot=90 + mirr=true, non-existent path, rotation=45, corrupt file. (~30 lines, deps: 1.3, AC: `cargo test` passes)
- [x] **3.2** Manual verification against AC-01 through AC-14: H-01–H-04, E-01–E-04, X-01–X-03. Context menu suppressed everywhere. Print CSS unaffected. (0 lines, deps: 2.2, 2.3, 3.1, AC: all acceptance criteria pass)

---

## Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 100 – 120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

Single PR — under 400 lines, 6 files, straightforward logic. Rust command is self-contained; frontend changes localized to `canvas.js`/`state.js`. `tauri-plugin-prevent-default` is a trivial dep+registration. No PR chain needed.
