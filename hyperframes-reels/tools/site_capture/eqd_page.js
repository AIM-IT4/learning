const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('https://desk2quant.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const reject = page.getByRole('button', { name: 'Reject' }); if (await reject.count()) await reject.first().click();
  await page.getByText('View details').first().click(); await page.waitForTimeout(3000);
  console.log('URL', page.url());
  const imgs = await page.evaluate(() => [...document.images].map(i => [i.currentSrc || i.src, i.naturalWidth, i.naturalHeight, Math.round(i.getBoundingClientRect().width)]).filter(x => x[3] > 200));
  console.log('IMGS', JSON.stringify(imgs.slice(0, 8)));
  const text = await page.evaluate(() => document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText);
  require('fs').writeFileSync(`${out}/product_text.txt`, text);
  await page.addStyleTag({ content: '#scrollProgress, #scrollTopBtn, .d2q-tawk-launcher, .d2q-adv-fab { display: none !important; }' });
  await page.screenshot({ path: `${out}/product_full.png`, fullPage: true });
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
