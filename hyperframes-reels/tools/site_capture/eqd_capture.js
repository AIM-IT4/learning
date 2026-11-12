// The Equity Derivatives product on the live site: its card in the grid and its detail panel (text + screenshots).
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('https://desk2quant.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const reject = page.getByRole('button', { name: 'Reject' }); if (await reject.count()) await reject.first().click();
  await page.addStyleTag({ content: '#scrollProgress, #scrollTopBtn, .d2q-tawk-launcher, .d2q-adv-fab { display: none !important; }' });
  await page.screenshot({ path: `${out}/banner.png`, clip: { x: 0, y: 0, width: 1280, height: 60 } });
  // the product card: find the card whose title mentions Equity Derivatives
  for (let y = 3000; y < 10500; y += 450) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(250); }
  const card = page.locator('text=/Equity Derivatives Quant Notes/i').first();
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
    const box = await card.evaluate((e) => { let c = e; for (let i = 0; i < 8 && c.parentElement; i++) { c = c.parentElement; const r = c.getBoundingClientRect(); if (r.height > 380 && r.width < 420) break; } const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, text: c.innerText.slice(0, 600) }; });
    console.log('CARD', JSON.stringify(box));
    await page.screenshot({ path: `${out}/card.png`, clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.width + 12, height: box.height + 12 } });
  } else console.log('no card');
  // the detail panel from the banner
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
  const view = page.getByText('View details').first();
  if (await view.count()) {
    await view.click(); await page.waitForTimeout(2000);
    const modal = page.locator('.modal.active, .modal.open, .modal[style*="flex"], .modal.show, [role="dialog"]').first();
    const txt = await page.evaluate(() => { const m = [...document.querySelectorAll('.modal, [role="dialog"]')].find(e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.5 && e.innerText.length > 50; }); return m ? m.innerText : 'NO MODAL'; });
    console.log('MODAL', txt.slice(0, 2500));
    await page.screenshot({ path: `${out}/modal.png` });
  } else console.log('no view details');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
