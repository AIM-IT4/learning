#!/usr/bin/env node
/*
render_scenes.cjs - turn the code-drawn scenes of an HTML page into video clips (or preview stills).

The page must define render(name, t, T, type) that draws scene `name` at time t of a T-second shot and
returns a data URL. The storyboard (make_festival.py format) says which scenes are needed and how long:
every shot with "video": "<scene>.mp4" gets a clip a little longer than its bars, so transitions have room.

  node render_scenes.cjs chhath_scenes.html ../examples/chhath_status/storyboard_code.json --out clips
  node render_scenes.cjs chhath_scenes.html storyboard.json --out stills --still 1.5     # one PNG per scene
  options: --only diwali,title   --fps 30   --force   --webgl (three.js pages: chhath_3d.html)
  one continuous timeline instead of a storyboard:  --timeline doc:90.7 [--timing timing.json] --serve
  preview frames of a timeline:  --stills 1,5,12.5
Needs: Node with the playwright package and its Chromium, ffmpeg on PATH.
*/
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function args() {
  const a = process.argv.slice(2), o = { pos: [], fps: 30, force: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--still') o.still = parseFloat(a[++i]);
    else if (a[i] === '--only') o.only = a[++i].split(',');
    else if (a[i] === '--fps') o.fps = parseInt(a[++i], 10);
    else if (a[i] === '--force') o.force = true;
    else if (a[i] === '--webgl') o.webgl = true;
    else if (a[i] === '--serve') o.serve = true;
    else if (a[i] === '--timeline') { const [n, T] = a[++i].split(':'); o.timeline = { name: n, dur: parseFloat(T) }; }
    else if (a[i] === '--stills') o.stills = a[++i].split(',').map(Number);
    else if (a[i] === '--timing') o.timing = a[++i];
    else o.pos.push(a[i]);
  }
  return o;
}

function scenesFrom(sb) {
  const bar = 240 / sb.bpm, total = sb.duration, out = [];
  let t = sb.beat0 || 0;
  sb.shots.forEach((s, k) => {
    const last = k === sb.shots.length - 1, len = last ? total - t : s.bars * bar;
    if (s.video) out.push({ name: path.basename(s.video, path.extname(s.video)), file: s.video, dur: len + 1.6 + (s.ss || 0) });
    t += s.bars * bar;
  });
  return out;
}

(async () => {
  const o = args();
  const [html, storyboard] = o.pos;  // storyboard is ignored with --timeline
  let scenes = o.timeline ? [{ name: o.timeline.name, file: o.timeline.name + '.mp4', dur: o.timeline.dur }]
    : scenesFrom(JSON.parse(fs.readFileSync(storyboard, 'utf8')));
  if (o.only) scenes = scenes.filter(s => o.only.includes(s.name));
  fs.mkdirSync(o.out, { recursive: true });
  // --webgl: software WebGL (SwiftShader) and the page served from a fake origin, so ES modules can load
  const browser = await chromium.launch(o.webgl ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  if (o.webgl || o.serve) {
    const root = path.dirname(path.resolve(html));
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
    await page.route('http://scene.local/**', r => {
      const f = path.join(root, decodeURIComponent(new URL(r.request().url()).pathname));
      if (!f.startsWith(root) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'not found' });
      r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'application/octet-stream' });
    });
    await page.goto('http://scene.local/' + path.basename(html));
    await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
    if (o.timing) await page.evaluate(tm => window.setTiming(tm), JSON.parse(fs.readFileSync(o.timing, 'utf8')));
  } else {
    await page.goto('file://' + path.resolve(html));
  }
  for (const s of scenes) {
    if (o.stills) {
      for (const t of o.stills) { const d = await page.evaluate(([n, t, T]) => window.render(n, t, T, 'image/jpeg'), [s.name, t, s.dur]);
        fs.writeFileSync(path.join(o.out, `${s.name}_${t.toFixed(1).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); }
      continue;
    }
    if (o.still !== undefined) {
      const d = await page.evaluate(([n, t, T]) => window.render(n, t, T, 'image/png'), [s.name, Math.min(o.still, s.dur - 0.1), s.dur]);
      fs.writeFileSync(path.join(o.out, s.name + '.png'), Buffer.from(d.split(',')[1], 'base64'));
      continue;
    }
    const file = path.join(o.out, s.file);
    if (fs.existsSync(file) && !o.force) { console.log(`${s.name}: cached`); continue; }
    const n = Math.round(s.dur * o.fps), t0 = Date.now();
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(o.fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < n; f++) {
      const d = await page.evaluate(([nm, t, T]) => window.render(nm, t, T), [s.name, f / o.fps, s.dur]);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) throw new Error(`ffmpeg failed for ${s.name}`);
    console.log(`${s.name}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
