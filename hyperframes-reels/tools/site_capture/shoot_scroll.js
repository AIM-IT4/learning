// Viewport-by-viewport capture of the live site as a visitor scrolls (reveal animations play), then stitched by Python.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], VW = 1280, VH = 900;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1.5, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('https://desk2quant.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const reject = page.getByRole('button', { name: 'Reject' });
  if (await reject.count()) { await reject.first().click(); console.log('consent: rejected'); }
  await page.addStyleTag({ content: '#scrollProgress, #scrollTopBtn, .d2q-tawk-launcher, .d2q-adv-fab { display: none !important; } nav.navbar { position: relative !important; }' });
  await page.waitForTimeout(800);
  let y = 0, k = 0, last = -1;
  const shots = [];
  while (k < 40) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(900);
    const sy = await page.evaluate(() => Math.round(window.scrollY));
    if (sy === last) break;
    const f = `${out}/s${String(k).padStart(2, '0')}.png`;
    await page.screenshot({ path: f });
    shots.push([f, sy]); last = sy; k++; y += VH;
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    if (y >= H) { y = H - VH; }
  }
  require('fs').writeFileSync(`${out}/shots.json`, JSON.stringify(shots));
  console.log('shots', shots.length, 'last scrollY', last);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
