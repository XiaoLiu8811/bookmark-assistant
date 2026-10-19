/** Longest description kept; the panel shows two lines of it. */
export const MAX_DESCRIPTION = 300;

// The summaries sites write for link previews, best first.
const SOURCES = ['og:description', 'description', 'twitter:description'];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  });

/**
 * The page's own summary from its <meta> tags, or '' if it has none.
 * Uses regular expressions because service workers have no DOMParser.
 */
export function extractDescription(html: string): string {
  const head = html.slice(0, 200_000);
  const found = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map<string, string>();
    for (const [, name, , v1, v2, v3] of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs.set(name.toLowerCase(), v1 ?? v2 ?? v3 ?? '');
    }
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key && content && !found.has(key)) found.set(key, content);
  }
  for (const source of SOURCES) {
    const text = decode(found.get(source) ?? '').replace(/\s+/g, ' ').trim();
    if (text) return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
  }
  return '';
}
