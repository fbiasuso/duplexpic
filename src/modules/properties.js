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

  appState.onEvent('margins', (margins) => {
    // Update slider positions and value displays
    const marginSliders = document.querySelectorAll('#tab-margins input[type="range"]');
    marginSliders.forEach(slider => {
      const key = slider.id.replace('margin-', '');
      if (margins[key] !== undefined) {
        slider.value = margins[key];
        const valueEl = document.getElementById(slider.id + '-value');
        if (valueEl) {
          valueEl.textContent = margins[key] + ' mm';
        }
      }
    });
    renderMarginsOverlay(margins);
  });

  // ── Wire sliders to live value display ─────────────────────
  const marginSliders = document.querySelectorAll('#tab-margins input[type="range"]');
  marginSliders.forEach(slider => {
    const valueEl = document.getElementById(slider.id + '-value');
    if (valueEl) {
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value + ' mm';
      });
    }
  });

  // ── Apply margins button ──────────────────────────────────
  const applyBtn = document.querySelector('[data-action="apply-margins"]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const margins = {};
      marginSliders.forEach(slider => {
        const key = slider.id.replace('margin-', '');
        margins[key] = parseInt(slider.value, 10);
      });
      appState.setMargins(margins);

      // Visual feedback
      const origText = applyBtn.textContent;
      applyBtn.textContent = '✓ Aplicado';
      setTimeout(() => { applyBtn.textContent = origText; }, 1500);
    });
  }

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
  renderMarginsOverlay(appState.margins);
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

function renderMarginsOverlay(margins) {
  const slots = document.querySelectorAll('.slot');
  const hasMargins = Object.values(margins).some(v => v > 0);

  slots.forEach(slot => {
    slot.classList.toggle('margins-active', hasMargins);
  });
}
