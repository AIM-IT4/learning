#!/usr/bin/env node
/* render_code.cjs - render the code-drawn music video page to an mp4 (or stills for checking).
   node render_code.cjs mv_code.html out.mp4 [--from 0 --to 62.263] [--fps 30]
   node render_code.cjs mv_code.html stills_dir --stills 1.0,4.5,9     (MV times)
   node render_code.cjs mv_code.html stills_dir --shots                 (one still per shot, mid-shot)  */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const [html, out] = a;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.resolve(html));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const save = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
  if (opt('--stills') || a.includes('--shots')) {
    fs.mkdirSync(out, { recursive: true });
    if (a.includes('--shots')) {
      const n = await page.evaluate(() => SHOTS.length);
      for (let i = 0; i < n; i++) { const d = await page.evaluate(i => window.shot(i, (SHOTS[i].t1 - SHOTS[i].t0) * 0.55), i); save(path.join(out, `shot${String(i + 1).padStart(2, '0')}.jpg`), d); }
    } else for (const t of opt('--stills').split(',').map(Number)) save(path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`), await page.evaluate(t => window.frame(t), t));
    await browser.close(); return;
  }
  const fps = parseInt(opt('--fps') || '30', 10), t0 = parseFloat(opt('--from') || '0'), t1 = parseFloat(opt('--to') || String(await page.evaluate(() => window.END)));
  const n = Math.round((t1 - t0) * fps);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const d = await page.evaluate(t => window.frame(t), t0 + i / fps);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close(); console.log('done', out);
})().catch(e => { console.error(e); process.exit(1); });
