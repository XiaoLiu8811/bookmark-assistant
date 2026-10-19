import { chromium, expect, test, type BrowserContext, type Page, type Request, type Worker } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DESCRIPTIONS, SAMPLE, SAMPLE_URLS } from '../fixtures/bookmarks';

// The real build asks for site access only when the user wants descriptions. The test build has it
// granted at install, because Chrome's permission prompt is a native dialog tests can't click.
const REAL = join(import.meta.dirname, '../../dist');
const WITH_ACCESS = join(import.meta.dirname, '../../dist-test');
const GOOGLE_SEARCH = /^https:\/\/www\.google\.[a-z.]+\/search/;
const GOOGLE_PAGE = readFileSync(join(import.meta.dirname, '../fixtures/google-results.html'), 'utf8');
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const PANEL = '#bookmark-assistant-panel';

interface Browser {
  context: BrowserContext;
  sw: Worker;
  /** Every request that wasn't the stand-in Google page, from pages and from the extension. */
  otherRequests: Request[];
}

const urls = (requests: Request[]) => requests.map((r) => r.url());
const page404 = '<title>Not a bookmark</title>';
// What a bookmarked page serves: a title and, for most, a link-preview summary.
const bookmarkedPage = (url: string) =>
  DESCRIPTIONS[url]
    ? `<title>Bookmarked page</title><meta name="description" content="${DESCRIPTIONS[url]}">`
    : '<title>Bookmarked page</title>';

