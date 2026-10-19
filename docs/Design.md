# Bookmark Assistant: Design record

Shows your matching bookmarks above Google's results, so what you already saved comes before the web. Everything stays on your device.

Idea and history: backlog item `D:\Backlog\items\bookmark-assistant.md`.

## Intake (2026-10-19)

| Question | Answer |
|---|---|
| Users | Just the owner, loaded as an unpacked extension. Others via the Chrome Web Store only after it proves useful. |
| Read or write heavy | Read. Every Google search reads the bookmarks; the MVP never writes them. |
| Never lose / can lose | The user's bookmarks must never be lost. The MVP is read-only, so it can't lose them. The on/off setting and local usage counts can be lost. |
| Latency | The panel shows within 200 ms of the results page loading. |
| Budget | $0. No server, API or hosting. ($5 one-time if it goes to the Web Store.) |

**Functional:** a toggle with a visible "on" hint; a panel of matching bookmarks on Google's results page; plain-language matching over title, URL and folder path.
**Non-functional:** fast (200 ms), private (no network requests at all), safe (read-only), cheap ($0). Where they conflict, **privacy wins**: no feature in this app sends bookmark data off the device. This is why the panel uses a system font and why meaning-based search, when it comes, has to run locally.

## Decisions

| Decision | Why | Rules out |
|---|---|---|
| Chrome extension (Manifest V3), the only thing the user installs | The user wanted nothing to install beyond an extension; an extension can read bookmarks directly, so there's no export step | Browsers other than Chrome/Chromium for now; a web app that imports an HTML export |
| Panel injected on Google's results page, not a redirect to a bookmarks page | Web results stay right below, so "search online" costs no click. A redirect costs a click on every search that needed the web | Intercepting the address bar itself (extensions can't, short of replacing the default search engine) |
| Google only (`www.google.com/search`) | Fewest permissions, one page to support and test | Bing, DuckDuckGo and Google country domains (e.g. google.co.uk) in the MVP |
| Search only, read-only | Smallest, safest MVP; proves the core value first | Move, delete and resurfacing in the MVP |
| On by default at install; clicking the toolbar icon toggles it; an amber "ON" badge shows while it's on | The user sees it working straight away, and the badge is the always-visible hint that the mode is on | A settings popup in the MVP |
| No panel when nothing matches | Keeps the mode out of the way; an empty panel on most searches is how it gets turned off | Showing "no bookmarks matched" |
| At most 3 results | Pushes Google's results down the least | A "show more" in the MVP |
| Keyword matching with MiniSearch (typo-tolerant, prefix, field boosts: title 3, folder 2, URL 1). Common words ("how", "to", "a") are ignored, and a bookmark must match at least half of the remaining words | Local, instant, one small dependency. Without the half-the-words rule, almost every search would show a panel | Meaning-based matching in the MVP |
| The manifest's security policy sets `connect-src 'none'` | The background code physically can't send data anywhere, so the privacy promise is enforced, not just intended | Any feature that needs the network from the background code; it would have to change this deliberately |
| Index rebuilt in memory on every service-worker start and on bookmark change events; never stored | A few thousand bookmarks index in milliseconds; a stored index could fall out of sync with the real bookmarks | Indexing page content (too slow to rebuild each start; needs its own storage design) |
| Panel lives in a Shadow DOM, placed at the top of `#center_col` (Google's results column), or at the top of the page if that's gone | Google's CSS can't restyle it, and it depends on one element of Google's markup, with a fallback | Visually merging into Google's result list |
| Plain TypeScript, esbuild, no UI framework | The UI is one small panel and a popup | — |

## Success criteria

**MVP acceptance criteria** (automated tests):
1. With the mode on, a Google search matching a bookmark's title, URL or folder name shows the panel within 200 ms, best match first, at most 3 results.
2. With the mode off, or with no matches, nothing is added to the page. The toolbar badge always shows the current mode.
3. **Hide** removes the panel for that search only. The on/off setting persists across browser restarts.
4. Clicking a result opens the bookmarked page.
5. The extension makes no network requests.

**Real-world success**, judged after about 2 weeks of the owner's own use (agreed 2026-10-19):
- A bookmark is opened from the panel at least 3 times a week.
- Most panels contain something useful.
- The mode is still on.

The toolbar icon's tooltip shows the counts kept on the device: panels shown and bookmarks opened since a date. "Useful" is judged by the owner; the count of opened bookmarks is the proxy.

## Known limitations

- Chrome's own address bar already suggests bookmarks by title. The MVP's edge is folder-path matching and looser wording; vague or truncated titles remain hard until page-content search exists.
- Google's results-page markup and URL patterns can change without notice. The panel avoids depending on the markup, but the URL match is fixed.
- Words are split on spaces and punctuation, so Chinese, Japanese and Korean text (no spaces) becomes one long word. Such a query only matches a title that starts the same way. The MVP targets English searches (decided 2026-10-19); other languages come later.
- The panel is added when a results page loads. If Google changes results without a page load, the panel isn't updated.
- No custom toolbar icon yet; Chrome shows a default letter icon with the badge.
- Dark mode follows the system setting (`prefers-color-scheme`), not Google's own theme setting, which can differ.
- Automated tests use a saved Google results page, not live Google (which shows consent pages and CAPTCHAs to automated browsers).

## Later

Open / move / delete with undo · resurfacing a few forgotten bookmarks at a time · page-content search · local meaning-based search · related pages online inspired by your bookmarks · Bing and DuckDuckGo · dead links and duplicates.
