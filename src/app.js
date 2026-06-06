import './modules/state.js';
import { initCanvas } from './modules/canvas.js';
import { openFileDialog } from './modules/fileLoader.js';

function onSlotClick(slotId) {
  openFileDialog(slotId);
}

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();

  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.addEventListener('click', (event) => {
      const slot = event.target.closest('.slot');
      if (slot) {
        const slotId = slot.id;
        onSlotClick(slotId);
      }
    });
  }
});
