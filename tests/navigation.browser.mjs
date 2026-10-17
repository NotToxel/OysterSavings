// Run against npm run dev, or a static server serving public/ after npm run build.
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.OYSTER_TEST_URL ?? 'http://127.0.0.1:5174/';
const artifacts = process.env.OYSTER_TEST_ARTIFACT_DIR;
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  // No live fares are needed for these navigation checks.
  await context.route('https://api.tfl.gov.uk/**', route => route.fulfill({ json: [] }));
  await page.goto(baseUrl);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Planner', 'Help']);
  await page.evaluate(() => { window.navigationTestMarker = true; });
  await nav.getByRole('link', { name: 'Planner', exact: true }).click();
  await expect(page).toHaveURL(new URL('planner/', baseUrl).href);
  assert.equal(await page.evaluate(() => window.navigationTestMarker), true, 'navigation must preserve the document');
  await nav.getByRole('link', { name: 'Help', exact: true }).click();
  await expect(page).toHaveURL(new URL('help/', baseUrl).href);
  await page.goBack();
  await expect(page).toHaveURL(new URL('planner/', baseUrl).href);
  await page.goForward();
  await expect(page).toHaveURL(new URL('help/', baseUrl).href);

  for (const [hash, path] of [['home', ''], ['analysis', ''], ['compare', ''], ['planner', 'planner/'], ['faq', 'help/']]) {
    await page.goto(new URL(`#${hash}`, baseUrl).href);
    await expect(page).toHaveURL(new URL(path, baseUrl).href);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('main h1')).toBeVisible();
  }
  for (const path of ['analysis/', 'compare/', 'planner/', 'help/']) {
    const response = await page.goto(new URL(path, baseUrl).href);
    assert.equal(response.status(), 200, `direct visit to ${path}`);
    await expect(page).toHaveURL(new URL(['analysis/', 'compare/'].includes(path) ? '' : path, baseUrl).href);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('main h1')).toBeVisible();
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
  }
  // Section anchors should not be mistaken for legacy routes.
  await page.goto(new URL('#upload-journey-history', baseUrl).href);
  await expect(page).toHaveURL(new URL('#upload-journey-history', baseUrl).href);

  await nav.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Try sample analysis', exact: true }).click();
  await page.getByRole('button', { name: /Load Sarah/ }).click();
  await expect(page).toHaveURL(new URL('analysis/', baseUrl).href);
  await expect(page.locator('.demo-banner')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Analysis', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Compare', exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Compare', exact: true }).click();
  await expect(nav.getByRole('link', { name: 'Analysis', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Compare', exact: true })).toBeVisible();
  await expect(page.locator('.demo-banner')).toBeVisible();
  await nav.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Journey Analysis/ }).click();
  await expect(page).toHaveURL(new URL('analysis/', baseUrl).href);
  const sharedPage = await context.newPage();
  await sharedPage.goto(page.url());
  await expect(sharedPage).toHaveURL(new URL('', baseUrl).href);
  await expect(sharedPage.getByRole('navigation').getByRole('link')).toHaveText(['Overview', 'Planner', 'Help']);
  await sharedPage.close();
  await page.getByRole('button', { name: /Exit Demo/ }).click();
  await expect(page).toHaveURL(new URL('', baseUrl).href);
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try sample analysis', exact: true }).click();
  await page.getByRole('button', { name: /Load Sarah/ }).click();
  await expect(page).toHaveURL(new URL('analysis/', baseUrl).href);
  await page.reload();
  await expect(page).toHaveURL(new URL('', baseUrl).href);
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Planner', 'Help']);

  if (artifacts) await mkdir(artifacts, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const label of ['Overview', 'Planner', 'Help']) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('main h1')).toBeVisible();
      assert.ok(await nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `nav overflows at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label} overflows at ${width}px`);
    }
    if (artifacts && [1440, 390].includes(width)) {
      await nav.getByRole('link', { name: 'Overview', exact: true }).click();
      await expect(nav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page');
      await page.screenshot({ path: `${artifacts}/navigation-${width}.png`, animations: 'disabled' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Import journey history', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'navigation-fixture.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Date,Start Time,Journey/Action,Charge\n17-Oct-2026,08:00,Bus journey route 1,1.75'),
  });
  await page.getByRole('button', { name: /See my recommendation/ }).click();
  await expect(page).toHaveURL(new URL('analysis/', baseUrl).href);
  await expect(nav.getByRole('link', { name: 'Analysis', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Compare', exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Analysis', 'Compare', 'Planner', 'Help']);
    await expect.poll(() => nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1), { message: `loaded nav overflows at ${width}px` }).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /Import new history/ }).click();
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Planner', 'Help']);
  assert.deepEqual(errors, []);
  console.log(`Navigation checks passed: ${baseUrl} (routes, history, legacy links, sample data, refresh privacy, 4 viewport widths)`);
} finally {
  await browser.close();
}
