# Design: duplexpic-initial-setup

## 1. Project Directory Structure

```
duplexpic/
├── src/                          # Frontend source
│   ├── index.html                # Entry point — A4 canvas layout
│   ├── styles.css                # All styles (screen + print)
│   ├── app.js                    # Main app controller (ES module)
│   └── modules/                  # JS modules
│       ├── canvas.js             # Canvas/rendering logic
│       ├── fileLoader.js         # File dialog + asset loading
│       └── state.js              # Slot state management
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   ├── capabilities/             # Tauri v2 permissions
│   │   └── default.json          # Capability set for the app
│   ├── src/
│   │   └── lib.rs                # Tauri app entry + commands
│   ├── icons/                    # App icons
│   └── build.rs                  # Tauri build script
├── .gitignore                    # Rust + Node artifacts
├── package.json                  # Node deps (Vite, Tauri CLI)
└── CONTEXT.md                    # Project context doc
```

## 2. Frontend Architecture

### HTML Structure (`src/index.html`)

```
body
└── #app
    └── #canvas.a4-sheet           ← A4 simulation container
        ├── #slot-top.slot          ← Top half (50% height)
        │   ├── .slot-placeholder   ← Placeholder text (hidden when image loaded)
        │   └── img.slot-image      ← Loaded image (hidden when no image)
        └── #slot-bottom.slot       ← Bottom half (50% height)
            ├── .slot-placeholder
            └── img.slot-image
```

Key points:
- `#canvas` uses fixed pixel width proportional to A4 (~595px wide) centered horizontally
- Each `.slot` is 100% width × 50% height of parent, with `overflow: hidden`
- Images use `object-fit: cover` + `width: 100%; height: 100%` to fill their slot
- Placeholder text is centered with `display: flex; align-items: center; justify-content: center`

### CSS Organization (`src/styles.css`)

Two sections:
1. **Screen styles** — Default styling for the app window
   - Dark/neutral background outside the A4 sheet
   - White sheet with subtle shadow for depth
   - Slot dividers with a light border/gap
   - Placeholder styling (icon + text)
   - Smooth transitions for image loading

2. **Print styles** — `@media print` block
   - `@page { size: A4; margin: 0; }`
   - Remove background, shadow, borders from sheet
   - Force each slot to exactly 50% of the page height
   - Images at full resolution

### JS Module Architecture (`src/app.js`, `src/modules/`)

```
app.js (controller)
├── imports canvas.js
│   └── renderSlot(slotId, imageSrc)
│       └── Updates DOM: hides placeholder, shows <img>
├── imports fileLoader.js
│   └── openFileDialog(slotId)
│       └── Uses window.__TAURI__.dialog.open()
│       └── Uses window.__TAURI__.core.convertFileSrc()
│       └── Calls canvas.renderSlot()
└── imports state.js
    └── AppState class
        ├── slots: { top: null, bottom: null }
        ├── setImage(slot, path)
        └── clearSlot(slot)
```

Data flow for image loading:
1. User clicks slot → `onSlotClick(event)` handler
2. Calls `fileLoader.openFileDialog(slotId)`
3. `openFileDialog` calls `@tauri-apps/plugin-dialog` `open()` with image filters
4. On file selected, calls `convertFileSrc(path)` to get asset protocol URL
5. Calls `canvas.renderSlot(slotId, assetUrl)`
6. `renderSlot` hides `.slot-placeholder`, sets `img.slot-image.src = assetUrl`
7. State is updated via `state.setImage(slotId, originalPath)`

## 3. Backend Architecture (Rust)

### `Cargo.toml` dependencies

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
image = "0.25"    # stub — no processing yet
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### `src/lib.rs`

Minimal setup:
- `tauri::Builder` with `tauri-plugin-dialog` and `tauri-plugin-fs` plugins registered
- No custom commands in this phase (commands come later for processing)
- Default `run` hook

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `tauri.conf.json` key configuration

```json
{
  "productName": "DuplexPic",
  "version": "0.1.0",
  "identifier": "com.duplexpic.app",
  "build": {
    "frontendDist": "../src",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "windows": [
      {
        "title": "DuplexPic",
        "width": 800,
        "height": 1100,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "assetProtocol": {
        "scope": ["**"]
      },
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'; script-src 'self'"
    }
  }
}
```

Note: `assetProtocol.scope: ["**"]` allows loading any file the user selects. This is acceptable for a local desktop app that only loads user-chosen files. If more restrictive, scope to the user's Pictures folder or a temp directory.

## 4. Data Flow Diagrams

### Image Loading Flow

```
User clicks Slot A (empty)
        │
        ▼
app.js: onSlotClick('top')
        │
        ▼
fileLoader.openFileDialog('top')
        │
        ├─► Tauri dialog plugin: open({ filters: [images] })
        │       │
        │       ▼
        │   User selects "photo.jpg"
        │       │
        │       ▼
        ├─► convertFileSrc("C:/Users/User/Pictures/photo.jpg")
        │       │
        │       ▼
        │   Returns "asset://localhost/..." URL
        │       │
        │       ▼
        ├─► canvas.renderSlot('top', assetUrl)
        │       │
        │       ▼
        │   DOM: #slot-top
        │   ├── .slot-placeholder → display: none
        │   └── img.slot-image → src = assetUrl, display: block
        │
        ▼
state.setImage('top', "C:/Users/User/Pictures/photo.jpg")
```

### Print Flow (future, CSS infrastructure only)

```
User clicks Print (Phase 2+)
        │
        ▼
window.print()
        │
        ▼
Browser print dialog
        │
        ▼
@media print CSS applied:
  - @page { size: A4; margin: 0; }
  - .a4-sheet { width: 210mm; height: 297mm; }
  - .slot { height: 50%; }
  - No background/shadow
        │
        ▼
Printer outputs exact visual composition
```

