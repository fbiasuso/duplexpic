# Contexto del Proyecto: DuplexPic Print Helper

Este documento sirve como especificación técnica y guía de contexto para el desarrollo de una aplicación de escritorio liviana y multiplataforma (enfocada inicialmente en Windows). El objetivo es permitir a un usuario sin conocimientos técnicos avanzados preparar e imprimir dos imágenes en una sola hoja A4 (dividida en mitad superior e inferior), controlando la orientación e intercambio de posición de forma manual para evitar las rotaciones automáticas incorrectas del asistente de impresión de Windows.

---

## 1. Visión General del Problema y de la Solución

### El Problema:
Al intentar imprimir dos imágenes independientes (por ejemplo, una en orientación vertical y otra en horizontal) usando el asistente nativo de Windows (diseño de 13x18cm o media página), el sistema operativo intenta rotar de manera inteligente y asimétrica las fotos basándose en sus metadatos. Esto causa que una imagen salga derecha y la otra acostada de forma indeseada, ignorando las rotaciones manuales hechas en el Explorador de Archivos.

### La Solución:
Una aplicación de escritorio nativa desarrollada en **Rust** que proporcione un lienzo visual fijo (simulando una hoja A4). El usuario puede cargar dos imágenes, visualizar exactamente cómo quedarán en el papel, rotarlas individualmente de a 90 grados, intercambiar sus posiciones (arriba/abajo) con un solo clic, y mandarlas a imprimir directamente respetando la composición visual de la pantalla de manera estricta.

---

## 2. Stack Tecnológico Requerido

* **Lenguaje Base:** Rust (eficiente, seguro, genera un único ejecutable `.exe` portable de pocos megabytes).
* **Framework de Interfaz Gráfica (GUI):** **Tauri v2** (Frontend utilizando HTML5/CSS3/JavaScript o TypeScript básico, Backend en Rust).
    * *Razón:* Permite diseñar una interfaz limpia, responsiva y moderna rápidamente con CSS, delegando el control del sistema de archivos y el procesamiento de imágenes a Rust a través de comandos seguros.
* **Procesamiento de Imágenes (Backend):** Librería `image` de Rust (para decodificar, rotar, espejar y componer el lienzo final si fuera necesario).
* **Motor de Impresión:** Pipeline Rust nativo. Composición de imágenes en lienzo A4 con `image` crate, generación de PDF con `printpdf`, envío directo a cola de impresión via PowerShell (`Start-Process -Verb Print`). Sin dependencia de `window.print()` del navegador.

---

## 3. Requerimientos Funcionales (MVP)

### 3.1. Interfaz de Usuario y Maquetación
* **Lienzo A4 Virtual:** Un área central que simule visualmente una hoja A4 (relación de aspecto aproximada de 1:1.414).
* **Dos Contenedores Fijos:** El lienzo debe estar dividido claramente en dos zonas:
    * `Contenedor A` (Mitad Superior)
    * `Contenedor B` (Mitad Inferior)
* **Carga de Archivos:** Cada contenedor debe permitir arrastrar y soltar una imagen (*Drag and Drop*) o hacer clic para abrir un cuadro de diálogo de selección de archivo nativo.

### 3.2. Controles Individuales de Imagen
Cada contenedor (Superior e Inferior) debe contar con una pequeña barra de herramientas flotante o adyacente con las siguientes opciones aplicables únicamente a la imagen cargada en ese espacio:
* **Rotar 90°:** Gira la imagen en sentido horario.
* **Espejar (Mirror):** Voltea la imagen horizontalmente (útil para folletos o transferencias térmicas).
* **Ajuste de Escala:** Opción para alternar entre "Ajustar al espacio (Fit)" (conservando la relación de aspecto sin recortar) o "Llenar espacio (Fill)" (recortando bordes para ocupar exactamente la mitad de la carilla).
* **Eliminar/Limpiar:** Quita la imagen del contenedor actual.

