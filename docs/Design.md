# Bookmark Assistant: Design record

Shows your matching bookmarks beside Google's results, so what you already saved comes before the web. Your bookmarks never leave your device.

Idea and history: backlog item `D:\Backlog\items\bookmark-assistant.md`.

## Intake (2026-10-19)

| Question | Answer |
|---|---|
| Users | The owner first, as an unpacked extension; then **public on the Chrome Web Store** (decided 2026-10-19). |
| Read or write heavy | Read. Every Google search reads the bookmarks. The only write is **Delete bookmark**, one at a time. |
| Never lose / can lose | The user's bookmarks must never be lost by accident: Delete removes one bookmark only on a click and always offers **Undo**. Saved descriptions, the on/off setting and usage counts can be lost. |
| Latency | The panel shows within 200 ms of the results page loading. Descriptions may arrive after it, since they need to load the bookmarked page. |
| Budget | $0. No server, API or hosting. ($5 one-time if it goes to the Web Store.) |

**Functional:** a toggle with a visible "on" hint; a panel of matching bookmarks on Google's results page with a one-sentence description each; plain-language matching over title, URL and folder path; Delete with Undo.
**Non-functional:** fast (200 ms), private, safe (no accidental loss), cheap ($0). Where they conflict, **privacy wins**. The privacy rule (changed 2026-10-19, was "no network requests at all"): **the extension only ever contacts the bookmarked sites themselves, never any third party, and never sends your cookies; bookmarks, searches and descriptions stay on the device.** This is why the panel uses system fonts and why meaning-based search, when it comes, has to run locally.

## Decisions

