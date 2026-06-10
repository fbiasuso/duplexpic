# UX Requirements — DuplexPic Print Helper

> Especificación de requerimientos funcionales y no funcionales.
> Extraído del documento original `CONTEXT.md` (secciones 3 y 4).

---

## 1. Interfaz de Usuario y Maquetación

| ID | Requerimiento | Estado |
|----|--------------|--------|
| UX-01 | Lienzo A4 virtual con relación de aspecto ~1:1.414 | ✅ Implementado |
| UX-02 | Dos contenedores fijos: superior e inferior | ✅ Implementado |
| UX-03 | Carga de archivos por drag & drop o clic → diálogo nativo | ✅ Implementado |

## 2. Controles Individuales de Imagen

Cada contenedor (superior e inferior) debe tener controles propios:

| ID | Requerimiento | Estado |
|----|--------------|--------|
| UX-04 | Rotar 90° sentido horario | ✅ Implementado (vista: CSS transform, impresión: Rust fliph/rotate) |
| UX-05 | Espejar (mirror) horizontalmente | ✅ Implementado (vista: CSS, impresión: Rust fliph) |
| UX-06 | Ajuste de escala: contain / cover / fill | ✅ Implementado |
| UX-07 | Eliminar/limpiar imagen del contenedor | ✅ Implementado |

## 3. Controles Globales

| ID | Requerimiento | Estado |
|----|--------------|--------|
| UX-08 | Botón Intercambiar (swap) | ✅ Implementado |
| UX-09 | Imprimir (Rust → PDF → diálogo del sistema) | ✅ Implementado |
| UX-10 | Guardar PDF | ✅ Implementado |
| UX-11 | Abrir en visor de PDF | ✅ Implementado |
| UX-12 | Limpiar todo | ✅ Implementado |

## 4. Requisitos No Funcionales

| ID | Requerimiento | Observaciones |
|----|--------------|--------------|
| NFR-01 | Build produce .exe portable + instalador (NSIS + MSI) | ✅ NSIS ya genera portable; ambos targets funcionando |
| NFR-02 | Ejecutable portable sin instalador ni dependencias externas | ✅ |
| NFR-03 | Consumo < 20 MB RAM en reposo | Pendiente de medir |
| NFR-04 | Código estructurado para compilar en Linux sin refactor | ✅ Backend Rust y frontend HTML/CSS son multiplataforma |
| NFR-05 | Compatible con HP LaserJet M1120 MFP (monocromática, sin dúplex) | ✅ Layout visual para impresión manual a doble cara |

## 5. Decisiones Técnicas Registradas

Ver `openspec/decisions/` para documentos detallados de decisiones técnicas.
