# Bookmark Assistant

Chrome extension (Manifest V3) that shows matching bookmarks beside Google's search results, with a one-sentence description and Delete/Undo on each. Design record and decisions: [docs/Design.md](docs/Design.md).

## Repo and URLs

- Repo: `D:\BookmarkAssistant`, local only (no remote yet). Branch: `main`.
- During development the extension is loaded unpacked from `dist/` in `chrome://extensions` (Developer mode → Load unpacked).
- Distribution: public on the Chrome Web Store (not yet submitted). Everything the dashboard asks for is in `store/listing.md`.
- Source: public on GitHub, https://github.com/XiaoLiu8811/bookmark-assistant (MIT). Push only `main`.
- Website: `site/` (home page and privacy policy) is published by `.github/workflows/pages.yml` to https://xiaoliu8811.github.io/bookmark-assistant/ on each push to `main` that touches it. The store listing links to `privacy/`, so keep that address, and update the policy's date when it changes.
- Listed on the owner's site under Projects: xiaoliu.us, `site.json` → `apps`, on the `personal-main` branch of `D:\PersonalWeb\xiaoliu-site`. Add the store link there once the listing is live.

## Commands

- `npm run build`: bundle `src/` into `dist/` with esbuild; writes the 187 Google country sites from `src/google-domains.json` into the manifest.
- `npm run package`: build, then zip `dist/` to `release/bookmark-assistant-<version>.zip` for the store.
- `node scripts/render-icons.mjs`: re-render `src/icons/icon-*.png` after editing `src/icons/icon.svg`.
- `node scripts/store-images.mjs` (after `node build.mjs --test`): store screenshot and promo tile into `store/images/`.
- `npm test`: type check, Vitest unit tests for matching quality (`tests/search.test.ts`) and description parsing (`tests/describe.test.ts`), then the real build and the test build (`dist-test/`: site access granted at install, since tests can't click Chrome's permission prompt), then Playwright end-to-end tests (`tests/e2e/`) in Playwright's own Chromium with the extension loaded. Google is replaced by the saved stand-in `tests/fixtures/google-results.html`; live Google shows consent pages and CAPTCHAs to automated browsers. Every other address is answered with a made-up page, so tests never reach the internet; fixture bookmarks use reserved example domains (`*.example.com/.org/.net`) only.
- The e2e run saves screenshots to `test-results/panel-*.png` (light, hover, delete hover, a deleted row in light and dark, dark, hidden, inside Google's right column, without site access) and `grant-page.png`; look at them before calling a UI change done.
- First time on a machine: `npx playwright install chromium`.

After a rebuild, click the reload icon on the extension's card in `chrome://extensions`, then reload the Google tab.

## Version and release notes

- The version lives in `src/manifest.json` (`version`) and nowhere else.
- Release notes: [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md). Update them as each feature lands.

## Design system

iPhone-style frosted glass with colors from the owner's site, xiaoliu.us. On Google's white page real transparency only works as **light glass with dark text** (a see-through dark card turns gray and unreadable), so light mode is clear glass and dark mode is dark glass.

| Token | Light | Dark |
|---|---|---|
| Glass | `linear-gradient(rgba(255,255,255,0.62) → 0.3)` | `linear-gradient(rgba(255,255,255,0.1) → 0.04)` |
| Glow (under the glass) | amber `rgba(245,158,11,0.1)` top-left, teal `rgba(66,111,118,0.13)` bottom-right | amber 0.12, teal 0.2 |
| Blur | `blur(22px) saturate(1.8)` | same |
| Rim and shadow | 1 px `rgba(255,255,255,0.75)` + navy hairline 0.08, inner top highlight; `0 18px 44px -14px rgba(23,42,58,0.28)` | 1 px `rgba(255,255,255,0.16)`; `0 18px 44px -14px rgba(0,0,0,0.6)` |
| Text: title / body / faint | navy `#172A3A` / 0.76 / 0.64 | `#fff` / 0.78 / 0.62 |
| Separators, row hover, button fill | navy at 0.1, 0.05, 0.07 (hover 0.13) | white at 0.12, 0.07, 0.12 (hover 0.2) |
| Strong button (Show, Undo) | navy fill, white text | white fill, navy text |
| Delete red | `#E5281C` | `#FF453A` |
| Accent (label tick, focus ring) | `#F59E0B` | same |
| Toolbar badge | "ON", white text on green `#188038` | same |

- Corners: card 24 px, rows 14 px, buttons and the hidden tab are capsules.
- Font: the Apple/Windows system stack (`-apple-system`, SF Pro, Segoe UI Variable, …). No web fonts: they're third-party requests.
- Label: 12 px, weight 600, uppercase, letter-spacing 0.06em, faint, after a rounded 4×14 px amber tick.
- Buttons: borderless capsules, weight 600, shrink slightly when pressed.
- Row: bold title (600, letter-spacing −0.01em), description in 2 lines (14 px), folder path joined with › (13 px, faint). Hairlines are inset 16 px and hidden next to a highlighted row. 3 rows first, **Show N more** for the rest (up to 10), which becomes **Show fewer**.
- Delete: a faint trash icon at the row's top right, sitting on top of the row (rows keep 48 px free on the right) so it can widen to a red "Delete bookmark" capsule without moving the text. Never label it just "Remove": it reads as "remove from this list".
- Deleted row: tinted with 10% delete red; "Deleted from your bookmarks" in red, the title below, **Undo** on the right.
- The card fades and rises in over 0.35 s (off with `prefers-reduced-motion`); screenshots must wait for it.
- Hidden state: a glass capsule with the label "N bookmarks match" and **Show**.
- Toolbar icon: `src/icons/icon.svg`, a navy-to-teal glass square with a white bookmark and an amber star.
- The permission page (`src/grant.html`) uses the same tokens, glass background and capsule buttons.
- Define colors as CSS custom properties inside the panel's Shadow DOM.

## App rules

- **Site access stays optional.** Never move it into `host_permissions` in `src/manifest.json`; only the test build grants it at install.
- **The extension contacts only bookmarked sites, never a third party, and never sends cookies.** No analytics, fonts, CDNs or APIs. The panel passes bookmark ids, never URLs, to the background script, which looks up the URL itself. A test checks the requests and the missing cookies.
- **Bookmark changes need Undo.** Delete removes one bookmark (never a folder) and offers Undo; any future write (move, bulk actions) must too.
- The panel lives in a Shadow DOM and depends only on `#rhs` and `#center_col` in Google's markup, with fallbacks.
- Test fixtures and screenshots use made-up bookmarks. Real bookmark exports stay out of the repo (see `.gitignore`).
