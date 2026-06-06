# Tasks: duplexpic-polish

## Tasks

### T-01: Disable context menu
- **Description**: Add document.addEventListener('contextmenu', e => e.preventDefault()) in app.js init
- **Dependencies**: None
- **Files touched**: src/app.js
- **Acceptance**: Right-click in app shows no menu

### T-02: Disable F5 and Ctrl+R reload
- **Description**: Add keydown handler blocking F5, Ctrl+R, Ctrl+Shift+R in app.js init
- **Dependencies**: None
- **Files touched**: src/app.js
- **Acceptance**: Pressing F5 or Ctrl+R does nothing

### T-03: Add drag & drop handlers + visual feedback
- **Description**: Add dragover/dragleave/drop events on .slot elements. CSS .drag-over class for dashed border.
- **Dependencies**: None
- **Files touched**: src/app.js, src/styles.css
- **Acceptance**: Dragging file over slot shows dashed border; dropping opens file dialog

### T-04: Verify no regressions
- **Description**: Click-to-browse still works, cargo check passes, all previous features intact
- **Dependencies**: T-01, T-02, T-03
- **Files touched**: None
- **Acceptance**: cargo check passes, manual tests pass

## Review Workload Forecast
- Estimated total changed lines: ~60
- 200-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
