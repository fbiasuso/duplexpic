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
    });
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

function renderMarginsOverlay(margins) {
  const slots = document.querySelectorAll('.slot');
  const hasMargins = Object.values(margins).some(v => v > 0);

  slots.forEach(slot => {
    if (hasMargins) {
      slot.classList.add('margins-active');
      slot.style.outlineWidth = '3px';
    } else {
      slot.classList.remove('margins-active');
      slot.style.outlineWidth = '';
    }
  });
}
