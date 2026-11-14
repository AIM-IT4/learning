// Render the reel page to numbered 1080x1920 JPEG frames, frame-exact.
//   node render_reel.js <page.html> <frames_dir> [fps]
// The page exposes window.__render(t) and window.__total, so each frame is drawn
// for an exact time instead of being screen-recorded in real time.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [page_html, outDir, fpsArg] = process.argv.slice(2);
  const fps = +fpsArg || 30;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + page_html + '?export=1');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const total = await page.evaluate(() => window.__total);
  const n = Math.ceil(total / 1000 * fps);
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await page.evaluate(t => window.__render(t), f * 1000 / fps);
    await page.screenshot({ path: `${outDir}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (f % 300 === 0) console.log(`frame ${f}/${n}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`done: ${n} frames, ${(total / 1000).toFixed(2)}s at ${fps}fps, ${((Date.now() - t0) / 1000).toFixed(0)}s to render`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
})();
