// usage: node render.mjs <firstFrame> <lastFrameExclusive> <out.mp4> [fps]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
const [f0, f1, out, fpsArg] = process.argv.slice(2);
const FPS = +(fpsArg || 30);
const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web/index.html');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto('file://' + web);
await p.evaluate(() => window.ready);
const cdp = await p.context().newCDPSession(p);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '13', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const T0 = Date.now();
for (let f = +f0; f < +f1; f++) {
  await p.evaluate(([t, f]) => window.renderAt(t, f), [f / FPS, f]);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true });
  const buf = Buffer.from(data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if ((f - f0) % 30 === 0) console.log(`${path.basename(out)} frame ${f} ${((Date.now() - T0) / (f - f0 + 1)).toFixed(0)} ms/f`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log(`${path.basename(out)} done ${f1 - f0} frames in ${((Date.now() - T0) / 1000).toFixed(0)}s`);
await b.close();
