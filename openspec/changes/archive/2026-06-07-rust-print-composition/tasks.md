# Tasks: Rust Print Composition

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |
| PR split (user decision) | **PR 1**: Rust engine (~530) → **PR 2**: Frontend + Tests (~470) |

Decision needed before apply: No (resolved)
Chain strategy: stacked-to-main
400-line budget risk: Low (explicit size:exception for both PRs under 600)

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rust composition engine + command wiring | PR 1 | print/ module (4 files), Cargo.toml, lib.rs command |
| 2 | Frontend print UI + invoke integration | PR 2 | state.js, controls.js, properties.js, sidebar.js, index.html, styles.css |
| 3 | Comprehensive tests | PR 2 | Unit + integration tests alongside print/ module, merged with frontend PR |

## Phase 1: Backend Module Foundation ✅ (PR 1)

- [x] 1.1 Add `printpdf` dep to `src-tauri/Cargo.toml`
- [x] 1.2 Create `print/error.rs` — PrintError enum with 6 spec-coded variants + Display
- [x] 1.3 Create `print/composition.rs` — A4Canvas struct, mm_to_px, slot_bbox, fit_contain/fill/cover, composite loop
- [x] 1.4 Create `print/pdf.rs` — PdfDocumentBuilder with RGB image embed, temp file write, PowerShell spawn
- [x] 1.5 Create `print/mod.rs` — Public facade exposing compose_preview() and compose_print()
- [x] 1.6 Wire `compose_print` in `lib.rs` — input validation (DPI 150/300/600, orientation, fit modes), mode dispatch, register in invoke_handler

## Phase 2: Frontend Print Controls

- [x] 2.1 Add `dpi`, `printPreviewMode`, `composedUrl` fields to AppState
- [x] 2.2 Add print tab to sidebar nav (`data-tab="print"`) + `#tab-print` pane
- [x] 2.3 Add DPI selector (150/300/600), Preview/Print buttons to `index.html`
- [x] 2.4 Implement print tab logic in `properties.js` — DPI bindings, preview/print triggers via `compose_print` invoke
- [x] 2.5 Replace `window.print()` in `controls.js` with preview/print toggle via `triggerComposePreview`/`triggerComposePrint`
- [x] 2.6 Add print preview rendering in `canvas.js` — overlay shows composed PNG, hides zoom bar, Back to Edit button

## Phase 3: Tests

- [x] 3.1 Unit tests for composition — already covered in PR 1 (28 Rust tests pass). No additional Rust changes in PR 2.
- [-] 3.2 Integration tests — skipped per SDD apply instructions: no frontend test framework exists (no Jest/Karma), no test infrastructure set up. Frontend testing is manual.

## Phase 4: Cleanup

- [x] 4.1 Remove obsolete `@media print` CSS rules from `styles.css`
- [x] 4.2 Remove `window.print()` fallback from `controls.js` — replaced with `invoke('compose_print', ...)`

## Implementation Order

Batch 1 (Foundation): Tasks 1.1–1.5 — independent, can be parallelized within this batch.
Batch 2 (Command Wiring): Task 1.6 — depends on all Batch 1 types existing.
Batch 3 (Frontend State + UI): Tasks 2.1–2.4 — can run in parallel with Batch 1–2 (UI doesn't need Rust).
Batch 4 (Frontend Integration): Tasks 2.5–2.6 — needs Batch 2 (command exists) + Batch 3 (UI wired).
Batch 5 (Tests): Tasks 3.1–3.2 — after Batch 2, uses print/ module for direct unit + integration testing.
Batch 6 (Cleanup): Tasks 4.1–4.2 — last, after verifying new pipeline works.

## Dependency Graph

```
1.1–1.5 ──→ 1.6 ──→ 2.5, 2.6 (indirect)
                  ↗
2.1 ──→ 2.2–2.4 ──┘
                    └──→ 3.1, 3.2 (direct)
                              └──→ 4.1, 4.2
```
