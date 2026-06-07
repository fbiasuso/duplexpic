import { appState } from './state.js';

const ORIENTATION_SIZES = {
  portrait: { w: 595, h: 842 },
  landscape: { w: 842, h: 595 },
};

export function initZoom() {
  const slider = document.getElementById('zoom-slider');
  const zoomOut = document.querySelector('[data-zoom="out"]');
  const zoomIn = document.querySelector('[data-zoom="in"]');
  const label = document.getElementById('zoom-label');
  if (!slider) return;

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
  });

  // ── Recalculate on orientation change ────────────────────
  appState.onEvent('orientation', () => {
    calculateFit();
  });

  // ── Initial fit on next frame ────────────────────────────
  setTimeout(() => {
    calculateFit();
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
  const scroll = document.getElementById('canvas-scroll');
  if (!canvas || !scroll) return;

  const isPortrait = appState.orientation === 'portrait';
  const size = ORIENTATION_SIZES[appState.orientation];
  const canvasW = size.w;
  const canvasH = size.h;

  const availW = scroll.clientWidth - 32;
  const availH = scroll.clientHeight - 32;

  if (availW <= 0 || availH <= 0) return;

  const scaleX = availW / canvasW;
  const scaleY = availH / canvasH;
  const scale = Math.min(scaleX, scaleY, 2.0);

  appState.setZoom(Math.max(0.5, scale));
}

function applyZoom(level) {
  const inner = document.getElementById('canvas-inner');
  if (!inner) return;

  const isPortrait = appState.orientation === 'portrait';
  const baseW = isPortrait ? 595 : 842;
  const baseH = isPortrait ? 842 : 595;

  inner.style.width = (baseW * level) + 'px';
  inner.style.height = (baseH * level) + 'px';
}
