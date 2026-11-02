// Render frames f0..f1 of a page that exposes window.ready and window.seek(t) to an H.264 file (1080x1920):
//   PAGE=demo.html node tools/render.mjs <fps> <f0> <f1> <out.mp4> [motion-blur subframes, e.g. 8]
// PAGE is resolved from the current folder. Split long renders into ranges run in parallel, then concat.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');      // global playwright (CommonJS) works from any folder
import { spawn } from 'child_process';
import path from 'path';
// optional 6th arg: motion-blur subframes (120° shutter, box filter), e.g. 8
const [,, fps_, f0_, f1_, out, mb_ = '1'] = process.argv; const orient = 'port', MB = Math.max(1, +mb_);
const fps = +fps_, f0 = +f0_, f1 = +f1_, land = orient === 'land';
const W = land ? 1920 : 1080, H = land ? 1080 : 1920;
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('file://' + path.resolve(process.env.PAGE || 'index.html'));
await page.evaluate(() => window.ready);
const blur = MB > 1 ? ['-vf', `tmix=frames=${MB}:weights='${Array(MB).fill(1).join(' ')}',select='eq(mod(n\\,${MB})\\,${MB - 1})',setpts=N/${fps}/TB`] : [];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * MB), '-c:v', 'mjpeg', '-i', '-', ...blur,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const cdp = await page.context().newCDPSession(page);
const t0 = Date.now();
for (let f = f0; f < f1; f++) for (let k = 0; k < MB; k++) {
  const t = MB > 1 ? (f + ((k + .5) / MB - .5) / 3) / fps : f / fps;   // 120° shutter: subframes span a third of a frame, centred on it
  await page.evaluate(t => window.seek(t), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (k < MB - 1) continue;
  if ((f - f0) % 300 === 0) console.log(orient, f, ((Date.now() - t0) / Math.max(1, f - f0)).toFixed(0), 'ms/f');
}
ff.stdin.end(); await new Promise(r => ff.on('close', r));
await browser.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
