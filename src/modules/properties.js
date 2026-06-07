import { invoke } from '@tauri-apps/api/core';
import { appState } from './state.js';

export function initProperties() {
  // ── Subscribe to events ────────────────────────────────────
  appState.onEvent('activeSlot', (slotId) => {
    renderImageInfo(slotId);
  });

  // Re-render image info when active slot content changes
  appState.onChange((slot, _config) => {
    if (slot === appState.activeSlot) {
      renderImageInfo(slot);
    }
  });

  // ── Sliders: live preview on drag + Apply / Cancel ───────
  const marginSliders = document.querySelectorAll('#tab-margins input[type="range"]');

  /** Convert slider values (mm) to CSS px on the canvas element. */
  function applyMarginsPreview(values) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const isLandscape = canvas.classList.contains('landscape');
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    // A4 reference in mm
    const a4w = isLandscape ? 297 : 210;
    const a4h = isLandscape ? 210 : 297;

    const toPx = (mm, refPx, refMm) => (mm / refMm) * refPx;

    const t = toPx(values.top || 0, ch, a4h);
    const b = toPx(values.bottom || 0, ch, a4h);
    const l = toPx(values.left || 0, cw, a4w);
    const r = toPx(values.right || 0, cw, a4w);
    const gapRef = isLandscape ? a4w : a4h;
    const gapPx = isLandscape ? cw : ch;
    const g = toPx(values.gutter || 0, gapPx, gapRef);

    canvas.style.setProperty('--canvas-pad-top', t + 'px');
    canvas.style.setProperty('--canvas-pad-bottom', b + 'px');
    canvas.style.setProperty('--canvas-pad-left', l + 'px');
    canvas.style.setProperty('--canvas-pad-right', r + 'px');
    canvas.style.setProperty('--canvas-gap', g + 'px');

    const hasMargins = Object.values(values).some(v => v > 0);
    canvas.classList.toggle('margins-preview', hasMargins);
  }

  /** Read all slider values into { top, bottom, left, right, gutter }. */
  function readSliderValues() {
    const vals = {};
    marginSliders.forEach(s => {
      const key = s.id.replace('margin-', '');
      vals[key] = parseInt(s.value, 10);
    });
    return vals;
  }

  // ── Margin guide dashed line ────────────────────────────
  function hideMarginGuide() {
    const guide = document.getElementById('margin-guide');
    if (guide) guide.style.display = 'none';
  }

  function updateMarginGuide(key, valueMm) {
    const guide = document.getElementById('margin-guide');
    const canvas = document.getElementById('canvas');
    if (!guide || !canvas) return;

    const isLandscape = canvas.classList.contains('landscape');
    const a4w = isLandscape ? 297 : 210;
    const a4h = isLandscape ? 210 : 297;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const toPx = (mm, refPx, refMm) => (mm / refMm) * refPx;

    // Read current paddings set by applyMarginsPreview
    const padTop = parseFloat(getComputedStyle(canvas).getPropertyValue('--canvas-pad-top')) || 0;
    const padLeft = parseFloat(getComputedStyle(canvas).getPropertyValue('--canvas-pad-left')) || 0;
    const padBottom = parseFloat(getComputedStyle(canvas).getPropertyValue('--canvas-pad-bottom')) || 0;
    const padRight = parseFloat(getComputedStyle(canvas).getPropertyValue('--canvas-pad-right')) || 0;
    const gap = parseFloat(getComputedStyle(canvas).getPropertyValue('--canvas-gap')) || 0;

    let isHorizontal = false;
    let pos = 0;

    switch (key) {
      case 'top':
        isHorizontal = true;
        pos = padTop;
        break;
      case 'bottom':
        isHorizontal = true;
        pos = ch - padBottom;
        break;
      case 'left':
        isHorizontal = false;
        pos = padLeft;
        break;
      case 'right':
        isHorizontal = false;
        pos = cw - padRight;
        break;
      case 'gutter': {
        isHorizontal = true;
        // Gutter center = top padding + (available height / 2)
        const available = ch - padTop - padBottom;
        pos = padTop + available / 2;
        break;
      }
    }

    guide.className = 'margin-guide' + (isHorizontal ? ' horizontal' : ' vertical');
    if (isHorizontal) {
      guide.style.cssText =
        `top:${pos}px; left:0; width:100%; height:0;` +
        `border-top:2px dashed #ff6b35; display:block;`;
    } else {
      guide.style.cssText =
        `top:0; left:${pos}px; height:100%; width:0;` +
        `border-left:2px dashed #ff6b35; display:block;`;
    }
  }

  // ── Margin guide persistence ────────────────────────────
  // Once a slider is moved, its guide line stays visible until Apply/Cancel.
  const movedMargins = new Set();

  // Live preview while dragging — with margin guide
  marginSliders.forEach(slider => {
    const key = slider.id.replace('margin-', '');
    const valueEl = document.getElementById(slider.id + '-value');

    // Hover shows guide — always
    slider.addEventListener('mouseenter', () => {
      updateMarginGuide(key, parseInt(slider.value, 10));
    });
    slider.addEventListener('focus', () => {
      updateMarginGuide(key, parseInt(slider.value, 10));
    });

    // Leave hides guide ONLY if this slider was never moved (transient mode)
    slider.addEventListener('mouseleave', () => {
      if (!movedMargins.has(key)) hideMarginGuide();
    });
    slider.addEventListener('blur', () => {
      if (!movedMargins.has(key)) hideMarginGuide();
    });

    // Moving the slider = persistent mode
    if (valueEl) {
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value + ' mm';
        applyMarginsPreview(readSliderValues());
        movedMargins.add(key);
        updateMarginGuide(key, parseInt(slider.value, 10));
      });
    }
  });

  // Apply — persist to state
  const applyBtn = document.querySelector('[data-action="apply-margins"]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const margins = readSliderValues();
      appState.setMargins(margins);
      appState.commitMargins();
      movedMargins.clear();
      hideMarginGuide();
      const origText = applyBtn.textContent;
      applyBtn.textContent = '✓ Aplicado';
      setTimeout(() => { applyBtn.textContent = origText; }, 1500);
    });
  }

  // Cancel — revert sliders to last committed margins
  const cancelBtn = document.querySelector('[data-action="cancel-margins"]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const committed = appState.getCommittedMargins();
      marginSliders.forEach(slider => {
        const key = slider.id.replace('margin-', '');
        if (committed[key] !== undefined) {
          slider.value = committed[key];
          const valueEl = document.getElementById(slider.id + '-value');
          if (valueEl) valueEl.textContent = committed[key] + ' mm';
        }
      });
      applyMarginsPreview(committed);
      movedMargins.clear();
      hideMarginGuide();
    });
  }

  // Sync slider UI from AppState (tab switch, orientation change, etc.)
  appState.onEvent('margins', (margins) => {
    marginSliders.forEach(slider => {
      const key = slider.id.replace('margin-', '');
      if (margins[key] !== undefined) {
        slider.value = margins[key];
        const valueEl = document.getElementById(slider.id + '-value');
        if (valueEl) valueEl.textContent = margins[key] + ' mm';
      }
    });
    applyMarginsPreview(margins);
  });

  // ── Print tab: DPI radio buttons ──────────────────────────
  const dpiRadios = document.querySelectorAll('#tab-print input[name="dpi"]');
  dpiRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        appState.setDpi(parseInt(radio.value, 10));
      }
    });
  });

  // Sync DPI state back to UI
  appState.onEvent('dpi', v => {
    const radio = document.querySelector(`#tab-print input[name="dpi"][value="${v}"]`);
    if (radio) radio.checked = true;
  });

  // ── Print tab: Copies slider ──────────────────────────────
  const copiesSlider = document.getElementById('copies');
  const copiesValue = document.getElementById('copies-value');
  if (copiesSlider && copiesValue) {
    copiesSlider.addEventListener('input', () => {
      copiesValue.textContent = copiesSlider.value;
      appState.setCopies(parseInt(copiesSlider.value, 10));
    });
  }

  // ── Print tab: Selected slots radio ───────────────────────
  const slotRadios = document.querySelectorAll('#tab-print input[name="selectedSlots"]');
  slotRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) appState.setSelectedSlots(radio.value);
    });
  });

  // ── Print tab: Grayscale checkbox ─────────────────────────
  const grayscaleChk = document.getElementById('grayscale');
  if (grayscaleChk) {
    grayscaleChk.addEventListener('change', () => {
      appState.setGrayscale(grayscaleChk.checked);
    });
  }

  // ── Print tab: Crop marks checkbox ────────────────────────
  const cropChk = document.getElementById('crop-marks');
  if (cropChk) {
    cropChk.addEventListener('change', () => {
      appState.setCropMarks(cropChk.checked);
    });
  }

  // ── Print tab: Page size select ───────────────────────────
  const pageSizeSelect = document.getElementById('page-size');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      appState.setPageSize(pageSizeSelect.value);
    });
  }

  // ── Print tab: Print method radio ─────────────────────────
  const methodRadios = document.querySelectorAll('#tab-print input[name="printMethod"]');
  methodRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) appState.setPrintMethod(radio.value);
    });
  });

  // ── Print tab: Save PDF button ────────────────────────────
  const saveBtn = document.querySelector('[data-action="save-pdf"]');
  if (saveBtn) {
    saveBtn.addEventListener('click', triggerSavePdf);
  }

  // ── Print tab: Imprimir button ────────────────────────────
  const printBtn = document.querySelector('[data-action="print-compose"]');
  if (printBtn) {
    printBtn.addEventListener('click', triggerComposePrint);
  }

  // ── Render initial state ──────────────────────────────────
  renderImageInfo(appState.activeSlot);
  applyMarginsPreview(appState.margins);
}

