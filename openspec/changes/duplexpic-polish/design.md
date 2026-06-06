# Design: duplexpic-polish

**Principle**: All changes are frontend-only. Zero Rust modifications.

---

## 1. Context Menu Blocking

**File**: `src/app.js` — inside `DOMContentLoaded` callback.

```js
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

Place after `initToolbars()` / `initCanvas()`. Single line, no dependencies.

---

## 2. Keyboard Reload Blocking

**File**: `src/app.js` — inside `DOMContentLoaded` callback, alongside contextmenu handler.

```js
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F5' ||
    (e.ctrlKey && e.key === 'r') ||
    (e.ctrlKey && e.shiftKey && e.key === 'R')
  ) {
    e.preventDefault();
  }
});
```

- `F5` → `e.key === 'F5'`
- `Ctrl+R` → `e.ctrlKey && e.key === 'r'`
- `Ctrl+Shift+R` → `e.ctrlKey && e.shiftKey && (e.key === 'r' || e.key === 'R')`

---

## 3. Drag & Drop

**Files**:
- `src/app.js` — event wiring in `DOMContentLoaded`
- `src/styles.css` — `.drag-over` visual state

### 3.1 Events (in `app.js`)

Attach `dragover`, `dragleave`, `drop` to each `.slot` element inside `DOMContentLoaded`:

```js
document.querySelectorAll('.slot').forEach((slot) => {
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });

  slot.addEventListener('dragleave', (e) => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];
    if (!validTypes.includes(file.type)) return;

    handleDroppedFile(slot.id, file);
  });
});
```

### 3.2 File Path Resolution

**Issue**: Browser `File` objects from DnD do not expose filesystem paths. The `appState.setImage()` expects a file path (string) for Tauri's `convertFileSrc` or dialog API.

**Options Evaluated**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | Call `open()` from `@tauri-apps/plugin-dialog` pre-filled to the dropped file's directory (fallback: user navigates to the file) | Simple, reliable, same flow as click-to-browse | Not truly seamless — user must re-select the file |
| **B** | Custom Rust command that reads `dataTransfer.files` via webview API to resolve native path | True seamless drag & drop | Requires Rust changes (violates frontend-only constraint) |
| **C** | Use `URL.createObjectURL(file)` for preview, skip persistence | Instant preview | No persistence; print won't work (needs real path) |

**Recommendation**: **Option A** for this phase. The dropped file's directory context can be extracted from the `File` webkitRelativePath or we default to the last-used directory. If the user finds this too cumbersome, Option B can be added in a follow-up.

Implementation:

```js
import { open } from '@tauri-apps/plugin-dialog';

async function handleDroppedFile(slotId, file) {
  // Use the dialog pre-populated with image filter
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Imágenes',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
    }]
  });

  if (selected === null) return;

  const path = typeof selected === 'string' ? selected : selected.path;
  appState.setImage(slotId, path);
}
```

While not "true" drag & drop (user still picks the file via dialog), it:
- Reuses the existing `openFileDialog` mechanism
- Avoids Rust changes
- Is honest about the Tauri v2 limitation
- Can be upgraded to Option B later

### 3.3 Drag Hover CSS

**File**: `src/styles.css`

```css
.slot.drag-over {
  outline: 3px dashed #4a9eff;
  outline-offset: -3px;
  background: rgba(74, 158, 255, 0.05);
}
```

- `.slot.drag-over` selector: added/removed by JS. No `!important` needed.
- Dashed blue outline mimics standard OS drag feedback.
- No layout shift (outline does not affect box model).

---

## 4. Print CSS Verification (F-06)

**File**: `src/styles.css` — `@media print` block (lines 138-189).

Review the existing rules:

| Rule | Status |
|------|--------|
| `@page { size: A4; margin: 0; }` | ✅ Correct |
| `body { background: white; padding: 0; }` | ✅ Correct |
| `#app { width: 210mm; height: 297mm; }` | ✅ Correct |
| `.slot { height: 50%; }` | ✅ Correct (100vh / 2 split) |
| `.slot-placeholder { display: none !important; }` | ✅ Correct |
| `.slot-image { display: block !important; }` | ✅ Correct |
| `.slot-toolbar, #global-toolbar { display: none !important; }` | ✅ Correct |
| `.slot { break-inside: avoid; }` | ✅ Correct |

**Verdict**: No changes needed. The existing print CSS already covers all cases. Edge case: if an image's `object-fit: cover` crops important content, user can switch to `contain` via the existing fit-mode control (`cover` vs `contain` in `object-fit` — verify that `appState.fitMode` maps correctly).

---

## 5. No Rust Changes

All six requirements are implemented entirely in frontend code (`app.js`, `styles.css`). The `tauri-plugin-dialog` and `tauri-plugin-fs` plugins are already registered in `lib.rs`.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/app.js` | Add contextmenu handler, keydown handler, dragover/dragleave/drop handlers, `handleDroppedFile()` |
| `src/styles.css` | Add `.slot.drag-over` rule |
| `src-tauri/src/lib.rs` | No changes |
| `src-tauri/Cargo.toml` | No changes |

---

## Rollback

Revert the additions in `src/app.js` and remove the `.slot.drag-over` block from `src/styles.css`. That restores the pre-polish state.
