# Print Composition Specification

## Purpose

Server-side A4 composition, PDF generation, and system print from two image slots. Bakes margins, gutter, fitMode, rotation, mirror, orientation, and DPI into pixels — no CSS print rendering. Future CMYK support tracked in tech-debt.md.

## Data Contract

### Input

| Field | Type | Values |
|-------|------|--------|
| `slot_top/bottom` | `string` | Absolute paths |
| `margins` | `object` | `{ top, bottom, left, right, gutter }` mm |
| `orientation` | `string` | `portrait` \| `landscape` |
| `fit_top/bottom` | `string` | `contain` \| `fill` \| `cover` |
| `rotate_top/bottom` | `number` | 0, 90, 180, 270 |
| `mirror_top/bottom` | `boolean` | Horizontal flip |
| `dpi` | `number` | 150 \| 300 \| 600 |
| `mode` | `string` | `preview` \| `print` |

### Output

| Mode | Shape |
|------|-------|
| preview | `{ ok: true, preview: "data:image/png;base64,..." }` |
| print | `{ ok: true, message: "Print dialog opened" }` |
| error | `{ ok: false, error: "...", code: "ERR" }` |

Errors: `IMAGE_NOT_FOUND`, `IMAGE_DECODE_FAIL`, `COMPOSITION_FAIL`, `PDF_GENERATION_FAIL`, `PRINT_SPAWN_FAIL`, `DPI_UNSUPPORTED`.

## Requirements

### R1: A4 Canvas Composition

The system MUST render an A4 canvas at the selected DPI and composite both slot images with margins, gutter, orientation, fitMode, rotation, mirror.

#### Scenario: Portrait 300 DPI

- GIVEN `"portrait"`, DPI 300
- WHEN canvas created
- THEN dimensions 2480×3508

#### Scenario: Landscape 600 DPI

- GIVEN `"landscape"`, DPI 600
- THEN dimensions 7016×4960

#### Scenario: mm→px conversion

- GIVEN margins 10mm, gutter 5mm, DPI 300
- WHEN bounding boxes computed
- THEN each edge `10*300/25.4` px, gap `5*300/25.4` px

#### Scenario: fitMode `cover`

- GIVEN 4:3 image, 1:1.414 slot, `"cover"`
- THEN image fills slot proportionally, overflow cropped

#### Scenario: fitMode `contain`

- GIVEN off-ratio image, `"contain"`
- THEN image fits entirely, aspect ratio preserved, remainder white

#### Scenario: fitMode `fill`

- GIVEN off-ratio image, `"fill"`
- THEN image fills slot exactly, ratio not preserved

#### Scenario: Rotation + mirror baked

- GIVEN `rotate_top: 90, mirror_top: true`
- WHEN composited
- THEN pixels rotated 90° CW and mirrored

### R2: DPI Validation

The system MUST accept only 150, 300, 600.

#### Scenario: Valid 150 DPI

- GIVEN DPI 150, portrait
- WHEN canvas created
- THEN dimensions 1240×1754

#### Scenario: Invalid 200 DPI

- GIVEN DPI 200
- WHEN called
- THEN response `code: "DPI_UNSUPPORTED"`

### R3: System Print

The system MUST spawn `Start-Process -FilePath "..." -Verb Print` via PowerShell in print mode.

#### Scenario: Print dialog

- GIVEN `mode: "print"`, valid inputs
- WHEN print invoked
- THEN response `{ ok: true }`

#### Scenario: PowerShell blocked

- GIVEN PowerShell blocked by policy
- WHEN print spawn fails
- THEN response `code: "PRINT_SPAWN_FAIL"`, temp PDF remains

### R4: Preview vs Print Mode

`"preview"` → composited PNG. `"print"` → PDF + print dialog.

#### Scenario: Preview no PDF

- GIVEN `mode: "preview"`
- WHEN composition succeeds
- THEN `preview` is valid base64 PNG, no PDF or print

### R5: Error Handling

The system MUST return structured errors without panicking.

#### Scenario: Missing file

- GIVEN slot path nonexistent
- WHEN called
- THEN response `code: "IMAGE_NOT_FOUND"`

#### Scenario: Corrupted image

- GIVEN slot path is non-image
- WHEN decoded
- THEN response `code: "IMAGE_DECODE_FAIL"`

#### Scenario: Temp dir unwritable

- GIVEN temp dir not writable
- WHEN PDF writes
- THEN response `code: "PDF_GENERATION_FAIL"`

### R6: Performance Budget

The system SHOULD handle 600 DPI A4 images and respond within 30 s.

#### Scenario: 600 DPI within timeout

- GIVEN two 600 DPI source images
- WHEN `compose_print` with DPI 600 completes
- THEN response within 30 seconds
