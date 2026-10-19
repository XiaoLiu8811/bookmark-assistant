import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAMPLE } from '../fixtures/bookmarks';

const DIST = join(import.meta.dirname, '../../dist');
const GOOGLE_PAGE = readFileSync(join(import.meta.dirname, '../fixtures/google-results.html'), 'utf8');
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const PANEL = '#bookmark-assistant-panel';

interface Browser {
  context: BrowserContext;
  sw: Worker;
  /** Every request that wasn't the stand-in Google page. */
  otherRequests: string[];
}

// A test copy of Chromium with only this extension, and Google's results page replaced by a saved stand-in.
async function launch(profileDir: string): Promise<Browser> {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  const otherRequests: string[] = [];
  context.on('request', (req) => {
    if (!req.url().startsWith('https://www.google.com/search')) otherRequests.push(req.url());
  });
  await context.route('https://www.google.com/search*', (route) =>
    route.fulfill({ contentType: 'text/html', body: GOOGLE_PAGE }),
  );
  await context.route(/^https:\/\/(?!www\.google\.com\/search)/, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Bookmarked page</title>' }),
  );
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

async function searchGoogle(context: BrowserContext, q: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(google(q));
  return page;
}

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

test('1. shows matching bookmarks above the results within 200 ms, best first, at most 3', async () => {
  const page = await searchGoogle(b.context, 'flexbox guide');
  const panel = page.locator(PANEL);
  await expect(panel.getByText('From your bookmarks · ON')).toBeVisible();
  await expect(panel.locator('li').first()).toContainText('A Complete Guide to Flexbox');
  await expect(panel.locator('li').first()).toContainText('Dev › CSS › Layout');
  expect(Number(await panel.getAttribute('data-ms'))).toBeLessThan(200);

  // The panel sits above Google's own results.
  const panelBox = (await panel.boundingBox())!;
  const firstResult = (await page.locator('.g').first().boundingBox())!;
  expect(panelBox.y).toBeLessThan(firstResult.y);

  const busy = await searchGoogle(b.context, 'example');
  await expect(busy.locator(`${PANEL} li`)).toHaveCount(3);
});

test('1. matches on a folder name', async () => {
  const page = await searchGoogle(b.context, 'recipes');
  await expect(page.locator(`${PANEL} li`)).toHaveText([/Grandma’s Sunday dinner/]);
});

test('2. shows nothing when there is no match, or when the mode is off; the badge shows the mode', async () => {
  await expect.poll(() => badge(b.sw)).toBe('ON');

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

test('3. Hide removes the panel for that search only', async () => {
  const page = await searchGoogle(b.context, 'flexbox');
  await page.locator(PANEL).getByRole('button', { name: 'Hide' }).click();
  await expect(page.locator(PANEL)).toHaveCount(0);

  await page.goto(google('sourdough'));
  await expect(page.locator(PANEL)).toContainText('Sourdough starter basics');
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
  await page.locator(PANEL).getByText('Kyoto in three days').click();
  await expect(page).toHaveURL('https://trips.example.org/kyoto-itinerary');
  await expect.poll(() => tooltip(b.sw)).toMatch(/1 panels shown, 1 bookmarks opened/);
  // Also proves the request recorder used by test 5 sees requests.
  expect(b.otherRequests).toEqual(['https://trips.example.org/kyoto-itinerary']);
});

test('5. the extension makes no network requests', async () => {
  for (const q of ['flexbox guide', 'recipes', 'weather tomorrow']) {
    const page = await searchGoogle(b.context, q);
    await page.waitForTimeout(300);
  }
  expect(b.otherRequests).toEqual([]);

  // The manifest's policy blocks the service worker from connecting anywhere.
  const blocked = await b.sw.evaluate(() =>
    fetch('https://blocked.example.com/').then(
      () => false,
      () => true,
    ),
  );
  expect(blocked).toBe(true);
});

test('screenshots for a visual check, light and dark', async () => {
  const page = await searchGoogle(b.context, 'css layout guide');
  await expect(page.locator(PANEL)).toBeVisible();
  await page.screenshot({ path: 'test-results/panel-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/panel-dark.png' });
});
