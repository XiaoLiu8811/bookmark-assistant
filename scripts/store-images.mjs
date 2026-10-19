// Makes the Chrome Web Store images in store/images/: a 1280×800 screenshot of the real panel
// (test build, so descriptions show) on a plain stand-in results page, the 440×280 small and
// 1400×560 marquee promo tiles (24-bit PNG, no alpha, as the store requires), and the store icon
// (96×96 artwork centered in 128×128 with transparent padding, per the store's image guidelines).
// Run after `node build.mjs --test`:  node scripts/store-images.mjs
import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const build = resolve('dist-test');
const results = readFileSync('store/mock-results.html', 'utf8');

// Made-up bookmarks on reserved example domains, with the summaries their pages offer.
const bookmarks = [
  ['Cooking', 'Bread', 'Sourdough starter in 7 days', 'https://loaf-lab.example.com/starter', 'A day-by-day guide to growing a lively starter from just flour and water.'],
  ['Cooking', 'Bread', 'Everyday sourdough loaf', 'https://loaf-lab.example.com/everyday', 'A forgiving recipe with an overnight rise that fits around a workday.'],
  ['Cooking', 'Recipes', 'Sourdough discard pancakes', 'https://family-food.example.net/pancakes', 'Fluffy weekend pancakes that use up the starter you would throw away.'],
  ['Cooking', 'Bread', 'Starter feeding schedule calculator', 'https://bake-tools.example.org/feeding', 'Work out feeding times and ratios for the temperature of your kitchen.'],
  ['Reading', 'Science', 'Wild yeast, explained', 'https://kitchen-lab.example.org/wild-yeast', 'What actually lives in a sourdough starter, and why it smells the way it does.'],
];

const profile = mkdtempSync(join(tmpdir(), 'ba-store-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
});
await context.route(/^https:\/\/www\.google\.com\/search/, (r) => r.fulfill({ contentType: 'text/html', body: results }));
await context.route(/^https?:\/\/(?!www\.google\.com\/search)/, (r) => {
  const hit = bookmarks.find((b) => b[3] === r.request().url());
  r.fulfill({ contentType: 'text/html', body: hit ? `<meta name="description" content="${hit[4]}">` : '' });
});
const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
await sw.evaluate(async (list) => {
  const folders = new Map();
  const folder = async (path) => {
    let parentId = '1';
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join('/');
      if (!folders.has(key)) folders.set(key, (await chrome.bookmarks.create({ parentId, title: path[i] })).id);
      parentId = folders.get(key);
    }
    return parentId;
  };
  for (const [a, b, title, url] of list) await chrome.bookmarks.create({ parentId: await folder([a, b]), title, url });
}, bookmarks);

const page = await context.newPage();
await page.goto('https://www.google.com/search?q=sourdough+starter');
await page.locator('#bookmark-assistant-panel .desc').first().waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: 'store/images/screenshot-1.png' });
const panelShot = (await page.locator('#bookmark-assistant-panel').screenshot()).toString('base64');

const icon = readFileSync('src/icons/icon.svg', 'utf8');
const tile = await context.newPage();
await tile.setViewportSize({ width: 440, height: 280 });
await tile.setContent(`<style>
  body { margin: 0; width: 440px; height: 280px; display: flex; align-items: center; gap: 22px; padding: 0 34px; box-sizing: border-box;
    font-family: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif; color: #fff;
    background: radial-gradient(120% 90% at 0% 0%, rgba(245,158,11,.35), transparent 55%), radial-gradient(120% 100% at 100% 100%, rgba(66,111,118,.9), transparent 65%), #172A3A; }
  svg { width: 104px; height: 104px; flex: none; filter: drop-shadow(0 10px 22px rgba(0,0,0,.35)); }
  h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.1; letter-spacing: -0.02em; }
  p { margin: 0; font-size: 16px; line-height: 1.4; color: rgba(255,255,255,.82); }
</style>${icon}<div><h1>Bookmark Assistant</h1><p>Your own bookmarks, first, beside every Google search.</p></div>`);
await tile.screenshot({ path: 'store/images/promo-small.png' });

const marquee = await context.newPage();
await marquee.setViewportSize({ width: 1400, height: 560 });
await marquee.setContent(`<style>
  body { margin: 0; width: 1400px; height: 560px; display: flex; align-items: center; justify-content: space-between; padding: 0 96px; box-sizing: border-box; overflow: hidden;
    font-family: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif; color: #fff;
    background: radial-gradient(90% 90% at 0% 0%, rgba(245,158,11,.32), transparent 55%), radial-gradient(90% 100% at 100% 100%, rgba(66,111,118,.95), transparent 65%), #172A3A; }
  .copy { display: flex; flex-direction: column; gap: 26px; max-width: 560px; }
  svg { width: 120px; height: 120px; filter: drop-shadow(0 12px 26px rgba(0,0,0,.35)); }
  h1 { margin: 0; font-size: 60px; line-height: 1.05; letter-spacing: -0.03em; }
  p { margin: 0; font-size: 26px; line-height: 1.35; color: rgba(255,255,255,.84); }
  img { width: 380px; border-radius: 22px; box-shadow: 0 30px 70px -20px rgba(0,0,0,.55); }
</style><div class="copy">${icon}<h1>Bookmark Assistant</h1><p>Your own bookmarks, first, beside every Google search.</p></div><img src="data:image/png;base64,${panelShot}">`);
await marquee.screenshot({ path: 'store/images/promo-marquee.png' });

const storeIcon = await context.newPage();
await storeIcon.setViewportSize({ width: 128, height: 128 });
await storeIcon.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:96px;height:96px;margin:16px}</style>${icon}`);
await storeIcon.screenshot({ path: 'store/images/store-icon-128.png', omitBackground: true });

await context.close();
rmSync(profile, { recursive: true, force: true });
console.log('Wrote store/images/: screenshot-1.png, promo-small.png, promo-marquee.png, store-icon-128.png');