### 3.3. Controles Globales de la Aplicación
* **Botón Intercambiar (Swap):** Cambia la imagen de la mitad superior a la mitad inferior y viceversa con un solo clic, manteniendo las rotaciones individuales que ya se les hayan aplicado.
* **Botón Imprimir:** Genera un PDF con la composición final al DPI seleccionado y abre el diálogo de impresión del sistema. Opción de previsualización (Preview) que muestra el PNG compuesto por Rust antes de imprimir.
* **Botón Limpiar Todo:** Restablece la aplicación a su estado inicial.

---

## 4. Requisitos No Funcionales y Experiencia de Usuario

* **Distribución Dual:** El build de producción debe generar tanto un `.exe` portable (ejecutable autónomo, sin instalación) como un instalador (NSIS `.exe` + MSI). El usuario puede elegir según sus necesidades.
* **Portabilidad:** El ejecutable portable debe funcionar sin instalador, sin dependencias externas, consumiendo menos de 20 MB de RAM en reposo.
* **Multiplataforma Nativo:** El código debe estructurarse de manera que el mismo backend de Rust y frontend de HTML/CSS pueda compilarse de manera nativa en Linux sin requerir refactorizaciones de lógica interna.
* **Restricciones de Hardware del Usuario:** El usuario final posee una impresora monocromática **HP LaserJet M1120 MFP** (sin dúplex automático). La aplicación debe facilitar la maquetación visual simple para que el usuario pueda posteriormente realizar impresiones a doble cara de forma manual sin confusión sobre el orden de las páginas.

---

## 5. Instrucciones Paso a Paso para la IA (Flujo de Desarrollo Sugerido)

Por favor, actúa como un ingeniero de software experto en Rust y Tauri. Sigue estos pasos de forma incremental para construir la aplicación:

### Paso 1: Inicialización del Proyecto
Genera la estructura base de un proyecto Tauri compatible con Windows utilizando `cargo tauri init`. Configura el backend en la carpeta `src-tauri` y un frontend limpio y minimalista en Vanilla JS o TypeScript (sin frameworks pesados como React/Vue a menos que sea estrictamente necesario para el Drag & Drop).

### Paso 2: Interfaz de Usuario Base (CSS/HTML)
Diseña el layout del lienzo A4 utilizando CSS clásico (evita `display: flex` o `grid` a nivel global si afectará la impresión, utiliza porcentajes fijos o `display: block` con dimensiones relativas para la simulación en pantalla). Define la vista de impresión con un bloque `@media print` que configure el tamaño de página `@page { size: A4; margin: 0; }` asegurando que los dos bloques de imagen cubran la superficie de manera exacta.

### Paso 3: Lógica del Frontend (Manipulación Visual)
Implementa las funciones de JavaScript para:
* Capturar los eventos de arrastrar y soltar archivos (*Drag & Drop*) y leer las rutas locales de las imágenes utilizando el plugin de sistema de archivos de Tauri.
* Aplicar transformaciones CSS de rotación (`transform: rotate(90deg)`) y escala de forma instantánea en la previsualización del usuario.
* Implementar la función de intercambio (swap) de variables de imagen entre el bloque superior e inferior.

### Paso 4: Backend en Rust (Procesamiento y Seguridad)
* Configura los permisos de Tauri (`capabilities`) para permitir el acceso a archivos de imagen locales mediante protocolos personalizados (por ejemplo, `asset://`) para que las imágenes se previsualicen correctamente sin violar políticas de seguridad.
* Implementa un comando `compose_print` en Rust que tome los paths de ambas imágenes, aplique rotaciones y mirror sobre los píxeles usando la crate `image`, componga un lienzo A4 con márgenes y gutter, genere un PDF con `printpdf`, y lo envíe a la cola de impresión via PowerShell.

### Paso 5: Pulido de Detalles
Asegúrate de desactivar el menú contextual predeterminado del navegador en producción y los atajos de recarga (F5) para que se comporte verdaderamente como una aplicación de escritorio nativa e independiente.

---
*Fin del Contexto. Por favor, comienza solicitando la confirmación de la estructura del proyecto o proponiendo el código para el Paso 1.*
