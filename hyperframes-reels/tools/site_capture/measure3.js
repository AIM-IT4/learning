const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto('https://desk2quant.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const reject = page.getByRole('button', { name: 'Reject' }); if (await reject.count()) await reject.first().click();
  await page.addStyleTag({ content: '#scrollProgress, #scrollTopBtn, .d2q-tawk-launcher, .d2q-adv-fab { display: none !important; } nav.navbar { position: relative !important; }' });
  const seen = {};
  for (let y = 0; y < 19500; y += 450) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(700);
    const hs = await page.evaluate(() => [...document.querySelectorAll('h1, h2')].map(e => {
      const b = e.getBoundingClientRect();
      return [(e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), Math.round(b.left), Math.round(b.top + window.scrollY), Math.round(b.width), Math.round(b.height), b.top > -50 && b.top < 900];
    }).filter(h => h[5] && h[0]));
    for (const h of hs) if (!seen[h[0]]) seen[h[0]] = h.slice(1, 5);
  }
  for (const [k, v] of Object.entries(seen)) console.log(v.join(','), '|', k);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
