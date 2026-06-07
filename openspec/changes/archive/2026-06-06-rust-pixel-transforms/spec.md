# Spec: rust-pixel-transforms

## 1. Requirements

### Functional Requirements

#### Image Transforms (New)

| ID | Requirement | Priority |
|----|------------|----------|
| F-IT-01 | Rust MUST expose a `transform_image(path: String, rotation: u32, mirrored: bool) -> String` Tauri command that decodes an image file, applies pixel-level rotation (0/90/180/270 degrees clockwise) and/or horizontal mirror, encodes as PNG, and returns a base64 data URL prefix `data:image/png;base64,...` | P0 |
| F-IT-02 | Rotation SHALL accept values `0`, `90`, `180`, `270`. Values outside this set SHOULD be normalized modulo 360. | P0 |
| F-IT-03 | Mirror SHALL flip the pixel buffer horizontally (not a CSS `scaleX`). | P0 |
| F-IT-04 | `SlotConfig` SHALL gain a `transformedUrl: string | null` field for caching the Rust output. | P0 |
| F-IT-05 | When `imagePath` changes, `transformedUrl` MUST be set to `null` (invalidated). | P0 |
| F-IT-06 | When `rotation` or `mirrored` changes after a load, the frontend MUST call `invoke('transform_image', { path, rotation, mirrored })`, cache the resulting data URL in `transformedUrl`, and update the `<img>` `src` attribute. | P0 |
| F-IT-07 | When `rotation` AND `mirrored` are both at defaults (0 / false) AND `imagePath` is set, the frontend MAY render via the existing `read_image` path or `transform_image` — either is acceptable since the output is identical. | P1 |
| F-IT-08 | Swap SHALL exchange the two `SlotConfig` objects (including their `transformedUrl` values). No Rust call SHALL be made during swap. | P0 |
| F-IT-09 | CSS `transform` property on `.slot-image` MUST be cleared — rotation and mirror are now pixel-level operations applied in Rust. | P0 |
| F-IT-10 | `object-fit` on the `<img>` element MUST remain in effect and compute against the already-transformed pixel dimensions. | P0 |

#### Context Menu Suppression (New)

| ID | Requirement | Priority |
|----|------------|----------|
| F-CM-01 | The WebView2 context menu (right-click menu in the app window) MUST be suppressed at the host (COM) level, not via JS `preventDefault`. | P0 |
| F-CM-02 | The suppression SHALL use `tauri-plugin-prevent-default` with `Flags::CONTEXT_MENU` only — no other default behaviors SHALL be blocked. | P0 |
| F-CM-03 | The plugin SHALL be registered in `tauri::Builder::default().plugin(...)` in `lib.rs`. | P0 |
| F-CM-04 | The JS `contextmenu` event listener on each `.slot` element MUST remain in place — it handles the custom right-click → open file dialog behavior. The host-level suppression SHALL prevent the native menu from showing, but the JS handler SHALL still fire. | P0 |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NF-01 | `transform_image` MUST execute asynchronously from the JS side (Tauri invoke is inherently async). The Rust function itself SHOULD complete within 500ms for a 10 MP image (test target). |
| NF-02 | Peak additional memory for cached data URLs across both slots MUST NOT exceed 50 MB for typical images (up to 20 MP each). |
| NF-03 | `tauri-plugin-prevent-default` MUST only be enabled on Windows targets (`unstable-windows` feature). On non-Windows platforms, the plugin MUST be omitted or conditionally compiled. |
| NF-04 | Zero additional network requests: all image data flows through Tauri IPC (invoke) and base64 data URLs. |
| NF-05 | The `image` crate (already at `0.25` in dependencies) SHALL be used and MUST NOT require additional system libraries on Windows. |

## 2. Scenarios

### Happy Path

#### H-01: Load image, rotate 90°, fill mode respects rotated orientation

1. **GIVEN** the application is running
2. **WHEN** the user loads a 1920×1080 landscape image into the top slot
3. **AND** clicks the Rotate 90° button twice (180° total)
4. **THEN** the image renders as pixel-rotated with correct aspect ratio
5. **AND** `object-fit: cover` fills the slot without stretching the wrong axis
6. **AND** no CSS `transform` property is set on the `<img>`

#### H-02: Mirror flips pixel data

1. **GIVEN** the top slot has a loaded image with text readable left-to-right
2. **WHEN** the user clicks the Mirror button
3. **THEN** the image is rendered horizontally flipped at the pixel level
4. **AND** the data URL in `transformedUrl` is a freshly encoded PNG

#### H-03: Swap slots with transforms

1. **GIVEN** slot-top has image A rotated 90° and slot-bottom has image B mirrored
2. **WHEN** the user clicks Swap
3. **THEN** slot-top now shows image B (mirrored) and slot-bottom shows image A (rotated 90°)
4. **AND** no `invoke('transform_image')` calls were made — only cached URLs were exchanged

#### H-04: Context menu suppressed, custom action still works

1. **GIVEN** an empty slot is visible
2. **WHEN** the user right-clicks on the empty slot area
3. **THEN** the native WebView2 context menu does NOT appear
4. **AND** the file open dialog opens (JS handler fires correctly)

### Edge Cases

#### E-01: Rotate four times returns to original

1. **GIVEN** a loaded image with transform defaults
2. **WHEN** the user clicks Rotate 90° four times
3. **THEN** the final `rotation` is 0 (modulo 360)
4. **AND** the cache is recomputed each time — four Rust calls, four data URLs

#### E-02: Mirror then rotate — order is deterministic

1. **GIVEN** a loaded image
2. **WHEN** the user mirrors first, then rotates 90°
3. **AND** clears, loads same image, rotates 90° first, then mirrors
4. **THEN** the two resulting images MUST be visually identical (Rust applies rotation then mirror in a fixed order)

