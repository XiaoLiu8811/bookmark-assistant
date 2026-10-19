import { SITE_ORIGINS } from './access';

const status = document.getElementById('status')!;
const actions = document.getElementById('actions')!;

// Chrome only shows its permission prompt from a click on the extension's own page.
document.getElementById('allow')!.addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: SITE_ORIGINS });
  actions.hidden = true;
  status.textContent = granted
    ? 'Done. Descriptions will appear in the panel.'
    : 'No problem. You can turn this on later with “Show descriptions” in the panel.';
  setTimeout(() => window.close(), granted ? 1200 : 2500);
});
document.getElementById('not-now')!.addEventListener('click', () => window.close());
