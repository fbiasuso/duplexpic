import { initCanvas, renderSlot } from './modules/canvas.js';
import { openFileDialog } from './modules/fileLoader.js';
import { appState } from './modules/state.js';
import { initToolbars, handleToolbarAction } from './modules/controls.js';
import { initSidebar } from './modules/sidebar.js';
import { initProperties } from './modules/properties.js';
import { initZoom } from './modules/zoom.js';

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
  initSidebar();
  initProperties();
  initZoom();

  appState.onChange(async (slot, config) => {
    await renderSlot(slot, config);
  });

  // Slot hover/click tracking for activeSlot
  const allSlots = document.querySelectorAll('.slot');
  allSlots.forEach(slot => {
    // First hover sets activeSlot permanently (no mouseleave reset)
    slot.addEventListener('mouseenter', () => {
      if (appState.activeSlot === null) {
        appState.setActiveSlot(slot.id);
      }
    });

    // Click reinforces activeSlot + existing open-file behavior
    slot.addEventListener('click', (event) => {
      if (event.target.closest('.slot-toolbar')) return;
      appState.setActiveSlot(slot.id);
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

  // Orientation class toggle on canvas
  appState.onEvent('orientation', (v) => {
    const canvas = document.getElementById('canvas');
    canvas.classList.toggle('portrait', v === 'portrait');
    canvas.classList.toggle('landscape', v === 'landscape');
  });

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