// A test copy of Chromium with only this extension, and Google's results page replaced by a saved stand-in.
async function launch(profileDir: string, build = WITH_ACCESS): Promise<Browser> {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
  });
  const otherRequests: Request[] = [];
  context.on('request', (req) => {
    // Only real network traffic: the extension's own files (chrome-extension://) never leave the browser.
    if (/^https?:/.test(req.url()) && !GOOGLE_SEARCH.test(req.url())) otherRequests.push(req);
  });
  // `&rhs=1` serves the variant with Google's right column (an info panel), as for places and people.
  await context.route(GOOGLE_SEARCH, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: route.request().url().includes('rhs=1')
        ? GOOGLE_PAGE.replace('<!--RHS-->', '<div id="rhs"><div class="info">Google info panel</div></div>')
        : GOOGLE_PAGE,
    }),
  );
  // Nothing reaches the real internet: every other address gets a made-up page.
  await context.route(/^https?:\/\/(?!www\.google\.[a-z.]+\/search)/, (route) => {
    const url = route.request().url();
    route.fulfill({ contentType: 'text/html', body: SAMPLE_URLS.includes(url) ? bookmarkedPage(url) : page404 });
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return { context, sw, otherRequests };
}

const seedBookmarks = (sw: Worker) =>
  sw.evaluate(async (nodes) => {
    type N = { title: string; url?: string; children?: N[] };
    const create = async (list: N[], parentId: string) => {
      for (const n of list) {
        const made = await chrome.bookmarks.create({ parentId, title: n.title, url: n.url });
        if (n.children) await create(n.children, made.id);
      }
    };
    await create(nodes as N[], '1');
  }, SAMPLE);

const setMode = (sw: Worker, enabled: boolean) => sw.evaluate((on) => chrome.storage.local.set({ enabled: on }), enabled);
const badge = (sw: Worker) => sw.evaluate(() => chrome.action.getBadgeText({}));
const tooltip = (sw: Worker) => sw.evaluate(() => chrome.action.getTitle({}));

async function searchGoogle(context: BrowserContext, q: string, extra = ''): Promise<Page> {
  const page = await context.newPage();
  await page.goto(google(q) + extra);
  return page;
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

let profileDir: string;
let b: Browser;

test.beforeEach(async () => {
  profileDir = mkdtempSync(join(tmpdir(), 'bookmark-assistant-'));
  b = await launch(profileDir);
  await seedBookmarks(b.sw);
});

test.afterEach(async () => {
  await b.context.close();
  rmSync(profileDir, { recursive: true, force: true });
});

test('1. shows matching bookmarks to the right of the results within 200 ms, best first', async () => {
  const page = await searchGoogle(b.context, 'flexbox guide');
  const panel = page.locator(PANEL);
  await expect(panel.getByText('From your bookmarks · ON')).toBeVisible();
  await expect(panel.locator('li').first()).toContainText('A Complete Guide to Flexbox');
  await expect(panel.locator('li').first()).toContainText('Dev › CSS › Layout');
  expect(Number(await panel.getAttribute('data-ms'))).toBeLessThan(200);

  // Beside Google's results, level with their top.
  const panelBox = await box(page, PANEL);
  const resultsBox = await box(page, '#center_col');
  expect(panelBox.x).toBeGreaterThan(resultsBox.x + resultsBox.width);
  expect(Math.abs(panelBox.y - resultsBox.y)).toBeLessThan(2);

  // Only 2 match, so there's no "Show more".
  await expect(panel.locator('li')).toHaveCount(2);
  await expect(panel.getByRole('button', { name: /more/ })).toHaveCount(0);
});

test('1. shows 3 matches first, and Show more reveals the rest', async () => {
  const page = await searchGoogle(b.context, 'example'); // all 7 sample bookmarks match
  const panel = page.locator(PANEL);
  await expect(panel.locator('li:visible')).toHaveCount(3);

  await panel.getByRole('button', { name: 'Show 4 more' }).click();
  await expect(panel.locator('li:visible')).toHaveCount(7);

  await panel.getByRole('button', { name: 'Show fewer' }).click();
  await expect(panel.locator('li:visible')).toHaveCount(3);
  await expect(panel.getByRole('button', { name: 'Show 4 more' })).toBeVisible();
});

test('1. sits at the top of Google’s right column when the page has one', async () => {
  const page = await searchGoogle(b.context, 'kyoto', '&rhs=1');
  await expect(page.locator(`#rhs > ${PANEL}`)).toBeVisible();
  expect((await box(page, PANEL)).y).toBeLessThan((await box(page, '#rhs .info')).y);
});

test('1. falls back to the top of the results when the window is too narrow', async () => {
  const page = await b.context.newPage();
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto(google('flexbox'));
  await expect(page.locator(`#center_col > ${PANEL}`)).toBeVisible();
  expect((await box(page, PANEL)).y).toBeLessThan((await box(page, '.g')).y);

  // Widening the window moves it to the right side.
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(async () => (await box(page, PANEL)).x).toBeGreaterThan((await box(page, '#center_col')).x + 652);
});

test('1. works on Google’s country sites too', async () => {
  for (const site of ['www.google.co.uk', 'www.google.de', 'www.google.com.au']) {
    const page = await b.context.newPage();
    await page.goto(`https://${site}/search?q=flexbox`);
    await expect(page.locator(PANEL)).toContainText('A Complete Guide to Flexbox');
  }
});

test('1. matches on a folder name', async () => {
  const page = await searchGoogle(b.context, 'recipes');
  await expect(page.locator(`${PANEL} li`)).toHaveText([/Grandma’s Sunday dinner/]);
});

test('2. shows nothing when there is no match, or when the mode is off; the badge shows the mode', async () => {
  await expect.poll(() => badge(b.sw)).toBe('ON');
  // Green with white text.
  expect(await b.sw.evaluate(() => chrome.action.getBadgeBackgroundColor({}))).toEqual([24, 128, 56, 255]);
  expect(await b.sw.evaluate(() => chrome.action.getBadgeTextColor({}))).toEqual([255, 255, 255, 255]);

  const noMatch = await searchGoogle(b.context, 'weather tomorrow');
  await expect(noMatch.locator('.g').first()).toBeVisible();
  await noMatch.waitForTimeout(500);
  await expect(noMatch.locator(PANEL)).toHaveCount(0);

  const open = await searchGoogle(b.context, 'flexbox');
  await expect(open.locator(PANEL)).toBeVisible();

  await setMode(b.sw, false);
  await expect.poll(() => badge(b.sw)).toBe('');
  await expect(open.locator(PANEL)).toHaveCount(0); // removed from pages already open

  const off = await searchGoogle(b.context, 'flexbox');
  await off.waitForTimeout(500);
  await expect(off.locator(PANEL)).toHaveCount(0);

  await setMode(b.sw, true);
  await expect.poll(() => badge(b.sw)).toBe('ON');
});

test('3. Hide shrinks the panel to a tab, Show brings it back, and the next search starts open', async () => {
  const page = await searchGoogle(b.context, 'complete guide');
  const panel = page.locator(PANEL);
  await panel.getByRole('button', { name: 'Hide' }).click();
  await expect(panel.getByText('2 bookmarks match')).toBeVisible();
  await expect(panel.locator('li').first()).toBeHidden();

  await panel.getByRole('button', { name: 'Show' }).click();
  await expect(panel.locator('li').first()).toBeVisible();
  await expect(panel.getByText('2 bookmarks match')).toBeHidden();

  await panel.getByRole('button', { name: 'Hide' }).click();
  await page.goto(google('sourdough'));
  await expect(panel.locator('li')).toHaveText([/Sourdough starter basics/]);
});

test('3. the on/off setting survives a browser restart', async () => {
  await setMode(b.sw, false);
  await expect.poll(() => badge(b.sw)).toBe('');
  await b.context.close();

  b = await launch(profileDir);
  await expect.poll(() => badge(b.sw)).toBe('');
  const page = await searchGoogle(b.context, 'flexbox');
  await page.waitForTimeout(500);
  await expect(page.locator(PANEL)).toHaveCount(0);

  // An empty badge is also Chrome's default, so check that "on" is restored after a restart too.
  await setMode(b.sw, true);
  await expect.poll(() => badge(b.sw)).toBe('ON');
  await b.context.close();
  b = await launch(profileDir);
  await expect.poll(() => badge(b.sw)).toBe('ON');
});

test('4. clicking a result opens the bookmarked page and counts it', async () => {
  const page = await searchGoogle(b.context, 'kyoto');
  await page.locator(PANEL).getByRole('link', { name: /Kyoto in three days/ }).click();
  await expect(page).toHaveURL('https://trips.example.org/kyoto-itinerary');
  await expect.poll(() => tooltip(b.sw)).toMatch(/1 panels shown, 1 bookmarks opened/);
});

test('6. each result shows the page’s own one-sentence summary, fetched once and saved', async () => {
  const page = await searchGoogle(b.context, 'complete guide');
  const row = (title: string) => page.locator(`${PANEL} li`).filter({ hasText: title });
  await expect(row('Centering in CSS').locator('.desc')).toHaveText(DESCRIPTIONS['https://css.example.com/centering']);
  await expect(row('Guide to Flexbox').locator('.desc')).toHaveText(DESCRIPTIONS['https://css.example.com/guides/flexbox']);

  // A page with no summary shows no empty line.
  const grid = await searchGoogle(b.context, 'grid by example');
  await expect(grid.locator(`${PANEL} li`).first()).toContainText('Grid by Example');
  await grid.waitForTimeout(500);
  await expect(grid.locator(`${PANEL} .desc`).first()).toBeHidden();

  // The second time, the summary comes from the saved copy: no new request.
  const before = urls(b.otherRequests).length;
  const again = await searchGoogle(b.context, 'complete guide');
  await expect(again.locator(`${PANEL} li .desc`).first()).toBeVisible();
  await again.waitForTimeout(300);
  expect(urls(b.otherRequests).slice(before)).toEqual([]);
});

test('6. summaries for the extra results load only after Show more', async () => {
  const page = await searchGoogle(b.context, 'example');
  const panel = page.locator(PANEL);
  await expect(panel.locator('li:visible .desc:visible')).not.toHaveCount(0);
  await page.waitForTimeout(500);
  expect(urls(b.otherRequests)).toHaveLength(3);

  await panel.getByRole('button', { name: 'Show 4 more' }).click();
  await expect.poll(() => urls(b.otherRequests).length).toBe(7);
});

test('7. Delete bookmark deletes it, and Undo puts it back in the same folder and position', async () => {
  const find = () =>
    b.sw.evaluate(async () => {
      const [hit] = await chrome.bookmarks.search({ url: 'https://css.example.com/centering' });
      if (!hit) return null;
      const [folder] = await chrome.bookmarks.get(hit.parentId!);
      return { folder: folder.title, index: hit.index };
    });
  const original = await find();
  expect(original).toEqual({ folder: 'Layout', index: 1 });

  const page = await searchGoogle(b.context, 'centering');
  const row = page.locator(`${PANEL} li`).first();
  await row.getByRole('button', { name: 'Delete bookmark' }).click();
  await expect(row).toContainText('Deleted from your bookmarks');
  await expect(row).toContainText('Centering in CSS: A Complete Guide');
  await expect(row.getByRole('button', { name: 'Undo' })).toBeFocused();
  await expect.poll(find).toBeNull();

  await row.getByRole('button', { name: 'Undo' }).click();
  await expect(row.getByRole('link')).toBeFocused();
  await expect.poll(find).toEqual(original);

  // The restored bookmark can be removed again (it has a new id).
  await row.getByRole('button', { name: 'Delete bookmark' }).click();
  await expect.poll(find).toBeNull();
});

test('5. the extension only contacts bookmarked pages, and never sends your cookies', async () => {
  await b.context.addCookies([{ name: 'session', value: 'made-up', domain: 'css.example.com', path: '/' }]);
  for (const q of ['complete guide', 'recipes', 'weather tomorrow']) {
    const page = await searchGoogle(b.context, q);
    await expect.poll(() => urls(b.otherRequests).length).toBeGreaterThanOrEqual(q === 'recipes' ? 3 : 0);
    await page.waitForTimeout(300);
  }
  expect(urls(b.otherRequests).sort()).toEqual([
    'https://css.example.com/centering',
    'https://css.example.com/guides/flexbox',
    'https://family-food.example.net/sunday',
  ]);
  for (const req of b.otherRequests) expect((await req.allHeaders()).cookie).toBeUndefined();

  // Proves the recorder would see a cookie: a normal visit to the same site sends it.
  const visit = await b.context.newPage();
  const [sent] = await Promise.all([visit.waitForRequest('https://css.example.com/centering'), visit.goto('https://css.example.com/centering')]);
  expect((await sent.allHeaders()).cookie).toBe('session=made-up');
});

test('screenshots for a visual check, light and dark', async () => {
  const page = await searchGoogle(b.context, 'example');
  await expect(page.locator(PANEL)).toBeVisible();
  await page.waitForTimeout(500); // let the summaries arrive
  await page.screenshot({ path: 'test-results/panel-light.png' });
  await page.locator(`${PANEL} li`).nth(1).getByRole('button', { name: 'Delete bookmark' }).hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/panel-delete-hover-light.png' });
  await page.locator(`${PANEL} li`).nth(1).getByRole('button', { name: 'Delete bookmark' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/panel-removed-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/panel-removed-dark.png' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator(`${PANEL} li`).nth(1).getByRole('button', { name: 'Undo' }).click();
  await page.locator(PANEL).getByRole('button', { name: 'Show 4 more' }).hover();
  await page.waitForTimeout(300); // let the hover fade finish
  await page.screenshot({ path: 'test-results/panel-hover-light.png' });
  await page.mouse.move(0, 0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/panel-dark.png' });
  await page.locator(PANEL).getByRole('button', { name: 'Hide' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/panel-hidden-dark.png' });

  const withInfo = await searchGoogle(b.context, 'kyoto', '&rhs=1');
  await expect(withInfo.locator(PANEL)).toBeVisible();
  await withInfo.waitForTimeout(500); // let the fade-in finish
  await withInfo.screenshot({ path: 'test-results/panel-right-column-light.png' });
});

test('8. without site access: no page is loaded, and Show descriptions opens the page that asks for it', async () => {
  await b.context.close();
  rmSync(profileDir, { recursive: true, force: true });
  profileDir = mkdtempSync(join(tmpdir(), 'bookmark-assistant-'));
  b = await launch(profileDir, REAL);
  await seedBookmarks(b.sw);

  const page = await searchGoogle(b.context, 'complete guide');
  const panel = page.locator(PANEL);
  await expect(panel.locator('li')).toHaveCount(2);
  await page.waitForTimeout(500);
  await expect(panel.locator('.desc:visible')).toHaveCount(0);
  expect(urls(b.otherRequests)).toEqual([]);
  await page.waitForTimeout(300); // let the fade-in finish
  await page.screenshot({ path: 'test-results/panel-no-access-light.png' });

  const [grant] = await Promise.all([
    b.context.waitForEvent('page'),
    panel.getByRole('button', { name: 'Show descriptions' }).click(),
  ]);
  await expect(grant).toHaveURL(/\/grant\.html$/);
  await expect(grant.getByRole('heading')).toHaveText('Show a description for each bookmark?');
  await expect(grant.getByRole('button', { name: 'Allow' })).toBeVisible();
  await grant.screenshot({ path: 'test-results/grant-page.png' });

  await grant.getByRole('button', { name: 'Not now' }).click();
  await expect.poll(() => grant.isClosed()).toBe(true);
  expect(urls(b.otherRequests)).toEqual([]);
});
