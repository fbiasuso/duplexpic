# Design: duplexpic-image-controls

## 1. Updated Project Directory Structure

```
duplexpic/
├── src/
│   ├── index.html                ← Updated: slot toolbar HTML + global toolbar
│   ├── styles.css                 ← Updated: toolbar CSS, transform classes, print transform rules
│   ├── app.js                     ← Updated: new imports, updated event delegation
│   └── modules/
│       ├── state.js               ← Updated: SlotConfig interface, new methods
│       ├── canvas.js              ← Updated: applyTransform, updateFitMode
│       ├── fileLoader.js          ← Unchanged
│       └── controls.js            ← NEW: toolbar rendering, button handlers
├── src-tauri/
│   └── ...                        ← Unchanged (no Rust changes)
├── package.json
├── CONTEXT.md
└── openspec/changes/
    └── duplexpic-image-controls/
        ├── proposal.yaml
        ├── spec.md
        └── design.md
```

## 2. Updated AppState Interface

### SlotConfig (new)

```js
// Per-slot configuration object
{
  imagePath: string | null,   // Original file path (null = empty slot)
  rotation: number,            // 0 | 90 | 180 | 270 — degrees clockwise
  mirrored: boolean,           // true = horizontally flipped
  fitMode: 'fill' | 'fit'     // 'fill' = object-fit: cover, 'fit' = object-fit: contain
}
```

### AppState class — new methods

```js
class AppState {
  constructor() {
    // Before: this.slots = { top: null, bottom: null }
    // After:
    this.slots = {
      top: { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' },
      bottom: { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' }
    };
    this._listeners = [];
  }

  // Updated: stores full SlotConfig
  setImage(slot, path) { ... }

  // NEW: update a single transform property
  updateTransform(slot, property, value) {
    this.slots[slot][property] = value;
    this._notify(slot, this.slots[slot]);
  }

  // NEW: toggle mirror
  toggleMirror(slot) {
    this.slots[slot].mirrored = !this.slots[slot].mirrored;
    this._notify(slot, this.slots[slot]);
  }

  // NEW: rotate 90° CW
  rotateCW(slot) {
    this.slots[slot].rotation = (this.slots[slot].rotation + 90) % 360;
    this._notify(slot, this.slots[slot]);
  }

  // NEW: toggle fit/fill
  toggleFitMode(slot) {
    const current = this.slots[slot].fitMode;
    this.slots[slot].fitMode = current === 'fill' ? 'fit' : 'fill';
    this._notify(slot, this.slots[slot]);
  }

  // NEW: swap full configs between slots atomically
  swap() {
    const temp = { ...this.slots.top };
    this.slots.top = { ...this.slots.bottom };
    this.slots.bottom = temp;
    this._notify('top', this.slots.top);
    this._notify('bottom', this.slots.bottom);
  }

  // NEW: reset everything
  clearAll() {
    this.slots.top = { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' };
    this.slots.bottom = { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' };
    this._notify('top', this.slots.top);
    this._notify('bottom', this.slots.bottom);
  }

  // Overloaded: clear single slot + transforms
  clearSlot(slot) {
    this.slots[slot] = { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' };
    this._notify(slot, this.slots[slot]);
  }
}
```

### Listener contract change

The `_notify` callback now receives:
- `(slotId: string, config: SlotConfig)` instead of `(slotId: string, path: string | null)`

All subscribers must be updated to destructure `config.imagePath` where needed.

## 3. Frontend Architecture

### New module: `src/modules/controls.js`

Responsibilities:
- `renderToolbar(slotId, config)` — Creates or updates the per-slot toolbar DOM based on current config
- `removeToolbar(slotId)` — Removes toolbar from DOM when slot is cleared
- `initGlobalToolbar()` — Renders Swap / Print / Clear All buttons below canvas
- `buildTransformString(config)` — Returns combined CSS transform value (rotation + mirror)

