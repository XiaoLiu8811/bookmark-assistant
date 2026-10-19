import type { Match } from './search';

/** Where a removed bookmark was, so Undo can put it back. */
export interface Removed {
  parentId?: string;
  index?: number;
  title: string;
  url: string;
}

export type Request =
  | { type: 'search'; query: string }
  | { type: 'opened' }
  // Bookmark ids, never URLs: the background only fetches pages that are bookmarked.
  | { type: 'describe'; ids: string[] }
  | { type: 'remove'; id: string }
  | { type: 'restore'; bookmark: Removed }
  // Opens the page that asks Chrome for site access (needed to load descriptions).
  | { type: 'askAccess' };

export interface SearchResponse {
  enabled: boolean;
  /** Whether the user has allowed site access, so descriptions can be loaded. */
  sitesAllowed: boolean;
  results: (Match & { description?: string })[];
}

/** Bookmark id → description ('' when the page has none). */
export type DescribeResponse = Record<string, string>;

export type RemoveResponse = { ok: true; removed: Removed } | { ok: false };

export type RestoreResponse = { ok: true; id: string } | { ok: false };
