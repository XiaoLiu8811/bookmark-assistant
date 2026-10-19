import type MiniSearch from 'minisearch';
import { buildIndex, flattenTree, search, type Bookmark } from './search';
import type { Request, SearchResponse } from './messages';

interface Stats {
  since: string;
  panels: number;
  opened: number;
}

// Built on first use and thrown away whenever bookmarks change, so it can't drift from the real ones.
let index: Promise<MiniSearch<Bookmark>> | null = null;
const getIndex = () => (index ??= chrome.bookmarks.getTree().then((tree) => buildIndex(flattenTree(tree))));
const dropIndex = () => {
  index = null;
};
chrome.bookmarks.onCreated.addListener(dropIndex);
chrome.bookmarks.onRemoved.addListener(dropIndex);
chrome.bookmarks.onChanged.addListener(dropIndex);
chrome.bookmarks.onMoved.addListener(dropIndex);

const isEnabled = async () => (await chrome.storage.local.get('enabled')).enabled !== false;

async function getStats(): Promise<Stats> {
  const { stats } = await chrome.storage.local.get<{ stats?: Stats }>('stats');
  return stats ??{ since: new Date().toISOString().slice(0, 10), panels: 0, opened: 0 };
}

async function count(key: 'panels' | 'opened') {
  const stats = await getStats();
  stats[key]++;
  await chrome.storage.local.set({ stats });
  await showMode();
}

// The badge is the "mode is on" hint; the tooltip also carries the trial counts.
async function showMode() {
  const [enabled, stats] = await Promise.all([isEnabled(), getStats()]);
  await chrome.action.setBadgeBackgroundColor({ color: '#B45309' });
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  await chrome.action.setTitle({
    title:
      `Bookmark Assistant is ${enabled ? 'on' : 'off'}. Click to turn it ${enabled ? 'off' : 'on'}.\n` +
      `Since ${stats.since}: ${stats.panels} panels shown, ${stats.opened} bookmarks opened.`,
  });
}

chrome.runtime.onInstalled.addListener(showMode);
chrome.runtime.onStartup.addListener(showMode);
chrome.storage.onChanged.addListener((changes) => {
  if ('enabled' in changes) showMode();
});
chrome.action.onClicked.addListener(async () => {
  await chrome.storage.local.set({ enabled: !(await isEnabled()) });
});

chrome.runtime.onMessage.addListener((msg: Request, _sender, reply) => {
  if (msg.type === 'search') {
    (async (): Promise<SearchResponse> => {
      if (!(await isEnabled())) return { enabled: false, results: [] };
      const results = search(await getIndex(), msg.query);
      if (results.length > 0) await count('panels');
      return { enabled: true, results };
    })().then(reply);
    return true; // reply is sent asynchronously
  }
  if (msg.type === 'opened') count('opened');
});