Exports:
- `initToolbar(slotId)` — Called once per slot at startup to append toolbar container
- `updateToolbar(slotId, config)` — Called on any state change to reflect current transform state (active button styles, fit/fill label)
- `initGlobalToolbar()` — Called once at startup
- `handleToolbarAction(slotId, action)` — Dispatches to the correct AppState method

Toolbar button actions:
- `'rotate'` → `appState.rotateCW(slotId)`
- `'mirror'` → `appState.toggleMirror(slotId)`
- `'fit-toggle'` → `appState.toggleFitMode(slotId)`
- `'clear'` → `appState.clearSlot(slotId)`
- `'swap'` → `appState.swap()`
- `'clear-all'` → `appState.clearAll()`
- `'print'` → `window.print()`

### Updated controller (`app.js`)

```js
import { initCanvas } from './modules/canvas.js';
import { openFileDialog } from './modules/fileLoader.js';
import { appState } from './modules/state.js';
import { initToolbar, updateToolbar, initGlobalToolbar } from './modules/controls.js';

// Single event listener on canvas for slot clicks (load image)
// Single event listener on global toolbar for global actions
// State listener: on any config change → canvas.renderSlot() + updateToolbar()
```

### Event handling flow

```
DOM events
├── #canvas click
│   ├── .slot (no image) → openFileDialog
│   └── .slot-toolbar button → stopPropagation → handleToolbarAction
│
├── #global-toolbar click
│   ├── #btn-swap → appState.swap()
│   ├── #btn-print → window.print()
│   └── #btn-clear-all → appState.clearAll()
│
└── State change → _notify
    └── canvas.renderSlot(slotId, config.imagePath)
        + controls.updateToolbar(slotId, config)
```

## 4. CSS Transform Strategy

### Combined transform composition

Both rotation and mirror are applied on the same element (`.slot-image`) via a single `transform` rule to avoid overriding:

```css
/* Applied inline via style property — not CSS classes — because
   rotation and mirror are independent axis that combine cumulatively */
transform: rotate(90deg) scaleX(-1);
```

Computation in `controls.js`:

```js
export function buildTransformString(config) {
  const parts = [];

  if (config.rotation > 0) {
    parts.push(`rotate(${config.rotation}deg)`);
  }

  if (config.mirrored) {
    parts.push(`scaleX(-1)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}
```

### Transform origin

```css
.slot-image {
  transform-origin: center center;
  /* Ensures rotation pivots from image center, not top-left corner */
}
```

The existing `.slot-image` already uses `object-fit` which works with CSS transforms naturally — the image content transforms within its layout box.

### Fit/Fill mode

Applied via `object-fit` inline style (overrides the CSS default):

```js
// In canvas.js:
function applyFitMode(slotId, mode) {
  const img = getImageElement(slotId);
  if (img) {
    img.style.objectFit = mode === 'fit' ? 'contain' : 'cover';
  }
}
```

### Print transform handling

```css
@media print {
  .slot-image {
    /* Transforms are applied inline — they survive the print
       because they're on the style attribute, which @media print inherits */
  }
}
```

CSS transforms applied via `element.style.transform` persist through `window.print()` in most modern webviews. If HP LaserJet M1120 driver ignores them, Phase 3 will bake transforms into pixels via the Rust `image` crate.

## 5. Data Flow for Each Operation

### Rotate 90° CW

```
User clicks Rotate btn on slot-toolbar
    │
    ├─► event.stopPropagation()
    │
    ▼
controls.handleToolbarAction('top', 'rotate')
    │
    ▼
appState.rotateCW('top')
    ├── this.slots.top.rotation += 90 (mod 360)
    └── this._notify('top', config)
        │
        ├─► canvas.renderSlot('top', config.imagePath)
        │   └── img.style.transform = buildTransformString(config)
        │
        └─► controls.updateToolbar('top', config)
            └── Update active state indicators (button highlights)
```

### Mirror toggle

```
User clicks Mirror btn
    │
    ├─► stopPropagation
    │
    ▼
appState.toggleMirror('top')
    ├── this.slots.top.mirrored = !this.slots.top.mirrored
    └── _notify → canvas.renderSlot → update transform

