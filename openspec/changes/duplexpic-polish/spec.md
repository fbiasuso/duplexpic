# Spec: duplexpic-polish

## Functional Requirements

### F-01: Context Menu Disabled
Right-click on any area of the webview must not show the browser context menu.

### F-02: Keyboard Reload Blocked
F5, Ctrl+R, and Ctrl+Shift+R must do nothing (no page reload, no devtools reload).

### F-03: Drag & Drop from OS File Manager
User can drag image files from Windows File Explorer (or any OS file manager) onto any `.slot` element. Supported extensions: png, jpg, jpeg, gif, bmp, webp.

### F-04: Visual Feedback on Drag Hover
When dragging a file over a `.slot`, a visual indicator (highlighted dashed border) must appear. The indicator must disappear when the drag leaves the slot.

### F-05: Correct Slot Loading
The dropped file must load into the exact slot that received the `drop` event. Same behavior as click-to-browse: image path stored via `appState.setImage()`, preview rendered via canvas module.

### F-06: Print CSS Verified
The existing `@media print` rules produce correct 50/50 split on A4. No visual artifacts, no empty placeholders showing, no toolbars visible.

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | Right-click shows no context menu | Manual: right-click anywhere → no menu |
| AC-02 | F5 / Ctrl+R do nothing | Manual: press F5, Ctrl+R → no reload |
| AC-03 | Drag image over slot shows visual feedback | Manual: drag file over `.slot` → border appears |
| AC-04 | Dropping image loads it in that slot | Manual: drop file → renders in correct slot |
| AC-05 | Click-to-browse still works | Manual: click empty slot → dialog opens → image loads |
| AC-06 | `cargo check` passes | Run `cargo check` in `src-tauri/` → 0 errors |

---

## Constraints

- All changes must be frontend-only. No Rust code modifications.
- Must not break existing click-to-browse (F-01 through F-05 are additive).
- Drag feedback must not interfere with toolbar hover states.
- @media print rules already exist; only verify, no changes unless a bug is found.
