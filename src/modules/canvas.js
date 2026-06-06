export function renderSlot(slotId, imageSrc) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const placeholder = slot.querySelector('.slot-placeholder');
  const image = slot.querySelector('.slot-image');

  if (placeholder) placeholder.style.display = 'none';
  if (image) {
    image.src = imageSrc;
    image.classList.add('visible');
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
  }
}

export function initCanvas() {
  clearSlot('slot-top');
  clearSlot('slot-bottom');
}
