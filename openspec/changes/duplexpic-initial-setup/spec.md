# Spec: duplexpic-initial-setup

## 1. Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| F-01 | Initialize a Tauri v2 project (2.11.x) with Rust backend and Vite + Vanilla JS frontend | P0 |
| F-02 | Display a virtual A4 canvas (aspect ratio ~1:1.414) centered in the window | P0 |
| F-03 | Divide the canvas into two equal-height 50% containers: Slot A (top) and Slot B (bottom) | P0 |
| F-04 | Each slot shows a placeholder prompt ("Haga clic para cargar imagen") when empty | P0 |
| F-05 | Clicking an empty slot opens a native file picker dialog via `tauri-plugin-dialog` | P0 |
| F-06 | Selected image loads into the slot via Tauri's `convertFileSrc` + asset protocol | P0 |
| F-07 | Loaded image is displayed centered, covering the slot area with `object-fit: cover` and proper background | P0 |
| F-08 | CSS `@media print` block forces zero margins and exact 50/50 split for printing | P0 |
| F-09 | Add `image` crate as a Rust dependency (no processing logic yet — stub) | P1 |
| F-10 | Capabilities file configured with `dialog:default` and `fs:default` permissions | P0 |
| F-11 | Asset protocol scope configured to allow reading user-selected image files | P0 |
| F-12 | Create `.gitignore` for Rust/Cargo + Node/Vite artifacts | P0 |
| F-13 | Verify app compiles and launches with `cargo tauri dev` | P0 |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NF-01 | Compiled Windows `.exe` must be a single portable file under 20MB |
| NF-02 | Memory consumption at idle must be under 20MB |
| NF-03 | Same codebase must compile on Linux without refactoring |
| NF-04 | No frontend frameworks (React, Vue, Svelte) — Vanilla JS only |
| NF-05 | Print output must match on-screen composition exactly (WYSIWYG) |
| NF-06 | Security: no `dangerous-*` Tauri APIs, no arbitrary shell access |

## 2. User Stories / Scenarios

### US-01: First launch — see the layout
> As a user, when I open the app, I see a clearly defined A4 page with two empty slots (top and bottom), each labeled with a prompt to load an image.

**Scenario:**
1. User launches the executable
2. Window appears with a centered white rectangle (A4 simulation)
3. Top half shows "Haga clic para cargar imagen superior"
4. Bottom half shows "Haga clic para cargar imagen inferior"

### US-02: Load an image into the top slot
> As a user, I click the top slot and select a JPG/PNG from my computer, and it appears in that slot.

**Scenario:**
1. User clicks the top slot area
2. Native file dialog opens, filtered for image files
3. User selects an image
4. Image renders in the top slot, centered and covering the area
5. Placeholder text disappears

### US-03: Load an image into the bottom slot
> Same as US-02 but for the bottom slot.

### US-04: Verify the app compiles and runs
> As a developer, I can run `cargo tauri dev` and see the app window with the A4 canvas.

**Scenario:**
1. Developer runs `cargo tauri dev`
2. Rust compiles successfully (no errors)
3. Webview opens with the HTML/CSS rendered
4. Canvas is visible with two empty slots

### US-05: Print preview via browser dialog (future print flow)
> As a user, the CSS is already configured so that when print is triggered (in a later phase), the page prints with zero margins and exact 50/50 split.

Note: The actual print button is **out of scope** for this phase. Only the CSS infrastructure is set up.

## 3. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | `cargo tauri dev` compiles and launches without warnings | Run command, observe output |
| AC-02 | A4 canvas is visible with two 50% height slots | Visual inspection |
| AC-03 | Each slot shows placeholder text when empty | Visual inspection |
| AC-04 | Clicking an empty slot opens the native file dialog | Manual test |
| AC-05 | Selected image renders in the clicked slot | Manual test |
| AC-06 | `@media print` CSS block exists with zero-margin A4 rules | Code review |
| AC-07 | Capabilities file includes `dialog:default` and `fs:default` | Code review |
| AC-08 | `tauri.conf.json` configures asset protocol scope | Code review |
| AC-09 | `.gitignore` covers Rust target/ and Node node_modules/ | Code review |
| AC-10 | `image` crate listed in `Cargo.toml` | Code review |
| AC-11 | Window has a meaningful title ("DuplexPic") | Code review + visual |

## 4. Out of Scope (Reminder)

The following are explicitly excluded from this phase and deferred to later phases:

- **Drag & drop** from OS file manager (Phase 2)
- **90° rotation** controls per slot (Phase 2)
- **Mirror/flip** controls (Phase 2)
- **Swap** button logic (Phase 2)
- **Fit/Fill** toggle (Phase 2)
- **Print button** and `window.print()` invocation (Phase 2)
- **Clear/remove** image per slot (Phase 2)
- **Clear All** button (Phase 2)
- Disabling context menu and F5 reload (Phase 3)
- Rust-side image processing (rotate, mirror, compose — Phase 3+)
- Any PDF generation or direct printing via system API

## 5. Key Technical Constraints

| Constraint | Detail |
|------------|--------|
| Tauri v2 API | Permissions use capabilities system, not the v1 allowlist. Missing capabilities cause silent failures. |
| `convertFileSrc` | Tauri v2 requires `asset:` protocol scope in capabilities AND `app.security.assetProtocol.scope` in `tauri.conf.json`. On some platforms, `requireLiteralLeadingDot: false` may be needed. |
| CSP header | Must include `img-src 'self' asset: https://asset.localhost` to allow asset protocol images to render. |
| Webview print | `@media print` behavior can vary across printer drivers. The HP LaserJet M1120 is the primary target. |
| No frameworks | All frontend logic must be Vanilla JS (ES modules) — no React, no bundler beyond Vite's built-in behavior. |
| Print dimensions | A4 is 210mm × 297mm. Each slot = 210mm × 148.5mm. The CSS must produce exact 50% vertical split at print time. |
