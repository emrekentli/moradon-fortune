import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const artifacts = new URL('../artifacts/visual/', import.meta.url);
await mkdir(artifacts, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Vite preview server did not start.');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      runtimeErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl) && !response.url().includes('favicon')) {
      runtimeErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForSelector('#intro-screen.visible', { state: 'visible' });
  await page.screenshot({ path: fileURLToPath(new URL('intro-desktop.png', artifacts)) });
  await page.click('#enter-game');
  await page.waitForSelector('#intro-screen', { state: 'hidden' });

  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'idle');
  await page.mouse.click(1135, 551);
  await page.waitForSelector('#auto-dialog', { state: 'visible' });
  await page.click('[data-spin-count="50"]');
  await page.click('.option-card:has(#auto-turbo)');
  await page.click('.option-card:has(#auto-quick)');
  if (!(await page.textContent('#start-auto'))?.includes('50')) throw new Error('Auto spin count was not updated.');
  await page.screenshot({ path: fileURLToPath(new URL('auto-settings-desktop.png', artifacts)) });
  const combinedSpeedStarted = Date.now();
  await page.click('#start-auto');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'spinning');
  await page.waitForFunction(
    () => ['presenting', 'idle'].includes(window.moradonDebug?.getState()),
    null,
    { timeout: 1800 },
  );
  const combinedSpeedDuration = Date.now() - combinedSpeedStarted;
  if (combinedSpeedDuration > 1500) throw new Error(`Combined Turbo/Quick spin took ${combinedSpeedDuration}ms.`);
  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'idle');
  await page.mouse.click(50, 245);
  await page.waitForSelector('#buy-dialog', { state: 'visible' });
  if ((await page.textContent('#buy-price'))?.trim() !== '500.00 Noah') throw new Error('Buy bonus price is incorrect.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: fileURLToPath(new URL('buy-bonus-desktop.png', artifacts)) });
  await page.click('#confirm-buy');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'bonus-intro');

  await page.goto(`${baseUrl}/?scene=anvil&skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'bonus-intro');
  await page.waitForTimeout(600);
  await page.screenshot({ path: fileURLToPath(new URL('anvil-idle.png', artifacts)) });

  await page.mouse.click(195, 535);
  await page.waitForTimeout(120);
  await page.screenshot({ path: fileURLToPath(new URL('anvil-trina-active.png', artifacts)) });
  await page.mouse.click(640, 635);
  await page.waitForTimeout(1450);
  await page.screenshot({ path: fileURLToPath(new URL('anvil-after-upgrade.png', artifacts)) });

  await page.goto(`${baseUrl}/?scene=anvil&level=7&skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'bonus-intro');
  await page.waitForTimeout(520);
  await page.screenshot({ path: fileURLToPath(new URL('anvil-debug-plus7.png', artifacts)) });

  await page.goto(`${baseUrl}/?scenario=big-win&skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'spinning');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'presenting');
  await page.waitForTimeout(380);
  await page.screenshot({ path: fileURLToPath(new URL('big-win.png', artifacts)) });
  const presentationSkipStarted = Date.now();
  await page.mouse.click(905, 645);
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'idle', null, { timeout: 1000 });
  const presentationSkipDuration = Date.now() - presentationSkipStarted;
  await page.mouse.click(1062, 647);
  await page.waitForTimeout(100);
  await page.screenshot({ path: fileURLToPath(new URL('paytable-history.png', artifacts)) });

  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'idle');
  await page.mouse.click(905, 645);
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'spinning');
  await page.waitForTimeout(320);
  const quickStopStarted = Date.now();
  await page.mouse.click(905, 645);
  await page.waitForFunction(() => ['presenting', 'idle'].includes(window.moradonDebug?.getState()), null, { timeout: 1600 });
  const quickStopDuration = Date.now() - quickStopStarted;
  if (quickStopDuration > 1500) throw new Error(`Quick stop took ${quickStopDuration}ms.`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/?skipIntro=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading.hidden');
  await page.waitForSelector('#mobile-hud', { state: 'visible' });
  await page.click('#mobile-auto');
  await page.waitForSelector('#auto-dialog', { state: 'visible' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: fileURLToPath(new URL('auto-settings-mobile.png', artifacts)) });
  await page.click('#auto-dialog .dialog-close');
  await page.click('#mobile-buy');
  await page.waitForSelector('#buy-dialog', { state: 'visible' });
  await page.click('#buy-dialog .dialog-close');
  await page.click('#mobile-spin');
  await page.waitForFunction(() => window.moradonDebug?.getState() === 'spinning');
  await page.waitForTimeout(320);
  await page.click('#mobile-spin');
  await page.waitForFunction(() => ['presenting', 'idle'].includes(window.moradonDebug?.getState()), null, { timeout: 1600 });
  await page.screenshot({ path: fileURLToPath(new URL('mobile-portrait.png', artifacts)) });

  if (runtimeErrors.length > 0) {
    throw new Error(`Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  }
  process.stdout.write(`Visual runtime checks passed: intro, Auto settings, ${combinedSpeedDuration}ms combined Turbo/Quick spin, Bonus Buy, Anvil, Big Win, paytable, portrait mobile, ${quickStopDuration}ms quick stop and ${presentationSkipDuration}ms presentation skip.\n`);
} finally {
  await browser?.close();
  server.kill();
}
