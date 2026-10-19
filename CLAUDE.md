# Bookmark Assistant

Chrome extension (Manifest V3) that shows matching bookmarks above Google's search results. Design record and decisions: [docs/Design.md](docs/Design.md).

## Repo and URLs

- Repo: `D:\BookmarkAssistant`, local only (no remote yet). Branch: `main`.
- No live URL and no deployment: the extension is loaded unpacked from `dist/` in `chrome://extensions` (Developer mode → Load unpacked).

## Commands

- `npm run build`: bundle `src/` into `dist/` with esbuild.
- `npm test`: type check, Vitest unit tests for matching quality (`tests/search.test.ts`), build, then Playwright end-to-end tests (`tests/e2e/`) in Playwright's own Chromium with the extension loaded. Google is replaced by the saved stand-in `tests/fixtures/google-results.html`; live Google shows consent pages and CAPTCHAs to automated browsers.
- The e2e run saves `test-results/panel-light.png` and `panel-dark.png`; look at both before calling a UI change done.
- First time on a machine: `npx playwright install chromium`.

After a rebuild, click the reload icon on the extension's card in `chrome://extensions`, then reload the Google tab.

## Version and release notes

- The version lives in `src/manifest.json` (`version`) and nowhere else.
- Release notes: [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md). Update them as each feature lands.

## Design system

| Token | Light | Dark |
|---|---|---|
| Accent (left bar, header, badge) | `#B45309` | `#F59E0B` |
| Tint (panel background) | `#FEF3E2` | `#2A1E0B` |
| Text | `#1F1F1F` | `#E8EAED` |
| Muted text (folder path) | `#5F6368` | `#9AA0A6` |

- Font: the system UI font stack only. No web fonts: loading one is a network request.
- Panel: amber left bar, header "From your bookmarks · ON" with a **Hide** button, at most 3 results. Each result shows ★, title, and folder path joined with ›.
- Theme follows `prefers-color-scheme`. Define colors as CSS custom properties inside the panel's Shadow DOM.

## App rules

- **No network requests from the extension, ever.** No analytics, fonts, CDNs or APIs. A test checks this.
- **The MVP never changes bookmarks.** Any future write (move, delete) needs undo.
- The panel lives in a Shadow DOM and must not depend on Google's result markup.
- Test fixtures and screenshots use made-up bookmarks. Real bookmark exports stay out of the repo (see `.gitignore`).
