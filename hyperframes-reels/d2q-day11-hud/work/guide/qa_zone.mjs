// Zone check for the guide: every frame at 60 fps, the drawn bounds of D (each arm with its hand, the head, the whole
// figure) must stay inside x 760-1060, y >= 1478 (the chart stage ends at 1478, the chip rail is x 54-760).
//   node work/guide/qa_zone.mjs [fps=60]      (from the project folder; reads out/guide_test.html)
// Optional: SHOTS="t1,t2,..." OUT=dir  writes crops of the lower right over the film frames (out/guide_bg) at those times.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright/index.js');
const fps = +(process.argv[2] || 60);
const page = path.resolve('out/guide_test.html');
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + page + (process.env.SHOTS ? '?bg=1' : ''));
await p.evaluate(() => window.ready);
const dur = await p.evaluate(() => window.DUR);
const res = await p.evaluate(({ dur, fps }) => {
  const D = Kit.CASTS[0].z, out = [], ext = { x0: 1e9, x1: -1e9, y0: 1e9 };
  const box = (el) => { const r = el.getBoundingClientRect(); return r.width || r.height ? [r.left, r.top, r.right, r.bottom] : null; };
  for (let f = 0; f <= Math.floor(dur * fps); f++) {
    const t = f / fps; window.seek(t);
    const parts = { arm0: [D.arms[0].U.g, D.arms[0].D.g], arm1: [D.arms[1].U.g, D.arms[1].D.g], head: [D.headG] };
    for (const k in parts) {
      const bb = parts[k].map(box).filter(Boolean); if (!bb.length) continue;
      const x0 = Math.min(...bb.map((q) => q[0])), y0 = Math.min(...bb.map((q) => q[1])), x1 = Math.max(...bb.map((q) => q[2]));
      ext.x0 = Math.min(ext.x0, x0); ext.x1 = Math.max(ext.x1, x1); ext.y0 = Math.min(ext.y0, y0);
      if (x0 < 760 || x1 > 1060 || y0 < 1478) out.push([+t.toFixed(3), k, Math.round(x0), Math.round(y0), Math.round(x1)]);
    }
  }
  return { out, ext };
}, { dur, fps });
console.log('frames', Math.floor(dur * fps) + 1, 'zone violations', res.out.length, 'extent', JSON.stringify(res.ext, (k, v) => typeof v === 'number' ? Math.round(v) : v));
let prev = null;
for (const v of res.out) { if (!prev || v[0] - prev[0] > 0.1 || v[1] !== prev[1]) console.log('  ', JSON.stringify(v)); prev = v; }
if (process.env.SHOTS) {
  const outDir = process.env.OUT || 'out/guide_qa'; fs.mkdirSync(outDir, { recursive: true });
  for (const t of process.env.SHOTS.split(',').map(Number)) {
    await p.evaluate((t) => window.seek(t), t); await p.waitForTimeout(60);
    await p.screenshot({ path: `${outDir}/t${t.toFixed(2)}.png`, clip: { x: 0, y: 760, width: 1080, height: 1160 } });
  }
  console.log('shots in', outDir);
}
if (errs.length) console.log('ERRORS', errs.slice(0, 5));
await b.close();
