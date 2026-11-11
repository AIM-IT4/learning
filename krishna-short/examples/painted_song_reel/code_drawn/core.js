// core.js - drawing toolkit for the code-drawn music video (landscape 1920x1080): maths, camera, sky, clouds,
// grass, flowers, light, particles, paper strips. Everything is deterministic in t (seconds) so any frame can be
// rendered on its own.
'use strict';
const W = 1920, H = 1080, TAU = Math.PI * 2;
let g = null;                                    // current 2D context (scenes draw into offscreen canvases)
const setCtx = c => { g = c; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = u => { u = clamp(u); return 0.5 - 0.5 * Math.cos(Math.PI * u); };
const easeOut = u => { u = clamp(u); return 1 - (1 - u) ** 3; };
const easeIn = u => { u = clamp(u); return u * u * u; };
function R(seed) { let s = (Math.imul((seed | 0) + 0x9e3779b9, 2654435761) ^ 0x5bd1e995) >>> 0; const nx = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; for (let i = 0; i < 4; i++) nx(); return nx; }
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u); }
function rgba(hex, a = 1) { const p = parseInt(hex.slice(1), 16); return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`; }
function mix(h1, h2, k) { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const c = [16, 8, 0].map(s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, k))); return `rgb(${c[0]},${c[1]},${c[2]})`; }

// ------------------------------------------------------------------ camera with parallax layers
let CAM = { x: W / 2, y: H / 2, z: 1, r: 0 };
function cam(x, y, z, r = 0) { CAM = { x, y, z, r }; }
// layer(k, fn): draw in world space seen through the camera; k = depth factor (0 = fixed to screen, 1 = world)
function layer(k, fn) {
  g.save();
  const z = 1 + (CAM.z - 1) * k;
  g.translate(W / 2, H / 2); g.rotate(CAM.r * k); g.scale(z, z);
  g.translate(-(W / 2 + (CAM.x - W / 2) * k), -(H / 2 + (CAM.y - H / 2) * k));
  fn(); g.restore();
}

// ------------------------------------------------------------------ shapes
function path(pts, close = true) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); }
// smooth closed curve through points (Catmull-Rom as Beziers)
function smooth(pts, close = true, tension = 0.5) {
  const n = pts.length; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  const P = i => close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), k = tension / 3;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (close) g.closePath();
}
function ell(x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function fillEll(x, y, rx, ry, col, rot = 0) { ell(x, y, rx, ry, rot); g.fillStyle = col; g.fill(); }
// tapered capsule between two points (limbs, stems, ropes)
function limb(x1, y1, x2, y2, w1, w2, col) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
  g.beginPath();
  g.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2); g.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  g.arc(x2, y2, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  g.arc(x1, y1, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  g.closePath(); g.fillStyle = col; g.fill();
}
function lingrad(x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function radgrad(x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function glow(x, y, r, col, a = 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.fillStyle = radgrad(x, y, 0, r, [[0, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }

// ------------------------------------------------------------------ skies
function sky(stops, x0 = -800, y0 = -600, w = W + 1600, h = H + 1200) { g.fillStyle = lingrad(0, y0, 0, y0 + h, stops); g.fillRect(x0, y0, w, h); }
const GOLD_SKY = [[0, '#6f8fc4'], [0.32, '#e9b7a0'], [0.55, '#f8c98c'], [0.72, '#ffe0a3'], [1, '#fff0c8']];
const DUSK_SKY = [[0, '#3d4f8f'], [0.35, '#9b7fb0'], [0.6, '#f2a98a'], [0.8, '#ffc98f'], [1, '#ffe2b2']];
const NIGHT_SKY = [[0, '#070b1f'], [0.45, '#0f1a44'], [0.8, '#1d2c63'], [1, '#2c3a78']];
function sunDisc(x, y, r, t) {
  glow(x, y, r * 9, 'rgba(255,214,140,0.55)'); glow(x, y, r * 4, 'rgba(255,236,190,0.8)');
  fillEll(x, y, r, r, '#fff6dc');
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU + t * 0.03, L = r * (6 + 3 * noise1(i * 3.1 + t * 0.4));
    g.fillStyle = lingrad(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, [[0, 'rgba(255,230,170,0.16)'], [1, 'rgba(255,230,170,0)']]);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - 0.05) * L, y + Math.sin(a - 0.05) * L); g.lineTo(x + Math.cos(a + 0.05) * L, y + Math.sin(a + 0.05) * L); g.fill();
  }
  g.restore();
}
function stars(x0, y0, w, h, n, t, seed = 5, a = 1) {
  const r = R(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, s = 0.6 + r() * 2.2, ph = r() * TAU, f = 0.6 + r() * 2.5;
    const tw = 0.55 + 0.45 * Math.sin(t * f + ph);
    g.fillStyle = `rgba(255,250,235,${a * tw * (0.5 + 0.5 * r())})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    if (s > 2.2) { g.strokeStyle = `rgba(255,245,225,${a * tw * 0.5})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s * 4, y); g.lineTo(x + s * 4, y); g.moveTo(x, y - s * 4); g.lineTo(x, y + s * 4); g.stroke(); }
  }
  g.restore();
}
function milkyWay(x1, y1, x2, y2, t, a = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const r = R(91), n = 70;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = lerp(x1, x2, u) + (r() - 0.5) * 120, y = lerp(y1, y2, u) + (r() - 0.5) * 90, rr = 90 + r() * 140;
    g.fillStyle = radgrad(x, y, 0, rr, [[0, `rgba(${170 + r() * 60 | 0},${160 + r() * 50 | 0},255,${0.06 * a})`], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const r2 = R(17);
  for (let i = 0; i < 520; i++) {
    const u = r2(), x = lerp(x1, x2, u) + (r2() - 0.5) * 220 * (0.4 + r2()), y = lerp(y1, y2, u) + (r2() - 0.5) * 160 * (0.4 + r2());
    g.fillStyle = `rgba(255,248,235,${a * (0.25 + 0.6 * r2()) * (0.7 + 0.3 * Math.sin(t * 2 + i))})`; g.fillRect(x, y, 1.6, 1.6);
  }
  g.restore();
}
// a soft cumulus cloud from overlapping puffs, lit from (lx, ly)
function cloud(x, y, s, seed, t, o = {}) {
  const r = R(seed), puffs = [];
  const n = o.n || 9;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); puffs.push([(u - 0.5) * 2.4 + (r() - 0.5) * 0.3, -Math.sin(u * Math.PI) * (0.55 + r() * 0.35) + (r() - 0.5) * 0.15, 0.38 + r() * 0.32]); }
  const lit = o.lit || '#fff7e8', mid = o.mid || '#f7d9c4', dark = o.dark || '#d8a8a6', a = o.a ?? 1;
  g.save(); g.globalAlpha = a; g.translate(x + Math.sin(t * 0.13 + seed) * 6 * s / 100, y); g.scale(s, s);
  g.fillStyle = dark; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px, py + 0.12, pr, 0, TAU); g.fill(); }
  g.beginPath(); g.ellipse(0, 0.1, 1.35, 0.32, 0, 0, TAU); g.fill();
  g.fillStyle = mid; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px - 0.03, py + 0.03, pr * 0.93, 0, TAU); g.fill(); }
  g.fillStyle = lit; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px - 0.08, py - 0.06, pr * 0.72, 0, TAU); g.fill(); }
  g.restore();
}

// ------------------------------------------------------------------ ground: hills, grass, flowers
function hill(pts, col, y2 = H + 600) { g.beginPath(); g.moveTo(pts[0][0], y2); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[pts.length - 1][0], y2); g.closePath(); g.fillStyle = col; g.fill(); }
function hillCurve(x0, x1, yBase, amp, seed, col, y2 = H + 600) { const pts = []; for (let x = x0; x <= x1; x += 40) pts.push([x, yBase - amp * noise1(x / 420, seed) - amp * 0.4 * noise1(x / 150, seed + 3)]); hill(pts, col, y2); }
// blades of grass along a strip, swaying in the wind
function grass(x0, x1, y, n, t, seed, o = {}) {
  const r = R(seed), h0 = o.h || 90, cols = o.cols || ['#4d6b26', '#62832f', '#7a9b3a', '#93ad4b', '#3c5520'];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), hh = h0 * (0.5 + r() * 0.8), w = (o.w || 7) * (0.6 + r() * 0.8), c = cols[(r() * cols.length) | 0];
    const sway = Math.sin(t * (1.2 + r() * 0.6) + x * 0.01) * (o.wind ?? 0.18) + (o.lean ?? 0.05);
    const tipx = x + Math.sin(sway) * hh, tipy = y - Math.cos(sway) * hh;
    g.beginPath(); g.moveTo(x - w / 2, y + 4); g.quadraticCurveTo(x + Math.sin(sway) * hh * 0.4, y - hh * 0.5, tipx, tipy); g.quadraticCurveTo(x + Math.sin(sway) * hh * 0.4 + w * 0.3, y - hh * 0.5, x + w / 2, y + 4); g.closePath();
    g.fillStyle = c; g.fill();
    if (o.rim && r() < 0.5) { g.strokeStyle = o.rim; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + w / 2, y); g.quadraticCurveTo(x + Math.sin(sway) * hh * 0.4 + w * 0.3, y - hh * 0.5, tipx, tipy); g.stroke(); }
  }
}
function daisy(x, y, s, petals = 12, rot = 0, o = {}) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const total = o.total || 12;
  for (let i = 0; i < total; i++) {
    if (i >= petals) continue;
    const a = i / total * TAU;
    g.save(); g.rotate(a); fillEll(0, -15, 4.2, 12, o.petal || '#fbf8f0'); g.strokeStyle = 'rgba(190,180,160,0.5)'; g.lineWidth = 0.8; g.stroke(); g.restore();
  }
  fillEll(0, 0, 7.5, 7.5, '#f2b928'); fillEll(-1.5, -1.5, 4, 4, '#ffd65a');
  g.restore();
}
function wildflowers(x0, x1, y0, y1, n, t, seed) {
  const r = R(seed), cols = ['#ffffff', '#f6d24a', '#e98bb0', '#b9a3e8', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 0.35 + r() * 0.6, c = cols[(r() * cols.length) | 0], sw = Math.sin(t * 1.4 + i) * 3;
    g.strokeStyle = '#4d6b26'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x, y + 30 * s); g.quadraticCurveTo(x + sw * 0.5, y + 15 * s, x + sw, y); g.stroke();
    if (c === '#ffffff') daisy(x + sw, y, s * 0.55, 12, i); else { fillEll(x + sw, y, 6 * s, 6 * s, c); fillEll(x + sw, y, 2.5 * s, 2.5 * s, '#f7e08a'); }
  }
}

// ------------------------------------------------------------------ particles (screen or world space)
function petals(t, n, seed, o = {}) {
  const r = R(seed), x0 = o.x0 ?? -100, x1 = o.x1 ?? W + 100, y0 = o.y0 ?? -100, y1 = o.y1 ?? H + 100;
  for (let i = 0; i < n; i++) {
    const vx = (o.vx ?? 60) * (0.5 + r()), vy = (o.vy ?? -40) * (0.5 + r()), px = r(), py = r(), sz = (o.size || 12) * (0.6 + r() * 0.8), sp = r() * 6;
    let x = x0 + ((px * (x1 - x0) + vx * t + 40 * Math.sin(t * 1.3 + i)) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
    let y = y0 + ((py * (y1 - y0) + vy * t) % (y1 - y0) + (y1 - y0)) % (y1 - y0);
    g.save(); g.translate(x, y); g.rotate(sp + t * (1 + r())); g.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
    fillEll(0, 0, sz, sz * 0.42, o.col || 'rgba(255,250,242,0.95)'); g.restore();
  }
}
function motes(t, n, seed, o = {}) {
  const r = R(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = ((r() * W + (o.vx ?? 8) * t * (0.5 + r())) % W + W) % W, y = ((r() * H - (o.vy ?? 14) * t * (0.5 + r())) % H + H) % H, s = 1.5 + r() * 3.5;
    const a = (o.a ?? 0.7) * (0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + r()) + i)));
    g.fillStyle = radgrad(x, y, 0, s * 3, [[0, `rgba(255,226,160,${a})`], [1, 'rgba(255,200,120,0)']]); g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  }
  g.restore();
}
function fireflies(t, n, seed, box) {
  const r = R(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const cx = box[0] + r() * box[2], cy = box[1] + r() * box[3], x = cx + 40 * Math.sin(t * 0.7 + i * 2), y = cy + 30 * Math.sin(t * 0.9 + i);
    const a = Math.max(0, Math.sin(t * 2 + i * 1.7)); glow(x, y, 18, `rgba(255,236,150,${0.8 * a})`);
  }
  g.restore();
}

// ------------------------------------------------------------------ torn paper strip with a lyric (screen space)
function lyricStrip(text, x, y, rot, size, seed, a = 1, sc = 1) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
  g.font = `700 ${size}px NotoDevaBold`; const tw = g.measureText(text).width, w = tw + size * 1.2, h = size * 1.75;
  const r = R(seed), pts = [];
  for (let i = 0; i <= 16; i++) pts.push([-w / 2 + i / 16 * w, -h / 2 + r() * 3]);
  for (let i = 1; i <= 6; i++) pts.push([w / 2 - r() * 10, -h / 2 + i / 6 * h]);
  for (let i = 16; i >= 0; i--) pts.push([-w / 2 + i / 16 * w, h / 2 - r() * 3]);
  for (let i = 5; i >= 1; i--) pts.push([-w / 2 + r() * 10, -h / 2 + i / 6 * h]);
  g.save(); g.translate(7, 9); path(pts); g.fillStyle = 'rgba(30,20,10,0.35)'; g.filter = 'blur(6px)'; g.fill(); g.restore();
  g.filter = 'none'; path(pts); g.fillStyle = '#f6f2e8'; g.fill();
  g.fillStyle = '#1f1a17'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, size * 0.06);
  g.restore();
}
