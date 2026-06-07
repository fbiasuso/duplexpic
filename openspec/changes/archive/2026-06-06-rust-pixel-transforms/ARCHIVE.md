# Archive: rust-pixel-transforms

**Archived**: 2026-06-06
**SDD Cycle**: Complete — fully implemented, verified, and closed.

---

## 1. Summary

Moved rotation and mirror from CSS `transform` to Rust pixel-level operations using the `image` crate (already in deps). The WebView2 context menu is suppressed at the host level via `tauri-plugin-prevent-default`. All transforms are cached as base64 data URLs in `SlotConfig.transformedUrl`, making swap instant (zero Rust calls).

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | Modified | Added `tauri-plugin-prevent-default` dep with `unstable-windows` feature |
| `src-tauri/src/lib.rs` | Modified | Added `transform_image` command (205 lines total including 8 tests), registered prevent-default plugin with `Flags::CONTEXT_MENU` |
| `src/modules/state.js` | Modified | `SlotConfig.transformedUrl` field, cache invalidation in `setRotation`/`setMirrored`, `clone()` copies the URL |
| `src/modules/canvas.js` | Modified | `renderSlot` checks cache → invoke on miss → drops CSS `transform`, stale-check guard for rapid clicks |
| `src/modules/controls.js` | Verified | No CSS-transform-related logic needed; actions unchanged |
| `src/styles.css` | Verified | No `transform` rule on `.slot-image`; `transform-origin` retained |
| `src-tauri/capabilities/default.json` | Verified | Prevent-default plugin works without explicit capability entry |

### Key Decisions

- **Transform order**: Rotate THEN mirror (deterministic — spec E-02)
- **Cache strategy**: `transformedUrl = null` in `setRotation`/`setMirrored`; `renderSlot` invokes Rust only on cache miss
- **Always invoke on load**: Single code path, no branching for rot=0/mirr=false
- **Context menu**: Host-level COM suppression via `tauri-plugin-prevent-default`; JS `contextmenu` listener preserved for file dialog
- **Swap**: Copies `SlotConfig` objects including cached URL — zero Rust calls

---

## 2. Acceptance Criteria — All PASS

| ID | Criterion | Status | Verification Method |
|----|-----------|--------|-------------------|
| AC-01 | `transform_image` returns valid `data:image/png;base64,...` for JPG with rot=90, mirr=false | ✅ PASS | Rust unit test `test_transform_rotate_90_mirrored` |
| AC-02 | `transform_image` returns error for invalid path | ✅ PASS | Rust unit test `test_transform_non_existent_path` |
| AC-03 | `transform_image` returns error for rotation=45 | ✅ PASS | Rust unit test `test_transform_invalid_rotation` |
| AC-04 | `<img>` has no `transform` CSS property after rotate | ✅ PASS | Code review: no `style.transform` set in `canvas.js`; no `.slot-image` transform rule |
| AC-05 | Rotate 90° + fill mode respects rotated orientation | ✅ PASS | Visual: pixel-rotated dimensions match `object-fit` correctly |
| AC-06 | Mirror flips pixel data correctly | ✅ PASS | Visual: text/arrows mirrored at pixel level |
| AC-07 | Swap is instant (<16ms, zero invoke calls) | ✅ PASS | Cached URLs exchanged; confirmed no Rust calls during swap |
| AC-08 | Four 90° rotates return to original | ✅ PASS | `rotation % 360` logic verified; visual confirm |
| AC-09 | No native context menu anywhere | ✅ PASS | Manual: right-click on slots, toolbar, canvas, empty space |
| AC-10 | Right-click on empty slot opens file dialog | ✅ PASS | Manual: custom JS handler fires despite host-level suppression |
| AC-11 | Clear sets `transformedUrl` to null and `src` to empty | ✅ PASS | Code review of `state.js` `clearSlot`, `canvas.js` `clearSlot` |
| AC-12 | `@media print` CSS produces correct A4 output | ✅ PASS | Print preview: 50/50 split, no regression |
| AC-13 | `cargo tauri build` succeeds without warnings | ✅ PASS | Build verified |
| AC-14 | `Flags::CONTEXT_MENU` only (no other flags) | ✅ PASS | Code review of `lib.rs` line 77 |

---

## 3. Stale-Checkbox Reconciliation

Task **3.2** (manual verification against AC-01 through AC-14) was `[ ]` unchecked in the persisted tasks artifact because the `sdd-apply` cycle did not mark it. At archive time, the orchestrator confirmed the change is "complete and verified manually by the user" with detailed evidence of all features working. The checkbox has been reconciled to `[x]` in the archived `tasks.md` as an exceptional mechanical correction backed by the orchestrator's explicit confirmation.

---

## 4. Known Limitations & Future Work

### Current Limitations
- **Data URL memory**: Two data URLs in RAM (~20-40 MB peak for typical images). Acceptable for the 2-slot use case.
- **No loading indicator**: Large images block the UI briefly during transform (<500ms for 10 MP per spec). A loading spinner could be added if needed.
- **Windows-only context menu suppression**: `tauri-plugin-prevent-default` requires `unstable-windows` feature. Non-Windows platforms would need a different mechanism.
- **No `prevent-default:default` capability**: The plugin works correctly without an explicit capability entry in `default.json` (Tauri v2 permits plugins without capability registration). Not an issue, but worth documenting.

### Future Opportunities
- **Switch to blob URLs**: Replace base64 data URLs with blob URLs (`URL.createObjectURL`) to reduce memory overhead. Tradeoff: needs `canvas.toBlob()` or Rust returning binary bytes via IPC.
- **WebAssembly fallback**: For non-Windows platforms, `image` crate can compile to WASM and run the same transform logic in-browser.
- **Progress indicator**: Show a spinner overlay on the slot during transform for very large images.
- **Batch print / multi-page**: Out of scope for this change, but the pixel-transform foundation is ready.

---

## 5. Rollback Instructions

To fully revert this change:

1. **Revert `src-tauri/Cargo.toml`**: Remove `tauri-plugin-prevent-default` dependency line.
2. **Revert `src-tauri/src/lib.rs`**: Remove the `transform_image` function (lines 40-68) and all test code (lines 88-205). Remove the `.plugin(...)` registration for `tauri-plugin-prevent-default` from the `Builder` chain.
3. **Revert `src/modules/state.js`**: Remove `transformedUrl` from `SlotConfig` (constructor, `clone()`, `setRotation`, `setMirrored`).
4. **Revert `src/modules/canvas.js`**: Restore the old `renderSlot` that used CSS transforms and `buildTransformString`. Remove the `invoke('transform_image', ...)` call path.
5. **Revert `src/modules/controls.js`**: If any CSS-transform-related logic was removed, restore it (none existed before this change).
6. **Verify**: Run `cargo test` (should still pass without transform tests), `cargo tauri build`, and manual checks on rotate/mirror (should fall back to CSS transforms).

---

## 6. Artifacts

| Artifact | Path |
|----------|------|
| Proposal | `openspec/changes/archive/2026-06-06-rust-pixel-transforms/proposal.md` |
| Spec | `openspec/changes/archive/2026-06-06-rust-pixel-transforms/spec.md` |
| Design | `openspec/changes/archive/2026-06-06-rust-pixel-transforms/design.md` |
| Tasks | `openspec/changes/archive/2026-06-06-rust-pixel-transforms/tasks.md` |
| Archive | `openspec/changes/archive/2026-06-06-rust-pixel-transforms/ARCHIVE.md` (this file) |
