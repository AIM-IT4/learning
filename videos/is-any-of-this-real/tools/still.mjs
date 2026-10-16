// usage: node still.mjs outdir t1 t2 ...
import { chromium } from 'playwright';
import path from 'path';
const [out, ...times] = process.argv.slice(2);
const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web/index.html');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + web + '?rs=' + (process.env.RS || '0.6667'));
try { await p.evaluate(() => window.ready); } catch (e) { console.log('READY FAIL', e.message.slice(0, 4000)); }
if (errs.length) console.log(errs.join('\n').slice(0, 6000));
console.log('duration', await p.evaluate(() => window.DURATION));
for (const t of times) {
  const t0 = Date.now();
  await p.evaluate((t) => window.renderAt(t), +t);
  await p.screenshot({ path: `${out}/t${(+t).toFixed(2)}.png` });
  console.log('t', t, 'ms', Date.now() - t0);
}
if (errs.length) console.log(errs.slice(0, 20).join('\n').slice(0, 6000));
await b.close();
