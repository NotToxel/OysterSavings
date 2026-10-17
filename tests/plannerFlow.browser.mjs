// Run against npm run dev. All TfL responses below are controlled test fixtures.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const baseUrl = process.env.OYSTER_TEST_URL ?? 'http://localhost:5173/';
const artifacts = process.env.OYSTER_TEST_ARTIFACT_DIR;

async function setup(returnPeak = 4.6, returnOffPeak = 3.7) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(2026, 9, 17, 12));
  const errors = [];
  const directions = new Set();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://api.tfl.gov.uk/StopPoint/**/FareTo/**', async route => {
    const reverse = route.request().url().includes('910GWATRLMN/FareTo/910GBARNES');
    directions.add(reverse ? 'return' : 'outbound');
    const peak = reverse ? returnPeak : 4.6;
    const offPeak = reverse ? returnOffPeak : 3.7;
    await route.fulfill({ json: [{ rows: [{ passengerType: 'Adult', routeDescription: 'Default route', endDate: '2030-12-31T23:59:59', ticketsAvailable: [
      { cost: String(offPeak), ticketType: { description: 'Pay as you go' }, ticketTime: { description: 'At all other times including public holidays.' } },
      { cost: String(peak), ticketType: { description: 'Pay as you go' }, ticketTime: { description: 'Monday to Friday from 0630 to 0930 and from 1600 to 1900.' } },
    ] }] }] });
  });
  await page.goto(new URL('#planner', baseUrl).href);
  await page.getByRole('button', { name: 'Set up my commute', exact: true }).click();
  await page.locator('#modal-origin-station').fill('Barnes');
  await page.locator('#modal-origin-station').press('Enter');
  await page.locator('#modal-dest-station').fill('London Waterloo');
  await page.locator('#modal-dest-station').press('Enter');
  await page.locator('.fare-leg-breakdown').waitFor();
  return { page, errors, directions };
}

async function savedRule(page) {
  return page.evaluate(() => ['oystersavings_advanced_recurrence_rules', 'oystersavings_recurrence_rules']
    .flatMap(key => JSON.parse(localStorage.getItem(key) ?? '[]')).find(rule => rule.name === 'Commute'));
}

try {
  const { page, errors, directions } = await setup();
  const total = page.locator('.estimated-total-row strong');
  await total.filter({ hasText: '£9.20' }).waitFor();
  assert.ok(directions.has('outbound') && directions.has('return'));
  const legs = page.locator('.fare-leg-breakdown > div');
  assert.match(await legs.nth(1).innerText(), /Z1 → Z3.*16:00-19:00.*Peak/);
  await page.locator('#modal-time-period').selectOption('09:31-15:59');
  assert.equal(await total.innerText(), '£8.30');
  await page.locator('#modal-time-period').selectOption('16:00-19:00');
  assert.equal(await total.innerText(), '£8.30');
  assert.match(await legs.nth(0).innerText(), /Off-peak/);
  assert.match(await legs.nth(1).innerText(), /· Peak/);
  await page.locator('#modal-journey-type').selectOption('none');
  assert.equal(await total.innerText(), '£7.40');
  await page.locator('#modal-journey-type').selectOption('recurring');
  assert.equal(await total.innerText(), '£8.30');
  if (artifacts) {
    await page.locator('.fare-leg-breakdown').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${artifacts}/barnes-return-preview.png` });
  }
  await page.getByRole('button', { name: 'Add Routine', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await savedRule(page)).returnExactFarePeak, 4.6);
  assert.equal((await savedRule(page)).returnExactFareOffPeak, 3.7);
  assert.equal(await page.locator('.planning-period').isVisible(), false);
  assert.ok(await page.locator('.planning-period-desktop').isVisible());
  assert.ok(await page.locator('.planning-period-desktop #plan-start').isVisible());
  if (artifacts) await page.screenshot({ path: `${artifacts}/planner-period-desktop-restored.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.planning-period-desktop').isVisible(), false);
  await page.getByRole('button', { name: '📅 Calendar', exact: true }).click();
  assert.ok(await page.locator('.planning-period').isVisible());
  assert.equal(await page.locator('.day-details-btn').count(), 0);
  const spend = page.locator('.day-spend-details').first();
  const bounds = await spend.evaluate(element => ({
    amountBottom: element.querySelector('.day-spend-value').getBoundingClientRect().bottom,
    barTop: element.querySelector('.mini-cap-bar').getBoundingClientRect().top,
  }));
  assert.ok(bounds.barTop >= bounds.amountBottom - 0.5, JSON.stringify(bounds));
  if (artifacts) await page.screenshot({ path: `${artifacts}/planner-period-mobile.png` });
  if (artifacts) {
    await spend.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${artifacts}/planner-cap-mobile.png` });
  }
  await spend.press('Enter');
  await page.locator('.daily-cap-hovercard.pinned').waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Add travel routine or journey' }).count(), 0);
  await page.getByRole('button', { name: 'Close tooltip', exact: true }).click({ position: { x: 2, y: 2 } });
  for (const name of ['🚇 Journeys', '⚙️ Settings']) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.ok(await page.locator('.planning-period').isVisible());
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS weekday and weekend fares, reverse zones, independent quotes, global period and mobile cap details');

  const asymmetric = await setup(5.2, 4.1);
  await asymmetric.page.locator('.estimated-total-row strong').filter({ hasText: '£9.80' }).waitFor();
  await asymmetric.page.getByRole('button', { name: 'Add Routine', exact: true }).click();
  await asymmetric.page.getByRole('dialog').waitFor({ state: 'hidden' });
  const rule = await savedRule(asymmetric.page);
  assert.equal(rule.exactFarePeak, 4.6);
  assert.equal(rule.returnExactFarePeak, 5.2);
  assert.equal(await asymmetric.page.locator('.day-spend-details').first().innerText(), '£9.80');
  await asymmetric.page.evaluate(() => {
    const key = 'oystersavings_advanced_recurrence_rules';
    const rules = JSON.parse(localStorage.getItem(key));
    for (const rule of rules) {
      delete rule.returnExactFarePeak;
      delete rule.returnExactFareOffPeak;
      delete rule.returnExactBaseFarePeak;
      delete rule.returnExactBaseFareOffPeak;
      delete rule.returnRouteDescription;
    }
    localStorage.setItem(key, JSON.stringify(rules));
  });
  await asymmetric.page.reload();
  await asymmetric.page.waitForFunction(() => JSON.parse(localStorage.getItem('oystersavings_advanced_recurrence_rules'))[0]?.returnExactFarePeak === 5.2);
  await asymmetric.page.locator('.day-spend-details').first().waitFor();
  assert.equal(await asymmetric.page.locator('.day-spend-details').first().innerText(), '£9.80');
  assert.deepEqual(asymmetric.errors, []);
  console.log('PASS asymmetric return quote survives saving/forecast and legacy routines acquire independent reverse fares on reload');
} finally {
  await browser.close();
}
