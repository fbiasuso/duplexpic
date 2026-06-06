# Tasks: duplexpic-image-controls

## Task Dependency Graph

```
T-01 (state.js) ──┬──► T-02 (canvas.js)
                   ├──► T-03 (controls.js) ──┬──► T-04 (styles.css)
                   │                         └──► T-06 (app.js) ──► T-08 (testing)
                   ├──► T-07 (fileLoader.js)     ▲
                   └─────────────────────────────┘
                                        │
                                   T-05 (index.html)
```

## Tasks

### T-01: Migrate AppState to SlotConfig

- **Description**: Convert `state.js` from storing `string | null` per slot to a `SlotConfig` object (`{ imagePath, rotation, mirrored, fitMode }`). Add new methods: `rotateCW(slot)` (cycles 0→90→180→270→0), `toggleMirror(slot)`, `toggleFitMode(slot)` (fill↔fit), `swap()` (exchange both configs atomically with spread copies), `clearSlot(slot)` (resets to default config), `clearAll()` (resets both slots). Update `setImage(slot, path)` to store `{ imagePath: path, rotation: 0, mirrored: false, fitMode: 'fill' }`. Update `isEmpty()` to check `imagePath === null`. Update `_notify` to pass the full config object instead of just the path string.
- **Dependencies**: None
- **Files touched**: `src/modules/state.js`
- **Acceptance**: `appState.slots.top` returns a full `SlotConfig`; `isEmpty()` returns `true` when `imagePath` is null; `rotateCW` on a slot with `rotation: 270` wraps back to `0`; `swap` exchanges both configs without object aliasing; `clearAll` resets both slots to defaults; `_notify` callbacks receive `(slotId, config)` where `config` has all four properties

### T-02: Update canvas.js to apply SlotConfig transforms

- **Description**: Update `renderSlot(slotId, config)` to accept a `SlotConfig` object instead of a path string. Add internal `buildTransformString(config)` helper that returns a combined CSS transform value: `rotate(Xdeg)` (when `config.rotation > 0`) and `scaleX(-1)` (when `config.mirrored`), joined with space. Apply `img.style.transform` during render. Apply `img.style.objectFit` as `'cover'` (fill mode) or `'contain'` (fit mode). Use `convertFileSrc(config.imagePath)` to derive the asset URL from the raw path. Update `clearSlot` to also reset `style.transform` and `style.objectFit`. Update `initCanvas` to pass default configs instead of null.
- **Dependencies**: T-01 (SlotConfig shape)
- **Files touched**: `src/modules/canvas.js`
- **Acceptance**: Image renders with correct rotation and mirror transforms; toggling fit/fill changes `object-fit` between `cover` and `contain`; clearing a slot resets both transform and object-fit; `buildTransformString({ rotation: 90, mirrored: true })` returns `"rotate(90deg) scaleX(-1)"`; `buildTransformString({ rotation: 0, mirrored: false })` returns `"none"`

### T-03: Create controls.js module

- **Description**: New module exporting:
  - `initToolbar(slotId)` — called once per slot at startup; creates a `.slot-toolbar` div with four buttons (`data-action="rotate"`, `data-action="mirror"`, `data-action="fit-toggle"`, `data-action="clear"`), appends it to the slot element, sets initial `display: none`
  - `updateToolbar(slotId, config)` — sets toolbar `display` to `block` when `config.imagePath` is truthy, `none` when null; updates button active/selected states based on config (e.g., highlighted when `rotation !== 0`, toggled label for fit/fill)
  - `initGlobalToolbar()` — called once at startup; creates a `#global-toolbar` div with three buttons (`data-action="swap"`, `data-action="print"`, `data-action="clear-all"`), appends it after `#canvas` inside `#app`
  - `handleToolbarAction(slotId, action)` — dispatches action string to the correct `appState` method; `'rotate'`→`rotateCW`, `'mirror'`→`toggleMirror`, `'fit-toggle'`→`toggleFitMode`, `'clear'`→`clearSlot`, `'swap'`→`swap`, `'clear-all'`→`clearAll`, `'print'`→`window.print()`
- **Dependencies**: T-01 (AppState methods must exist)
- **Files touched**: `src/modules/controls.js` (NEW)
- **Acceptance**: Per-slot toolbar appears only when slot has an image; each button calls the correct AppState method; `handleToolbarAction('print')` calls `window.print()`; toolbar buttons have correct `data-action` attributes; per-slot actions receive the correct `slotId`; global toolbar actions don't need a `slotId`

### T-04: Add toolbar styles to styles.css