| Decision | Why | Rules out |
|---|---|---|
| Chrome extension (Manifest V3), the only thing the user installs | The user wanted nothing to install beyond an extension; an extension can read bookmarks directly, so there's no export step | Browsers other than Chrome/Chromium for now; a web app that imports an HTML export |
| Panel injected on Google's results page, not a redirect to a bookmarks page | Web results stay right there, so "search online" costs no click. A redirect costs a click on every search that needed the web | Intercepting the address bar itself (extensions can't, short of replacing the default search engine) |
| Every Google country site: the content script matches `https://www.google.<domain>/search*` for the 187 domains in `src/google-domains.json`, copied from https://www.google.com/supported_domains (2026-10-19, was google.com only). The build writes them into the manifest | Public users search on their own country's Google. Match patterns can't wildcard a top-level domain, so the list is explicit | Bing and DuckDuckGo for now |
| On by default at install; clicking the toolbar icon toggles it; a green `#188038` "ON" badge with white text shows while it's on (2026-10-19, was amber) | The user sees it working straight away, and the badge is the always-visible hint. Green reads as "on"; this shade keeps white text at about 5:1 | A settings popup for now |
| No panel when nothing matches | Keeps the mode out of the way; an empty panel on most searches is how it gets turned off | Showing "no bookmarks matched" |
| 3 results first; **Show N more** reveals the rest, up to 10 in total (2026-10-19, was a hard limit of 3) | Keeps the panel short while not hiding relevant bookmarks. Past 10, matches are usually weak | Listing every match |
| Keyword matching with MiniSearch (typo-tolerant, prefix, field boosts: title 3, folder 2, URL 1). Common words ("how", "to", "a") are ignored, and a bookmark must match at least half of the remaining words | Local, instant, one small dependency. Without the half-the-words rule, almost every search would show a panel | Meaning-based matching for now |
| Index rebuilt in memory on every service-worker start and on bookmark change events; never stored | A few thousand bookmarks index in milliseconds; a stored index could fall out of sync with the real bookmarks | Indexing page content (too slow to rebuild each start; needs its own storage design) |
| Panel on the right side of the page (2026-10-19, was above the results): at the top of Google's right column (`#rhs`) when the page has one; otherwise in the empty space right of the results column (`#center_col`), at the same spot and width as Google's own right column (76 px gap, 372 px wide); at the top of the results when the window leaves under 280 px; at the top of the page if neither element exists. Re-placed when the window is resized | The owner preferred it beside the results rather than pushing them down. Google shows a right column only on some searches (places, people), so the panel can't rely on it being there | Visually merging into Google's result list |
| iPhone-style frosted glass (2026-10-19; replaced in turn a monochrome list the owner found too easy to miss, a solid navy card, and a see-through navy card they wanted more transparent). Light mode: clear glass (white 62% → 30%) with a faint amber glow top-left and teal glow bottom-right, `blur(22px) saturate(1.8)`, a bright rim and a soft navy shadow, navy text. Dark mode: dark glass with white text. 24 px corners, inset list with hairline separators, capsule buttons, a capsule for the hidden state | On Google's white page, real transparency is only possible as light glass with dark text: a see-through dark card turns gray and unreadable. The rim, shadow and tints keep it noticeable. Colors from xiaoliu.us (navy `#172A3A`, teal `#426F76`) plus this app's amber | Blending in with Google's results; a dark card in light mode |
| Panel lives in a Shadow DOM | Google's CSS can't restyle it | — |
| **Hide** shrinks the panel to a one-line tab ("7 bookmarks match · Show"); every new search starts open | After Hide, the owner had no way to bring the panel back. Starting each search open means no match is missed | Remembering the hidden state across searches |
| One-sentence description per result: the summary the page itself offers for link previews (`og:description`, then `description`, then `twitter:description`), cut to 300 characters and shown in 2 lines (2026-10-19) | Lets the owner tell results apart without opening each one. A bookmark stores only a title and URL, so the text has to come from the page | Descriptions for pages that offer no summary; AI-written summaries |
| Descriptions are fetched by the background script, by **bookmark id only**: the panel can't ask it to load an arbitrary URL. Loaded without cookies (`credentials: 'omit'`), 8-second timeout, HTML only. Each is saved on the device and reused; a page with no summary is tried again after 7 days; the saved copy is deleted when the bookmark is | Keeps the new network access tied to the privacy rule: only bookmarked sites, never your logged-in session, and each page loaded once rather than on every search | Fetching through any service or proxy |
| Descriptions load only for visible rows: the first 3 when the panel opens, the rest on **Show more** | Fewer page loads per search | — |
| Site access is **optional** (`optional_host_permissions` for all http/https sites, 2026-10-19, was granted at install). Until it's allowed, the panel shows a **Show descriptions** button; it opens the extension's own page (`grant.html`), which explains what the access is for and asks Chrome on **Allow**. Granting it sets `sitesAllowedAt` in storage, and open panels then load their descriptions. The security policy's `connect-src http: https:` stays | Installing asks only for bookmarks and Google, so the install warning is mild and the store review is faster. Chrome only shows its permission prompt from a click on an extension page, not from inside Google's page | Descriptions for users who don't opt in |
| **Delete** on each row: a trash icon that widens to a red "Delete bookmark" when pointed at (accessible name "Delete bookmark"). One click deletes that one bookmark from Chrome; the row turns red-tinted with "Deleted from your bookmarks", the title and a prominent **Undo** (which gets keyboard focus) until the page is left. Undo recreates it in the same folder and position, or in "Other bookmarks" if the folder is gone too. Never deletes folders (2026-10-19, was read-only; renamed from "Remove", which read as "remove from this list") | Cleaning up should be one click, and Undo makes a mis-click harmless. A confirmation dialog on every deletion is the chore this app is meant to remove | Deleting folders; bulk deletion |
| Toolbar icon (2026-10-19): a navy-to-teal glass square with a white bookmark and an amber star, from `src/icons/icon.svg`, rendered to 16/32/48/128 px by `scripts/render-icons.mjs` | Matches the panel and xiaoliu.us, and stays readable at 16 px with the badge on it (chosen from three drawn options) | — |
| Published on the Chrome Web Store, public. Listing text, permission justifications and images live in `store/`; `npm run package` writes the upload zip | The owner wants others to use it; the store gives one-click install and automatic updates | Sharing an unpacked zip |
| Open source on GitHub (MIT, like SparkFlow), with a small GitHub Pages site (`site/`: home page and privacy policy) at https://xiaoliu8811.github.io/bookmark-assistant/ (2026-10-19) | The store needs a public privacy policy; GitHub Pages is free for a public repo, and public code lets users and reviewers check the privacy claims | Hosting the policy on xiaoliu.us, which would need its builder to support pages under a project |
| Listed under Projects on xiaoliu.us, linking to the store page once the listing is live | The owner's other apps are listed there | — |
| Plain TypeScript, esbuild, no UI framework | The UI is one small panel | — |
| Two builds: `dist/` is the real one; `dist-test/` (`node build.mjs --test`) is identical except site access is granted at install | Chrome's permission prompt is a native dialog automated tests can't click, so the description tests need access up front. The real build is tested for the no-access path | — |

