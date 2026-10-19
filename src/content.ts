import { SHOWN_FIRST } from './limits';
import type { DescribeResponse, Removed, RemoveResponse, Request, RestoreResponse, SearchResponse } from './messages';

const HOST_ID = 'bookmark-assistant-panel';
const started = performance.now();

// Google's right column is 372 px wide and starts 76 px right of the results column.
const RIGHT_WIDTH = 372;
const RIGHT_GAP = 76;
const MIN_RIGHT_WIDTH = 280;

const send = <T>(msg: Request): Promise<T> => chrome.runtime.sendMessage(msg);

// iPhone-style frosted glass. On Google's white page, real transparency means a light glass with
// dark text (a see-through dark card just turns gray), so light mode is clear glass with a faint
// amber and teal tint, a bright rim and a soft shadow; dark mode is dark glass with white text.
// Colors come from xiaoliu.us: navy #172A3A, teal #426F76, plus this app's amber.
const STYLE = `
  :host { all: initial; display: block; margin: 0 0 24px; max-width: 652px; }
  .panel {
    --text: #172A3A; --soft: rgba(23, 42, 58, 0.76); --faint: rgba(23, 42, 58, 0.64);
    --line: rgba(23, 42, 58, 0.1); --hover: rgba(23, 42, 58, 0.05);
    --fill: rgba(23, 42, 58, 0.07); --fill-hover: rgba(23, 42, 58, 0.13);
    --strong: #172A3A; --on-strong: #fff; --accent: #F59E0B; --red: #E5281C;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: var(--text);
    background:
      radial-gradient(140% 90% at 0% 0%, rgba(245, 158, 11, 0.1), transparent 55%),
      radial-gradient(140% 100% at 100% 100%, rgba(66, 111, 118, 0.13), transparent 60%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.3));
    backdrop-filter: blur(22px) saturate(1.8);
    border: 1px solid rgba(255, 255, 255, 0.75); border-radius: 24px; padding: 8px;
    box-shadow:
      0 0 0 1px rgba(23, 42, 58, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95),
      0 18px 44px -14px rgba(23, 42, 58, 0.28), 0 3px 10px -2px rgba(23, 42, 58, 0.08);
    animation: appear 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @media (prefers-color-scheme: dark) {
    .panel {
      --text: #fff; --soft: rgba(255, 255, 255, 0.78); --faint: rgba(255, 255, 255, 0.62);
      --line: rgba(255, 255, 255, 0.12); --hover: rgba(255, 255, 255, 0.07);
      --fill: rgba(255, 255, 255, 0.12); --fill-hover: rgba(255, 255, 255, 0.2);
      --strong: #fff; --on-strong: #172A3A; --red: #FF453A;
      background:
        radial-gradient(140% 90% at 0% 0%, rgba(245, 158, 11, 0.12), transparent 55%),
        radial-gradient(140% 100% at 100% 100%, rgba(66, 111, 118, 0.2), transparent 60%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
      border-color: rgba(255, 255, 255, 0.16);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 18px 44px -14px rgba(0, 0, 0, 0.6);
    }
  }
  @keyframes appear { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
  @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  header, .tab { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  header { padding: 6px 6px 8px 16px; }
  .label {
    display: flex; align-items: center; gap: 9px; margin: 0;
    font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint);
  }
  .label::before { content: ''; width: 4px; height: 14px; border-radius: 2px; background: var(--accent); flex: none; }
  button {
    flex: none; font: inherit; font-size: 13px; font-weight: 600; line-height: 1.4; padding: 5px 14px;
    color: var(--text); background: var(--fill); border: 0; border-radius: 999px;
    cursor: pointer; transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.1s;
  }
  button:hover { background: var(--fill-hover); }
  button:active { transform: scale(0.96); }
  button.strong { background: var(--strong); color: var(--on-strong); }
  button.strong:hover { background: var(--strong); opacity: 0.85; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  ul { list-style: none; margin: 0; padding: 0; }
  /* Room on the right for the trash button, which sits on top so it can grow without moving the text. */
  li { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 12px 48px 12px 16px; border-radius: 14px; transition: background 0.15s; }
  /* Hairline separators inset from both sides, hidden next to a highlighted row. */
  li + li::before { content: ''; position: absolute; top: 0; left: 16px; right: 16px; height: 1px; background: var(--line); }
  li:hover::before, li:hover + li::before, li:focus-within::before, li:focus-within + li::before { opacity: 0; }
  li:hover, li:focus-within { background: var(--hover); }
  .extra { display: none; }
  .expanded .extra { display: flex; }
  a { flex: 1; min-width: 0; color: inherit; text-decoration: none; border-radius: 6px; }
  a:hover .title { text-decoration: underline; text-underline-offset: 3px; }
  .title { font-weight: 600; letter-spacing: -0.01em; line-height: 1.35; color: var(--text); }
  .desc {
    margin-top: 3px; font-size: 14px; line-height: 1.45; color: var(--soft);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .desc[hidden] { display: none; }
  .path { margin-top: 4px; font-size: 13px; color: var(--faint); }
  /* Delete: a trash icon that widens to "Delete bookmark" when pointed at, turning red. */
  .delete {
    position: absolute; top: 9px; right: 8px; display: flex; align-items: center; gap: 6px;
    padding: 6px 8px; color: var(--faint); background: transparent;
  }
  .delete svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .delete-text { max-width: 0; overflow: hidden; white-space: nowrap; transition: max-width 0.2s ease; }
  .delete:hover, .delete:focus-visible { color: #fff; background: var(--red); }
  .delete:hover .delete-text, .delete:focus-visible .delete-text { max-width: 120px; }
  /* Deleted: red-tinted, says what happened, with Undo right there. */
  .note { display: none; flex: 1; align-self: center; min-width: 0; }
  .note-head { font-size: 14px; font-weight: 600; color: var(--red); }
  .note-title { font-size: 14px; color: var(--soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .removed { padding-right: 10px; }
  .removed, .removed:hover { background: color-mix(in srgb, var(--red) 10%, transparent); }
  .removed a, .removed .delete { display: none; }
  .removed .note, .removed .undo { display: block; }
  .undo { display: none; align-self: center; }
  footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 6px 4px 16px; }
  .tab { display: none; }
  /* Hidden: a small glass capsule, like a notification pill. */
  .collapsed { width: fit-content; padding: 6px 6px 6px 14px; border-radius: 999px; }
  .collapsed header, .collapsed ul, .collapsed footer { display: none; }
  .collapsed .tab { display: flex; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
};

const button = (label: string, title: string, onClick: () => void, className = '') => {
  const b = el('button', className, label);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
};

type Result = SearchResponse['results'][number];

// A trash can, drawn like Apple's: lid, handle, and a can with two ribs.
function trashIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6.5 7l1 12.5h9l1-12.5', 'M10 10.5v6', 'M14 10.5v6']) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** One bookmark: title, its one-line summary, folder path, and Delete with Undo. */
function row(r: Result, extra: boolean) {
  let id = r.id;
  let removed: Removed | null = null;
  const item = el('li', extra ? 'extra' : '');

  const link = el('a');
  link.href = r.url;
  const desc = el('div', 'desc');
  desc.hidden = true;
  link.append(el('div', 'title', r.title || r.url), desc);
  if (r.folderPath) link.append(el('div', 'path', r.folderPath));
  const opened = () => send({ type: 'opened' });
  link.addEventListener('click', opened);
  link.addEventListener('auxclick', opened);

  // After deleting: say plainly what happened, and offer Undo right there.
  const note = el('div', 'note');
  note.append(el('div', 'note-head', 'Deleted from your bookmarks'), el('div', 'note-title', r.title || r.url));

  // A trash icon that spells out "Delete bookmark" when pointed at, so it can't be
  // mistaken for hiding the row from this list.
  const deleteButton = button('', 'Delete from your Chrome bookmarks', async () => {
    const res = await send<RemoveResponse>({ type: 'remove', id });
    if (!res.ok) return;
    removed = res.removed;
    item.classList.add('removed');
    undo.focus();
  }, 'delete');
  deleteButton.setAttribute('aria-label', 'Delete bookmark');
  deleteButton.append(trashIcon(), el('span', 'delete-text', 'Delete bookmark'));

  const undo = button('Undo', 'Put the bookmark back where it was', async () => {
    if (!removed) return;
    const res = await send<RestoreResponse>({ type: 'restore', bookmark: removed });
    if (!res.ok) return;
    id = res.id;
    removed = null;
    item.classList.remove('removed');
    link.focus();
  }, 'undo strong');

  item.append(link, note, deleteButton, undo);
  const setDescription = (text: string | undefined) => {
    desc.textContent = text ?? '';
    desc.hidden = !text;
  };
  setDescription(r.description);
  return { item, id: () => id, needsDescription: r.description === undefined, setDescription };
}

function render(results: Result[], sitesAllowed: boolean): HTMLElement {
  const host = el('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });

  const panel = el('section', 'panel');
  panel.setAttribute('aria-label', 'From your bookmarks');
  const setCollapsed = (collapsed: boolean) => panel.classList.toggle('collapsed', collapsed);

  const header = el('header');
  header.append(
    el('h2', 'label', 'From your bookmarks · ON'),
    button('Hide', 'Shrink to a small tab', () => setCollapsed(true)),
  );

  // What's left after Hide, so the panel can be brought back.
  const tab = el('div', 'tab');
  tab.append(
    el('span', 'label', `${results.length} ${results.length === 1 ? 'bookmark matches' : 'bookmarks match'}`),
    button('Show', 'Show your matching bookmarks', () => setCollapsed(false), 'strong'),
  );

  const rows = results.map((r, i) => row(r, i >= SHOWN_FIRST));
  const list = el('ul');
  list.append(...rows.map((r) => r.item));
  panel.append(header, tab, list);

  // Summaries not saved yet are fetched once rows become visible: the first 3 now, the rest on "Show more".
  let allowed = sitesAllowed;
  const visibleRows = () => (panel.classList.contains('expanded') ? rows : rows.slice(0, SHOWN_FIRST));
  const describe = async (batch: typeof rows) => {
    if (!allowed) return;
    const pending = batch.filter((r) => r.needsDescription);
    pending.forEach((r) => (r.needsDescription = false));
    if (pending.length === 0) return;
    const found = await send<DescribeResponse>({ type: 'describe', ids: pending.map((r) => r.id()) });
    pending.forEach((r) => r.setDescription(found[r.id()]));
  };
  describe(rows.slice(0, SHOWN_FIRST));

  const footer = el('footer');
  const hiddenCount = results.length - SHOWN_FIRST;
  if (hiddenCount > 0) {
    const more = button(`Show ${hiddenCount} more`, 'Show all matching bookmarks', () => {
      const expanded = panel.classList.toggle('expanded');
      more.textContent = expanded ? 'Show fewer' : `Show ${hiddenCount} more`;
      if (expanded) describe(rows.slice(SHOWN_FIRST));
    });
    footer.append(more);
  }
  // Site access is asked for only when wanted: this opens the extension's own page that asks Chrome.
  if (!allowed) {
    const ask = button('Show descriptions', 'Allow a short summary of each bookmark', () => send({ type: 'askAccess' }));
    footer.append(ask);
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes.sitesAllowedAt || allowed) return;
      allowed = true;
      ask.remove();
      if (footer.childElementCount === 0) footer.remove();
      describe(visibleRows());
    });
  }
  if (footer.childElementCount > 0) panel.append(footer);

  const style = el('style');
  style.textContent = STYLE;
  root.append(style, panel);
  return host;
}

/**
 * Right side of the results: at the top of Google's right column when it has one,
 * otherwise in the empty space beside the results. Top of the results when the
 * window is too narrow, and top of the page if Google renames its columns.
 */
function place(host: HTMLElement) {
  host.removeAttribute('style');
  const rightColumn = document.querySelector('#rhs');
  if (rightColumn) return rightColumn.prepend(host);

  const results = document.querySelector('#center_col');
  if (!results) return document.body.prepend(host);

  const box = results.getBoundingClientRect();
  const room = document.documentElement.clientWidth - box.right - RIGHT_GAP - 16;
  if (room < MIN_RIGHT_WIDTH) return results.prepend(host);

  Object.assign(host.style, {
    position: 'absolute',
    left: `${box.right + window.scrollX + RIGHT_GAP}px`,
    top: `${box.top + window.scrollY}px`,
    width: `${Math.min(RIGHT_WIDTH, room)}px`,
  });
  document.body.append(host);
}

async function main() {
  const query = new URLSearchParams(location.search).get('q')?.trim();
  if (!query) return;
  const res = await send<SearchResponse>({ type: 'search', query });
  if (!res.enabled || res.results.length === 0) return;

  const host = render(res.results, res.sitesAllowed);
  place(host);
  host.dataset.ms = String(Math.round(performance.now() - started));
  window.addEventListener('resize', () => host.isConnected && place(host));
}

// Turning the mode off removes the panel from pages already open.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled?.newValue === false) document.getElementById(HOST_ID)?.remove();
});

main();
