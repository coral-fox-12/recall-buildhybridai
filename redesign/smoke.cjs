// Functional smoke test against the LIVE Recall site: load sample notes,
// generate flashcards + quiz, verify results render, no console errors.
const { chromium } = require('/home/hatch/workspace/makefun/tools/shot/node_modules/playwright-core');
const { spawn } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const proxy = spawn('node', ['/home/hatch/workspace/devpost/contextcon/video-work/local_proxy.cjs'], {
    env: { ...process.env, TMPDIR: '/home/hatch/tmp' }, stdio: 'ignore',
  });
  await sleep(1500);
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',
    proxy: { server: 'http://127.0.0.1:18080', bypass: '127.0.0.1,localhost' },
    env: { ...process.env, TMPDIR: '/home/hatch/tmp' },
  });
  const errors = [];
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
    await page.goto('https://recall-buildhybridai.surge.sh/', { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(1500);
    const label = await page.textContent('#engineLabel');
    results.push(['engine status shows demo mode', label.includes('Demo mode')]);
    const h1 = await page.textContent('.brand h1');
    results.push(['masthead title present', h1.includes('Recall')]);
    await page.click('#btnSample');
    await page.click('#btnCards');
    await sleep(2500);
    const cards = await page.locator('#deck .card').count();
    results.push([`flashcards generated (got ${cards})`, cards >= 4]);
    await page.click('#btnQuiz');
    await sleep(2500);
    const qs = await page.locator('#quizBox .quiz-q').count();
    results.push([`quiz questions (got ${qs})`, qs === 5]);
    // Card flip still works in the new design.
    await page.click('#tabbtn-cards');
    await page.locator('#deck .card').first().click();
    await sleep(300);
    const flipped = await page.locator('#deck .card.flipped').count();
    results.push(['card flips on click', flipped === 1]);
    for (const [name, ok] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
  } finally {
    await browser.close();
    proxy.kill();
  }
  if (errors.length) { console.log('ERRORS:'); errors.forEach((e) => console.log('  ' + e)); }
  else console.log('no console errors, no failed requests');
  const failed = results.filter(([, ok]) => !ok).length + errors.length;
  console.log(failed === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failed})`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
