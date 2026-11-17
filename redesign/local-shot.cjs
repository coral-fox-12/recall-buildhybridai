// Local screenshots of the redesigned Recall site (empty + populated deck),
// desktop 1440px and mobile 390px. Serves the repo dir on 127.0.0.1.
const { chromium } = require('/home/hatch/workspace/makefun/tools/shot/node_modules/playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const DIR = path.join(__dirname, '..');
const PORT = 8125;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: DIR, stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {}
    await sleep(500);
  }
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',
    env: { ...process.env, TMPDIR: '/home/hatch/tmp' },
  });
  const errors = [];
  try {
    for (const [name, w, h] of [['1440', 1440, 900], ['390', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
      page.on('requestfailed', (r) => errors.push(`${name} requestfailed: ${r.url()}`));
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(1500);
      await page.screenshot({ path: path.join(__dirname, `local-${name}.png`), fullPage: true });
      console.log(`saved local-${name}.png (empty state)`);
      // Populate: load sample notes, generate flashcards, screenshot the deck.
      await page.click('#btnSample');
      await page.click('#btnCards');
      await sleep(2500);
      await page.screenshot({ path: path.join(__dirname, `local-deck-${name}.png`), fullPage: true });
      console.log(`saved local-deck-${name}.png (populated deck)`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (errors.length) { console.log('ERRORS:'); errors.forEach((e) => console.log('  ' + e)); }
  else console.log('no console errors, no failed requests');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