Note: transform string now includes both rotate() and scaleX()
```

### Fit/Fill toggle

```
User clicks Fit/Fill btn
    │
    ├─► stopPropagation
    │
    ▼
appState.toggleFitMode('top')
    ├── this.slots.top.fitMode = 'fill' ↔ 'fit'
    └── _notify → canvas.renderSlot
        └── img.style.objectFit = 'cover' | 'contain'
```

### Swap

```
User clicks Swap btn (global toolbar)
    │
    ▼
appState.swap()
    ├── temp = { ...this.slots.top }
    ├── this.slots.top = { ...this.slots.bottom }
    ├── this.slots.bottom = temp
    ├── _notify('top', config)
    │   └── canvas.renderSlot('top', config.imagePath)
    │       with config.transform and config.fitMode
    └── _notify('bottom', config)
        └── canvas.renderSlot('bottom', config.imagePath)
            with config.transform and config.fitMode
```

### Clear single slot

```
User clicks Clear btn on toolbar
    │
    ├─► stopPropagation
    │
    ▼
appState.clearSlot('top')
    ├── this.slots.top = { imagePath: null, rotation: 0, mirrored: false, fitMode: 'fill' }
    └── _notify('top', null-config)
        ├─► canvas.clearSlot('top')
        │   ├── placeholder display: ''
        │   ├── img src = '', transform = 'none'
        │   └── img.classList.remove('visible')
        └─► controls.removeToolbar('top')
```

### Clear All

```
User clicks Clear All btn (global toolbar)
    │
    ▼
appState.clearAll()
    ├── resets both slots to empty configs
    ├── _notify('top', ...) → clear + remove toolbar
    └── _notify('bottom', ...) → clear + remove toolbar
```

### Print

```
User clicks Print btn (global toolbar)
    │
    ▼
window.print()
    │
    ▼
@media print CSS applied:
    ├── @page { size: A4; margin: 0; }
    ├── #canvas { width: 210mm; height: 297mm; }
    ├── .slot { height: 50%; }
    └── .slot-image inline transforms are rendered by the print engine
```

## 6. Event Handling Strategy

### Problem
The current app uses a single click listener on `#canvas` that calls `event.target.closest('.slot')` → `openFileDialog()`. Toolbar buttons inside `.slot` would bubble up and trigger the file dialog.

### Solution: Multi-level delegation with stopPropagation

```js
// In app.js:

// 1. Canvas click — slot image loading
canvas.addEventListener('click', (event) => {
  // Ignore clicks on toolbar elements
  if (event.target.closest('.slot-toolbar')) return;

  const slot = event.target.closest('.slot');
  if (slot && appState.isEmpty(slot.id)) {
    openFileDialog(slot.id);
  }
});

// 2. Toolbar button clicks (per-slot)
// Event delegation via a toolbar parent or individual listeners
// Each toolbar button has a data-action attribute
canvas.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  if (!btn.closest('.slot-toolbar')) return;

  event.stopPropagation();
  const slotId = btn.closest('.slot').id;
  const action = btn.dataset.action;
  handleToolbarAction(slotId, action);
});

// 3. Global toolbar
document.getElementById('global-toolbar')?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  handleGlobalAction(action);
});
```

Key rules:
- `.slot-toolbar` buttons ALWAYS call `event.stopPropagation()` (or we check `closest('.slot-toolbar')` and early-return in the slot handler)
- The slot handler ONLY triggers file dialog when the slot is empty AND the click target is not a toolbar element
- Global toolbar exists at the `#app` level, outside `#canvas`, so it never conflicts

## 7. Updated Component Tree

