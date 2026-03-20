import { test, expect, type Page } from '@playwright/test';

/**
 * Full static site map (matches vite build inputs in vite.config.js).
 * Order: home → duplicate pages/index → POIs → live feed → summary → sources → terms.
 */
const ROUTES: { path: string; label: string }[] = [
  { path: '/', label: 'Startsida (root)' },
  { path: '/pages/index.html', label: 'Startsida (pages/)' },
  { path: '/pages/poi-1.html', label: 'POI 1 · Ministern' },
  { path: '/pages/poi-2.html', label: 'POI 2 · Kameraoffensiven' },
  { path: '/pages/poi-3.html', label: 'POI 3 · Biometri' },
  { path: '/pages/poi-4.html', label: 'POI 4 · Palantir / Acus' },
  { path: '/pages/poi-5.html', label: 'POI 5 · Kylande effekten' },
  { path: '/pages/poi-6.html', label: 'POI 6 · Övervakningskapitalism' },
  { path: '/pages/live-feed.html', label: 'Ansiktigenkänning (live-feed)' },
  { path: '/pages/summary.html', label: 'Sammanfattning' },
  { path: '/pages/sources.html', label: 'Källor' },
  { path: '/pages/terms.html', label: 'Terms of Service' },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Scroll the main document in small steps (good for video), with a hard step cap.
 * Uses `scrollingElement.scrollBy` so it matches how the page actually scrolls.
 */
async function scrollToBottomSlow(page: Page) {
  await page.evaluate(async () => {
    const el = document.scrollingElement || document.documentElement;
    const maxSteps = 60;
    for (let i = 0; i < maxSteps; i++) {
      const max = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= max - 4) break;
      el.scrollBy(0, 520);
      await new Promise((r) => setTimeout(r, 110));
    }
  });
}

async function maybeAcceptCookieBanner(page: Page) {
  const accept = page.locator('#btn-cookie-banner-accept');
  try {
    await accept.waitFor({ state: 'visible', timeout: 4000 });
    await accept.click();
    await sleep(400);
  } catch {
    // No banner (already consented) or page without overlay yet
  }
}

test.describe('Site walkthrough (video)', () => {
  test.describe.configure({ mode: 'serial' });

  test('entire website — scroll each page', async ({ page }) => {
    // Google Translate can re-frame the document and destroy the JS context mid-test.
    await page.route(/translate\.google\.com/, (route) => route.abort());

    let first = true;

    for (const { path, label } of ROUTES) {
      await test.step(label, async () => {
        const res = await page.goto(path, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        expect(res).not.toBeNull();
        expect(res!.status()).toBeLessThan(400);
        await page.waitForLoadState('domcontentloaded');

        if (first) {
          await maybeAcceptCookieBanner(page);
          first = false;
        }

        // Top of page — let layout settle briefly
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(500);

        await scrollToBottomSlow(page);
        await sleep(400);

        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(300);
      });
    }
  });
});