## Success criteria

**Acceptance criteria** (automated tests):
1. With the mode on, a Google search matching a bookmark's title, URL or folder name shows the panel within 200 ms on the right side of the page (top of the results in a narrow window), best match first, 3 results at first, and **Show more** for the rest (up to 10).
2. With the mode off, or with no matches, nothing is added to the page. The toolbar badge always shows the current mode.
3. **Hide** shrinks the panel to a tab, **Show** brings it back, and the next search starts open. The on/off setting persists across browser restarts.
4. Clicking a result opens the bookmarked page.
5. The extension only contacts bookmarked pages, and never sends cookies with those requests.
8. Without site access, no page is loaded; **Show descriptions** opens the page that explains and asks for it. It works on Google's country sites (google.co.uk, google.de, …) as well as google.com.
6. Each result shows the page's own one-sentence summary when it has one, and no empty line when it doesn't. A saved summary is reused without a new request.
7. **Delete bookmark** deletes it from Chrome, the row says so with an **Undo** button, and Undo puts it back in the same folder and position.

**Real-world success**, judged after about 2 weeks of the owner's own use (agreed 2026-10-19):
- A bookmark is opened from the panel at least 3 times a week.
- Most panels contain something useful.
- The mode is still on.

The toolbar icon's tooltip shows the counts kept on the device: panels shown and bookmarks opened since a date. "Useful" is judged by the owner; the count of opened bookmarks is the proxy.

## Known limitations

- Chrome's own address bar already suggests bookmarks by title. The edge here is folder-path matching, looser wording and the descriptions; vague titles of pages with no summary remain hard until page-content search exists.
- Some sites offer no summary, block automated page loads, or need you to be logged in (cookies are never sent), so their bookmarks have no description.
- A description is the site's own text, in the site's language, and can be marketing copy.
- Undo lasts only while the results page is open. After leaving it, a deleted bookmark is gone (Chrome's own history of bookmarks doesn't keep it). Deleting a synced bookmark deletes it on your other devices too.
- Google's results-page markup and URL patterns can change without notice. The panel depends on two element ids with fallbacks, but the URL match is fixed.
- Words are split on spaces and punctuation, so Chinese, Japanese and Korean text (no spaces) becomes one long word. Such a query only matches a title that starts the same way. The app targets English searches for now (decided 2026-10-19).
- The panel is added when a results page loads. If Google changes results without a page load, the panel isn't updated.
- No custom toolbar icon yet; Chrome shows a default letter icon with the badge.
- System fonts instead of the site's Inter: loading a web font would contact a third party.
- Clicking **Allow** in Chrome's own permission prompt can't be automated; check it by hand after changing that flow.
- The list of Google country sites is a snapshot; refresh `src/google-domains.json` from https://www.google.com/supported_domains if Google adds one.
- The store screenshot uses a plain stand-in results page with made-up bookmarks; a real screenshot from Chrome is better.
- Automated tests use a saved Google results page and made-up bookmarked pages, not live sites (Google shows consent pages and CAPTCHAs to automated browsers).

## Later

Move to another folder · resurfacing a few forgotten bookmarks at a time · page-content search · local meaning-based search · related pages online inspired by your bookmarks · Bing and DuckDuckGo · dead links and duplicates.
