# Bookmark Assistant

Describe what you're looking for in your own words, and the assistant finds it in your bookmarks first. It also brings forgotten bookmarks back so you can use, move or delete them.

A Chrome extension: when the mode is on, matching bookmarks appear beside your Google results, each with a one-sentence description and a trash button to delete it. Your bookmarks never leave your device. Design and decisions: [docs/Design.md](docs/Design.md). The idea's history is in the backlog item `D:\Backlog\items\bookmark-assistant.md`.

## Status

Version 0.1.0 is built and passes its tests; it hasn't been released yet. Next step: try it in your own Chrome for about 2 weeks, judged by the goals in `docs/Design.md`.

## Try it

1. `npm install`, then `npm run build`.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `dist` folder.
3. Search something on Google that you've bookmarked.
4. To see a one-line description for each bookmark, click **Show descriptions** in the panel and allow access.

## Publish to the Chrome Web Store

1. `npm test`, then `npm run package`. The zip is in `release/`.
2. The privacy policy is `site/privacy/index.html`, published with the home page to https://xiaoliu8811.github.io/bookmark-assistant/ on each push to `main`.
3. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 registration), create a new item, upload the zip, and fill in the tabs from `store/listing.md`, using the images in `store/images/`.
4. Submit for review.
