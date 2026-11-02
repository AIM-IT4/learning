// Frame audit for the motion test: sample every 1/60 s, flag joint jumps that stand out from their neighbours.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');      // global playwright (CommonJS) works from any folder
const page = process.argv[2] || 'motest.html';
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('file://' + process.cwd() + '/' + page); await p.evaluate(() => window.ready);
const dur = await p.evaluate(() => window.DUR);
const rows = await p.evaluate(dur => { const out = []; for (let f = 0; f <= Math.floor(dur * 60); f++) { window.seek(f / 60); out.push(window.__probe()); } return out; }, dur);
await b.close();
const flags = [];
for (let i = 2; i < rows.length - 2; i++) for (const k in rows[i]) {
  const d = j => (rows[j] && rows[j][k] && rows[j - 1] && rows[j - 1][k]) ? Math.hypot(rows[j][k][0] - rows[j - 1][k][0], rows[j][k][1] - rows[j - 1][k][1]) : null;
  const di = d(i); if (di == null) continue;
  const nb = [d(i - 2), d(i - 1), d(i + 1), d(i + 2)].filter(x => x != null).sort((a, b) => a - b); if (nb.length < 2) continue;
  const med = (nb[Math.floor((nb.length - 1) / 2)] + nb[Math.ceil((nb.length - 1) / 2)]) / 2;
  if (di > 6 && di > 2.4 * med + 3) flags.push({ t: (i / 60).toFixed(3), k, d: di.toFixed(1), med: med.toFixed(1) });
}
console.log('frames', rows.length, 'flags', flags.length);
const byK = {}; for (const f of flags) { const kk = f.k.replace(/[0-9]+:/, ':'); byK[kk] = (byK[kk] || 0) + 1; }
console.log(JSON.stringify(byK));
for (const f of flags.slice(0, 120)) console.log(f.t, f.k, f.d, f.med);
