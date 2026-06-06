import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { renderSlot } from './canvas.js';
import { appState } from './state.js';

export async function openFileDialog(slotId) {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Imágenes',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
      }]
    });

    if (selected === null) {
      return null;
    }

    const path = typeof selected === 'string' ? selected : selected.path;
    const assetUrl = convertFileSrc(path);

    renderSlot(slotId, assetUrl);
    appState.setImage(slotId, path);

    return assetUrl;
  } catch (error) {
    console.error('Error loading image:', error);
    alert('Error al cargar la imagen: ' + error);
    return null;
  }
}
