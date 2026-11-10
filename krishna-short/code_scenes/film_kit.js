// film_kit.js - shared timeline machinery for the Mithila films (used by chhath_ghar.html): parallax camera
// layers, skies, paper, light effects, text overlays, ink-wipe transitions, grain and the frame renderer.
// The page defines SC (scene painters), OVER (overlays per shot) and calls startFilm(canvas, DEF).
// Timing (shots, subtitles, cues, total) comes from DEF, or from window.setTiming(json) before rendering.
'use strict';
const W = 1080, H = 1920;
let TM = null, SHOT_T0 = 0, FILM_CV = null;
const cue = (k, dflt) => (TM.cues && TM.cues[k] != null) ? TM.cues[k] - SHOT_T0 : dflt;
const XF = 0.8; // transition length

// ------------------------------------------------------------------ backgrounds and camera
const PAPERS = {};
function paper(name, base, seed) { if (!PAPERS[name]) PAPERS[name] = paperTexture(W, H, seed, base); return PAPERS[name]; }
function skyGrad(stops, y0 = 0, y1 = H) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(-300, y0 - 300, W + 600, y1 - y0 + 600); }
function paperOver(a = 0.5) { g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = a; g.drawImage(paper('cream', C.paper, 3), -300, -300, W + 600, H + 600); g.restore(); }
let CAM = { x: 540, y: 960, z: 1 };
// layer(k, fn): draw fn with parallax depth k under the shot camera (k=0 fixed, 1 = moves with the camera)
function layer(k, fn) {
  g.save(); const z = 1 + (CAM.z - 1) * k;
  g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-(W / 2 + (CAM.x - W / 2) * k), -(H / 2 + (CAM.y - H / 2) * k));
  fn(); g.restore();
}
function camPath(u, a, b) { const k = ease(u); CAM = { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), z: lerp(a[2], b[2], k) }; }
function lerp3(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = [16, 8, 0].map(s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k))); return `rgb(${c[0]},${c[1]},${c[2]})`; }
function stream(x0, y0, x1, y1, t, n = 40, col = '255,250,235') {
  for (let i = 0; i < n; i++) { const u = (t * 1.3 + i / n) % 1; const x = lerp(x0, x1, u), y = y0 + (y1 - y0) * u * u; g.fillStyle = `rgba(${col},${0.85 * (1 - u * 0.5)})`; g.beginPath(); g.arc(x + Math.sin(i * 3) * 3, y, 3.5 + 2 * Math.sin(i), 0, TAU); g.fill(); }
}
function lightBeams(x, y, t, a = 0.25, n = 9, spread = 1.2, len = 1600) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const ang = Math.PI / 2 + (i - (n - 1) / 2) * spread / n + Math.sin(t * 0.4 + i) * 0.02; const gr = g.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len); gr.addColorStop(0, `rgba(255,220,140,${a})`); gr.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang - 0.04) * len, y + Math.sin(ang - 0.04) * len); g.lineTo(x + Math.cos(ang + 0.04) * len, y + Math.sin(ang + 0.04) * len); g.fill(); }
  g.restore();
}
function sparkles(x, y, w, h, t, n, seed) { const r = R(seed); g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h - ((t * (20 + r() * 30)) % h), a = 0.5 + 0.5 * Math.sin(t * 3 + i); g.fillStyle = `rgba(255,220,140,${0.6 * a})`; g.beginPath(); g.arc(px, py < y ? py + h : py, 2 + r() * 3, 0, TAU); g.fill(); } g.restore(); }
function glow(x, y, r, rgba) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
// a figure standing in water: the water band covers it below the waterline
function inWater(fn, wl, t, col = C.blue) { fn(); g.save(); waterBand(wl, H + 400, t, col, { a: 0.75 }); g.restore(); }

