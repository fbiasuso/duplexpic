# Spec: duplexpic-image-controls

## 1. Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| F-01 | Each slot (top/bottom) must display a floating toolbar when it has an image loaded, with buttons for Rotate 90° CW, Mirror, Fit/Fill toggle, and Clear | P0 |
| F-02 | Rotate button applies a 90° clockwise rotation to the slot image via CSS `transform: rotate()`. Consecutive clicks accumulate (0→90→180→270→360→90...) | P0 |
| F-03 | Mirror button toggles a horizontal flip via CSS `transform: scaleX(-1)`. Can be combined with rotation | P0 |
| F-04 | Each slot has a Fit/Fill toggle: "Fit" uses `object-fit: contain` (image fully visible, possible letterboxing), "Fill" uses `object-fit: cover` (image fills slot, edges may crop). Default is Fill | P0 |
| F-05 | Clear button removes the image from that slot, resets all transforms, shows placeholder, and hides the per-slot toolbar | P0 |
| F-06 | A global toolbar below the canvas contains Swap, Print, and Clear All buttons | P0 |
| F-07 | Swap exchanges both images and their full transform state (rotation, mirror, fitMode) between top and bottom slots | P0 |
| F-08 | Clear All removes both images, resets all transform state, and shows both placeholders | P0 |
| F-09 | Print button calls `window.print()` — the `@media print` CSS must render images with their applied transforms (rotate + mirror) exactly as seen on screen | P0 |
| F-10 | Toolbar buttons must not trigger the slot's click handler (loading a new image). Use `event.stopPropagation()` on toolbar interactions | P0 |
| F-11 | Transforms must survive re-render cycles: if an image is swapped and swapped back, rotation/mirror state is preserved | P0 |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NF-01 | All image manipulation is CSS-only — no pixel-level processing in this phase |
| NF-02 | Toolbar must not overlap or obscure the image content beyond the toolbar's own footprint |
| NF-03 | Toolbar must be visually distinct from the image (semi-transparent background, subtle shadow) |
| NF-04 | Swap must be O(1) in terms of DOM operations — exchange state objects, not image data |
| NF-05 | Print output must reflect the composed transform state (rotated + mirrored) — not just the raw image |

## 2. User Stories / Scenarios

### US-01: Rotate an image
> As a user, I click the Rotate button on a slot and the image turns 90° clockwise.

**Scenario:**
1. User loads an image into the top slot
2. User clicks the Rotate 90° button in the top slot toolbar
3. Image rotates 90° CW in the preview
4. User clicks Rotate again → image rotates another 90° (180° total)
5. User clicks Rotate twice more → image returns to 0° orientation

### US-02: Mirror an image
> As a user, I click the Mirror button and the image flips horizontally.

**Scenario:**
1. User loads an image into the bottom slot
2. User clicks Mirror in the bottom slot toolbar
3. Image flips horizontally
4. User clicks Mirror again → image returns to original orientation

### US-03: Combine rotate + mirror
> As a user, I can rotate and mirror an image and both transforms apply simultaneously.

**Scenario:**
1. User loads an image into the top slot
2. User clicks Rotate twice (180°)
3. User clicks Mirror once
4. Image shows rotated 180° AND mirrored
5. User clicks Mirror again → mirror toggles off, rotation stays at 180°

### US-04: Toggle fit/fill
> As a user, I switch between Fit and Fill modes and see the image adjust.

**Scenario:**
1. User loads a portrait image into a landscape slot
2. Default is Fill (object-fit: cover) — image fills slot, edges cropped
3. User clicks Fit/Fill toggle
4. Image switches to Fit (object-fit: contain) — full image visible with letterboxing
5. User clicks toggle again → back to Fill

### US-05: Clear a single slot
> As a user, I remove an image from one slot without affecting the other.

**Scenario:**
1. User loads images in both slots
2. User clicks Clear on the top slot toolbar
3. Top slot image is removed, placeholder reappears
4. Bottom slot image remains unchanged
5. Top slot toolbar disappears

### US-06: Swap images between slots
> As a user, I click Swap and the images trade places with all their transforms.

**Scenario:**
1. Top slot: image A rotated 90° + mirrored
2. Bottom slot: image B in Fill mode
3. User clicks Swap
4. Top slot now shows image B in Fill mode
5. Bottom slot now shows image A rotated 90° + mirrored

### US-07: Print the composition
> As a user, I click Print and the print dialog shows my exact on-screen composition with transforms applied.

**Scenario:**
1. User sets up both slots with images, rotations, and mirror adjustments
2. User clicks Print
3. System print dialog opens
4. Print preview shows the composed layout including all transforms
5. User selects the HP LaserJet M1120 and prints

### US-08: Clear all and start over
> As a user, I want to reset everything with one click.

**Scenario:**
1. Both slots have images with various transforms applied
2. User clicks Clear All
3. Both images are removed, both placeholders visible
4. All transform state is reset

## 3. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | Toolbar appears on each slot only when the slot has an image loaded | Manual test |
| AC-02 | Rotate button cycles through 0° → 90° → 180° → 270° → 0° | Manual test |
| AC-03 | Mirror toggles between normal and horizontally flipped | Manual test |
| AC-04 | Rotate + Mirror combine correctly (e.g., 90° + mirror) | Visual inspection + print test |
| AC-05 | Fit/Fill toggle switches `object-fit` between `contain` and `cover` | Visual inspection |
| AC-06 | Clear removes image, resets transforms, shows placeholder | Manual test |
| AC-07 | Swap exchanges both images AND their full transform state | Manual test |
| AC-08 | Clear All resets both slots completely | Manual test |
| AC-09 | Print triggers `window.print()` with transforms visible in preview | Manual test |
| AC-10 | Clicking toolbar buttons does NOT trigger file dialog | Manual test |
| AC-11 | Toolbar is visually clear and does not block critical image content | Visual inspection |
| AC-12 | All transforms reset on Clear / Clear All | Code review + manual test |

## 4. Out of Scope

The following are explicitly excluded from this phase:

- **Rust-side pixel rotation/mirroring** (deferred to Phase 3 if CSS print transform is unreliable)
- **Drag & drop** from OS file manager (Phase 3)
- **Disabling context menu and F5 reload** (Phase 3)
- **PDF generation** or system print API (Phase 3)
- **90° counter-clockwise rotation** (only CW in this phase — CCW can be achieved with 3× CW)
- **Custom zoom or pan** controls
- **Batch printing** or multi-page layouts

## 5. Key Technical Constraints

| Constraint | Detail |
|------------|--------|
| CSS transform origin | `transform-origin: center center` must be set on `.slot-image` for predictable rotation and mirror behavior |
| Combined transforms | Rotation and mirror must be combined in a single `transform` property string: `transform: rotate(Xdeg) scaleX(Y)` — separate transforms would overwrite each other |
| Print transform compatibility | Some printer drivers (including HP LaserJet M1120) may not render CSS transforms in print. Must test early. Fallback: Rust-side composition in Phase 3 |
| Swap state integrity | `swap()` must exchange full `SlotConfig` objects atomically — not just image paths. Any missing property causes silent state corruption |
| Toolbar z-index | Toolbar must have `z-index` above the image so buttons are clickable, but below any potential overlay elements |
| `stopPropagation` | Every toolbar button click must call `event.stopPropagation()` to prevent slot click handler from firing and opening the file dialog |

