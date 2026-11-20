// Pointing accuracy: for every point beat, the angle between D's index finger (knuckle -> tip, as drawn) and the line from
// the fingertip to the chart element he points at, sampled at 30 fps from 0.45 s after the move starts to the end of the hold.
//   node work/guide/qa_aim.mjs      (from the project folder; reads out/guide_test.html)
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright/index.js');
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('file://' + path.resolve('out/guide_test.html'));
await p.evaluate(() => window.ready);
const rows = await p.evaluate(() => {
  const D = Kit.CASTS[0].z, kw = Cast.K * 1.55, out = [];
  // the point beats, read back from the arm-0 gesture keys the composition built (pointZ keys with their targets)
  const keys = window.__mcKeys ? window.__mcKeys[0] : null;
  if (!keys) return null;
  keys.forEach((k, i) => {
    if (k[1] !== 'pointZ') return;
    const t0 = k[0] + 0.45, t1 = i + 1 < keys.length ? keys[i + 1][0] : t0 + 1;
    let worst = 0, sum = 0, n = 0;
    for (let t = t0; t <= t1 + 1e-6; t += 1 / 30) {
      window.seek(t);
      const T = typeof k[3].target === 'function' ? k[3].target() : k[3].target;
      const a = D.arms[0], W = a.W, f = a.hand.fingers[0].m, kn = [W.x + +f[1].getAttribute('x1') * kw, W.y + +f[1].getAttribute('y1') * kw];
      const tip = [W.x + +f[3].getAttribute('x2') * kw, W.y + +f[3].getAttribute('y2') * kw];
      const a1 = Math.atan2(tip[1] - kn[1], tip[0] - kn[0]), a2 = Math.atan2(T.y - tip[1], T.x - tip[0]);
      const e = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180 / Math.PI;
      worst = Math.max(worst, e); sum += e; n++;
    }
    out.push([+k[0].toFixed(2), +(sum / n).toFixed(1), +worst.toFixed(1)]);
  });
  return out;
});
if (!rows) console.log('the page does not expose window.__mcKeys');
else { console.log('point starts (s), mean and worst aim error (deg):'); rows.forEach((r) => console.log('  ', r.join('  '))); }
await b.close();
