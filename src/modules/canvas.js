import { convertFileSrc } from '@tauri-apps/api/core';

function buildTransformString(config) {
  const transforms = [];
  if (config.rotation !== 0) {
    transforms.push(`rotate(${config.rotation}deg)`);
  }
  if (config.mirrored) {
    transforms.push('scaleX(-1)');
  }
  return transforms.join(' ');
}

export function renderSlot(slotId, config) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const placeholder = slot.querySelector('.slot-placeholder');
  const image = slot.querySelector('.slot-image');

  if (!config || config.isEmpty()) {
    if (placeholder) placeholder.style.display = '';
    if (image) {
      image.src = '';
      image.classList.remove('visible');
      image.style.transform = '';
      image.style.objectFit = 'cover';
    }
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  if (image) {
    const assetUrl = config.imagePath.startsWith('asset://')
      ? config.imagePath
      : convertFileSrc(config.imagePath);

    image.src = assetUrl;
    image.classList.add('visible');
    image.style.transform = buildTransformString(config);
    image.style.objectFit = config.fitMode === 'fit' ? 'contain' : 'cover';
  }
}

export function clearSlot(slotId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const placeholder = slot.querySelector('.slot-placeholder');
  const image = slot.querySelector('.slot-image');

  if (placeholder) placeholder.style.display = '';
  if (image) {
    image.src = '';
    image.classList.remove('visible');
    image.style.transform = '';
    image.style.objectFit = 'cover';
  }
}

export function initCanvas() {
  clearSlot('slot-top');
  clearSlot('slot-bottom');
}