function renderImageInfo(slotId) {
  const tab = document.getElementById('tab-image');
  if (!tab) return;

  if (!slotId) {
    tab.innerHTML = '<p class="slot-info-placeholder">Seleccioná un slot</p>';
    return;
  }

  const config = appState.slots[slotId];
  const slotName = slotId === 'slot-top' ? 'Superior' : 'Inferior';

  if (!config || config.isEmpty()) {
    tab.innerHTML = `
      <div class="image-info">
        <h3>Slot ${slotName}</h3>
        <p class="slot-info-placeholder">Sin imagen cargada</p>
      </div>
    `;
    return;
  }

  const filename = config.imagePath ? config.imagePath.split(/[\\/]/).pop() : '—';
  const fitModeLabel = {
    contain: 'Ajustar (Fit)',
    fill: 'Llenar (Fill)',
    cover: 'Cubrir (Cover)'
  }[config.fitMode] || config.fitMode;
  const mirrorLabel = config.mirrored ? 'Activado' : 'Desactivado';

  const slot = document.getElementById(slotId);
  const img = slot ? slot.querySelector('.slot-image') : null;
  const dimensions = img && img.naturalWidth
    ? img.naturalWidth + ' × ' + img.naturalHeight + ' px'
    : '—';

  tab.innerHTML = `
    <div class="image-info">
      <h3>Slot ${slotName}</h3>
      <div class="property-group">
        <label>Archivo</label>
        <div class="value">${filename}</div>
      </div>
      <div class="property-group">
        <label>Dimensiones</label>
        <div class="value">${dimensions}</div>
      </div>
      <div class="property-group">
        <label>Ajuste</label>
        <div class="value">${fitModeLabel}</div>
      </div>
      <div class="property-group">
        <label>Espejo</label>
        <div class="value">${mirrorLabel}</div>
      </div>
    </div>
  `;
}

