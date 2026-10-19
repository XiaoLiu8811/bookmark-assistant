# Chrome Web Store listing: Bookmark Assistant

Everything to paste into the Chrome Web Store Developer Dashboard. Keep it in step with what the extension does; reviewers compare the two.

## Store listing tab

**Name:** Bookmark Assistant

**Summary:** comes from `description` in `src/manifest.json` (the dashboard shows it as "Summary from package" and can't edit it). To change it, edit the manifest, bump the version and upload a new zip.

**Description** (plain text: the dashboard doesn't render bold or other formatting):
> You saved those pages because they were useful. Bookmark Assistant brings them back when you need them.
>
> Search Google as usual. When your bookmarks match what you're looking for, they appear in a small glass panel beside the results: the best three first, with "Show more" for the rest. You don't need to remember a bookmark's title or which folder you put it in. Matching uses the title, the folder names and the web address, and tolerates typos.
>
> • A one-line description for each bookmark, the page's own summary, so you can tell them apart without opening them. (Optional: you choose whether to turn this on.)
> • Clean up as you go. The trash button deletes a bookmark you no longer need, and Undo puts it right back.
> • Out of the way. No match, no panel. "Hide" shrinks it to a small tab. Click the toolbar icon to turn it off; the green ON badge shows when it's on.
> • Private. Your bookmarks and searches never leave your device. There's no account, no server and no tracking.
>
> Works on Google in every country. English searches work best for now.

**Category:** Tools (under Productivity).

**Language:** English (or English (United States) if regional variants are offered).

**Images** (made by `node scripts/store-images.mjs`, saved in `store/images/`):
- Store icon, 128×128: `store/images/store-icon-128.png` (96×96 artwork with 16 px transparent padding, per the store's image guidelines; the packaged `src/icons/icon-128.png` has none)
- Screenshot, 1280×800: `store/images/screenshot-1.png`. Replace it with one taken in your own Chrome on real Google results if you can; reviewers and users trust the real thing.
- Small promo tile, 440×280: `store/images/promo-small.png`
- Marquee promo tile, 1400×560 (optional; used if the store features the extension): `store/images/promo-marquee.png`
- Screenshots and promo tiles must be JPEG or 24-bit PNG with no alpha. Playwright's page screenshots already are; check with the PNG header (byte 25 = 2) after changing the script.
- Promo video: none.

## Privacy practices tab

**Single purpose:**
> Show the user's own bookmarks that match their Google search, beside the search results.

**Permission justifications:**
- **bookmarks:** Reads the user's bookmarks to find the ones that match their Google search. Deletes a bookmark only when the user clicks its Delete button, and recreates it if they click Undo.
- **storage:** Saves, on the device only, the on/off setting, the page summaries already loaded, and simple counts of panels shown and bookmarks opened.
- **Host permission for Google search pages** (content script on `https://www.google.<country>/search*`): Shows the bookmarks panel on Google search results pages and reads the search query to find matching bookmarks.
- **Optional host permission for all sites** (`http://*/*`, `https://*/*`): Asked for only when the user clicks "Show descriptions" and allows it. Used solely to load each bookmarked page once and read the short summary the page provides for link previews. Only bookmarked pages are loaded, without cookies; the summary is stored on the device.

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** The extension handles the user's bookmarks, their Google search query, and summaries of bookmarked pages. None of it is sent to the developer or any third party; it stays in the browser. Decide in the dashboard which data types to tick; the honest, cautious choice is to tick **Web history** (bookmarks) and **Website content** (page summaries), and then certify all three statements: not sold to third parties, not used for unrelated purposes, not used for creditworthiness or lending.

**Privacy policy URL:** `https://xiaoliu8811.github.io/bookmark-assistant/privacy/` (source: `site/privacy/index.html`, published by `.github/workflows/pages.yml`).

## Additional fields (Store listing tab)

- **Official URL:** xiaoliu.us (verified)
- **Homepage URL:** `https://xiaoliu8811.github.io/bookmark-assistant/`
- **Support URL:** `https://xiaoliu.us/connect/`
- **Mature content:** off

## Distribution tab

**Visibility:** Public. **Regions:** All regions.

## Before each upload

1. Bump `version` in `src/manifest.json` (the store refuses a version it has seen) and update `docs/RELEASE-NOTES.md`.
2. `npm test`, then `npm run package`.
3. Upload `release/bookmark-assistant-<version>.zip`.