### Application Startup Flow

```
cargo tauri dev
    │
    ├─► Vite dev server starts (port 1420)
    │
    ├─► Rust compiles + runs
    │   ├─► lib.rs::run()
    │   ├─► Plugin: dialog registered
    │   ├─► Plugin: fs registered
    │   └─► Webview window opens (800×1100)
    │
    └─► index.html loads in webview
        ├─► styles.css applied
        ├─► app.js initializes
        │   ├─► canvas.js: renders empty A4 sheet
        │   └─► state.js: creates AppState { top: null, bottom: null }
        └─► User sees two empty slots
```

## 5. Security Configuration

### Capabilities file (`src-tauri/capabilities/default.json`)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability set for DuplexPic",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "fs:default",
    "fs:allow-read"
  ]
}
```

### CSP

```
default-src 'self';
img-src 'self' asset: https://asset.localhost;
style-src 'self' 'unsafe-inline';
script-src 'self'
```

- `unsafe-inline` on `style-src` is needed for dynamic/inline styles (acceptable for desktop app — no XSS cross-user risk)
- `asset:` + `https://asset.localhost` on `img-src` allows Tauri's asset protocol images to render
- `script-src 'self'` — no inline scripts, no eval

### Asset Protocol Scope

Configured in `tauri.conf.json` under `app.security.assetProtocol`:
- Scope: `["**"]` (any path the user selects)
- This is safe because file selection goes through the native dialog — the user explicitly chooses which files to load

## 6. Print Strategy

### CSS `@media print` rules

```css
@media print {
    @page {
        size: A4;
        margin: 0;
    }

    body {
        margin: 0;
        padding: 0;
        background: white;
    }

    #app {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
    }

    #canvas {
        width: 210mm;
        height: 297mm;
        box-shadow: none;
        border: none;
    }

    .slot {
        height: 50%;
        width: 100%;
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .slot-placeholder {
        display: none !important;
    }

    .slot-image {
        object-fit: cover;
        width: 100%;
        height: 100%;
    }
}
```

Key decisions:
- `210mm × 297mm` — exact A4 physical dimensions
- No `box-shadow`, no border-radius, no background colors in print
- Each `.slot` is exactly 50% height of the A4 page
- `object-fit: cover` ensures images fill the slot without distortion (edges may be cropped)
- `break-inside: avoid` prevents page breaks inside a slot

### Why this approach

Using `@media print` + `@page` CSS avoids the need for:
- PDF generation libraries (wkhtmltopdf, headless Chrome)
- Rust-side image composition for printing
- System print API calls

If the HP LaserJet M1120 driver ignores CSS print rules, we fall back to Rust-side composition (Phase 3/4).

## 7. Component Tree

```
Tauri Webview Window ("DuplexPic")
│
├── <head>
│   ├── <link rel="stylesheet" href="styles.css">
│   └── <meta charset="UTF-8">
│
├── <body>
│   │
│   └── <div id="app">                          ← Full viewport container
│       │
│       └── <div id="canvas" class="a4-sheet">  ← Centered A4 simulation
│           │                                   ← 595px × 842px on screen
│           │                                   ← 210mm × 297mm in print
│           │
│           ├── <div id="slot-top" class="slot"> ← 50% height (298px on screen)
│           │   ├── <div class="slot-placeholder">  ← Visible when empty
│           │   │   └── <span>📄 Haga clic para cargar imagen superior</span>
│           │   │
│           │   └── <img class="slot-image">     ← Hidden when empty
│           │                                     ← object-fit: cover
│           │
│           └── <div id="slot-bottom" class="slot"> ← 50% height
│               ├── <div class="slot-placeholder">
│               │   └── <span>📄 Haga clic para cargar imagen inferior</span>
│               │
│               └── <img class="slot-image">
│
└── <script type="module" src="app.js">          ← ES module controller
```

## 8. Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 01 | **Vanilla JS instead of React/Vue** | The app has trivial state (2 slots). A framework adds 40-100KB to the bundle, a build complexity layer, and no benefit for a two-slot app. Vanilla `class AppState` with DOM manipulation is simpler, faster, and more maintainable here. |
| 02 | **`object-fit: cover` for images** | Ensures images fill their slot without distortion. User gets a clean fill regardless of source aspect ratio. Edges may crop, which the user sees in the preview and can adjust by rotating. |
| 03 | **Fixed pixel width for A4 on screen (595px)** | Matches A4 ratio at ~96 DPI. Using `width: 595px` with auto height gives a predictable centered layout. On print, we override to exact `210mm × 297mm`. |
| 04 | **Asset protocol with `["**"]` scope** | The user explicitly selects files through the native dialog — there is no path traversal risk. A narrower scope (e.g., only Pictures folder) would break when users pick files from Desktop, Downloads, or external drives. |
| 05 | **ES modules with `type="module"`** | Clean dependency management without a bundler. Each module has a single responsibility. `app.js` imports exactly what it needs. |
| 06 | **No Tauri commands in this phase** | Phase 1 is purely scaffolding + frontend. The first custom command (`process_images` or similar) comes when we need Rust-side rotation or composition. |
| 07 | **`page-break-inside: avoid` + `break-inside: avoid`** | Both properties ensure cross-browser compatibility. The `page-break-*` prefix is the legacy name, `break-inside` is the modern standard. Using both covers all webview versions Tauri v2 may embed. |
| 08 | **CSP with `unsafe-inline` on style-src** | Required for any inline styles or dynamic CSS injection. In a desktop app with no user-content rendering, the CSP XSS risk is negligible. We accept this tradeoff for simplicity. |