#### E-03: Clear slot clears cached URL

1. **GIVEN** a transformed image in the top slot with `transformedUrl` populated
2. **WHEN** the user clicks Clear
3. **THEN** `imagePath` is null, `transformedUrl` is null, the `<img>` `src` is empty

#### E-04: Multiple rapid rotates

1. **GIVEN** a large image loaded
2. **WHEN** the user clicks Rotate 90° five times in < 1 second
3. **THEN** the last visible state matches the cumulative rotation
4. **AND** no stale intermediate results are shown (sequential invoke calls resolve in order)

### Error Cases

#### X-01: Invalid image path

1. **GIVEN** `imagePath` points to a deleted or inaccessible file
2. **WHEN** the user triggers rotate (calling `transform_image`)
3. **THEN** the Rust command returns an `Err` result
4. **AND** the frontend logs the error and keeps the previous valid state

#### X-02: Corrupt image file

1. **GIVEN** `imagePath` points to a truncated/non-image file
2. **WHEN** the image crate attempts to decode it
3. **THEN** the command returns an `Err` result
4. **AND** no data URL is set; the slot may show a broken-image indicator

#### X-03: Rotation value out of set

1. **GIVEN** a loaded image
2. **WHEN** the frontend calls `transform_image` with `rotation: 45`
3. **THEN** the Rust command SHALL return an `Err("rotation must be 0, 90, 180, or 270")`

## 3. Data Flow

### Transform Image Flow

```
┌──────┐  rotate/mirror click  ┌───────────────┐  invoke()  ┌───────────────────┐
│ User │─────────────────────> │ controls.js   │──────────> │ lib.rs            │
└──────┘                       │               │            │ transform_image() │
                               │ appState.set  │            │                   │
                               │ Rotation/     │            │ decode via        │
                               │ Mirrored()    │            │ image::open()     │
                               └───────┬───────┘            │                   │
                                       │                    │ apply rotate      │
                                       │ notify listeners   │ apply mirror      │
                                       ▼                    │ encode PNG        │
                               ┌───────────────┐            │ to base64         │
                               │ canvas.js     │            └────────┬──────────┘
                               │ renderSlot()  │                     │
                               │               │        data:image/png;base64,...
                               │ check cache → │ ←──────────────────┘
                               │ if miss:      │
                               │   invoke()    │
                               │ store in      │
                               │ transformedUrl│
                               └───────┬───────┘
                                       │
                                       │ set img.src = transformedUrl
                                       ▼
                               ┌───────────────┐
                               │ <img> in slot │
                               │ no CSS        │
                               │ transform      │
                               │ object-fit    │
                               │ still applied  │
                               └───────────────┘
```

### Cache Invalidation Flow

```
                  setImage(path)
                       │
                       ▼
            SlotConfig.imagePath = path
            SlotConfig.transformedUrl = null
                       │
                       ▼
                 renderSlot()
              invokes transform_image
              with default rot=0, mirr=false
              (or skips if no rotation/mirror needed)
              
                  rotate/mirror
                       │
                       ▼
            SlotConfig.transformedUrl ≠ null
            (from previous load)
                       │
                       ▼
                 renderSlot()
              sees rot/mirr changed from cached
              → invokes transform_image
              → stores new URL

                  swap()
                       │
                       ▼
            Exchange entire SlotConfig objects
            Including transformedUrl
            Zero Rust calls
```

### Context Menu Suppression Flow

```
                    User right-clicks
                           │
                           ▼
          ┌────────────────────────────────┐
          │ WebView2 host (Rust/Plugin)    │
          │ Flags::CONTEXT_MENU            │
          │ → suppresses native menu       │
          └──────────────┬─────────────────┘
                         │
                         │ still delivers DOM event
                         ▼
          ┌────────────────────────────────┐
          │ JS contextmenu listener fires  │
          │ → opens file dialog if empty   │
          └────────────────────────────────┘
```

## 4. Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | `transform_image` returns a valid `data:image/png;base64,...` for a JPG input with rot=90, mirr=false | Attach Rust unit test; verify prefix and valid PNG header in decoded bytes |
| AC-02 | `transform_image` returns error for invalid path | Rust unit test with non-existent path |
| AC-03 | `transform_image` returns error for rotation=45 | Rust unit test with invalid rotation value |
| AC-04 | After loading an image and clicking Rotate 90°, the `<img>` element has no `transform` CSS property | DevTools inspection (or check `image.style.transform === ''`) |
| AC-05 | After rotating 90° with `fitMode: fill`, the image fills the slot without stretching the wrong axis (landscape image in portrait slot shows correct orientation) | Visual inspection |
| AC-06 | After Mirror, rendered text is correctly mirrored (e.g., a left-to-right arrow points right on original, left after mirror) | Visual inspection |
| AC-07 | Swap exchanges images AND their transforms in < 16ms | Measure `performance.now()` around swap call; verify zero `invoke` calls via console tracing |
| AC-08 | Four 90° rotates return to original pixel orientation | Visual inspection + verify `rotation` value is 0 |
| AC-09 | Right-click anywhere in the app window does NOT show the native context menu | Manual test: right-click on slot, toolbar, canvas area, empty space |
| AC-10 | Right-click on an empty slot still opens the file dialog | Manual test |
| AC-11 | Clear sets `transformedUrl` to null and `<img>` `src` to empty | Code review + DevTools |
| AC-12 | `@media print` CSS output is unchanged and still produces correct A4 output | Print preview shows both slots at 50% height with images (regression check) |
| AC-13 | `cargo tauri build` succeeds without warnings on Windows | Run command |
| AC-14 | `tauri-plugin-prevent-default` is registered with `Flags::CONTEXT_MENU` only | Code review of `lib.rs` |
