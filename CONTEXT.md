# DuplexPic — Contexto para la IA

Resumen ejecutivo del proyecto. Lo esencial que no está en `README.md`.

---

## Stack (en uso)

| Capa | Tecnología |
|------|-----------|
| GUI | Tauri v2 (`protocol-asset`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-prevent-default`) |
| Frontend | Vanilla JS + CSS modular (sin frameworks) |
| Backend Rust | `image` 0.25 (decodificar, rotar, fliph, escalar), `printpdf` 0.9 (PDF), `base64` 0.22 (data URLs) |
| Impresión | PowerShell `Start-Process -Verb Print` / `Start-Process` (visor) |
| Bundles | NSIS + MSI (ambos configurados en `tauri.conf.json`) |

## Decisiones Arquitectónicas Clave

- **Composición en Rust, no en CSS**: el PDF se compone pixel a pixel en Rust con `image` + `printpdf`. Evita inconsistencias del motor de renderizado del navegador. El `@media print` fue eliminado.
- **Mirror dual**: en la vista de edición se aplica con CSS `transform: scaleX(-1)` (animación card-flip); en la impresión se aplica con `image::fliph()` en Rust. Decisión documentada en `openspec/decisions/mirror-dual-approach.md`.
- **Drag & drop**: usa la API nativa de Tauri v2 (`onDragDropEvent`), no HTML5 File API (evita problemas de path y permisos).
- **Save PDF**: frontend abre el diálogo Guardar primero, pasa el path elegido como `destPath` a Rust. Rust escribe directo (sin `copyFile` del plugin fs, que tiene restricciones de scope).
- **Márgenes en vivo**: se renderizan vía CSS custom properties (`--canvas-pad-*`, `--canvas-gap`) calculadas en píxeles desde los sliders, sin pasar por el estado de la app.

## Convenciones y Reglas

- **Commits**: conventional commits (`fix:`, `feat:`, `chore:`, `docs:`). Sin "Co-Authored-By" ni atribuciones de IA.
- **Idioma**: el README y artefactos técnicos van en inglés. El contexto de proyecto (`CONTEXT.md`) y la conversación con el usuario van en español rioplatense (voseo).
- **SDD**: solo para cambios con tradeoffs no obvios. Features mecánicas van inline.
- **camelCase en invoke**: Tauri v2 espera camelCase desde el frontend (`slotTop`, `marginsTop`, `destPath`).
- **Test runner**: `cd src-tauri; cargo test`. 40 tests actuales.

## Estado Actual (v1.2.0)

- MVP completo: carga de imágenes, rotación/mirror, márgenes, swap, orientación, print/open/save PDF, DPI 150/300/600, copias múltiples (1-30), slots individuales, escala de grises, marcas de corte, tamaños de hoja (A4/A5/Letter).
- Build: `npm run tauri build` genera NSIS + MSI.
- Dev: `npm run tauri dev`.

## Deuda Técnica Conocida

Ver `openspec/tech-debt.md`:
- **TD-001**: CMYK con `lopdf` (pendiente)
- **TD-002**: limpieza de PDFs temporales post-impresión

## Preferencias del Usuario

- Responde en español rioplatense, respuestas cortas.
- Deja el dev corriendo cuando pide probar algo.
- Quiere control manual de todo el layout — nada automático.



---

*Este archivo es para la IA. Los requerimientos funcionales detallados están en `openspec/specs/ux-requirements.md`. Las decisiones técnicas archivadas están en `openspec/decisions/`.*