function buildPrintPayload(mode) {
  return {
    slotTop: appState.slots['slot-top'].imagePath || '',
    slotBottom: appState.slots['slot-bottom'].imagePath || '',
    marginsTop: appState.margins.top,
    marginsBottom: appState.margins.bottom,
    marginsLeft: appState.margins.left,
    marginsRight: appState.margins.right,
    gutter: appState.margins.gutter,
    orientation: appState.orientation,
    fitTop: appState.slots['slot-top'].fitMode || 'contain',
    fitBottom: appState.slots['slot-bottom'].fitMode || 'contain',
    rotateTop: appState.slots['slot-top'].rotation || 0,
    rotateBottom: appState.slots['slot-bottom'].rotation || 0,
    mirrorTop: appState.slots['slot-top'].mirrored || false,
    mirrorBottom: appState.slots['slot-bottom'].mirrored || false,
    dpi: appState.dpi,
    mode,
    copies: appState.copies,
    selectedSlots: appState.selectedSlots,
    grayscale: appState.grayscale,
    cropMarks: appState.cropMarks,
    pageSize: appState.pageSize,
  };
}

function setStatus(text, type) {
  const el = document.getElementById('print-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'print-status' + (type ? ' ' + type : '');
}

export async function triggerSavePdf() {
  setStatus('Generating PDF...', '');

  try {
    const result = await invoke('compose_print', buildPrintPayload('save'));
    if (result.ok && result.path) {
      // Open native save dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const dest = await save({
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        defaultPath: 'duplexpic-output.pdf',
      });
      if (dest) {
        // Copy temp file to chosen destination
        const { copyFile } = await import('@tauri-apps/plugin-fs');
        await copyFile(result.path, dest);
        setStatus('✓ PDF guardado', 'success');
      } else {
        setStatus('Guardado cancelado', '');
      }
    } else {
      setStatus('Error [' + (result.code || '?') + ']: ' + (result.error || 'Unknown'), 'error');
    }
  } catch (err) {
    setStatus('Error: ' + err, 'error');
  }
}

export async function triggerComposePrint() {
  const method = appState.printMethod === 'open' ? 'open' : 'print';
  const label = method === 'open' ? 'Abriendo PDF en visor...' : 'Enviando a impresora...';
  setStatus(label, '');

  try {
    const result = await invoke('compose_print', buildPrintPayload(method));
    if (result.ok) {
      const msg = method === 'open'
        ? 'PDF abierto en el visor'
        : 'Enviado a impresora';
      setStatus(msg, 'success');
    } else {
      setStatus('Error [' + (result.code || '?') + ']: ' + (result.error || 'Unknown'), 'error');
    }
  } catch (err) {
    setStatus('Error: ' + err, 'error');
  }
}


