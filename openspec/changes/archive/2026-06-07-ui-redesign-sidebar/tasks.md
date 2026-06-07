# Tasks: UI Redesign — Sidebar Layout

> Estimated total lines changed: ~780 (exceeds 400 — consider chained PRs)
> Based on proposal + design + current codebase analysis.

---

## Phase A — State Preparation (state.js)

### T1 — Add new AppState fields to constructor
**Files:** `src/modules/state.js`
**Description:** Add `orientation`, `zoom`, `activeSlot`, `margins`, and `activeTab` fields to the `AppState` constructor, plus the `_eventListeners` map for the event channel system.
- `orientation`: `'portrait'` (default)
- `zoom`: `1.0` (default)
- `activeSlot`: `null` (default)
- `margins`: `{ top: 0, bottom: 0, left: 0, right: 0, gutter: 0 }` (default)
- `activeTab`: `'margins'` (default — first tab)
- `_eventListeners`: `{}` (map of event key → array of callbacks)
**Dependencies:** None
**Acceptance criteria:**
- [x] New AppState instance has all 5 fields with correct defaults
- [x] `_eventListeners` is an empty object
- [x] Existing slot-related fields unchanged

**Estimated lines:** ~15

---

### T2 — Add setter methods + event channel to AppState
**Files:** `src/modules/state.js`
**Description:** Add the following methods to `AppState`:
- `setOrientation(v)` → sets `this.orientation`, calls `this._notifyEvent('orientation', v)`
- `setZoom(v)` → clamps to `[0.5, 2.0]`, sets `this.zoom`, calls `_notifyEvent('zoom', this.zoom)`
- `setActiveSlot(id)` → sets `this.activeSlot`, calls `_notifyEvent('activeSlot', id)`
- `setMargins(m)` → merges with `Object.assign(this.margins, m)`, calls `_notifyEvent('margins', this.margins)`
- `setActiveTab(t)` → sets `this.activeTab`, calls `_notifyEvent('activeTab', t)`
- `onEvent(key, callback)` → registers callback in `this._eventListeners[key]`
- `_notifyEvent(key, data)` → invokes all callbacks registered for that key
**Dependencies:** T1
**Acceptance criteria:**
- [x] `setOrientation('landscape')` emits via `onEvent('orientation', cb)` with `'landscape'`
- [x] `setZoom(3.0)` clamps to `2.0` and emits `2.0`
- [x] `setActiveSlot('slot-top')` emits `'slot-top'`
- [x] `setMargins({ top: 5 })` merges without overwriting other margin keys
- [x] `_notifyEvent` with no listeners does not throw
- [x] Existing `onChange`/`_notify` for slot rendering is unchanged

**Estimated lines:** ~40

---

## Phase B — HTML Structure

### T3 — Rewrite index.html with new layout
**Files:** `src/index.html`
**Description:** Replace the entire `<body>` content with the new flex layout structure as defined in the design:
- `<div id="app">` becomes `display: flex; flex-direction: row`
  - `<div id="sidebar">` (260px, flex column)
    - `.global-buttons` container for Swap/Print/Clear-all
    - `.tabs-nav` with two `<button>` elements: "Márgenes" (data-tab="margins"), "Imagen" (data-tab="image")
    - `.tab-content` with two `.tab-pane` divs: `#tab-margins` (active by default), `#tab-image` (hidden by default)
      - `#tab-margins`: property groups for top/bottom/left/right/gutter sliders (0–20mm each) + "Aplicar" button
      - `#tab-image`: empty container (rendered dynamically by properties.js), initial fallback text "Seleccioná un slot"
  - `<div id="canvas-zone">` (flex column, flex: 1)
    - `.canvas-wrapper` containing existing `#canvas.a4-sheet.portrait`
      - `#slot-top.slot` and `#slot-bottom.slot` (unchanged content from current HTML)
    - `.zoom-bar` below canvas-wrapper:
      - `<button data-zoom="out">−</button>`
      - `<input type="range" id="zoom-slider" min="50" max="200" value="100">`
      - `<button data-zoom="in">+</button>`
