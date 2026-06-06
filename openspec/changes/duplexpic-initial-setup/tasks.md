# Tasks: duplexpic-initial-setup

## Tasks

### T-01: Initialize Tauri v2 project scaffolding
- **Description**: Create the Tauri v2 project with Vite + Vanilla JS frontend. Run `npm create tauri-app` or manually scaffold the structure. Install npm dependencies: `@tauri-apps/cli` (dev), `vite` (dev), `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`. Configure `package.json` with scripts (`tauri dev`, `tauri build`). Set up `src-tauri/Cargo.toml` with Rust deps: `tauri 2`, `tauri-plugin-dialog 2`, `tauri-plugin-fs 2`, `image 0.25`, `serde 1`, `serde_json 1`. Write minimal `src-tauri/src/lib.rs` registering `tauri_plugin_dialog` and `tauri_plugin_fs` plugins via `tauri::Builder`. Create `src-tauri/build.rs`, `src-tauri/icons/` directory with placeholder icons.
- **Dependencies**: None
- **Files touched**: `package.json`, `vite.config.js`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`, `src-tauri/icons/`
- **Acceptance**: `npm install` completes without errors; `cargo tauri dev` compiles and opens an empty webview window with title "DuplexPic"

### T-02: Configure tauri.conf.json
- **Description**: Create `src-tauri/tauri.conf.json` with: `productName: "DuplexPic"`, `version: "0.1.0"`, `identifier: "com.duplexpic.app"`, `frontendDist: "../src"` pointing at the HTML entry, `devUrl: "http://localhost:1420"`, window config (800×1100, resizable, title "DuplexPic"), `app.security.assetProtocol.scope: ["**"]`, and CSP with `img-src 'self' asset: https://asset.localhost` plus `style-src 'self' 'unsafe-inline'`.
- **Dependencies**: T-01
- **Files touched**: `src-tauri/tauri.conf.json`
- **Acceptance**: Tauri compiles with the config; webview opens at 800×1100; asset protocol is active for image loading; CSP allows local images via asset protocol

### T-03: Create capabilities/default.json
- **Description**: Create `src-tauri/capabilities/default.json` with `identifier: "default"`, target window `"main"`, and permissions: `core:default`, `dialog:default`, `dialog:allow-open`, `fs:default`, `fs:allow-read`. Reference `$schema: "../gen/schemas/desktop-schema.json"`.
- **Dependencies**: T-01
- **Files touched**: `src-tauri/capabilities/default.json`
- **Acceptance**: Tauri compiles without capability warnings; dialog `open()` call works at runtime; file read operations are permitted

### T-04: Create .gitignore
- **Description**: Create project root `.gitignore` covering: Rust `target/`, Node `node_modules/`, Vite `dist/` and `.vite/`, OS files (`.DS_Store`, `Thumbs.db`), IDE files (`.idea/`, `.vscode/`), `*.log`, and `src-tauri/gen/` (Tauri generated schemas).
- **Dependencies**: None
- **Files touched**: `.gitignore`
- **Acceptance**: All common Rust, Node, and OS artifacts are excluded; `git status` shows only source files

### T-05: Build A4 canvas HTML structure (index.html)
- **Description**: Create `src/index.html` with semantic A4 canvas layout. Structure: `#app` full-viewport wrapper → `#canvas.a4-sheet` → two child `.slot` divs (`#slot-top`, `#slot-bottom`). Each slot contains a `.slot-placeholder` (centered text: "Haga clic para cargar imagen superior/inferior") and an `<img class="slot-image">` (hidden initially). Link `styles.css` in `<head>` and load `app.js` as `<script type="module">` at end of `<body>`. Set `<meta charset="UTF-8">` and `<title>DuplexPic</title>`.
- **Dependencies**: T-01 (src/ directory exists as frontendDist target)
- **Files touched**: `src/index.html`
- **Acceptance**: HTML validates; two slot containers with placeholders render in browser; module script loads without errors

### T-06: Build CSS layout (styles.css)
- **Description**: Create `src/styles.css` with two sections. **Screen styles**: body reset (margin/padding 0, dark background `#2c2c2c`), `#app` full viewport with flex centering, `#canvas.a4-sheet` at 595px wide with auto height (A4 ratio), white background with subtle box-shadow, `.slot` at 100% width × 50% height with `overflow: hidden`, `.slot-placeholder` with flex centering, subtle border/gap between slots (2px `#ccc` border), placeholder text styling (gray, 1.2rem, pointer cursor), `.slot-image` with `object-fit: cover` + `width: 100%; height: 100%` + `display: none` when empty. **Print styles** (`@media print`): `@page { size: A4; margin: 0; }`, body/`#app`/`#canvas` at 210mm × 297mm with no shadow/border/background, `.slot` at exact 50% height with `break-inside: avoid`, `.slot-placeholder { display: none !important; }`, `.slot-image { display: block !important; object-fit: cover; }`.
- **Dependencies**: T-05 (styles.css is linked from index.html)
- **Files touched**: `src/styles.css`
- **Acceptance**: Screen layout shows centered A4 sheet with two equal halves; print preview (Ctrl+P in dev) shows zero-margin A4 with exact 50/50 split; no layout shift between screen and print

