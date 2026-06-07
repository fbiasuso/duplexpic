# Decision: Mirror — CSS in Edit View, Rust in Print

## Status

**Accepted** — 2026-06-07. Do not change.

## Context

The mirror (horizontal flip) feature needs to work in two contexts:

1. **Edit view**: user sees the image mirrored while editing
2. **Print output**: the printed result must have mirror baked into pixels

Two approaches exist:

- **A**: Apply mirror via Rust `transform_image` in both edit and print, using only CSS `transform` for the toolbar animation
- **B**: Apply mirror as CSS `scale(-1, 1)` in edit view (with animation), and apply `img.fliph()` in Rust only during `compose_print`

## Decision

**Adopt approach B**: CSS for edit, Rust for print.

## Rationale

1. **Animation quality**: The CSS mirror has a smooth card-flip animation (`mirror-flip-on`/`mirror-flip-off` keyframes) that would be lost if we replaced the pixel buffer. The animation is important UX — the user sees a satisfying flip rather than an instant swap.
2. **Correct print output**: `compose_print` receives `mirror_top: bool` and `mirror_bottom: bool` from the frontend. In `composite_slot()` (`print/composition.rs:279-281`):
   ```rust
   if mirrored {
       img = img.fliph();
   }
   ```
   This bakes the mirror into pixels before compositing onto the A4 canvas. The PDF always has the mirror correctly applied.
3. **Separation of concerns**: Edit is CSS (declarative, animated, GPU-composited). Print is Rust (deterministic, pixel-accurate, driver-independent).

## Consequences

- The edit view shows a CSS-transformed version; the print preview (via `compose_preview`) shows the Rust-composited version. They should match visually, but the edit version has the animation benefit.
- If someone later removes the CSS mirror, print mirror still works independently.
- The `transform_image` Rust command also accepts `mirrored: bool` and applies `fliph()` — this is used by the existing "save/export" path but not by edit view rendering. Both paths coexist.

## Related Code

- Edit CSS mirror: `src/styles.css` — `.mirror-flip-on`/`.mirror-flip-off` keyframes
- Edit CSS transform: `src/modules/canvas.js` — applies `scale(-1, 1)` via CSS
- Rust print mirror: `src-tauri/src/print/composition.rs` — `composite_slot()` applies `img.fliph()`
- Rust transform command: `src-tauri/src/lib.rs` — `transform_image()` also applies `fliph()` if `mirrored: true`
