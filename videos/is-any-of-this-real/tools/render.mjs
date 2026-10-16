// usage: node render.mjs <firstFrame> <lastFrameExclusive> <out.mp4> [fps]
// Frames are composited in-page (GL layer upscaled + 1080p typography) and streamed as raw RGBA
// to a local HTTP sink that pipes straight into x264 — no screenshot API in the loop.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
const [f0, f1, out, fpsArg] = process.argv.slice(2);
const FPS = +(fpsArg || 24);
const RS = process.env.RS || '0.6667';
const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web/index.html');

const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const done = () => { res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok'); };
    if (buf.length !== 1920 * 1080 * 4) { console.error('bad frame size', buf.length); res.writeHead(500); res.end(); return; }
    if (ff.stdin.write(buf)) done(); else ff.stdin.once('drain', done);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto(`file://${web}?rs=${RS}`);
await p.evaluate(() => window.ready);
await p.evaluate((port) => {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  window.grabFrame = async (t, f) => {
    renderAt(t, f);
    x.drawImage(document.getElementById('gl'), 0, 0, 1920, 1080);
    x.drawImage(document.getElementById('ui'), 0, 0);
    const px = x.getImageData(0, 0, 1920, 1080).data;
    const r = await fetch(`http://127.0.0.1:${port}/frame`, { method: 'POST', body: new Blob([px]) });
    if (!r.ok) throw new Error('sink rejected frame');
  };
}, port);

const T0 = Date.now();
for (let f = +f0; f < +f1; f++) {
  await p.evaluate(([t, f]) => window.grabFrame(t, f), [f / FPS, f]);
  if ((f - f0) % 24 === 0) console.log(`${path.basename(out)} frame ${f} ${((Date.now() - T0) / (f - f0 + 1)).toFixed(0)} ms/f`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log(`${path.basename(out)} done ${f1 - f0} frames in ${((Date.now() - T0) / 1000).toFixed(0)}s`);
server.close();
await b.close();
