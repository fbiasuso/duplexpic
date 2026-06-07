import { appState } from './state.js';

const SLOT_TOOLBAR_HTML = `
  <div class="slot-toolbar" data-slot-toolbar>
    <button data-action="rotate" title="Rotar 90°">↻ 90°</button>
    <button data-action="mirror" title="Espejar">⇔</button>
    <button data-action="fit-toggle" title="Ajuste">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 10 L2 14 L6 14" />
        <path d="M14 6 L14 2 L10 2" />
        <path d="M2 6 L2 2 L6 2" />
        <path d="M14 10 L14 14 L10 14" />
      </svg>
    </button>
    <button data-action="clear" title="Limpiar">✕</button>
  </div>
`;

export function initToolbars() {
  const slots = document.querySelectorAll('.slot');
  slots.forEach(slot => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = SLOT_TOOLBAR_HTML;
    const toolbar = wrapper.querySelector('[data-slot-toolbar]');
    toolbar.dataset.slotId = slot.id;
    slot.appendChild(toolbar);
  });
}

export function handleToolbarAction(action, slotId) {
  switch (action) {
    case 'rotate':
      const currentRot = appState.slots[slotId].rotation;
      appState.setRotation(slotId, (currentRot + 90) % 360);
      break;
    case 'mirror':
      appState.setMirrored(slotId, !appState.slots[slotId].mirrored);
      break;
    case 'fit-toggle': {
      const order = ['contain', 'fill', 'cover'];
      const currentMode = appState.slots[slotId].fitMode;
      const nextIdx = (order.indexOf(currentMode) + 1) % order.length;
      appState.setFitMode(slotId, order[nextIdx]);
      break;
    }
    case 'clear':
      appState.clearSlot(slotId);
      break;
    case 'swap': {
      const topSlot = document.getElementById('slot-top');
      const bottomSlot = document.getElementById('slot-bottom');
      const topImg = topSlot?.querySelector('.slot-image.visible');
      const bottomImg = bottomSlot?.querySelector('.slot-image.visible');

      // No images to swap
      if (!topImg && !bottomImg) {
        appState.swap();
        break;
      }

      // Only one image visible — use simple slide-out/slide-in
      if (!topImg || !bottomImg) {
        const onlyImg = topImg || bottomImg;
        const isTop = !!topImg;
        onlyImg.classList.add(isTop ? 'slide-out-down' : 'slide-out-up');
        onlyImg.addEventListener('animationend', () => {
          onlyImg.classList.remove('slide-out-down', 'slide-out-up');
          appState.swap();
          requestAnimationFrame(() => {
            const newImg = document.querySelector(
              `#${isTop ? 'slot-bottom' : 'slot-top'} .slot-image.visible`
            );
            if (newImg) {
              newImg.classList.add(isTop ? 'slide-in-down' : 'slide-in-up');
              newImg.addEventListener('animationend', () => {
                newImg.classList.remove('slide-in-down', 'slide-in-up');
              }, { once: true });
            }
          });
        }, { once: true });
        break;
      }

      // ── Both images visible — crossing swap animation ────────────

      const topRect = topSlot.getBoundingClientRect();
      const bottomRect = bottomSlot.getBoundingClientRect();

      // Overlay to hold the animated clones
      const overlay = document.createElement('div');
      overlay.id = 'swap-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;pointer-events:none;';
      document.body.appendChild(overlay);

      // Clone helper: preserves visual state (size, object-fit, mirror)
      const cloneImage = (img, rect) => {
        const c = img.cloneNode(true);
        const { left, top, width, height } = rect;
        c.style.cssText = `
          position:absolute; left:${left}px; top:${top}px;
          width:${width}px; height:${height}px;
          object-fit:${img.style.objectFit || 'contain'};
          scale:${img.style.scale || 'none'};
          margin:0; padding:0; border:none; display:block; opacity:1;
        `;
        return c;
      };

      const cTop = cloneImage(topImg, topRect);
      const cBottom = cloneImage(bottomImg, bottomRect);
      overlay.appendChild(cTop);
      overlay.appendChild(cBottom);

      // Hide the real images during the spectacle
      topImg.style.opacity = '0';
      bottomImg.style.opacity = '0';

      // Animate clones crossing paths via WAAPI
      const dy = bottomRect.top - topRect.top; // how far top must go down
      const topAnim = cTop.animate([
        { transform: 'translate(0, 0)',          opacity: 1 },
        { transform: `translate(0, ${dy / 2}px)`, opacity: 0.4, offset: 0.5 },
        { transform: `translate(0, ${dy}px)`,    opacity: 0 },
      ], { duration: 400, easing: 'ease', fill: 'forwards' });

      const bottomAnim = cBottom.animate([
        { transform: 'translate(0, 0)',            opacity: 1 },
        { transform: `translate(0, ${-dy / 2}px)`, opacity: 0.4, offset: 0.5 },
        { transform: `translate(0, ${-dy}px)`,     opacity: 0 },
      ], { duration: 400, easing: 'ease', fill: 'forwards' });

      // Clean up after both animations finish
      Promise.allSettled([topAnim.finished, bottomAnim.finished]).then(() => {
        // Pre-set mirror datasets so applyMirror skips the flip animation
        topImg.dataset.mirrored = String(appState.slots['slot-bottom'].mirrored);
        bottomImg.dataset.mirrored = String(appState.slots['slot-top'].mirrored);

        appState.swap();

        // Remove any fit animation classes renderSlot may have injected
        topImg.classList.remove('fit-zoom-in', 'fit-zoom-out');
        bottomImg.classList.remove('fit-zoom-in', 'fit-zoom-out');

        topImg.style.opacity = '';
        bottomImg.style.opacity = '';
        overlay.remove();
      });
      break;
    }
    case 'orientation': {
      const newOrientation = appState.orientation === 'portrait' ? 'landscape' : 'portrait';
      appState.setOrientation(newOrientation);
      break;
    }
    case 'clear-all':
      appState.clearSlot('slot-top');
      appState.clearSlot('slot-bottom');
      break;
  }
}
