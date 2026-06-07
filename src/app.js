import { initCanvas, renderSlot } from './modules/canvas.js';
import { openFileDialog } from './modules/fileLoader.js';
import { appState } from './modules/state.js';
import { initToolbars, handleToolbarAction } from './modules/controls.js';

// Block F5 / Ctrl+R reload
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F5' ||
    (e.ctrlKey && (e.key === 'r' || e.key === 'R')) ||
    (e.ctrlKey && e.shiftKey && (e.key === 'r' || e.key === 'R'))
  ) {
    e.preventDefault();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initToolbars();
  initCanvas();

  appState.onChange(async (slot, config) => {
    await renderSlot(slot, config);
  });

  // Click y contextmenu directo en cada slot
  const allSlots = document.querySelectorAll('.slot');
  allSlots.forEach(slot => {
    slot.addEventListener('click', (event) => {
      if (event.target.closest('.slot-toolbar')) return;
      if (appState.isEmpty(slot.id)) {
        openFileDialog(slot.id);
      }
    });

    slot.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (appState.isEmpty(slot.id)) {
        openFileDialog(slot.id);
      }
    });

    // Drag & drop
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      if (appState.isEmpty(slot.id)) {
        openFileDialog(slot.id);
      }
    });
  });

  const globalToolbar = document.getElementById('global-toolbar');
  if (globalToolbar) {
    globalToolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.action;
      if (action) {
        handleToolbarAction(action, null);
      }
    });
  }

  document.addEventListener('click', (event) => {
    const toolbar = event.target.closest('.slot-toolbar');
    if (!toolbar) return;

    const button = event.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const slotId = toolbar.dataset.slotId;
    if (action && slotId) {
      event.stopPropagation();
      handleToolbarAction(action, slotId);
    }
  });
});