- Keep `<script type="module" src="app.js"></script>` at bottom
**Dependencies:** None
**Acceptance criteria:**
- [x] Sidebar is first child of #app with all three sections (global-buttons, tabs-nav, tab-content)
- [x] canvas-zone is second child with canvas-wrapper > #canvas > slots inside
- [x] Zoom bar is below canvas-wrapper with slider and +/- buttons
- [x] Tab-pane structure has two panes, #tab-margins has .active class
- [x] Placeholder icons and text in slots preserved from current HTML
- [x] No #global-toolbar in the DOM

**Estimated lines:** ~90

---

### T4 — Fit-toggle button SVG icon
**Files:** `src/modules/controls.js`
**Description:** In `SLOT_TOOLBAR_HTML`, replace the `▢` text content of the fit-toggle button with an inline SVG icon showing 4 expand arrows (indicating "fit to container"). Keep `data-action="fit-toggle"` and `title` attribute unchanged.
- SVG should be ~16×16px, inline, no external dependencies
- Design: 4 arrows pointing outward from center (north-west, north-east, south-west, south-east) or a standard "fit/expand" icon
- Remove the old `▢` character
**Dependencies:** None (can be done independently)
**Acceptance criteria:**
- [x] Fit-toggle button renders an SVG icon instead of ▢
- [x] SVG is visually clear as "fit to container"
- [x] `data-action="fit-toggle"` and `title="Ajuste"` are preserved
- [x] Other toolbar buttons unchanged

**Estimated lines:** ~5 (SVG inline string)

---

## Phase C — CSS (styles.css)

### T5 — Layout CSS (flex row, sidebar, canvas-zone, canvas-wrapper)
**Files:** `src/styles.css`
**Description:** Add CSS rules for the new flex layout:
- `#app`: `display: flex; flex-direction: row; height: 100vh; width: 100%;` (replaces old centered layout)
- `#sidebar`: `width: 260px; min-width: 260px; display: flex; flex-direction: column; background: #1a1a1a; padding: 16px; overflow-y: auto;`
- `#canvas-zone`: `flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; background: #2c2c2c;`
- `.canvas-wrapper`: `transform-origin: center center; transition: transform 0.15s ease;`
- `#canvas.a4-sheet`: keep existing dimensions (595×842) but move to be inside canvas-wrapper
- Update body: remove `padding: 2rem`, keep `background: #2c2c2c`
**Dependencies:** T3 (needs the new DOM structure to exist)
**Acceptance criteria:**
- [x] #app takes full viewport height with horizontal flex
- [x] Sidebar is 260px fixed width, full height
- [x] Canvas-zone fills remaining space, centered content
- [x] Canvas-wrapper wraps the A4 canvas with transform-origin centered
- [x] No scrollbars on the main viewport at 1280×900 (body overflow: hidden)

**Estimated lines:** ~25

---

