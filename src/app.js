// Capture splash start as early as possible
const _splashStart = Date.now();

import { initCanvas, renderSlot } from './modules/canvas.js';
import { openFileDialog } from './modules/fileLoader.js';
import { appState } from './modules/state.js';
import { initToolbars, handleToolbarAction } from './modules/controls.js';
import { initSidebar } from './modules/sidebar.js';
import { initProperties } from './modules/properties.js';
import { initZoom } from './modules/zoom.js';
import { getCurrentWebview } from '@tauri-apps/api/webview';

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
    // Hover always sets activeSlot (exploration mode)
    slot.addEventListener('mouseenter', () => {
      appState.setActiveSlot(slot.id);
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

  });

  // Drag & drop via Tauri native API (HTML5 events are suppressed by the webview)
  (async () => {
    const webview = getCurrentWebview();
    await webview.onDragDropEvent((event) => {
      const { type, position, paths } = event.payload;
      const el = document.elementFromPoint(position.x, position.y);
      const slot = el?.closest('.slot');

      if (type === 'over' || type === 'enter') {
        // Remove highlight from all slots, add to current
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));
        if (slot) slot.classList.add('drag-over');
      }

      if (type === 'leave') {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));
      }

      if (type === 'drop') {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('drag-over'));
        if (slot && paths?.[0] && appState.isEmpty(slot.id)) {
          appState.setImage(slot.id, paths[0]);
        }
      }
    });
  })();

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

  // ── Splash dismissal ──
  const MIN_SPLASH_MS = 1200;

  function dismissSplash() {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('remove')) return;
    splash.classList.add('hide');
    splash.addEventListener('transitionend', () => {
      splash.classList.add('remove');
    }, { once: true });
  }

  const elapsed = Date.now() - _splashStart;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  setTimeout(dismissSplash, remaining);

  // ── About modal ──
  const versionBadge = document.getElementById('version-badge');
  const aboutModal = document.getElementById('about-modal');
  const aboutClose = document.getElementById('about-close');

  versionBadge?.addEventListener('click', () => {
    if (!aboutModal) return;
    aboutModal.classList.add('visible');
  });

  aboutClose?.addEventListener('click', () => {
    aboutModal?.classList.remove('visible');
  });

  aboutModal?.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('visible');
    }
  });
});