```
Tauri Webview Window ("DuplexPic")
│
├── <head>
│   ├── <link rel="stylesheet" href="styles.css">
│   └── <meta charset="UTF-8">
│
├── <body>
│   │
│   └── <div id="app">
│       │
│       ├── <div id="canvas" class="a4-sheet">
│       │   │
│       │   ├── <div id="slot-top" class="slot">
│       │   │   ├── <div class="slot-toolbar">           ← NEW: visible only when image is loaded
│       │   │   │   ├── <button data-action="rotate">     ⟳ 90°</button>
│       │   │   │   ├── <button data-action="mirror">     ⇔ Mirror</button>
│       │   │   │   ├── <button data-action="fit-toggle"> ⊞ Fit/Fill</button>
│       │   │   │   └── <button data-action="clear">      ✕ Clear</button>
│       │   │   │
│       │   │   ├── <div class="slot-placeholder">        ← Hidden when image loaded
│       │   │   │   └── <span>🖼️ Haga clic para cargar ...</span>
│       │   │   │
│       │   │   └── <img class="slot-image">              ← transform + object-fit applied inline
│       │   │
│       │   └── <div id="slot-bottom" class="slot">
│       │       ├── <div class="slot-toolbar">            ← NEW
│       │       │   ├── <button data-action="rotate">     ⟳ 90°</button>
│       │       │   ├── <button data-action="mirror">     ⇔ Mirror</button>
│       │       │   ├── <button data-action="fit-toggle"> ⊞ Fit/Fill</button>
│       │       │   └── <button data-action="clear">      ✕ Clear</button>
│       │       │
│       │       ├── <div class="slot-placeholder">
│       │       │   └── <span>...</span>
│       │       │
│       │       └── <img class="slot-image">
│       │
│       ├── <div id="global-toolbar">                     ← NEW: outside canvas
│       │   ├── <button data-action="swap">       ⇅ Swap</button>
│       │   ├── <button data-action="print">      🖨️ Print</button>
│       │   └── <button data-action="clear-all">  ✕✕ Clear All</button>
│       │
│       └── <script type="module" src="app.js">
│
└── ...
```

## 8. Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 01 | **Combined single `transform` string** (rotate + scaleX on one property) | CSS transforms overwrite, not accumulate. If we set `transform: rotate(90deg)` and then `transform: scaleX(-1)`, the rotation is lost. Building one string ensures both apply. |
| 02 | **`SlotConfig` as a value object, not individual properties** | Clean swap, clear, and clearAll operations. Swap is a single `Object.assign` or spread exchange. No risk of missing a property. |
| 03 | **`data-action` attribute delegation** instead of per-button listeners | Single listener per toolbar, clean dispatch via action string. New actions can be added without wiring new listeners. |
| 04 | **`stopPropagation` guard on canvas handler** rather than per-element stopPropagation | The canvas handler checks `event.target.closest('.slot-toolbar')` and returns early. This avoids mutating the event flow for other potential listeners. |
| 05 | **Inline styles for transforms** instead of CSS class swapping | Rotation values are numeric (0/90/180/270) — class swapping would require N×M classes (rotation × mirror). Inline `style.transform` is simpler and equally performant for this use case. |
| 06 | **`object-fit` for fit/fill toggle** instead of `background-size` or manual canvas scaling | Images are already `<img>` elements with `object-fit`. Switching between `cover` and `contain` is a one-line change. No additional CSS or JS logic needed. |
| 07 | **Toolbar is DOM inside `.slot`** with `position: absolute` | Keeps toolbar position relative to its slot. No complex coordinate mapping. `z-index` ensures buttons are clickable above the image. |
| 08 | **Global toolbar outside `#canvas`** | Click events on global toolbar buttons must NOT trigger the A4 canvas click handler. Placing it outside `#canvas` in the DOM tree means it's not a descendant, so `closest('.slot')` returns null. This is the simplest isolation strategy. |
| 09 | **`swap()` creates new config objects** (spread copy) | Prevents aliasing bugs where `this.slots.top` and `this.slots.bottom` reference the same object after swap. Each slot always has an independent config object. |
| 10 | **No CSS class toggles for toolbar visibility** — controlled by JS setting `display` | The toolbar visibility is directly tied to whether `config.imagePath` is null. A class-based approach would require CSS logic to handle the show/hide transition. Direct JS control is more explicit. |

