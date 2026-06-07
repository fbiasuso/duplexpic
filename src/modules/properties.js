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

  // Live preview while dragging
  marginSliders.forEach(slider => {
    const valueEl = document.getElementById(slider.id + '-value');
    if (valueEl) {
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value + ' mm';
        applyMarginsPreview(readSliderValues());
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

  // ── Print tab: Preview button ─────────────────────────────
  const previewBtn = document.querySelector('[data-action="preview"]');
  if (previewBtn) {
    previewBtn.addEventListener('click', triggerComposePreview);
  }

  // ── Print tab: Print button ───────────────────────────────
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

  // Try to get dimensions from the actual image element
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
  };
}

export async function triggerComposePreview() {
  const statusEl = document.getElementById('print-status');
  if (statusEl) {
    statusEl.textContent = 'Generating preview...';
    statusEl.className = 'print-status';
  }

  try {
    const result = await invoke('compose_print', buildPrintPayload('preview'));
    if (result.ok) {
      appState.setComposedUrl(result.preview);
      appState.setPrintPreviewMode(true);
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'print-status';
      }
    } else {
      if (statusEl) {
        statusEl.textContent = 'Error [' + result.code + ']: ' + result.error;
        statusEl.className = 'print-status error';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + err;
      statusEl.className = 'print-status error';
    }
  }
}

export async function triggerComposePrint() {
  const statusEl = document.getElementById('print-status');
  if (statusEl) {
    statusEl.textContent = 'Sending to printer...';
    statusEl.className = 'print-status';
  }

  try {
    const result = await invoke('compose_print', buildPrintPayload('print'));
    if (result.ok) {
      if (statusEl) {
        statusEl.textContent = 'Sent to printer';
        statusEl.className = 'print-status success';
      }
      // Exit preview mode after sending to print
      appState.setPrintPreviewMode(false);
      appState.setComposedUrl(null);
    } else {
      if (statusEl) {
        statusEl.textContent = 'Error [' + result.code + ']: ' + result.error;
        statusEl.className = 'print-status error';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + err;
      statusEl.className = 'print-status error';
    }
  }
}


