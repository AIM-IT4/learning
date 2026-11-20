// Zone check for the guide (bust framing), on the test page out/guide_test.html:
//  1. pixels: at every film frame (24 fps), the guide's SVG is rasterised and no drawn pixel may fall on the chart stage
//     (y < 1478) or on the chip rail (x 54-760, y 1478-1690);
//  2. the face: at 60 fps, his raised hand (arm 0's hand) may never overlap his head (bounding boxes);
//  3. it reports how much of the time the raised hand is in view and the figure's extent.
//   node work/guide/qa_zone.mjs [fps=24]      (from the project folder)
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright/index.js');
const fps = +(process.argv[2] || 24);
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + path.resolve('out/guide_test.html'));
await p.evaluate(() => window.ready);
const dur = await p.evaluate(() => window.DUR);
const pix = await p.evaluate(async ({ dur, fps }) => {
  const svg = document.getElementById('mc-sv'), cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
  const g = cv.getContext('2d', { willReadFrequently: true }), ser = new XMLSerializer();
  const RECTS = { stage: [0, 1200, 1080, 278], rail: [54, 1478, 706, 212] }, bad = [];
  let x0 = 1e9, y0 = 1e9;
  for (let f = 0; f <= Math.floor(dur * fps); f++) {
    const t = f / fps; window.seek(t);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ser.serializeToString(svg)); await img.decode();
    g.clearRect(0, 0, 1080, 1920); g.drawImage(img, 0, 0);
    for (const k in RECTS) {
      const [x, y, w, h] = RECTS[k], d = g.getImageData(x, y, w, h).data; let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
      if (n) bad.push([+t.toFixed(3), k, n]);
    }
    // the figure's extent (left edge, top edge) in the lower right
    const d = g.getImageData(600, 1400, 480, 520).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) { const q = (i - 3) / 4, x = 600 + (q % 480), y = 1400 + Math.floor(q / 480); if (x < x0) x0 = x; if (y < y0) y0 = y; }
  }
  return { bad, x0, y0 };
}, { dur, fps });
const geo = await p.evaluate(({ dur }) => {
  const D = Kit.CASTS[0].z, out = []; let up = 0, n = 0;
  const box = (els) => { const r = els.map((e) => e.getBoundingClientRect()).filter((q) => q.width || q.height);
    return r.length ? [Math.min(...r.map((q) => q.left)), Math.min(...r.map((q) => q.top)), Math.max(...r.map((q) => q.right)), Math.max(...r.map((q) => q.bottom))] : null; };
  for (let f = 0; f <= Math.floor(dur * 60); f++) {
    const t = f / 60; window.seek(t); n++;
    const h = box([D.arms[0].hbG, D.arms[0].hfG]), hd = box([D.headG]);
    if (h && h[1] < 1920) up++;
    if (h && hd && h[0] < hd[2] && h[2] > hd[0] && h[1] < hd[3] && h[3] > hd[1]) out.push(+t.toFixed(3));
  }
  return { face: out, upShare: up / n };
}, { dur });
console.log(`pixels: ${Math.floor(dur * fps) + 1} frames at ${fps} fps, frames touching the stage or the chip rail: ${new Set(pix.bad.map((q) => q[0])).size}`);
let prev = null; for (const v of pix.bad) { if (!prev || v[0] - prev[0] > 0.1 || v[1] !== prev[1]) console.log('   ', JSON.stringify(v)); prev = v; }
console.log(`figure extent in the lower right: left x ${pix.x0}, top y ${pix.y0}`);
console.log(`face: frames (60 fps) where the raised hand overlaps his head: ${geo.face.length}${geo.face.length ? ' first ' + geo.face.slice(0, 8).join(' ') : ''}`);
console.log(`the raised hand is in view ${(100 * geo.upShare).toFixed(0)}% of the time`);
if (errs.length) console.log('ERRORS', errs.slice(0, 5));
await b.close();
