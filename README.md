# DuplexPic Print Helper

**Print two images on a single sheet — without Windows fighting you.**

DuplexPic is a lightweight desktop app that lets you compose two images onto one A4 page, control every aspect of the layout, and print directly — bypassing the Windows print assistant's automatic (and often wrong) rotations.

![DuplexPic screenshot](screenshot.png)

---

## The Problem

Windows' built-in photo printing tries to be "smart": it reads EXIF orientation metadata and auto-rotates each image independently. If you have one vertical and one horizontal photo on the same page, one comes out right and the other sideways — even if you manually rotated them in File Explorer. There's no way to force a consistent layout.

## The Solution

A native desktop app that shows you **exactly** what will be printed, lets you tweak everything, and sends a pixel-perfect composition to the printer:

1. Load two images into fixed top/bottom slots
2. Rotate (90° increments), mirror, and fit each one independently
3. Adjust margins and gutter spacing with live preview
4. Choose your DPI, page size, grayscale mode, and crop marks
5. Print directly, open in your PDF viewer, or save as PDF

---

## Features

- **Dual-slot canvas**: top and bottom image slots on a virtual A4 sheet
- **Per-slot controls**: rotate 90°, mirror horizontally, fit/contain/fill modes
- **Live margin preview**: drag sliders and see margins update in real time
- **Orientation toggle**: switch between portrait and landscape
- **Swap**: exchange top and bottom images with one click
- **Print directly** (Rust → PDF → system print dialog)
- **Open in PDF viewer** to review before printing
- **Save as PDF** to any location
- **Multi-copy**: print 1–30 copies, each as a separate page
- **Grayscale output**: save toner when color isn't needed
- **Crop marks**: thin guides at slot corners for manual trimming
- **Drag & drop**: drop images directly onto slots
- **DPI**: 150, 300, or 600 DPI
- **Page sizes**: A4, A5, Letter
- **Single-slot mode**: print only the top or bottom slot

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| GUI framework | [Tauri v2](https://v2.tauri.app) |
| Frontend | Vanilla JavaScript + CSS (no framework) |
| Backend | Rust (`image`, `printpdf`) |
| PDF engine | PrintPDF via Rust composition pipeline |
| Print dispatch | PowerShell `Start-Process -Verb Print` |
| Bundles | NSIS (portable .exe) + MSI installer |

### Why this stack?

Tauri gives a modern, responsive UI with CSS while keeping the executable tiny (~5 MB). All image processing and PDF generation happens in Rust — deterministic, driver-independent, and free of browser print quirks. No Electron bloat, no JavaScript image libraries.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/#windows)
  - Microsoft Visual Studio C++ Build Tools
  - WebView2 (included in Windows 10 1803+)

### Development

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot-reload)
npm run tauri dev
```

### Build for distribution

```bash
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/`:
- `duplexpic_1.2.0_x64-setup.exe` (NSIS installer)
- `duplexpic_1.2.0_x64_en-US.msi` (MSI installer)
- `duplexpic_1.2.0_x64-setup.exe` also works as a **portable executable** (extracts and runs without installation)

---

## Usage

1. **Load images**: click or drag & drop an image into each slot
2. **Adjust**: rotate, mirror, or change fit mode per slot
3. **Set margins**: use the sliders under the Margins tab — changes are live
4. **Toggle orientation**: swap between portrait and landscape
5. **Open the Print tab**: choose DPI, page size, copies, and output method
6. **Print, open, or save**: click the corresponding button

### Print methods

| Method | What happens |
|--------|-------------|
| **Directo** | Rust generates the PDF and sends it to the Windows print dialog |
| **Abrir en visor** | PDF opens in your default PDF viewer (print from there) |
| **Guardar PDF** | Save the PDF to any location on disk |

---

## Keyboard shortcuts

None yet — the app is designed for mouse/touch use on a single window. The context menu and refresh keys are intentionally disabled to behave like a native app.

---

## Roadmap

- [ ] **Native GDI printing** (bypass PDF entirely for faster direct output)
- [ ] **CMYK output** (for professional print shops)
- [ ] **Auto-cleanup** of temporary PDF files
- [ ] **Linux support** (the Rust backend is already cross-platform)

---

## License

MIT