### T-07: Implement state.js (AppState class)
- **Description**: Create `src/modules/state.js` exporting an `AppState` class with: `slots` property (`{ top: null, bottom: null }`), `setImage(slot, path)` method updating state and logging, `clearSlot(slot)` method resetting to null, `getImage(slot)` accessor, `isEmpty(slot)` boolean check. Use a simple event dispatch pattern or callback registration so canvas.js can react to state changes. Export a singleton `appState` instance.
- **Dependencies**: None
- **Files touched**: `src/modules/state.js`
- **Acceptance**: Module loads without errors; `appState.setImage('top', path)` updates state correctly; `appState.isEmpty('top')` returns `false` after set, `true` after clear

### T-08: Implement canvas.js (renderSlot, clearSlot)
- **Description**: Create `src/modules/canvas.js` exporting functions: `renderSlot(slotId, imageSrc)` — selects the slot container by ID, hides `.slot-placeholder` (`display: none`), sets `<img>` src to the asset URL and makes it visible (`display: block`). `clearSlot(slotId)` — resets slot to empty state (shows placeholder, hides image). `initCanvas()` — ensures both slots start in empty state. All functions operate directly on DOM via `document.getElementById`.
- **Dependencies**: T-05 (DOM structure must exist with correct IDs)
- **Files touched**: `src/modules/canvas.js`
- **Acceptance**: `renderSlot('top', assetUrl)` updates the DOM correctly; `clearSlot('top')` restores placeholder; `initCanvas()` sets both slots to empty

### T-09: Implement fileLoader.js (dialog open, convertFileSrc, error handling)
- **Description**: Create `src/modules/fileLoader.js` exporting `openFileDialog(slotId)` async function. Use `@tauri-apps/plugin-dialog` `open()` with filters for image types (`*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.bmp`, `*.webp`), `multiple: false`. On file selected, call `@tauri-apps/api/core` `convertFileSrc(path)` to get asset protocol URL. Handle cancel (null selection) gracefully. Handle errors with a `try/catch` that logs and shows a user-facing alert. Return the asset URL on success, `null` on cancel. Call `canvas.renderSlot(slotId, assetUrl)` and `state.setImage(slotId, originalPath)` on success. Export as named function.
- **Dependencies**: T-05 (slot DOM), T-08 (canvas.renderSlot), T-07 (state.setImage)
- **Files touched**: `src/modules/fileLoader.js`
- **Acceptance**: Clicking a slot opens native file dialog filtered to images; selecting a file renders it in the slot; cancel returns to previous state; errors show an alert

### T-10: Wire up app.js controller
- **Description**: Create `src/app.js` as the ES module controller. Import `AppState` from `./modules/state.js`, `renderSlot`, `clearSlot`, `initCanvas` from `./modules/canvas.js`, `openFileDialog` from `./modules/fileLoader.js`. Implement `onSlotClick(slotId)` handler: calls `openFileDialog(slotId)`. Register click handlers on both `.slot` containers via `addEventListener('click', ...)`. Call `initCanvas()` on DOMContentLoaded. Use a thin delegation pattern: one listener on `#canvas` with event delegation to detect which slot was clicked.
- **Dependencies**: T-07, T-08, T-09, T-05 (DOM ready)
- **Files touched**: `src/app.js`
- **Acceptance**: Clicking an empty slot opens the file dialog; selecting an image renders it; both slots work independently; no console errors on init

### T-11: Verify compilation and manual testing
- **Description**: Run `cargo tauri dev` and verify: (1) Rust compiles without warnings, (2) webview window opens with correct title "DuplexPic" and 800×1100 size, (3) A4 canvas renders centered with two empty slots showing placeholder text, (4) clicking each slot opens the native OS file dialog, (5) selecting an image renders it in the correct slot with `object-fit: cover`, (6) both slots can hold independent images, (7) print preview shows zero-margin A4 with 50/50 split, (8) window is resizable and maintains layout. Run `npm run build` (or `cargo tauri build`) to verify release build succeeds and produces a portable `.exe`.
- **Dependencies**: T-01 through T-10
- **Files touched**: None (verification only)
- **Acceptance**: All acceptance criteria from spec (AC-01 through AC-11) pass; no compiler warnings; app produces a working `.exe` under 20MB

## Review Workload Forecast

- **Estimated total changed lines**: ~420
- **400-line budget risk**: Medium
- **Chained PRs recommended**: No
- **Decision needed before apply**: No
