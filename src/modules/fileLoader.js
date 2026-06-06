import { open } from '@tauri-apps/plugin-dialog';
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
    appState.setImage(slotId, path);
    return path;
  } catch (error) {
    console.error('Error loading image:', error);
    alert('Error al cargar la imagen: ' + error);
    return null;
  }
}
