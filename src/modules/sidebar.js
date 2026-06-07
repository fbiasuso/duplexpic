import { appState } from './state.js';
import { handleToolbarAction } from './controls.js';

export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // ── Tab switching ───────────────────────────────────────
  const tabButtons = sidebar.querySelectorAll('.tabs-nav button[data-tab]');
  const tabPanes = sidebar.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Deactivate all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      // Activate clicked
      btn.classList.add('active');
      const pane = document.getElementById('tab-' + tabId);
      if (pane) pane.classList.add('active');

      appState.setActiveTab(tabId);
    });
  });

  // ── Global button delegation ────────────────────────────
  sidebar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    handleToolbarAction(action, null);
  });

  // ── Sync tab UI when state changes externally ──────────
  appState.onEvent('activeTab', (tabId) => {
    tabButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    tabPanes.forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tabId);
    });
  });

  // ── Sync orientation button text + icon on event ───────
  const ORIENTATION_ICONS = {
    portrait: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="1" width="8" height="16" rx="1.5"/></svg>',
    landscape: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="16" height="8" rx="1.5"/></svg>',
  };

  function updateOrientationButton(v) {
    const btn = document.querySelector('[data-action="orientation"]');
    if (!btn) return;
    btn.innerHTML = ORIENTATION_ICONS[v] + ' <span>' + (v === 'portrait' ? 'Vista Vertical' : 'Vista Horizontal') + '</span>';
  }

  appState.onEvent('orientation', updateOrientationButton);

  // ── Set initial state ──────────────────────────────────
  setTimeout(() => updateOrientationButton(appState.orientation), 0);
}