### T6 — Sidebar styles (buttons, tabs, property groups)
**Files:** `src/styles.css`
**Description:** Add styling for sidebar internals:
- `.global-buttons`: `display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;`
- `.global-buttons button`: dark theme (bg #333, color white, border #555, rounded, padding 8px 16px)
- `.tabs-nav`: `display: flex; border-bottom: 1px solid #333;`
- `.tabs-nav button`: `flex: 1; padding: 8px; background: none; color: #999; border: none; cursor: pointer; font-size: 0.9rem;`
- `.tabs-nav button.active`: `color: #fff; border-bottom: 2px solid #4a9eff;`
- `.tab-content`: `flex: 1; overflow-y: auto; padding: 12px 0;`
- `.tab-pane`: `display: none;` and `.tab-pane.active`: `display: block;`
- `.property-group`: `margin: 12px 0;`
- `.property-group label`: `display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 4px;`
- `.property-group .value`: `font-size: 0.95rem; color: #e0e0e0;`
- `.property-group input[type=range]`: full width within sidebar
**Dependencies:** T3 (sidebar DOM exists), T5 (sidebar layout exists)
**Acceptance criteria:**
- [x] Global buttons are stacked vertically with proper spacing
- [x] Tab buttons have active state indicator (blue bottom border)
- [x] Only active tab-pane is visible
- [x] Property groups have proper label/value styling
- [x] Range inputs fit within 260px sidebar without overflow

**Estimated lines:** ~50

---

### T7 — Landscape orientation CSS
**Files:** `src/styles.css`
**Description:** Add CSS rules for landscape mode:
- `.a4-sheet.landscape`: `width: 842px; height: 595px;` (swapped dimensions)
- `.a4-sheet.landscape .slot`: `width: 50%; height: 100%;` (slots side by side)
- `#slot-top.landscape`: `border-bottom: none; border-right: 2px solid #e0e0e0;` (vertical divider instead of horizontal)
- Ensure slot contents (placeholder, image, toolbar) still render correctly in landscape
**Dependencies:** T3 (a4-sheet with landscape class), T5 (layout for canvas)
**Acceptance criteria:**
- [x] `.a4-sheet.landscape` renders 842×595
- [x] Slots appear side by side (not stacked)
- [x] Border between slots is vertical (right side of left slot)
- [x] Toggling portrait/landscape via JS class swap works visually
- [x] Slot contents (images/placeholders) fill the horizontal slots correctly

**Estimated lines:** ~20

---

### T8 — Zoom bar styles
**Files:** `src/styles.css`
**Description:** Style the zoom bar below the canvas:
- `.zoom-bar`: `display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px; background: #1a1a1a; width: 100%;`
- `.zoom-bar button`: `background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 6px 14px; cursor: pointer; font-size: 1.1rem;`
- `.zoom-bar button:hover`: `background: #444;`
- `#zoom-slider`: `width: 160px; accent-color: #4a9eff;`
- `.zoom-label`: `color: #aaa; font-size: 0.85rem; min-width: 40px; text-align: center;` (for percentage display)
**Dependencies:** T3 (zoom-bar DOM), T5 (canvas-zone layout)
**Acceptance criteria:**
- [x] Zoom bar is centered below the canvas
- [x] Slider is styled with accent color
- [x] +/- buttons are styled consistently with dark theme
- [x] Zoom bar background matches sidebar color (#1a1a1a)

**Estimated lines:** ~25

---

### T9 — Margins overlay styles
**Files:** `src/styles.css`
**Description:** Add CSS for the visual margins overlay on canvas slots:
- `.slot.margins-active`: `outline-style: dashed; outline-color: rgba(74, 158, 255, 0.6);` (base class when margins are applied)
- Use CSS `outline` property (not `border`) so it doesn't affect layout:
  - `.slot.margin-top-{n}`, `.slot.margin-bottom-{n}`, etc.: dynamic classes applied by properties.js
  - Alternatively, use inline `style.outline` for per-side control
- Ensure margins overlay is visual-only and doesn't affect slot child layout
**Dependencies:** T3 (slots exist), T5 (layout)
**Acceptance criteria:**
- [x] Margin outlines are dashed and don't affect slot sizing
- [x] Outlines are visible over any slot background
- [x] No JS needed to render the outlines (CSS handles visual, JS only sets values)

**Estimated lines:** ~15

---

### T10 — Update @media print styles
**Files:** `src/styles.css`
**Description:** Update the existing `@media print` block to work with the new layout:
- Hide sidebar, zoom-bar, slot-toolbars: `display: none !important;`
- `.canvas-wrapper`: `transform: none !important;` (reset any zoom)
- `#canvas-zone`: `justify-content: flex-start;` (no vertical centering on print)
- `#app`: reset flex row to block for print; set A4 dimensions
- Preserve existing slot/image/placeholder print rules
- Ensure landscape variant also prints correctly (slots side by side on landscape A4)
**Dependencies:** T3, T5, T7
**Acceptance criteria:**
- [x] Print preview hides sidebar, zoom bar, and slot toolbars
- [x] Canvas fills the A4 page regardless of zoom level
- [x] Landscape print renders landscape orientation on paper
- [x] No sidebar layout artifacts in print

**Estimated lines:** ~30

---

### T11 — Remove old #global-toolbar CSS rules
**Files:** `src/styles.css`
**Description:** Delete all CSS rules for `#global-toolbar` and `#global-toolbar button` (including hover states). These are no longer needed since global buttons now live in the sidebar.
- Remove entire block: lines ~245-266 in current styles.css
- Also update any references to `#global-toolbar` in `@media print` — replace with `#sidebar` hide rule (already part of T10)
- Update the old `@media print` rule that has `#global-toolbar` in the comma-separated selector: replace it with `#sidebar` (or keep both for safety)
**Dependencies:** T10 (print updates must be in place first)
**Acceptance criteria:**
- [x] No `#global-toolbar` CSS rules remain
- [x] No broken selectors from removing these rules
- [x] Sidebar buttons are styled by the new rules (T6)
- [x] Print still hides the sidebar correctly

**Estimated lines:** ~20

---

## Phase D — JavaScript Modules

### T12 — Create sidebar.js (tab switching + global button wiring)
**Files:** `src/modules/sidebar.js` (NEW)
**Description:** Create the sidebar module with:
- `initSidebar()` function:
  - Set up tab switching: click handlers on `.tabs-nav button[data-tab]`, show/hide corresponding `.tab-pane`
  - Wire global buttons by delegating clicks to `handleToolbarAction(action, null)` from controls.js
  - Listen for `appState.onEvent('activeTab', tab)` to sync the tab UI when state changes externally
- Tab switching logic:
  - Remove `.active` from all tab buttons and tab panes
  - Add `.active` to clicked tab button and corresponding pane
  - Call `appState.setActiveTab(tabId)` to update state
- Global button delegation:
  - Single click listener on `#sidebar` with `event.target.closest('button[data-action]')`
  - Map data-action values: `swap` → `handleToolbarAction('swap')`, `print` → `handleToolbarAction('print')`, `clear-all` → `handleToolbarAction('clear-all')`
**Dependencies:** T3 (sidebar DOM), T6 (sidebar CSS), T15 (controls.js actions defined)
**Acceptance criteria:**
- [x] Clicking "Márgenes" tab shows margins pane, hides image pane
- [x] Clicking "Imagen" tab shows image pane, hides margins pane
- [x] Active tab button has `.active` class with blue underline
- [x] Swap/Print/Clear-all buttons in sidebar trigger correct actions
- [x] Tab state syncs when `setActiveTab()` is called externally

**Estimated lines:** ~70

---

### T13 — Create properties.js (image info panel + margins sliders)
**Files:** `src/modules/properties.js` (NEW)
**Description:** Create the properties panel module:
- `initProperties()` function:
  - Subscribes to `appState.onEvent('activeSlot', slotId)` to update the image info tab
  - Subscribes to `appState.onEvent('margins', margins)` to update the margins overlay and slider values
  - Renders initial state (activeSlot is null → "Seleccioná un slot")
- `renderImageInfo(slotId)`: updates `#tab-image` with:
  - Slot name (e.g., "Superior" / "Inferior")
  - Filename (extracted from imagePath)
  - Image dimensions (displayed as "Ancho × Alto px" — read from naturalWidth/naturalHeight if available, otherwise "—")
  - Fit mode (contain/fill/cover in user-friendly text)
  - Mirror state (activado/desactivado)
  - When activeSlot is null, shows centered "Seleccioná un slot" message
  - When slot has no image, shows "Sin imagen cargada"
- `renderMarginsPanel(margins)`: updates `#tab-margins`:
  - Sliders (input type=range, 0–20, step 1) for each margin: top, bottom, left, right, gutter
  - Current value display next to each slider (e.g., "5 mm")
  - "Aplicar" button (click handler: calls `appState.setMargins()` with current slider values)
  - Each slider's `input` event updates the value display in real-time
- Margins overlay: when margins are non-zero, apply dotted outline styles to `.slot` elements via inline style
**Dependencies:** T3, T12 (tab structure), T6 (property group CSS)
**Acceptance criteria:**
- [x] Image info tab shows correct data for active slot
- [x] "Seleccioná un slot" shown when activeSlot is null
- [x] "Sin imagen cargada" shown when slot exists but has no image
- [x] Margins sliders range 0–20mm with live value display
- [x] "Aplicar" button calls setMargins with current slider values
- [x] Non-zero margins show dotted outlines on canvas slots

**Estimated lines:** ~100

---

### T14 — Create zoom.js (zoom slider, buttons, auto-fit)
**Files:** `src/modules/zoom.js` (NEW)
**Description:** Create the zoom control module:
- `initZoom()` function:
  - Get references to zoom-slider, zoom-out button, zoom-in button, zoom-label
  - Wire slider `input` event → convert value to zoom (value/100) → call `appState.setZoom(zoom)`
  - Wire `-` button click: `appState.setZoom(appState.zoom - 0.1)` (clamped to 0.5)
  - Wire `+` button click: `appState.setZoom(appState.zoom + 0.1)` (clamped to 2.0)
  - Subscribe to `appState.onEvent('zoom', level)` to:
    1. Apply `transform: scale(level)` to `.canvas-wrapper`
    2. Update slider value and label display (e.g., "100%")
  - Calculate and apply initial zoom via `calculateFit()`
- `calculateFit()` function:
  - Measure available space in `#canvas-zone` (clientWidth, clientHeight minus zoom-bar height)
  - Measure canvas dimensions (595×842 for portrait, 842×595 for landscape)
  - Calculate scale that fits the canvas in the available space, accounting for both width and height
  - Apply with `appState.setZoom(calculatedZoom)`
  - Called on init and when orientation changes
- `applyZoom(level)`: sets `transform: scale(level)` on `.canvas-wrapper`
- Subscribe to `appState.onEvent('orientation', ...)` to recalculate fit on orientation toggle
- Handle resize: debounced `window.resize` event recalculates fit if canvas exceeds or is too small in current view
**Dependencies:** T3 (canvas-wrapper + zoom-bar DOM), T5 (layout), T8 (zoom bar CSS)
**Acceptance criteria:**
- [x] Slider and +/- buttons control zoom level
- [x] Zoom range is 0.5–2.0 in 0.1 increments
- [x] Initial zoom auto-fits canvas into canvas-zone with no scroll
- [x] Zoom label shows current percentage (e.g., "125%")
- [x] Orientation change triggers re-fit calculation
- [x] `.canvas-wrapper` `transform: scale()` is smooth (CSS transition)
- [x] Canvas stays centered in canvas-zone at all zoom levels

**Estimated lines:** ~80

---

### T15 — Update controls.js (remove global toolbar, SVG icon)
**Files:** `src/modules/controls.js`
**Description:**
1. **Remove `GLOBAL_TOOLBAR_HTML`**: Delete the entire `GLOBAL_TOOLBAR_HTML` template literal.
2. **Update `initToolbars()`**: Remove the code that injects `GLOBAL_TOOLBAR_HTML` into `#app`. Keep slot toolbar injection unchanged.
3. **Replace ▢ with SVG**: In `SLOT_TOOLBAR_HTML`, replace the `▢` character in the fit-toggle button with an inline SVG icon (4 expand arrows, ~16×16px). Keep `data-action="fit-toggle"` and `title="Ajuste"`. (Already done in PR 1.)
4. Add `orientation` case to `handleToolbarAction`: toggle between 'portrait' and 'landscape'.
**Dependencies:** T3 (sidebar DOM with .global-buttons)
**Acceptance criteria:**
- [x] No `GLOBAL_TOOLBAR_HTML` or its injection code remains
- [x] Slot toolbars still injected correctly on all `.slot` elements
- [x] Fit-toggle button shows SVG icon instead of ▢
- [x] `handleToolbarAction` remains exported and functional
- [x] All slot toolbar actions still work (rotate, mirror, fit-toggle, clear)
- [x] Orientation case toggles portrait/landscape

**Estimated lines:** ~25

---

### T16 — Update state.js (integrate new state, address swap behavior)
**Files:** `src/modules/state.js`
**Description:**
1. Ensure T1 and T2 changes are correctly integrated (fields, setters, _notifyEvent/onEvent).
2. **Swap behavior with activeSlot**: The `swap()` method currently exchanges slot-top and slot-bottom content. Should `activeSlot` also be swapped? 
   - **Recommendation: No.** The activeSlot tracks the user's UI focus (which slot they hovered/clicked last), not the slot content. If the user was looking at slot-top's properties and swaps, they're still looking at slot-top — its content just changed. This is more predictable and matches the design's "no deselect" rule.
   - Add a comment in `swap()` documenting this decision.
3. Verify `_notifyEvent` and `onEvent` don't conflict with existing `_notify`/`onChange` (they shouldn't — different method names).
4. Add `setOrientation` to also call `_notify` if needed? No — orientation doesn't affect slot rendering. Keep it purely on the event channel.
**Dependencies:** T1, T2
**Acceptance criteria:**
- [x] All fields and setters from T1/T2 are correctly implemented
- [x] `swap()` does NOT swap activeSlot (documented decision)
- [x] Event channel coexists with old onChange channel without conflicts
- [x] Orientation setter triggers only event, not slot re-render

**Estimated lines:** ~15 (mostly documentation + verification)

---

### T17 — Update app.js (init modules, event wiring, slot tracking)
**Files:** `src/app.js`
**Description:**
1. **Import new modules**: Add imports for `initSidebar`, `initProperties`, `initZoom`
2. **Initialize new modules** in DOMContentLoaded:
   - `initSidebar()` — build sidebar UI, wire tab switching and global buttons
   - `initProperties()` — subscribe to activeSlot/margins events
   - `initZoom()` — set up zoom control
3. **Remove global-toolbar listener**: Delete the `const globalToolbar = document.getElementById('global-toolbar');` block. Global button handling is now in sidebar.js.
4. **Orientation toggle**: Orientation button with `data-action="orientation"` exists in `.global-buttons`. Wired via `handleToolbarAction('orientation')` in controls.js.
5. **Add slot hover/click tracking for activeSlot**:
   - On each `.slot`: `mouseenter` event → `appState.setActiveSlot(slot.id)` (only if no activeSlot is set yet)
   - **Per user decision**: activeSlot persists once set. No reset on mouseleave or click-outside. First hover or click sets it permanently for the session (until clear-all or app restart).
   - On each `.slot`: `click` event → `appState.setActiveSlot(slot.id)` (reinforces selection)
6. **Subscribe to `onEvent('orientation')`** to toggle `.portrait`/`.landscape` class on `#canvas`.
7. Keep all existing slot interaction code (click to open file, contextmenu, drag and drop).
**Dependencies:** T12, T13, T14, T15, T16
**Acceptance criteria:**
- [x] App initializes without errors (all modules loaded)
- [x] Sidebar renders with buttons, tabs, properties panel
- [x] Hovering a slot sets activeSlot (persists after mouse leave)
- [x] Clicking a slot also sets activeSlot
- [x] Properties panel updates when activeSlot changes
- [x] Orientation toggle switches canvas class and updates zoom
- [x] All existing features still work (open image, drag-drop, print, etc.)

**Estimated lines:** ~60

---

## Phase E — Polish

### T18 — Window sizing in tauri.conf.json
**Files:** `src-tauri/tauri.conf.json`
**Description:** Update the window dimensions to accommodate the new layout:
- `width`: 1280 (sidebar 260px + canvas-zone ~1020px with padding)
- `height`: 900 (canvas 842px + zoom bar ~50px + padding)
- Keep `resizable: true`, `fullscreen: false`
**Dependencies:** None (config change)
**Acceptance criteria:**
- [x] Window opens at 1280×900
- [x] All content visible without scrollbars at this size
- [x] Window is resizable

**Estimated lines:** ~3

---

### T19 — Initial zoom auto-fit calculation on load
**Files:** `src/modules/zoom.js` (already part of T14, but specific acceptance needed)
**Description:** This is verified as part of T14 but listed separately for explicit acceptance. The initial auto-fit zoom must:
- Calculate the available viewport in canvas-zone after layout is rendered
- Consider the current orientation (portrait/landscape)
- Apply a zoom level that shows the full canvas without scrollbars
- Have a small padding buffer (~16px) so the canvas doesn't touch the edges
**Dependencies:** T14
**Acceptance criteria:**
- [x] On first load, canvas auto-fits within canvas-zone
- [x] No scrollbars on the window
- [x] Canvas is centered vertically and horizontally
- [x] After orientation change, auto-fit recalculates

**Estimated lines:** ~0 (part of T14, ~10 lines within calculateFit)

---

### T20 — Verify all existing features still work
**Files:** (all)
**Description:** Manual verification checklist — run through all existing features after the refactor.
**Archive reconciliation:** All 13 sub-checks verified working in PR 2 (merged to main). Stale checkboxes reconciled at archive time per user confirmation.
- [x] **Image loading**: Click placeholder opens file dialog, image renders in slot
- [x] **Drag & drop**: Drop image file on empty slot loads it
- [x] **Rotate 90°**: Click rotate button rotates image, preserves across swaps
- [x] **Mirror**: Toggle mirror flips image horizontally with card-flip animation
- [x] **Fit mode cycling**: Click fit-toggle cycles contain → fill → cover with directional animation
- [x] **Swap**: Swap button exchanges slot contents with crossing animation
- [x] **Clear individual slot**: Clear button removes image from one slot
- [x] **Clear all**: Reset button clears both slots
- [x] **Print**: Window.print() opens print dialog with correct A4 layout
- [x] **Slot toolbars**: Toolbar appears on hover over each slot (unchanged behavior)
- [x] **Loader spinner**: Shows during Rust image processing
- [x] **Keyboard protection**: F5/Ctrl+R blocked
- [x] **Context menu**: Right-click on empty slot opens file dialog
**Dependencies:** All previous tasks
**Acceptance criteria:**
- [x] All 13 existing features work identically to before the refactor (verified in PR 2)
- [x] No regressions in animation behavior (swap crossing, mirror flip, fit zoom)

**Estimated lines:** ~0 (verification only)

---

## Dependencies Graph

```
T1 ─→ T2 ─→ T16 ─┐
                   │
T3 ─┬→ T5 ─┬→ T6 ─┤
    │       └→ T8 ─┤
    │       └→ T9 ─┤
    │       └→ T7 ─┤
    │              ├→ T12 ─┐
    │              │       ├→ T17
    │              ├→ T13 ─┘
    │              │
    │              └→ T14 ─┬→ T19
    │                       │
    ├→ T10 → T11           │
    │                       │
    ├→ T15 ────────────────┘
    │
T4 ─┘
                          
T18 ─ (independent)

T20 ─ depends on all
```

---

## Line Count Summary

| Phase | Tasks | Est. Lines |
|-------|-------|------------|
| A — State Preparation | T1, T2 | ~55 |
| B — HTML Structure | T3, T4 | ~95 |
| C — CSS | T5–T11 | ~185 |
| D — JavaScript Modules | T12–T17 | ~350 |
| E — Polish | T18, T19, T20 | ~3 |
| **Total** | **20 tasks** | **~688** |

> **Risk**: Total exceeds 400 lines. Recommend splitting into 2 chained PRs:
> - PR 1: Phase A + B + C (HTML/CSS/state — ~335 lines, safe)
> - PR 2: Phase D + E (JS modules + polish — ~353 lines, safe)

---

## Open Questions for the User

1. **swap() + activeSlot (T16)**: The recommended approach is that swap() does NOT swap activeSlot — the user's UI focus stays on the same slot even though its content changed. Confirm?

2. **Orientation toggle button**: The design mentions orientation as a feature but doesn't specify where the toggle button lives. Should it be:
   - A button in .global-buttons (alongside Swap/Print/Clear-all)?
   - A toggle in the properties panel (e.g., in the margins tab)?
   - The proposal says "toggle portrait/landscape" but doesn't specify placement. Current recommendation: add it to `.global-buttons` as `data-action="orientation"`.

3. **SVG icon for fit-toggle (T4)**: Should I use a specific SVG design? The canonical "fit" icon uses 4 arrows pointing inward (collapse) or outward (expand). Recommendation: 4 outward-pointing arrows in corners of a bounding box, indicating "fit to container".
