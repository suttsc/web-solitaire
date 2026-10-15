import { fetchHealth } from './api';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

root.innerHTML = `
  <section class="space-y-3 text-center">
    <h1 class="text-3xl font-semibold tracking-tight">Solitaire</h1>
    <p class="text-sm text-white/70">Phase 0 scaffold: game coming soon.</p>
    <p class="text-xs text-white/50">API: <span data-api-status>checking…</span></p>
  </section>
`;

const status = root.querySelector<HTMLElement>('[data-api-status]');

fetchHealth()
  .then(({ status: value }) => {
    if (status) status.textContent = value;
  })
  .catch(() => {
    if (status) status.textContent = 'unreachable';
  });
