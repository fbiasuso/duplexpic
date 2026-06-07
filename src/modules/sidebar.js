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

  // ── Sync orientation button text on event ──────────────
  appState.onEvent('orientation', (v) => {
    const btn = document.querySelector('[data-action="orientation"]');
    if (btn) {
      btn.textContent = v === 'portrait' ? '🔄 Orientación' : '🔄 Vertical';
    }
  });
}
