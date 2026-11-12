// Page-coordinate boxes of key words on the live site (same injected styles as the stitched capture).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto('https://desk2quant.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const reject = page.getByRole('button', { name: 'Reject' }); if (await reject.count()) await reject.first().click();
  await page.addStyleTag({ content: '#scrollProgress, #scrollTopBtn, .d2q-tawk-launcher, .d2q-adv-fab { display: none !important; } nav.navbar { position: relative !important; }' });
  for (let y = 0; y < 19000; y += 900) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(250); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const out = {};
    const words = ['Interview', 'Desk', 'Desk2Quant', '54+', '50+', '500+', 'Premium Digital Products', 'Learn the model', 'Implement it', 'Break it',
                   'Validate it', 'Explain it', 'Personalized 1-on-1 Sessions', 'What Aspirants Say', 'Ready to Level Up?', 'Build Quant Skills',
                   'LEARNING RESOURCES', 'NOTES + LAB', 'INTERVIEW GUIDE', 'PLAYBOOK + LAB', 'Learn the models that real trading desks use', 'All 54 resources'];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const txt = n.textContent;
      for (const w of words) {
        const i = txt.indexOf(w);
        if (i < 0) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length);
        const b = r.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        (out[w] = out[w] || []).push([Math.round(b.left), Math.round(b.top + window.scrollY), Math.round(b.width), Math.round(b.height)]);
      }
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v.slice(0, 6)));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
