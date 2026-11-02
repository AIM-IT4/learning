// Render the model sheets: node tools/sheet.mjs  (run from characters/) -> sheets/lineup.png, turn.png, faces.png, gestures.png
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');      // global playwright (CommonJS) works from any folder
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
for (const s of process.argv.slice(2).length ? process.argv.slice(2) : ['lineup', 'turn', 'faces', 'gestures']) {
  const p = await b.newPage({ viewport: { width: 1200, height: 100 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(`file://${root}/sheet.html?s=${s}`); await p.evaluate(() => window.ready);
  await p.screenshot({ path: `${root}/sheets/${s}.png`, fullPage: true }); await p.close();
  console.log('sheets/' + s + '.png');
}
await b.close();
