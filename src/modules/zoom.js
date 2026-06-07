import { appState } from './state.js';

export function initZoom() {
  const slider = document.getElementById('zoom-slider');
  const zoomOut = document.querySelector('[data-zoom="out"]');
  const zoomIn = document.querySelector('[data-zoom="in"]');
  const label = document.getElementById('zoom-label');
  const canvasWrapper = document.querySelector('.canvas-wrapper');

  if (!slider || !canvasWrapper) return;

  // ── Slider input → zoom ──────────────────────────────────
  slider.addEventListener('input', () => {
    const zoom = parseFloat(slider.value) / 100;
    appState.setZoom(zoom);
  });

  // ── Zoom buttons ─────────────────────────────────────────
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      appState.setZoom(appState.zoom - 0.1);
    });
  }

  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      appState.setZoom(appState.zoom + 0.1);
    });
  }

  // ── Subscribe to zoom events ─────────────────────────────
  appState.onEvent('zoom', (level) => {
    applyZoom(level);
    slider.value = Math.round(level * 100);
    if (label) {
      label.textContent = Math.round(level * 100) + '%';
    }
    // Show scroll when zoomed in, hide when auto-fitted
    const canvasZone = document.getElementById('canvas-zone');
    if (canvasZone) {
      canvasZone.style.overflow = level > 1.0 ? 'auto' : 'hidden';
    }
  });

  // ── Recalculate on orientation change ────────────────────
  appState.onEvent('orientation', () => {
    calculateFit();
  });

  // ── Initial zoom at 67% for restored window ──────────────
  setTimeout(() => {
    appState.setZoom(0.67);
  }, 50);

  // ── Window resize (debounced) ────────────────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      calculateFit();
    }, 150);
  });
}

function calculateFit() {
  const canvas = document.getElementById('canvas');
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  if (!canvas || !canvasWrapper) return;

  const isPortrait = appState.orientation === 'portrait';
  const canvasW = isPortrait ? 595 : 842;
  const canvasH = isPortrait ? 842 : 595;

  // canvas-wrapper has flex:1 inside canvas-zone, so its dimensions
  // reflect the actual available space (minus zoom-bar and padding)
  const availW = canvasWrapper.clientWidth - 32;
  const availH = canvasWrapper.clientHeight - 32;

  if (availW <= 0 || availH <= 0) return;

  const scaleX = availW / canvasW;
  const scaleY = availH / canvasH;
  const scale = Math.min(scaleX, scaleY, 2.0);

  appState.setZoom(Math.max(0.5, scale));
}

function applyZoom(level) {
  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.style.transform = 'scale(' + level + ')';
  }
}