- **Description**: Add styles for:
  - `.slot-toolbar`: `position: absolute; top: 0; left: 0; right: 0;` semi-transparent dark background (`rgba(0,0,0,0.6)`), `z-index` above image, flex row, centered, `display: none` by default, `gap` between buttons
  - `.slot-toolbar button`: light text, icon-friendly sizing, subtle hover/active states, `cursor: pointer`
  - `.slot-toolbar button.active`: visual indicator when transform is applied (e.g., brighter background or underline)
  - `#global-toolbar`: flex row, centered, `gap` between buttons, padding, background distinct from canvas
  - `.slot-image`: `transform-origin: center center` (ensures rotation pivots from center)
  - `@media print`: `{ .slot-toolbar, #global-toolbar { display: none !important; } }` — also ensure `transform-origin` persists
- **Dependencies**: T-03, T-05 (must match DOM structure)
- **Files touched**: `src/styles.css`
- **Acceptance**: Per-slot toolbar overlays at the top of each slot; toolbar is semi-transparent and visually distinct; buttons are clickable and show hover states; global toolbar renders below the canvas; print output hides both toolbars

### T-05: Update index.html structure

- **Description**: Add `#global-toolbar` container as a sibling after `#canvas`, inside `#app` (the `controls.js` `initGlobalToolbar()` will populate it). Optionally add empty `.slot-toolbar` containers inside each `.slot` (if `controls.js` expects them as mount points rather than creating them entirely from scratch — decide based on T-03 implementation approach).
- **Dependencies**: None
- **Files touched**: `src/index.html`
- **Acceptance**: HTML includes a container where the global toolbar can mount; slot structure is compatible with toolbar injection

### T-06: Integrate controls in app.js

- **Description**: On `DOMContentLoaded`, call `initToolbar('slot-top')`, `initToolbar('slot-bottom')`, and `initGlobalToolbar()`. Wire up state listener: `appState.onChange((slot, config) => { renderSlot(slot, config); updateToolbar(slot, config); })`. Update click delegation on `#canvas`: slot click handler checks `event.target.closest('.slot-toolbar')` and returns early if found (prevents file dialog on toolbar clicks); toolbar button clicks are handled via `[data-action]` delegation (checking `closest('.slot-toolbar')` to confirm they're per-slot buttons). Add separate listener for `#global-toolbar` clicks via `[data-action]` delegation. `'print'` action calls `window.print()` directly. Remove old `onSlotClick` function.
- **Dependencies**: T-01, T-02, T-03, T-05
- **Files touched**: `src/app.js`
- **Acceptance**: Clicking "Rotate" on toolbar does NOT open file dialog; clicking empty slot still opens file dialog; state changes (from rotate, mirror, etc.) propagate to both canvas rendering and toolbar visual state; print button triggers `window.print()`; swap exchanges both images AND transforms

### T-07: Align fileLoader.js with state-driven rendering

- **Description**: Remove the direct `renderSlot(slotId, assetUrl)` call from `openFileDialog`. Remove the `import { renderSlot }` from `canvas.js`. The method should call `appState.setImage(slotId, path)` and let the state listener in `app.js` handle rendering via the `onChange` callback. No longer need to import `renderSlot`.
- **Dependencies**: T-01, T-02 (state listener is the source of truth for rendering)
- **Files touched**: `src/modules/fileLoader.js`
- **Acceptance**: Loading an image via file dialog renders it correctly with all transforms; no double-render; no console errors about missing imports

### T-08: Manual testing of all controls

- **Description**: Manual verification of all acceptance criteria from spec:
  - AC-01: Toolbar appears only when slot has an image
  - AC-02: Rotate cycles 0°→90°→180°→270°→0°
  - AC-03: Mirror toggles between normal and flipped
  - AC-04: Rotate + Mirror combine correctly
  - AC-05: Fit/Fill toggles `object-fit` correctly
  - AC-06: Clear removes image and resets transforms
  - AC-07: Swap preserves full state (rotation + mirror + fitMode)
  - AC-08: Clear All resets both slots
  - AC-09: Print opens system dialog with transforms in preview
  - AC-10: Toolbar clicks don't trigger file dialog
  - AC-11: Toolbar is visually clear and non-blocking
  - AC-12: All transforms reset on Clear / Clear All
- **Dependencies**: T-01 through T-07
- **Files touched**: None
- **Acceptance**: All 12 acceptance criteria pass; no console errors; print preview shows transforms

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated total changed lines | ~250 (7 files modified + 1 new file) |
| 400-line budget risk | Low (≈60% of budget) |
| Chained PRs recommended | No |
| Decision needed before apply | No — spec and design cover all decisions. Implementation follows SSOT pattern. |
