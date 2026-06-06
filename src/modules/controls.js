import { appState } from './state.js';

const SLOT_TOOLBAR_HTML = `
  <div class="slot-toolbar" data-slot-toolbar>
    <button data-action="rotate" title="Rotar 90°">↻ 90°</button>
    <button data-action="mirror" title="Espejar">⇔</button>
    <button data-action="fit-toggle" title="Ajuste">▢</button>
    <button data-action="clear" title="Limpiar">✕</button>
  </div>
`;

const GLOBAL_TOOLBAR_HTML = `
  <div id="global-toolbar">
    <button data-action="swap" title="Intercambiar">⇅ Intercambiar</button>
    <button data-action="print" title="Imprimir">🖨️ Imprimir</button>
    <button data-action="clear-all" title="Limpiar todo">🗑️ Limpiar todo</button>
  </div>
`;

export function initToolbars() {
  const slots = document.querySelectorAll('.slot');
  slots.forEach(slot => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = SLOT_TOOLBAR_HTML;
    const toolbar = wrapper.querySelector('[data-slot-toolbar]');
    toolbar.dataset.slotId = slot.id;
    slot.appendChild(toolbar);
  });

  const app = document.getElementById('app');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = GLOBAL_TOOLBAR_HTML;
  const globalToolbar = wrapper.firstElementChild;
  app.insertBefore(globalToolbar, document.getElementById('canvas'));
}

export function handleToolbarAction(action, slotId) {
  switch (action) {
    case 'rotate':
      const currentRot = appState.slots[slotId].rotation;
      appState.setRotation(slotId, (currentRot + 90) % 360);
      break;
    case 'mirror':
      appState.setMirrored(slotId, !appState.slots[slotId].mirrored);
      break;
    case 'fit-toggle':
      const currentMode = appState.slots[slotId].fitMode;
      appState.setFitMode(slotId, currentMode === 'fill' ? 'fit' : 'fill');
      break;
    case 'clear':
      appState.clearSlot(slotId);
      break;
    case 'swap':
      appState.swap();
      break;
    case 'print':
      window.print();
      break;
    case 'clear-all':
      appState.clearSlot('slot-top');
      appState.clearSlot('slot-bottom');
      break;
  }
}
