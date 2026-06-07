import { invoke } from '@tauri-apps/api/core';
import { appState } from './state.js';

function setLoading(slot, loading) {
  const spinner = slot.querySelector('.slot-loader');
  const image = slot.querySelector('.slot-image');
  if (spinner) spinner.classList.toggle('visible', loading);
  if (image) image.classList.toggle('fade-in', loading);
}

function applyMirror(image, mirrored, animate) {
  const wasMirrored = image.dataset.mirrored === 'true';
  if (!animate || !image.classList.contains('visible')) {
    // No animation — just set state and inline style directly
    image.dataset.mirrored = String(mirrored);
    image.style.scale = mirrored ? '-1 1' : '';
    return;
  }

  // Skip if state hasn't actually changed
  if (wasMirrored === mirrored) return;

  // Card-flip animation via keyframes (animates `scale` property, not `transform`)
  image.classList.add(mirrored ? 'mirror-flip-on' : 'mirror-flip-off');

  image.addEventListener('animationend', () => {
    image.classList.remove('mirror-flip-on', 'mirror-flip-off');
    image.dataset.mirrored = String(mirrored);
    image.style.scale = mirrored ? '-1 1' : '';
  }, { once: true });
}

const FIT_SIZE = { contain: 0, fill: 1, cover: 2 };

function applyFitMode(image, fitMode) {
  const oldFit = image.style.objectFit || 'contain';
  const changed = oldFit !== fitMode;

  image.style.objectFit = fitMode;

  if (changed && image.classList.contains('visible')) {
    const growing = (FIT_SIZE[fitMode] ?? 0) > (FIT_SIZE[oldFit] ?? 0);

    // Clean up previous animation
    image.classList.remove('fit-zoom-in', 'fit-zoom-out');
    image.style.transform = '';

    // Force reflow so the browser picks up the removal before adding new class
    void image.offsetWidth;

    // Play the correct directional animation
    image.classList.add(growing ? 'fit-zoom-in' : 'fit-zoom-out');

    // Detach after animation ends
    image.addEventListener('animationend', () => {
      image.classList.remove('fit-zoom-in', 'fit-zoom-out');
      image.style.transform = '';
    }, { once: true });
  }
}

export async function renderSlot(slotId, config) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const placeholder = slot.querySelector('.slot-placeholder');
  const image = slot.querySelector('.slot-image');

  if (!config || config.isEmpty()) {
    setLoading(slot, false);
    if (placeholder) placeholder.style.display = '';
    if (image) {
      image.src = '';
      image.classList.remove('visible', 'fade-in');
      applyMirror(image, false, false);
      applyFitMode(image, 'contain');
    }
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  if (!image) return;

  // Cache hit — use existing transformed data URL
  if (config.transformedUrl !== null) {
    setLoading(slot, false);
    image.classList.remove('fade-in');
    image.src = config.transformedUrl;
    image.classList.add('visible');

    // Mirror flip animation if state changed (only happens on explicit mirror toggle)
    const mirrorChanged = image.dataset.mirrored !== String(config.mirrored);
    const sameImage = image.src === config.transformedUrl;
    applyMirror(image, config.mirrored, mirrorChanged && sameImage);

    applyFitMode(image, config.fitMode);
    return;
  }

  // Cache miss — show spinner and fade out while Rust processes
  setLoading(slot, true);

  try {
    const rotation = config.rotation;
    const path = config.imagePath;

    const dataUrl = await invoke('transform_image', {
      path,
      rotation,
      mirrored: false, // mirror is now CSS-only
    });

    // Stale check: only apply if the config still matches what we requested.
    // (mirror is excluded from stale check — it's handled via CSS, not Rust)
    if (
      config.isEmpty() ||
      config.transformedUrl !== null ||
      config.imagePath !== path ||
      config.rotation !== rotation
    ) {
      setLoading(slot, false);
      return;
    }

    config.transformedUrl = dataUrl;
    image.classList.add('visible');
    image.style.objectFit = config.fitMode;

    // Apply mirror state before loading the image (no animation, the fade-in masks it)
    applyMirror(image, config.mirrored, false);

    image.src = dataUrl;
    image.onload = () => {
      image.classList.remove('fade-in');
      setLoading(slot, false);
      image.onload = null;
    };
    // Fallback if onload never fires (shouldn't happen for data URLs)
    setTimeout(() => {
      if (image.classList.contains('fade-in')) {
        image.classList.remove('fade-in');
        setLoading(slot, false);
      }
    }, 2000);
  } catch (err) {
    setLoading(slot, false);
    console.error('Error transforming image:', err);
  }
}

export function clearSlot(slotId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const placeholder = slot.querySelector('.slot-placeholder');
  const image = slot.querySelector('.slot-image');
  const spinner = slot.querySelector('.slot-loader');

  if (spinner) spinner.classList.remove('visible');
  if (placeholder) placeholder.style.display = '';
  if (image) {
    image.src = '';
    image.classList.remove('visible', 'fade-in');
    applyMirror(image, false, false);
    applyFitMode(image, 'contain');
  }
}

export function initCanvas() {
  clearSlot('slot-top');
  clearSlot('slot-bottom');
}
