// filmstrip of the guide over the film frames: node work/guide/strip.mjs t0 t1 step out.png
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright/index.js');
const [,, t0, t1, step, out] = process.argv;
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + path.resolve('out/guide_test.html') + '?bg=1'); await p.evaluate(() => window.ready);
const shots = [];
for (let t = +t0; t <= +t1 + 1e-6; t += +step) {
  await p.evaluate((t) => window.seek(t), t); await p.waitForTimeout(30);
  shots.push([t, await p.screenshot({ clip: { x: 700, y: 1440, width: 380, height: 480 } })]);
}
await b.close();
const fs = await import('fs'); const dir = out.replace(/\.png$/, '_f'); fs.mkdirSync(dir, { recursive: true });
shots.forEach(([t, buf], i) => fs.writeFileSync(`${dir}/${String(i).padStart(3, '0')}_${t.toFixed(2)}.png`, buf));
console.log(shots.length, 'frames in', dir);