// ------------------------------------------------------------------ overlays (screen space)
function tx(text, x, y, font, fill, o = {}) {
  g.save(); g.font = font; g.textAlign = o.align || 'center'; g.textBaseline = 'alphabetic'; g.globalAlpha = o.a ?? 1;
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 30; }
  if (o.stroke) { g.lineWidth = o.sw || 10; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(text, x, y); }
  g.shadowBlur = 0; g.fillStyle = fill; g.fillText(text, x, y); g.restore();
}
function rule(x, y, w, a) { g.save(); g.globalAlpha = a; g.strokeStyle = '#e8c070'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke(); g.fillStyle = '#e8c070'; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); g.restore(); }
function topScrim(a, h = 560) { g.save(); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(20,8,6,${0.62 * a})`); gr.addColorStop(1, 'rgba(20,8,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, h); g.restore(); }
function botScrim(a, h = 560) { g.save(); const gr = g.createLinearGradient(0, H - h, 0, H); gr.addColorStop(0, 'rgba(20,8,6,0)'); gr.addColorStop(1, `rgba(20,8,6,${0.7 * a})`); g.fillStyle = gr; g.fillRect(0, H - h, W, h); g.restore(); }
function chapter(u, T, small, big, o = {}) {
  const a = ease(u / 0.7) * (1 - ease((u - T + 0.6) / 0.5)); if (a <= 0) return;
  topScrim(a); tx(small, 540, 262, '36px NotoDeva', '#f2d48a', { a, stroke: 'rgba(20,8,6,0.6)', sw: 6 }); rule(540, 288, 320 * ease(u / 0.9), a);
  if (big) tx(big, 540, 380, (o.size || 84) + 'px Tiro', '#fff4dc', { a, stroke: 'rgba(30,10,6,0.85)', sw: 10, glow: 'rgba(255,190,90,0.6)', blur: 24 });
}
function place(u, T, text, sub, y = 1270) {
  const a = ease((u - 0.9) / 0.6) * (1 - ease((u - T + 0.7) / 0.5)); if (a <= 0) return;
  const x = 70 + (1 - ease((u - 0.9) / 0.6)) * -30;
  g.save(); g.globalAlpha = a; g.fillStyle = '#e8c070'; g.fillRect(x, y, 6, sub ? 92 : 56); g.restore();
  tx(text, x + 24, y + 46, '44px NotoDeva', '#fff4dc', { a, align: 'left', stroke: 'rgba(20,8,6,0.75)', sw: 8 });
  if (sub) tx(sub, x + 24, y + 88, '30px NotoDeva', '#f2d48a', { a, align: 'left', stroke: 'rgba(20,8,6,0.75)', sw: 6 });
}
function wrap(text, maxW) { const words = text.split(' '), out = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; }
function subtitle(t) {
  const s = TM.subs.find(([a, b]) => t >= a && t < b); if (!s) return;
  const [a, b, text] = s, al = ease((t - a) / 0.25) * (1 - ease((t - b + 0.25) / 0.25));
  g.save(); g.font = '44px NotoDeva'; const lines = wrap(text, 920), y0 = TM.subY || 1590;
  lines.forEach((ln, i) => tx(ln, 540, y0 + i * 58 - (lines.length - 1) * 29, '44px NotoDeva', '#ffffff', { a: al, stroke: 'rgba(0,0,0,0.78)', sw: 10 }));
  g.restore();
}
function dayCard(u, T, n, name, date, desc) {
  const a = ease(u / 0.35) * (1 - ease((u - T + 0.35) / 0.3)); if (a <= 0) return;
  topScrim(a, 640); const pop = 0.8 + 0.2 * easeOut(u / 0.4);
  tx(n, 540, 250, '40px NotoDeva', '#f2d48a', { a, stroke: 'rgba(20,8,6,0.6)', sw: 6 }); rule(540, 278, 260, a);
  g.save(); g.translate(540, 400); g.scale(pop, pop); tx(name, 0, 0, '120px "Yatra One"', '#ffd34d', { a, stroke: '#5a0a06', sw: 14, glow: 'rgba(255,160,40,0.8)', blur: 30 }); g.restore();
  tx(date, 540, 476, '48px Tiro', '#fff4dc', { a, stroke: 'rgba(20,8,6,0.8)', sw: 8 });
  if (desc) { botScrim(a); tx(desc, 540, 1600, '46px NotoDeva', '#ffffff', { a: a * ease((u - 0.4) / 0.4), stroke: 'rgba(0,0,0,0.75)', sw: 9 }); }
}

// ------------------------------------------------------------------ transitions, grain, frame
const GRAIN = Array.from({ length: 4 }, (_, k) => { const c2 = document.createElement('canvas'); c2.width = 540; c2.height = 960; const x = c2.getContext('2d'), im = x.createImageData(540, 960), r = R(k + 11); for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c2; });
function inkWipe(p, seed, cx, cy) {
  const r = R(seed), ph = [r() * 6, r() * 6, r() * 6], Rm = Math.hypot(W, H) * 0.75 * easeOut(p);
  g.beginPath();
  for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU, rr = Rm * (1 + 0.12 * Math.sin(5 * a + ph[0]) + 0.07 * Math.sin(11 * a + ph[1]) + 0.04 * Math.sin(23 * a + ph[2])); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}
function drawShot(i, t) {
  const [id, a, b] = TM.shots[i], u = t - a; SHOT_T0 = a;
  const dd = (TM.fast || []).includes(id) ? 0.7 : Math.min(1.3, 0.25 * (b - a));   // how long the ink outlines take to draw on
  REVEAL.d = ease(u / dd); REVEAL.f = ease((u - dd * 0.35) / (dd * 0.7));
  g.save(); SC[id](u, b - a); g.restore(); REVEAL.d = 1; REVEAL.f = 1;
}
function renderFilm(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const S = TM.shots; let i = S.findIndex(([, a, b]) => t >= a && t < b); if (i < 0) i = S.length - 1;
  const [id, a, b] = S[i];
  const prev = i > 0 && t < a + XF / 2 ? i - 1 : -1;
  if (prev >= 0 && !(TM.cutsHard || []).includes(id)) {
    drawShot(prev, t); const p = (t - (a - XF / 2)) / XF, cx = W * (0.3 + 0.4 * ((i * 37) % 10) / 10);
    g.save(); inkWipe(p, i * 7 + 1, cx, H * 0.55); g.clip(); drawShot(i, t); g.restore();
    g.save(); inkWipe(p, i * 7 + 1, cx, H * 0.55); g.strokeStyle = `rgba(40,15,5,${0.5 * (1 - p)})`; g.lineWidth = 14; g.stroke(); g.restore();
  } else drawShot(i, t);
  SHOT_T0 = a; g.save(); OVER[id] && OVER[id](t - a, b - a); g.restore();
  subtitle(t);
  const fin = ease(t / 0.8), fout = 1 - ease((t - TM.total + 1.2) / 1.0);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,4,2,0.38)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.09; g.drawImage(GRAIN[Math.floor(t * 30) % 4], 0, 0, W, H); g.restore();
  if (fin < 1 || fout < 1) { g.fillStyle = `rgba(0,0,0,${1 - Math.min(fin, fout)})`; g.fillRect(0, 0, W, H); }
  return FILM_CV.toDataURL('image/jpeg', 0.93);
}
function startFilm(cv, def) {
  FILM_CV = cv; setCtx(cv.getContext('2d')); TM = def;
  window.render = (name, t) => renderFilm(t);
  window.setTiming = tm => { TM = { ...def, ...tm }; };
  Promise.all(['36px NotoDeva', '60px Tiro', '60px "Yatra One"'].map(f => document.fonts.load(f, 'छठ महापर्व'))).then(() => { paper('cream', C.paper, 3); window.ready = true; });
}
