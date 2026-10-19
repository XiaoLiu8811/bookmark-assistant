import MiniSearch from 'minisearch';
import { MAX_RESULTS } from './limits';

export { MAX_RESULTS, SHOWN_FIRST } from './limits';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  /** Folder names from the top of the tree down, e.g. ["Dev", "CSS"]. */
  folders: string[];
}

export interface Match {
  id: string;
  title: string;
  url: string;
  folderPath: string;
}

// Words that carry no meaning in a search like "how to center a div".
// Without this, nearly every bookmark matches nearly every query.
const STOP_WORDS = new Set(
  ('a an and are as at be best by can do does for from get how i in is it me my near of on or ' +
    'the this to vs what when where which who why will with you your').split(' '),
);

// URL parts that appear in almost every bookmark.
const URL_NOISE = new Set(['http', 'https', 'www', 'com', 'org', 'net', 'html', 'htm', 'php', 'index']);

const tokenize = (text: string): string[] =>
  text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);

/** Walks Chrome's bookmark tree into a flat list of bookmarks with their folder path. */
export function flattenTree(nodes: chrome.bookmarks.BookmarkTreeNode[], folders: string[] = []): Bookmark[] {
  const out: Bookmark[] = [];
  for (const node of nodes) {
    if (node.url) {
      out.push({ id: node.id, title: node.title, url: node.url, folders });
    } else if (node.children) {
      // The root and Chrome's built-in folders ("Bookmarks bar", "Other bookmarks") say nothing about the topic.
      const isBuiltIn = node.id === '0' || node.parentId === '0';
      out.push(...flattenTree(node.children, isBuiltIn ? folders : [...folders, node.title]));
    }
  }
  return out;
}

export function buildIndex(bookmarks: Bookmark[]): MiniSearch<Bookmark> {
  const index = new MiniSearch<Bookmark>({
    fields: ['title', 'folderText', 'url'],
    storeFields: ['title', 'url', 'folders'],
    extractField: (doc, field) => (field === 'folderText' ? doc.folders.join(' ') : (doc as any)[field]),
    tokenize: (text, field) => {
      const tokens = tokenize(text);
      return field === 'url' ? tokens.filter((t) => !URL_NOISE.has(t)) : tokens;
    },
    processTerm: (term) => (STOP_WORDS.has(term) ? null : term),
  });
  index.addAll(bookmarks);
  return index;
}

/**
 * Up to MAX_RESULTS bookmarks for a plain-language query, best first.
 * A bookmark must match at least half of the query's meaningful words, so a
 * single shared common word doesn't put it in the panel.
 */
export function search(index: MiniSearch<Bookmark>, query: string): Match[] {
  const terms = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  if (terms.length === 0) return [];
  const needed = Math.ceil(terms.length / 2);

  return index
    .search(terms.join(' '), {
      boost: { title: 3, folderText: 2, url: 1 },
      prefix: (term) => term.length >= 3,
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      combineWith: 'OR',
    })
    .filter((r) => r.queryTerms.length >= needed)
    .slice(0, MAX_RESULTS)
    .map((r) => ({ id: String(r.id), title: r.title, url: r.url, folderPath: (r.folders as string[]).join(' › ') }));
}
