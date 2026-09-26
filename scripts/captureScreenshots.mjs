import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'static', 'images', 'readme');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function launchBrowser() {
  const options = {
    headless: true,
  };

  // Attempt Microsoft Edge or Google Chrome if available, otherwise bundled chromium
  try {
    return await chromium.launch({ ...options, channel: 'msedge' });
  } catch {
    try {
      return await chromium.launch({ ...options, channel: 'chrome' });
    } catch {
      return await chromium.launch(options);
    }
  }
}

async function capture() {
  let viteServer = null;
  let browser = null;

  try {
    console.log('[INFO] Starting in-process Vite dev server...');
    viteServer = await createServer({
      root: projectRoot,
      server: {
        port: 0, // Auto-pick any free port
      },
    });
    await viteServer.listen();

    const address = viteServer.httpServer?.address();
    const port = typeof address === 'object' && address ? address.port : 5173;
    const baseUrl = `http://localhost:${port}`;
    console.log(`[INFO] Vite dev server listening at ${baseUrl}`);

    console.log('[INFO] Launching browser in dark mode (1440x900 @2x)...');
    browser = await launchBrowser();

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2, // Retina resolution for high-DPI screenshots
      colorScheme: 'dark',
    });

    const page = await context.newPage();

    console.log('[INFO] Navigating to Home...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Landing Page
    console.log('[1/7] Capturing Landing Page -> oystersavings_landing.png');
    await page.screenshot({
      path: path.join(outputDir, 'oystersavings_landing.png'),
      fullPage: false,
    });

    // Capture the finished illustrative comparison, not a partly counted fare.
    console.log('[INFO] Capturing desktop and mobile sample comparisons...');
    const journeyChoices = page.getByRole('group', { name: 'Choose sample journeys' });
    const fareChoices = page.getByRole('group', { name: 'Choose a sample comparison' });
    await page.locator('.journey-vignette').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await journeyChoices.getByRole('button', { name: 'Daily Tube + bus' }).click();
    await page.locator('.monthly-example .savings-replay').waitFor({ state: 'visible', timeout: 30000 });
    const ledgerCount = await page.locator('.ledger-heading span').innerText();
    if (!/^(\d+) \/ \1$/.test(ledgerCount)) {
      throw new Error(`Desktop comparison was captured before all journeys arrived: ${ledgerCount}`);
    }
    await page.locator('.journey-vignette').screenshot({
      path: path.join(outputDir, 'sample_comparison_desktop.png'),
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await fareChoices.getByRole('button', { name: '18+ Student' }).click();
    await page.locator('.monthly-example .savings-replay').waitFor({ state: 'visible', timeout: 30000 });
    // Keep the sticky header from occluding an element taller than the viewport.
    await page.addStyleTag({ content: '.top-bar { position: relative !important; }' });
    await page.locator('.journey-vignette').screenshot({
      path: path.join(outputDir, 'sample_comparison_mobile.png'),
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // 2. Walkthrough Active Step
    console.log('[2/7] Opening Walkthrough & Capturing -> walkthrough_active.png');
    const startAnalysisBtn = page.locator('button:has-text("Generate Analysis")').first();
    if (await startAnalysisBtn.isVisible()) {
      await startAnalysisBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(outputDir, 'walkthrough_active.png'),
        fullPage: false,
      });
    }

    // 3. Load Demo Profile (Sarah) -> Analysis Page
    console.log('[3/7] Loading Demo Profile (Sarah)...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Generate Analysis' }).click();
    await page.getByRole('button', { name: 'Explore with sample journeys' }).click();
    await page.locator('.btn-demo-load').first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Load Sarah's Log/ }).click();

    await page.waitForSelector('.stat-card, .analysis-page, .report-header, .insights-page', { timeout: 8000 });
    await page.waitForTimeout(1500);

    // 3a. Analysis: Insights Tab
    console.log('[3a/7] Capturing Analysis Insights Tab -> analysis_tab.png & analysis_insights.png');
    const insightsTabBtn = page.locator('.tab-btn:has-text("Insights")').first();
    if (await insightsTabBtn.isVisible()) {
      await insightsTabBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({
      path: path.join(outputDir, 'analysis_tab.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(outputDir, 'analysis_insights.png'),
      fullPage: false,
    });

    // 3b. Analysis: Discounted Fares (Savings) Tab with Railcard simulation
    console.log('[3b/7] Capturing Analysis Discounted Fares -> analysis_savings.png');
    const savingsTabBtn = page.locator('.tab-btn:has-text("Discounted Fares")').first();
    if (await savingsTabBtn.isVisible()) {
      await savingsTabBtn.click();
      await page.waitForTimeout(600);

      // Select National Railcard in savings if not already
      const fareSelect = page.locator('#fare-type-select');
      if (await fareSelect.isVisible()) {
        await fareSelect.selectOption('railcard');
        await page.waitForTimeout(800);
      }

      await page.screenshot({
        path: path.join(outputDir, 'analysis_savings.png'),
        fullPage: false,
      });
    }

    // 3c. Analysis: Cap Analysis Tab
    console.log('[3c/7] Capturing Analysis Cap Analysis -> analysis_caps.png');
    const capsTabBtn = page.locator('.tab-btn:has-text("Cap Analysis")').first();
    if (await capsTabBtn.isVisible()) {
      await capsTabBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(outputDir, 'analysis_caps.png'),
        fullPage: false,
      });
    }

    // 3d. Analysis: Journeys Table Tab
    console.log('[3d/7] Capturing Analysis Journeys Table -> analysis_journeys.png');
    const journeysTabBtn = page.locator('.tab-btn:has-text("Journeys")').first();
    if (await journeysTabBtn.isVisible()) {
      await journeysTabBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(outputDir, 'analysis_journeys.png'),
        fullPage: false,
      });
    }

    // 4. Planner Page with National Railcard applied, full-month routines, and one-off journeys
    console.log('[4/7] Navigating to Planner, Applying National Railcard & Populating Routines & One-offs...');
    const plannerNav = page.locator('.nav-pill:has-text("Planner")').first();
    await plannerNav.click();
    await page.waitForSelector('.planner-page, .routine-builder, .planner-container, .calendar-grid', { timeout: 6000 });
    await page.waitForTimeout(800);

    // Apply National Railcard in Planner
    const plannerFareSelect = page.locator('#sel-fare-type');
    if (await plannerFareSelect.isVisible()) {
      await plannerFareSelect.selectOption('railcard');
      await page.waitForTimeout(600);
    }

    // Set the planning period to the current calendar month so all weeks are active.
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    const startInput = page.locator('#plan-start');
    if (await startInput.isVisible()) {
      await startInput.fill(`${year}-${month}-01`);
      await startInput.evaluate(e => e.dispatchEvent(new Event('change', { bubbles: true })));
      await page.waitForTimeout(300);
    }
    const endInput = page.locator('#plan-end');
    if (await endInput.isVisible()) {
      await endInput.fill(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
      await endInput.evaluate(e => e.dispatchEvent(new Event('change', { bubbles: true })));
      await page.waitForTimeout(400);
    }

    // Import all detected routines available (populates Mon-Fri commutes, bus routes, weekend trips)
    const importButtons = await page.locator('.detected-card button:has-text("Import"), button:has-text("Import")').all();
    console.log(`[INFO] Found ${importButtons.length} detected routines to import in Planner`);
    for (const btn of importButtons) {
      if (await btn.isVisible()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // Add a couple of distinct one-off journeys.
    // 1. One-off Tube trip on the 15th
    console.log('[INFO] Adding One-off Tube Journey on the 15th...');
    const day15Cell = page.locator('.calendar-cell').filter({ has: page.locator('.day-number:has-text("15")') }).first();
    if (await day15Cell.isVisible()) {
      await day15Cell.click();
      await page.waitForSelector('.modal-overlay', { timeout: 4000 });
      await page.waitForTimeout(300);

      // Name
      const nameInput = page.locator('#modal-rule-name');
      if (await nameInput.isVisible()) {
        await nameInput.fill('Covent Garden West End Trip');
      }

      // Origin Station
      const originInput = page.locator('#modal-origin-station');
      if (await originInput.isVisible()) {
        await originInput.fill('South Wimbledon');
        await page.waitForTimeout(400);
        const originOpt = page.locator('.station-dropdown .station-option').first();
        if (await originOpt.isVisible()) {
          await originOpt.click();
        }
      }

      // Destination Station
      const destInput = page.locator('#modal-dest-station');
      if (await destInput.isVisible()) {
        await destInput.fill('Covent Garden');
        await page.waitForTimeout(400);
        const destOpt = page.locator('.station-dropdown .station-option').first();
        if (await destOpt.isVisible()) {
          await destOpt.click();
        }
      }

      // Time Period -> Day Off-Peak (09:31-15:59)
      const timeSelect = page.locator('#modal-time-period');
      if (await timeSelect.isVisible()) {
        await timeSelect.selectOption('09:31-15:59');
      }

      // Return Journey
      const returnCheck = page.locator('#modal-is-return').first();
      if (await returnCheck.isVisible()) {
        await returnCheck.check().catch(() => {});
      }

      // Save
      const saveBtn = page.locator('.modal-footer .btn-primary');
      await saveBtn.click();
      await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // 2. One-off Bus trip on the 16th
    console.log('[INFO] Adding One-off Bus Journey on the 16th...');
    const day16Cell = page.locator('.calendar-cell').filter({ has: page.locator('.day-number:has-text("16")') }).first();
    if (await day16Cell.isVisible()) {
      await day16Cell.click();
      await page.waitForSelector('.modal-overlay', { timeout: 4000 });
      await page.waitForTimeout(300);

      // Name
      const nameInput = page.locator('#modal-rule-name');
      if (await nameInput.isVisible()) {
        await nameInput.fill('Richmond Park Bus Trip');
      }

      // Select Bus / Tram
      const busBtn = page.locator('.segment-btn:has-text("Bus / Tram")').first();
      if (await busBtn.isVisible()) {
        await busBtn.click();
      }

      // Save
      const saveBtn = page.locator('.modal-footer .btn-primary');
      await saveBtn.click();
      await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // Ensure One-Off Journeys and Travel Routines accordions are both expanded in sidebar
    const oneOffHeaderBtn = page.locator('button:has-text("One-off Journeys")').first();
    if (await oneOffHeaderBtn.isVisible()) {
      const isCollapsed = await oneOffHeaderBtn.innerText().then(t => t.includes('▶'));
      if (isCollapsed) {
        await oneOffHeaderBtn.click();
        await page.waitForTimeout(300);
      }
    }

    const routinesHeaderBtn = page.locator('button:has-text("Travel Routines")').first();
    if (await routinesHeaderBtn.isVisible()) {
      const isCollapsed = await routinesHeaderBtn.innerText().then(t => t.includes('▶'));
      if (isCollapsed) {
        await routinesHeaderBtn.click();
        await page.waitForTimeout(300);
      }
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    console.log('[INFO] Capturing Planner Page -> planner_tab.png');
    await page.screenshot({
      path: path.join(outputDir, 'planner_tab.png'),
      fullPage: false,
    });

    // 5. Compare Page
    console.log('[5/7] Navigating to Compare -> compare_tab.png');
    const compareNav = page.locator('.nav-pill:has-text("Compare")').first();
    await compareNav.click();
    await page.waitForSelector('.compare-page, .product-card, .matrix-container', { timeout: 5000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(outputDir, 'compare_tab.png'),
      fullPage: false,
    });

    console.log('\n✨ [DONE] Successfully captured all README screenshots into static/images/readme/!\n');
  } catch (err) {
    console.error('[ERROR] Screenshot generation failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (viteServer) {
      console.log('[INFO] Closing Vite server...');
      await viteServer.close();
    }
  }
}

capture();
