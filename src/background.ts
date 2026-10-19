import type MiniSearch from 'minisearch';
import { hasSiteAccess } from './access';
import { extractDescription } from './describe';
import { buildIndex, flattenTree, search, type Bookmark } from './search';
import type { DescribeResponse, Removed, RemoveResponse, Request, RestoreResponse, SearchResponse } from './messages';

interface Stats {
  since: string;
  panels: number;
  opened: number;
}

interface CachedDescription {
  text: string;
  at: number;
}

const FETCH_TIMEOUT_MS = 8000;
// A page that had no summary (or didn't load) is tried again after a week.
const RETRY_EMPTY_MS = 7 * 24 * 60 * 60 * 1000;

// Built on first use and thrown away whenever bookmarks change, so it can't drift from the real ones.
let index: Promise<MiniSearch<Bookmark>> | null = null;
const getIndex = () => (index ??= chrome.bookmarks.getTree().then((tree) => buildIndex(flattenTree(tree))));
const dropIndex = () => {
  index = null;
};
chrome.bookmarks.onCreated.addListener(dropIndex);
chrome.bookmarks.onChanged.addListener(dropIndex);
chrome.bookmarks.onMoved.addListener(dropIndex);
chrome.bookmarks.onRemoved.addListener((_id, info) => {
  dropIndex();
  // Don't keep a description for a page that's no longer bookmarked.
  if (info.node.url) chrome.storage.local.remove(descKey(info.node.url));
});

const isEnabled = async () => (await chrome.storage.local.get('enabled')).enabled !== false;

async function getStats(): Promise<Stats> {
  const { stats } = await chrome.storage.local.get<{ stats?: Stats }>('stats');
  return stats ?? { since: new Date().toISOString().slice(0, 10), panels: 0, opened: 0 };
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
  // Green for "on", with white text (about 5:1 contrast).
  await chrome.action.setBadgeBackgroundColor({ color: '#188038' });
  await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  await chrome.action.setTitle({
    title:
      `Bookmark Assistant is ${enabled ? 'on' : 'off'}. Click to turn it ${enabled ? 'off' : 'on'}.\n` +
      `Since ${stats.since}: ${stats.panels} panels shown, ${stats.opened} bookmarks opened.`,
  });
}

const descKey = (url: string) => `desc:${url}`;

async function cachedDescriptions(urls: string[]): Promise<Map<string, CachedDescription>> {
  const stored = await chrome.storage.local.get<Record<string, CachedDescription>>(urls.map(descKey));
  return new Map(urls.filter((u) => stored[descKey(u)]).map((u) => [u, stored[descKey(u)]]));
}

const isFresh = (c: CachedDescription | undefined) => !!c && (c.text !== '' || Date.now() - c.at < RETRY_EMPTY_MS);

// Loads the bookmarked page itself, without cookies, and keeps only its summary.
async function fetchDescription(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return '';
  try {
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok || !res.headers.get('content-type')?.includes('html')) return '';
    return extractDescription(await res.text());
  } catch {
    return '';
  }
}

async function describe(ids: string[]): Promise<DescribeResponse> {
  if (!(await hasSiteAccess())) return {};
  // Look the pages up by bookmark id, so only bookmarked pages are ever fetched.
  const nodes = (await Promise.all(ids.map((id) => chrome.bookmarks.get(id).catch(() => [])))).flat();
  const bookmarks = nodes.filter((n): n is chrome.bookmarks.BookmarkTreeNode & { url: string } => !!n.url);
  const cache = await cachedDescriptions(bookmarks.map((b) => b.url));
  const out: DescribeResponse = {};
  await Promise.all(
    bookmarks.map(async (b) => {
      const cached = cache.get(b.url);
      if (isFresh(cached)) return (out[b.id] = cached!.text);
      const text = await fetchDescription(b.url);
      await chrome.storage.local.set({ [descKey(b.url)]: { text, at: Date.now() } satisfies CachedDescription });
      out[b.id] = text;
    }),
  );
  return out;
}

async function remove(id: string): Promise<RemoveResponse> {
  const [node] = await chrome.bookmarks.get(id).catch(() => []);
  if (!node?.url) return { ok: false }; // only single bookmarks, never folders
  await chrome.bookmarks.remove(id);
  return { ok: true, removed: { parentId: node.parentId, index: node.index, title: node.title, url: node.url } };
}

async function restore(b: Removed): Promise<RestoreResponse> {
  try {
    return { ok: true, id: (await chrome.bookmarks.create(b)).id };
  } catch {
    // The folder is gone too; put it back in "Other bookmarks" rather than lose it.
    return { ok: true, id: (await chrome.bookmarks.create({ title: b.title, url: b.url })).id };
  }
}

// Tells open panels that descriptions can load now.
chrome.permissions.onAdded.addListener(() => chrome.storage.local.set({ sitesAllowedAt: Date.now() }));

chrome.runtime.onInstalled.addListener(showMode);
chrome.runtime.onStartup.addListener(showMode);
chrome.storage.onChanged.addListener((changes) => {
  if ('enabled' in changes) showMode();
});
chrome.action.onClicked.addListener(async () => {
  await chrome.storage.local.set({ enabled: !(await isEnabled()) });
});

chrome.runtime.onMessage.addListener((msg: Request, _sender, reply) => {
  const handle = async () => {
    switch (msg.type) {
      case 'search': {
        if (!(await isEnabled())) return { enabled: false, sitesAllowed: false, results: [] } satisfies SearchResponse;
        const results = search(await getIndex(), msg.query);
        if (results.length > 0) await count('panels');
        // Descriptions already saved come with the results; the rest are fetched after the panel shows.
        const cache = await cachedDescriptions(results.map((r) => r.url));
        return {
          enabled: true,
          sitesAllowed: await hasSiteAccess(),
          results: results.map((r) => {
            const cached = cache.get(r.url);
            return isFresh(cached) ? { ...r, description: cached!.text } : r;
          }),
        } satisfies SearchResponse;
      }
      case 'describe':
        return describe(msg.ids);
      case 'remove':
        return remove(msg.id);
      case 'restore':
        return restore(msg.bookmark);
      case 'opened':
        return count('opened');
      case 'askAccess':
        return chrome.windows.create({ url: chrome.runtime.getURL('grant.html'), type: 'popup', width: 480, height: 400 }).then(() => undefined);
    }
  };
  handle().then(reply);
  return true; // reply is sent asynchronously
});
