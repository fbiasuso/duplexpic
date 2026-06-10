/**
 * Centralized notification modal.
 *
 * States: loading | success | error
 * - loading: spinner icon, "Cancelar" button
 * - success: green checkmark, "Aceptar" button (auto-closes after 3s)
 * - error: red X, "Aceptar" button
 */

let _currentResolve = null;  // resolve function for the returned promise

// ── SVG icons (inline) ──

const ICONS = {
  loading: `<svg class="ntf-icon ntf-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
    </path>
  </svg>`,

  success: `<svg class="ntf-icon ntf-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="16 8 10 16 7 13" />
  </svg>`,

  error: `<svg class="ntf-icon ntf-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>`,
};

// ── Core API ──

/**
 * Show a notification modal.
 *
 * @param {'loading'|'success'|'error'} type
 * @param {string} message
 * @param {object} [opts]
 * @param {boolean} [opts.autoClose]  — auto-close success after 3s (default true)
 * @param {boolean} [opts.cancellable] — show "Cancelar" instead of "Aceptar" (default false for loading)
 * @returns {Promise<boolean>} resolves true if user confirmed / dismissed, false if cancelled
 */
export function showNotification(type, message, opts = {}) {
  hideNotification(); // dismiss any previous

  const modal = document.getElementById('notification-modal');
  if (!modal) return Promise.resolve(true);

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isLoading = type === 'loading';

  const autoClose = opts.autoClose !== false && isSuccess;
  const cancellable = opts.cancellable === true || isLoading;

  // Set content
  modal.querySelector('.ntf-icon-wrap').innerHTML = ICONS[type] || ICONS.loading;
  modal.querySelector('.ntf-message').textContent = message;
  const btn = modal.querySelector('.ntf-btn');
  btn.textContent = cancellable ? 'Cancelar' : 'Aceptar';
  btn.className = 'ntf-btn' + (isError ? ' ntf-btn-error' : isSuccess ? ' ntf-btn-success' : '');

  // Reset state class
  modal.className = 'ntf-overlay';
  // Force reflow before adding visible class for animation
  void modal.offsetHeight;
  modal.classList.add('ntf-visible');
  modal.classList.add('ntf-' + type);

  // Auto-close for success
  let autoTimer = null;
  if (autoClose) {
    autoTimer = setTimeout(() => {
      if (modal.classList.contains('ntf-visible')) {
        closeModal(modal, true);
      }
    }, 3000);
  }

  return new Promise((resolve) => {
    _currentResolve = resolve;

    // Click handler for the button
    const onButton = () => {
      if (autoTimer) clearTimeout(autoTimer);
      const isCancel = cancellable;
      closeModal(modal, !isCancel);
    };

    // Cleanup old listener, attach new one
    const oldBtn = btn._listener;
    if (oldBtn) btn.removeEventListener('click', oldBtn);
    btn.addEventListener('click', onButton);
    btn._listener = onButton;

    // Also close on backdrop click for success/error
    const onBackdrop = (e) => {
      if (e.target === modal && !isLoading) {
        if (autoTimer) clearTimeout(autoTimer);
        closeModal(modal, true);
      }
    };
    modal._backdropListener = onBackdrop;
    modal.addEventListener('click', onBackdrop);
  });
}

/** Convenience: show a loading notification */
export function showLoading(message) {
  return showNotification('loading', message, { cancellable: true });
}

/** Convenience: show a success notification */
export function showSuccess(message, opts = {}) {
  return showNotification('success', message, opts);
}

/** Convenience: show an error notification */
export function showError(message, opts = {}) {
  return showNotification('error', message, { autoClose: false, ...opts });
}

/** Hide the current notification immediately */
export function hideNotification() {
  const modal = document.getElementById('notification-modal');
  if (!modal) return;
  if (_currentResolve) {
    _currentResolve(true);
    _currentResolve = null;
  }
  closeModal(modal, true);
}

// ── Internal ──

function closeModal(modal, resolved) {
  if (!modal.classList.contains('ntf-visible')) return;

  modal.classList.remove('ntf-visible');
  modal.classList.add('ntf-closing');

  // Cleanup listeners
  if (modal._backdropListener) {
    modal.removeEventListener('click', modal._backdropListener);
    modal._backdropListener = null;
  }

  if (_currentResolve) {
    _currentResolve(resolved);
    _currentResolve = null;
  }

  // Remove from DOM after animation
  setTimeout(() => {
    modal.classList.remove('ntf-closing');
    modal.className = 'ntf-overlay';
  }, 350);
}
