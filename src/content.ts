import type { Request, SearchResponse } from './messages';
import type { Match } from './search';

const HOST_ID = 'bookmark-assistant-panel';
const started = performance.now();

const STYLE = `
  :host { all: initial; display: block; margin: 0 0 20px; max-width: 652px; }
  .panel {
    --accent: #B45309; --tint: #FEF3E2; --text: #1F1F1F; --muted: #5F6368;
    font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--tint); color: var(--text);
    border-left: 4px solid var(--accent); border-radius: 8px; padding: 12px 16px;
  }
  @media (prefers-color-scheme: dark) {
    .panel { --accent: #F59E0B; --tint: #2A1E0B; --text: #E8EAED; --muted: #9AA0A6; }
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--accent); }
  button {
    font: inherit; font-size: 13px; color: var(--muted); background: none;
    border: 1px solid currentColor; border-radius: 6px; padding: 2px 10px; cursor: pointer;
  }
  button:hover { color: var(--text); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  a { color: var(--text); text-decoration: none; display: block; }
  a:hover .title { text-decoration: underline; }
  .title { font-size: 16px; }
  .title::before { content: "★ "; color: var(--accent); }
  .path { color: var(--muted); font-size: 13px; padding-left: 1.2em; }
`;

function render(results: Match[]) {
  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'From your bookmarks');

  const header = document.createElement('header');
  const heading = document.createElement('h2');
  heading.textContent = 'From your bookmarks · ON';
  const hide = document.createElement('button');
  hide.type = 'button';
  hide.textContent = 'Hide';
  hide.title = 'Hide for this search';
  hide.addEventListener('click', () => host.remove());
  header.append(heading, hide);

  const list = document.createElement('ul');
  for (const r of results) {
    const link = document.createElement('a');
    link.href = r.url;
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = r.title || r.url;
    link.append(title);
    if (r.folderPath) {
      const path = document.createElement('div');
      path.className = 'path';
      path.textContent = r.folderPath;
      link.append(path);
    }
    const opened = () => chrome.runtime.sendMessage({ type: 'opened' } satisfies Request);
    link.addEventListener('click', opened);
    link.addEventListener('auxclick', opened);
    const item = document.createElement('li');
    item.append(link);
    list.append(item);
  }

  panel.append(header, list);
  root.append(style, panel);

  // One anchor in Google's markup, with the top of the page as the fallback if Google renames it.
  (document.querySelector('#center_col') ?? document.body).prepend(host);
  host.dataset.ms = String(Math.round(performance.now() - started));
}

async function main() {
  const query = new URLSearchParams(location.search).get('q')?.trim();
  if (!query) return;
  const res: SearchResponse = await chrome.runtime.sendMessage({ type: 'search', query } satisfies Request);
  if (res.enabled && res.results.length > 0) render(res.results);
}

// Turning the mode off removes the panel from pages already open.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled?.newValue === false) document.getElementById(HOST_ID)?.remove();
});

main();
