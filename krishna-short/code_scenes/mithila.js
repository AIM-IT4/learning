// mithila.js - a small Mithila (Madhubani) painting kit for canvas 2D: ink outlines, patterned fills,
// profile figures with the classic large almond eye, saris, dhotis, crowns, halos, horses, fish, lotus,
// trees, temples and Chhath props (soop, daura, lota, diya, chulha). Everything is drawn in code.
// All drawing goes to the global context `g` (set with setCtx). Figures use local units: 1 unit ~ head size,
// origin at the feet, facing right; dir = -1 mirrors them.
'use strict';
let g = null;
function setCtx(ctx) { g = ctx; }
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
function R(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const nz = (t, k = 0) => Math.sin(t * 1.7 + k) * 0.5 + Math.sin(t * 3.1 + k * 2.3) * 0.3 + Math.sin(t * 5.3 + k * 1.7) * 0.2;

const C = {
  paper: '#f3e4c2', paper2: '#e9d3a4', ink: '#1b120e', red: '#c8231d', vermilion: '#e0442a', yellow: '#f2b705',
  turmeric: '#f6c845', orange: '#ef7d1a', pink: '#e8608a', rose: '#f39bb5', green: '#2e8b57', leaf: '#4f9a3a',
  indigo: '#26357a', blue: '#2f6fb0', sky: '#7cc0e3', maroon: '#7a1e1e', gold: '#d9a520', cream: '#fbf1da',
  skin: '#eab27a', skinD: '#cf8f55', skinBlue: '#5b8fd6', white: '#fbf4e4', saffron: '#f08a24', grey: '#8a8a8a',
};

// draw-on reveal: REVEAL.d (0..1) controls how much of each outline is drawn, REVEAL.f the opacity of fills
const REVEAL = { d: 1, f: 1 };
function inkStroke(w = 3, col = C.ink) {
  g.lineWidth = w; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'round';
  if (REVEAL.d < 0.999) g.setLineDash([2600 * REVEAL.d + 0.01, 2600]); g.stroke(); g.setLineDash([]);
}
function fillA(col) { g.fillStyle = col; const a = g.globalAlpha; g.globalAlpha = a * REVEAL.f; g.fill(); g.globalAlpha = a; }
// fill a path, overlay a pattern inside it, then outline it (Mithila "bharni" style)
function shape(path, col, o = {}) {
  g.beginPath(); path(); if (col) fillA(col);
  if (o.pattern && REVEAL.f > 0.01) { g.save(); g.beginPath(); path(); g.clip(); g.globalAlpha *= REVEAL.f; o.pattern(); g.restore(); }
  if (o.ink !== false) { g.beginPath(); path(); inkStroke(o.w ?? 0.045 * (o.u || 1), o.inkCol); }
}
// patterns (drawn in the current transform, inside a clip)
function patDots(col, step, r, x0 = -6, y0 = -10, x1 = 6, y1 = 2) {
  g.fillStyle = col; let k = 0;
  for (let y = y0; y < y1; y += step, k++) for (let x = x0 + (k % 2) * step / 2; x < x1; x += step) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
}
function patLines(col, step, w, angle = 0.8, span = 14) {
  g.strokeStyle = col; g.lineWidth = w; g.save(); g.rotate(angle);
  for (let x = -span; x < span; x += step) { g.beginPath(); g.moveTo(x, -span); g.lineTo(x, span); g.stroke(); }
  g.restore();
}
function patScales(col, step, w, x0 = -6, y0 = -10, x1 = 6, y1 = 2) {
  g.strokeStyle = col; g.lineWidth = w; let k = 0;
  for (let y = y0; y < y1; y += step * 0.6, k++) for (let x = x0 + (k % 2) * step / 2; x < x1; x += step) { g.beginPath(); g.arc(x, y, step / 2, 0, Math.PI); g.stroke(); }
}
function patFlowers(col, step, r, seed = 1, x0 = -6, y0 = -10, x1 = 6, y1 = 2) {
  g.fillStyle = col;
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.55, 0, TAU); g.fill(); }
  }
}
function zigzagBand(x0, x1, y, h, col, step) {
  g.beginPath(); g.moveTo(x0, y);
  for (let x = x0, k = 0; x <= x1; x += step / 2, k++) g.lineTo(x, y + (k % 2 ? -h : 0));
  g.strokeStyle = col; g.lineWidth = h * 0.35; g.stroke();
}

// ------------------------------------------------------------------ paper, frames, text helpers
function paperTexture(w, h, seed = 3, base = C.paper) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); const r = R(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 260; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,80,30' : '255,250,235'},${0.03 + r() * 0.06})`; x.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(110,70,30,${0.03 + r() * 0.05})`; x.lineWidth = 0.6 + r(); x.beginPath(); const sx = r() * w, sy = r() * h; x.moveTo(sx, sy); x.quadraticCurveTo(sx + (r() - 0.5) * 60, sy + (r() - 0.5) * 60, sx + (r() - 0.5) * 120, sy + (r() - 0.5) * 120); x.stroke(); }
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(80,45,15,0.28)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  return cv;
}

// ------------------------------------------------------------------ figure parts
function limb(ax, ay, bx, by, wa, wb, col) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  shape(() => {
    g.moveTo(ax + nx * wa, ay + ny * wa); g.lineTo(bx + nx * wb, by + ny * wb); g.arc(bx, by, wb, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    g.lineTo(ax - nx * wa, ay - ny * wa); g.arc(ax, ay, wa, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  }, col, { w: 0.04 });
}
function bangles(x, y, ang, w, cols) {
  cols.forEach((c, i) => {
    const px = x - Math.cos(ang) * (0.07 + i * 0.07), py = y - Math.sin(ang) * (0.07 + i * 0.07), nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
    g.beginPath(); g.moveTo(px + nx, py + ny); g.lineTo(px - nx, py - ny); g.lineWidth = 0.06; g.strokeStyle = c; g.globalAlpha *= REVEAL.f; g.stroke(); g.globalAlpha /= Math.max(REVEAL.f, 0.001);
  });
}
function arm(sh, el, ha, skin, o = {}) {
  limb(sh[0], sh[1], el[0], el[1], 0.17, 0.13, skin);
  limb(el[0], el[1], ha[0], ha[1], 0.13, 0.1, skin);
  const ang = Math.atan2(ha[1] - el[1], ha[0] - el[0]);
  if (o.bangles !== false) bangles(ha[0], ha[1], ang, 0.12, o.bangleCols || [C.red, C.green, C.red, C.gold]);
  // hand
  g.save(); g.translate(ha[0], ha[1]); g.rotate(ang);
  shape(() => { g.moveTo(0, -0.1); g.quadraticCurveTo(0.26, -0.14, 0.32, 0); g.quadraticCurveTo(0.26, 0.12, 0, 0.1); g.closePath(); }, skin, { w: 0.035 });
  if (o.alta !== false) { g.fillStyle = C.red; g.globalAlpha *= REVEAL.f; g.beginPath(); g.arc(0.14, 0, 0.045, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.restore();
}
function eye(x, y, k = 1) {
  shape(() => { g.moveTo(x - 0.2 * k, y); g.quadraticCurveTo(x, y - 0.15 * k, x + 0.21 * k, y - 0.01 * k); g.quadraticCurveTo(x, y + 0.11 * k, x - 0.2 * k, y); }, C.white, { w: 0.035 });
  g.beginPath(); g.arc(x + 0.06 * k, y - 0.02 * k, 0.06 * k, 0, TAU); fillA(C.ink);
  g.beginPath(); g.moveTo(x - 0.2 * k, y - 0.12 * k); g.quadraticCurveTo(x, y - 0.27 * k, x + 0.17 * k, y - 0.14 * k); inkStroke(0.035);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 0.12 * k + i * 0.1 * k, y - 0.09 * k); g.lineTo(x - 0.14 * k + i * 0.1 * k, y - 0.15 * k); inkStroke(0.02); }
}
function profileFace(skin) {
  return () => {
    g.moveTo(0.42, -7.28); g.quadraticCurveTo(0.62, -7.15, 0.66, -6.95); g.quadraticCurveTo(0.78, -6.78, 1.0, -6.6);
    g.lineTo(0.78, -6.53); g.quadraticCurveTo(0.85, -6.47, 0.8, -6.42); g.lineTo(0.73, -6.4); g.quadraticCurveTo(0.82, -6.35, 0.76, -6.28);
    g.quadraticCurveTo(0.72, -6.12, 0.55, -6.1); g.quadraticCurveTo(0.35, -6.06, 0.22, -6.18); g.lineTo(-0.15, -6.25);
    g.quadraticCurveTo(-0.38, -6.55, -0.32, -6.95); g.quadraticCurveTo(-0.1, -7.42, 0.42, -7.28);
  };
}
function head(o) {
  const skin = o.skin || C.skin;
  // halo for the divine
  if (o.halo) {
    g.save(); g.translate(0.15, -6.75); g.rotate((o.t || 0) * 0.3);
    for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * TAU); shape(() => { g.moveTo(-0.12, -1.25); g.lineTo(0, -1.75 - (i % 2) * 0.2); g.lineTo(0.12, -1.25); g.closePath(); }, i % 2 ? C.red : C.yellow, { w: 0.03 }); g.restore(); }
    g.restore();
    shape(() => g.arc(0.15, -6.75, 1.25, 0, TAU), o.haloCol || C.turmeric, { w: 0.05, pattern: () => patDots(C.orange, 0.32, 0.05, -2, -9, 2, -4) });
    shape(() => g.arc(0.15, -6.75, 1.0, 0, TAU), C.yellow, { w: 0.04 });
  }
  // back hair / bun
  const male = o.kind === 'man' || o.kind === 'king';
  if (o.hair !== false && o.kind !== 'rishi' && !male) {
    shape(() => g.arc(-0.62, -6.62, 0.3, 0, TAU), C.ink, { w: 0.03 });
    if (o.kind === 'woman' || o.kind === 'goddess') for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(-0.62 + Math.cos(a) * 0.22, -6.62 + Math.sin(a) * 0.22, 0.07, 0, TAU); fillA(i % 2 ? C.white : C.yellow); }
  }
  shape(profileFace(skin), skin, { w: 0.045 });
  // hair cap
  if (o.kind === 'rishi') {
    shape(() => { g.ellipse(-0.05, -7.55, 0.42, 0.32, -0.2, 0, TAU); }, C.white, { w: 0.04, pattern: () => patLines('rgba(0,0,0,0.25)', 0.12, 0.02, 0.4) });
    shape(() => { g.moveTo(0.42, -7.28); g.quadraticCurveTo(0.0, -7.55, -0.32, -7.0); g.lineTo(-0.36, -6.4); g.quadraticCurveTo(-0.15, -6.9, 0.05, -7.05); g.quadraticCurveTo(0.2, -7.2, 0.42, -7.28); }, C.white, { w: 0.035 });
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0.38 + i * 0.04, -7.18 + i * 0.06); g.lineTo(0.62, -7.12 + i * 0.06); g.lineWidth = 0.035; g.strokeStyle = C.white; g.stroke(); }
    g.beginPath(); g.arc(0.58, -7.05, 0.04, 0, TAU); fillA(C.red);
  } else if (o.hair !== false) {
    shape(() => { g.moveTo(0.44, -7.3); g.quadraticCurveTo(0.1, -7.58, -0.35, -7.32); g.quadraticCurveTo(-0.62, -7.0, -0.5, -6.55); g.lineTo(-0.16, -6.3); g.quadraticCurveTo(-0.05, -6.72, 0.05, -6.96); g.quadraticCurveTo(0.2, -7.16, 0.44, -7.3); }, C.ink, { w: 0.03 });
  }
  if (o.kind === 'woman' || o.kind === 'goddess') { g.beginPath(); g.moveTo(0.4, -7.3); g.quadraticCurveTo(0.25, -7.45, 0.05, -7.5); g.lineWidth = 0.06; g.strokeStyle = C.red; g.globalAlpha *= REVEAL.f; g.stroke(); g.globalAlpha = 1; }
  eye(0.5, -6.86);
  // ear and earrings
  shape(() => g.ellipse(0.05, -6.68, 0.09, 0.15, 0, 0, TAU), skin, { w: 0.03 });
  const big = o.kundal;
  shape(() => g.arc(0.05, -6.42, big ? 0.17 : 0.09, 0, TAU), C.gold, { w: 0.03, pattern: big ? () => patDots(C.red, 0.1, 0.025, -0.2, -6.6, 0.3, -6.2) : null });
  if (big) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0.05, -6.42, 0, 0.05, -6.42, 0.6); gr.addColorStop(0, `rgba(255,220,120,${0.6 * (0.7 + 0.3 * Math.sin((o.t || 0) * 4))})`); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(-0.6, -7.1, 1.3, 1.3); g.restore(); }
  if (o.kind === 'woman' || o.kind === 'goddess') {
    g.beginPath(); g.arc(0.6, -7.03, 0.045, 0, TAU); fillA(C.red);
    g.beginPath(); g.arc(0.9, -6.53, 0.09, -2.4, 2.0); inkStroke(0.03, C.gold);
  }
  if (o.mustache) { shape(() => { g.moveTo(0.82, -6.49); g.quadraticCurveTo(0.66, -6.4, 0.46, -6.44); g.quadraticCurveTo(0.36, -6.47, 0.38, -6.58); g.quadraticCurveTo(0.44, -6.5, 0.54, -6.5); g.quadraticCurveTo(0.68, -6.5, 0.82, -6.49); }, C.ink, { w: 0.02 }); }
  if (male && o.hair !== false) { shape(() => { g.moveTo(-0.15, -6.25); g.quadraticCurveTo(-0.45, -6.15, -0.42, -5.9); g.quadraticCurveTo(-0.3, -6.0, -0.12, -6.1); g.closePath(); }, C.ink, { w: 0.02 }); }
  if (o.beard) { shape(() => { g.moveTo(0.72, -6.3); g.quadraticCurveTo(0.95, -5.6, 0.55, -4.9); g.quadraticCurveTo(0.25, -5.2, -0.05, -6.2); g.quadraticCurveTo(0.3, -6.05, 0.72, -6.3); }, C.white, { w: 0.035, pattern: () => patLines('rgba(0,0,0,0.22)', 0.1, 0.018, 0.3) }); }
  if (o.tilak) { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0.4 + i * 0.03, -7.12 + i * 0.05); g.lineTo(0.62, -7.06 + i * 0.05); g.lineWidth = 0.025; g.strokeStyle = i === 1 ? C.red : C.white; g.globalAlpha *= REVEAL.f; g.stroke(); g.globalAlpha = 1; } }
  if (o.crown) {
    shape(() => { g.moveTo(-0.35, -7.22); g.lineTo(0.5, -7.25); g.lineTo(0.38, -8.2); g.quadraticCurveTo(0.1, -8.75, -0.05, -8.2); g.lineTo(-0.35, -7.22); }, C.gold, { w: 0.04, pattern: () => { patDots(C.red, 0.18, 0.045, -0.5, -8.6, 0.6, -7.2); } });
    shape(() => { g.rect(-0.38, -7.38, 0.9, 0.16); }, C.red, { w: 0.03 });
    shape(() => { g.arc(0.08, -8.55, 0.11, 0, TAU); }, C.red, { w: 0.03 });
    for (let i = 0; i < 3; i++) { shape(() => { g.moveTo(0.05 + i * 0.12, -8.3 + i * 0.25); g.quadraticCurveTo(0.4 + i * 0.1, -8.6 + i * 0.25, 0.3 + i * 0.1, -8.1 + i * 0.25); }, C.green, { w: 0.02 }); }
  }
  if (o.ghunghat) {
    shape(() => { g.moveTo(0.46, -7.34); g.quadraticCurveTo(0.12, -7.72, -0.45, -7.4); g.quadraticCurveTo(-0.92, -6.9, -0.78, -6.15); g.lineTo(-0.42, -5.62); g.lineTo(-0.12, -5.9); g.quadraticCurveTo(-0.35, -6.5, -0.12, -7.0); g.quadraticCurveTo(0.12, -7.28, 0.46, -7.34); }, o.sari, { w: 0.04, pattern: () => patDots(o.sari2 || C.gold, 0.28, 0.04, -1.2, -8, 0.6, -5.4) });
    g.beginPath(); g.moveTo(0.46, -7.34); g.quadraticCurveTo(0.12, -7.6, -0.3, -7.42); inkStroke(0.09, o.border || C.gold);
  }
}
// standing figure. o: {kind:'woman'|'man'|'rishi'|'king'|'goddess', sari, sari2, border, blouse, dhoti, skin, pose:{near:[el,ha], far:[el,ha]}, crown, halo, ...}
const POSES = {
  stand: { near: [[0.35, -4.3], [0.55, -3.2]], far: [[-0.2, -4.3], [0.0, -3.2]] },
  arghya: { near: [[1.3, -6.1], [1.75, -7.25]], far: [[1.05, -6.3], [1.5, -7.4]] },
  pour: { near: [[1.3, -5.8], [2.15, -6.5]], far: [[1.1, -5.95], [1.95, -6.65]] },
  namaste: { near: [[0.6, -4.45], [1.0, -5.2]], far: [[0.4, -4.5], [0.98, -5.25]] },
  hold: { near: [[0.55, -4.3], [1.15, -4.75]], far: [[0.3, -4.5], [1.05, -4.95]] },
  bless: { near: [[0.8, -4.6], [1.05, -5.6]], far: [[0.1, -4.4], [0.65, -4.05]] },
  carry: { near: [[0.95, -6.35], [0.6, -7.75]], far: [[-0.2, -4.3], [0.05, -3.2]] },
  bow: { near: [[0.85, -4.6], [1.25, -5.0]], far: [[0.3, -4.3], [0.6, -3.5]] },
};
function figure(x, y, s, o, t = 0) {
  const dir = o.dir || 1, skin = o.skin || C.skin, pose = typeof o.pose === 'string' ? POSES[o.pose] : (o.pose || POSES.stand);
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const br = Math.sin(t * 1.4 + (o.seed || 0)) * 0.03; // breathing / sway
  g.rotate(br * 0.02);
  const shN = [0.25, -5.55], shF = [-0.15, -5.6];
  // far arm first
  arm(shF, pose.far[0], pose.far[1], o.armSkin || skin, o);
  const isWoman = o.kind === 'woman' || o.kind === 'goddess';
  if (isWoman) {
    // skirt
    shape(() => { g.moveTo(-0.45, -4.25); g.lineTo(0.55, -4.25); g.quadraticCurveTo(0.9, -2.0, 1.45, -0.15); g.lineTo(-1.15, -0.15); g.quadraticCurveTo(-0.75, -2.2, -0.45, -4.25); },
      o.sari, { pattern: () => { patDots(o.sari2 || C.gold, 0.34, 0.055, -1.5, -4.4, 1.6, 0); (o.motif || patNone)(); } });
    shape(() => { g.moveTo(-1.08, -0.5); g.lineTo(1.33, -0.5); g.lineTo(1.45, -0.15); g.lineTo(-1.15, -0.15); g.closePath(); }, o.border || C.gold, { w: 0.035, pattern: () => zigzagBand(-1.2, 1.5, -0.25, 0.12, C.red, 0.2) });
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0.42 + i * 0.03, -3.9); g.lineTo(0.55 + i * 0.22, -0.55); inkStroke(0.03); }
    // feet with alta
    shape(() => { g.moveTo(0.5, -0.17); g.lineTo(1.05, -0.1); g.quadraticCurveTo(1.12, 0.02, 0.95, 0.03); g.lineTo(0.5, 0.03); g.closePath(); }, skin, { w: 0.03 });
    g.beginPath(); g.moveTo(0.52, 0.02); g.lineTo(1.0, 0.02); g.lineWidth = 0.05; g.strokeStyle = C.red; g.stroke();
    // blouse + pallu
    shape(() => { g.moveTo(-0.35, -5.75); g.lineTo(0.55, -5.72); g.quadraticCurveTo(0.82, -5.3, 0.72, -4.9); g.quadraticCurveTo(0.52, -4.6, 0.52, -4.22); g.lineTo(-0.42, -4.2); g.quadraticCurveTo(-0.58, -5.0, -0.35, -5.75); }, o.blouse || C.red, {});
    shape(() => { g.moveTo(-0.38, -5.8); g.lineTo(0.18, -5.82); g.quadraticCurveTo(0.78, -4.9, 0.92, -3.85); g.lineTo(0.55, -3.7); g.quadraticCurveTo(0.2, -4.6, -0.48, -5.0); g.closePath(); },
      o.sari, { pattern: () => patDots(o.sari2 || C.gold, 0.3, 0.05, -1, -6, 1.2, -3.5) });
    g.beginPath(); g.moveTo(0.18, -5.82); g.quadraticCurveTo(0.78, -4.9, 0.92, -3.85); inkStroke(0.1, o.border || C.gold);
    if (!o.ghunghat) { shape(() => { g.moveTo(-0.36, -5.6); g.quadraticCurveTo(-1.0, -4.6, -1.25, -3.0); g.lineTo(-0.85, -3.1); g.quadraticCurveTo(-0.62, -4.3, -0.3, -5.0); }, o.sari, { pattern: () => patDots(o.sari2 || C.gold, 0.3, 0.05, -1.6, -6, 0, -2.8) }); }
  } else {
    // dhoti
    shape(() => { g.moveTo(-0.5, -4.15); g.lineTo(0.55, -4.15); g.lineTo(0.75, -1.8); g.lineTo(0.15, -1.6); g.lineTo(0.05, -2.6); g.lineTo(-0.1, -1.65); g.lineTo(-0.72, -1.8); g.closePath(); },
      o.dhoti || C.yellow, { pattern: () => patLines(o.dhoti2 || 'rgba(200,35,29,0.5)', 0.22, 0.04, 0.25) });
    g.beginPath(); g.moveTo(-0.72, -1.8); g.lineTo(-0.1, -1.65); g.moveTo(0.15, -1.6); g.lineTo(0.75, -1.8); inkStroke(0.09, o.border || C.red);
    limb(-0.35, -1.75, -0.32, -0.25, 0.14, 0.1, skin); limb(0.42, -1.75, 0.5, -0.25, 0.14, 0.1, skin);
    shape(() => { g.moveTo(-0.45, -0.3); g.lineTo(0.0, -0.22); g.quadraticCurveTo(0.08, -0.05, -0.05, -0.02); g.lineTo(-0.45, -0.02); g.closePath(); }, skin, { w: 0.03 });
    shape(() => { g.moveTo(0.38, -0.3); g.lineTo(0.85, -0.22); g.quadraticCurveTo(0.93, -0.05, 0.8, -0.02); g.lineTo(0.38, -0.02); g.closePath(); }, skin, { w: 0.03 });
    // torso
    shape(() => { g.moveTo(-0.45, -5.78); g.lineTo(0.6, -5.75); g.quadraticCurveTo(0.8, -5.2, 0.62, -4.7); g.lineTo(0.55, -4.12); g.lineTo(-0.5, -4.1); g.quadraticCurveTo(-0.65, -5.0, -0.45, -5.78); },
      o.kavach ? C.gold : skin, { pattern: o.kavach ? () => patScales(C.ink, 0.22, 0.02, -1, -6, 1, -4) : null });
    if (!o.kavach) { g.beginPath(); g.moveTo(-0.3, -5.75); g.quadraticCurveTo(0.2, -4.9, 0.5, -4.15); inkStroke(0.035, C.white); }
    if (o.uttariya) { shape(() => { g.moveTo(-0.45, -5.8); g.quadraticCurveTo(-0.9, -4.5, -1.05, -3.2); g.lineTo(-0.7, -3.25); g.quadraticCurveTo(-0.5, -4.6, -0.2, -5.4); }, o.uttariya, {}); }
    // necklace
    g.beginPath(); g.arc(0.18, -5.75, 0.38, 0.35, 2.6); inkStroke(0.06, C.gold);
  }
  // neck, head
  shape(() => { g.moveTo(0.1, -6.18); g.lineTo(0.42, -6.12); g.lineTo(0.42, -5.72); g.lineTo(0.0, -5.74); g.closePath(); }, skin, { w: 0.03 });
  if (isWoman) { g.beginPath(); g.arc(0.2, -5.82, 0.3, 0.3, 2.7); inkStroke(0.06, C.gold); for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(0.2 + Math.cos(0.4 + i * 0.33) * 0.32, -5.82 + Math.sin(0.4 + i * 0.33) * 0.32, 0.04, 0, TAU); fillA(C.red); } }
  head({ ...o, skin, t });
  // near arm on top
  arm(shN, pose.near[0], pose.near[1], o.armSkin || skin, o);
  g.restore();
  // hand position in world coordinates (for props)
  const hx = x + pose.near[1][0] * s * dir, hy = y + pose.near[1][1] * s, fx = x + pose.far[1][0] * s * dir, fy = y + pose.far[1][1] * s;
  return { hand: [hx, hy], far: [fx, fy], mid: [(hx + fx) / 2, (hy + fy) / 2] };
}
function patNone() {}

// ------------------------------------------------------------------ props
function soop(x, y, w, t, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot || 0); const u = w;
  const pop = o.pop || (() => 1);
  const items = [
    k => { for (let i = 0; i < 4; i++) shape(() => { g.save(); g.translate(-0.18 * u + i * 0.05 * u, -0.06 * u); g.rotate(-0.4 + i * 0.12); g.scale(k, k); g.moveTo(-0.13 * u, 0); g.quadraticCurveTo(0, -0.12 * u, 0.13 * u, 0); g.quadraticCurveTo(0, -0.05 * u, -0.13 * u, 0); g.restore(); }, C.yellow, { w: 0.006 * u }); },
    k => shape(() => g.ellipse(0.12 * u, -0.08 * u, 0.09 * u * k, 0.08 * u * k, 0, 0, TAU), '#7a4a2a', { w: 0.006 * u, pattern: () => patLines('rgba(240,200,140,0.5)', 0.03 * u, 0.005 * u, 0.3, u) }),
    k => shape(() => g.arc(-0.02 * u, -0.05 * u, 0.06 * u * k, 0, TAU), C.red, { w: 0.006 * u }),
    k => shape(() => g.arc(0.27 * u, -0.03 * u, 0.055 * u * k, 0, TAU), C.orange, { w: 0.006 * u }),
    k => shape(() => g.ellipse(-0.3 * u, -0.02 * u, 0.06 * u * k, 0.045 * u * k, 0, 0, TAU), '#c07a2a', { w: 0.006 * u, pattern: () => patLines('rgba(90,40,10,0.6)', 0.02 * u, 0.004 * u, 0, u) }),
    k => { for (const sx of [-0.4, 0.4]) { g.save(); g.translate(sx * u, 0); g.rotate(sx * 0.4); shape(() => g.rect(-0.012 * u, -0.5 * u * k, 0.024 * u, 0.5 * u * k), C.leaf, { w: 0.005 * u }); g.restore(); } },
  ];
  items.forEach((f, i) => { const k = pop(i); if (k > 0.01) f(k); });
  shape(() => { g.moveTo(-0.5 * u, 0); g.quadraticCurveTo(-0.5 * u, 0.32 * u, 0, 0.36 * u); g.quadraticCurveTo(0.5 * u, 0.32 * u, 0.5 * u, 0); g.quadraticCurveTo(0, 0.08 * u, -0.5 * u, 0); }, '#e2b25a',
    { w: 0.008 * u, pattern: () => { patLines('rgba(140,90,20,0.55)', 0.045 * u, 0.006 * u, 0.6, u); patLines('rgba(140,90,20,0.35)', 0.045 * u, 0.006 * u, -0.6, u); } });
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(i * 0.12 * u, 0.06 * u + Math.abs(i) * 0.005 * u, 0.012 * u, 0, TAU); fillA(C.red); }
  if (o.diya !== false) diya(0, 0.02 * u, 0.12 * u, t, o.seed || 1, true);
  g.restore();
}
function diya(x, y, w, t, seed = 0, lit = 1) {
  g.save(); g.translate(x, y);
  shape(() => { g.moveTo(-w / 2, 0); g.quadraticCurveTo(0, w * 0.55, w / 2, 0); g.quadraticCurveTo(w * 0.62, -w * 0.1, w * 0.68, -w * 0.12); g.quadraticCurveTo(w * 0.4, -w * 0.08, 0, -w * 0.06); g.quadraticCurveTo(-w * 0.4, -w * 0.06, -w / 2, 0); }, C.vermilion, { w: w * 0.06, pattern: () => patDots(C.yellow, w * 0.18, w * 0.03, -w, -w * 0.3, w, w) });
  if (!lit) { g.restore(); return; }
  const fl = 1 + 0.15 * nz(t * 6, seed), sw = nz(t * 4, seed + 2) * w * 0.05, fx = w * 0.62, fy = -w * 0.14;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(fx, fy - w * 0.3, 0, fx, fy - w * 0.3, w * 2.2); gr.addColorStop(0, `rgba(255,180,60,${0.55 * lit})`); gr.addColorStop(1, 'rgba(255,140,30,0)');
  g.fillStyle = gr; g.fillRect(fx - w * 2.2, fy - w * 2.5, w * 4.4, w * 4.4); g.restore();
  g.save(); g.globalAlpha = lit;
  shape(() => { g.moveTo(fx - w * 0.1, fy); g.quadraticCurveTo(fx - w * 0.14, fy - w * 0.3 * fl, fx + sw, fy - w * 0.6 * fl); g.quadraticCurveTo(fx + w * 0.14, fy - w * 0.3 * fl, fx + w * 0.1, fy); g.closePath(); }, C.yellow, { w: w * 0.04 });
  g.beginPath(); g.ellipse(fx, fy - w * 0.12, w * 0.04, w * 0.1, 0, 0, TAU); fillA(C.red); g.restore();
  g.restore();
}

function lota(x, y, w, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  shape(() => { g.moveTo(-w * 0.25, -w * 0.62); g.lineTo(w * 0.25, -w * 0.62); g.lineTo(w * 0.18, -w * 0.48); g.quadraticCurveTo(w * 0.55, -w * 0.3, w * 0.45, 0); g.quadraticCurveTo(0, w * 0.22, -w * 0.45, 0); g.quadraticCurveTo(-w * 0.55, -w * 0.3, -w * 0.18, -w * 0.48); g.closePath(); }, C.gold,
    { w: w * 0.05, pattern: () => { g.strokeStyle = 'rgba(120,70,0,0.6)'; g.lineWidth = w * 0.04; g.beginPath(); g.moveTo(-w, -w * 0.25); g.lineTo(w, -w * 0.25); g.stroke(); patDots(C.red, w * 0.16, w * 0.025, -w, -w * 0.2, w, w * 0.1); } });
  g.restore();
}
function daura(x, y, w, t) {
  g.save(); g.translate(x, y);
  shape(() => { g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w * 0.38, w * 0.32); g.lineTo(-w * 0.38, w * 0.32); g.closePath(); }, '#d9a43a', { w: w * 0.03, pattern: () => { patLines('rgba(120,70,10,0.55)', w * 0.06, w * 0.012, 0.0, w); patLines('rgba(120,70,10,0.45)', w * 0.06, w * 0.012, 1.57, w); } });
  for (let i = 0; i < 4; i++) shape(() => g.arc(-w * 0.3 + i * w * 0.2, -w * 0.05, w * 0.09, Math.PI, 0), [C.yellow, C.red, C.orange, '#7a4a2a'][i], { w: w * 0.02 });
  for (const sx of [-0.4, 0.4]) { g.save(); g.translate(sx * w, 0); shape(() => g.rect(-w * 0.02, -w * 0.5, w * 0.04, w * 0.5), C.leaf, { w: w * 0.01 }); g.restore(); }
  g.restore();
}
function sun(x, y, r, t, o = {}) {
  g.save(); g.translate(x, y);
  g.save(); g.rotate(t * 0.12);
  for (let i = 0; i < 28; i++) { g.save(); g.rotate(i / 28 * TAU); shape(() => { g.moveTo(-r * 0.11, -r * 1.02); g.lineTo(0, -r * (1.48 + (i % 2) * 0.16)); g.lineTo(r * 0.11, -r * 1.02); g.closePath(); }, i % 2 ? C.red : C.orange, { w: r * 0.018 }); g.restore(); }
  g.restore();
  if (o.glow !== false) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 3.2); gr.addColorStop(0, 'rgba(255,200,90,0.45)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.fillRect(-r * 3.2, -r * 3.2, r * 6.4, r * 6.4); g.restore(); }
  shape(() => g.arc(0, 0, r, 0, TAU), C.yellow, { w: r * 0.035 });
  shape(() => g.arc(0, 0, r * 0.88, 0, TAU), C.turmeric, { w: r * 0.02, pattern: () => patDots(C.orange, r * 0.14, r * 0.02, -r, -r, r, r) });
  if (o.face !== false) {
    g.save(); g.scale(r / 1.15, r / 1.15); g.translate(-0.5, 6.8);
    const ex = [[0.15, -7.0], [0.95, -7.0]];
    ex.forEach(([ex2, ey]) => eye(ex2, ey, 1.5));
    g.beginPath(); g.moveTo(0.55, -7.0); g.quadraticCurveTo(0.45, -6.55, 0.62, -6.5); inkStroke(0.05);
    shape(() => { g.moveTo(0.32, -6.15); g.quadraticCurveTo(0.55, -5.95, 0.78, -6.15); g.quadraticCurveTo(0.55, -6.07, 0.32, -6.15); }, C.red, { w: 0.03 });
    g.beginPath(); g.arc(-0.2, -6.4, 0.12, 0, TAU); fillA('rgba(214,40,28,0.45)'); g.beginPath(); g.arc(1.3, -6.4, 0.12, 0, TAU); fillA('rgba(214,40,28,0.45)');
    shape(() => { g.moveTo(0.55, -7.65); g.lineTo(0.47, -7.35); g.lineTo(0.63, -7.35); g.closePath(); }, C.red, { w: 0.02 });
    g.restore();
  }
  g.restore();
}
function mFish(x, y, s, rot, body, fin, t) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); const wig = Math.sin(t * 4 + x) * 0.08;
  shape(() => { g.moveTo(-1.5, 0); g.lineTo(-2.25, -0.62 + wig); g.quadraticCurveTo(-1.95, 0, -2.25, 0.62 + wig); g.closePath(); }, fin, { w: 0.06, pattern: () => patLines(C.ink, 0.16, 0.03, 0, 4) });
  shape(() => { g.moveTo(-1.6, 0); g.quadraticCurveTo(-0.3, -1.0, 1.1, -0.15); g.quadraticCurveTo(1.35, 0, 1.1, 0.15); g.quadraticCurveTo(-0.3, 1.0, -1.6, 0); }, body, { w: 0.07, pattern: () => patScales(C.ink, 0.36, 0.035, -1.6, -1, 1.2, 1) });
  shape(() => { g.moveTo(-0.3, -0.62); g.quadraticCurveTo(0, -1.12, 0.4, -0.55); g.closePath(); }, fin, { w: 0.05 });
  g.beginPath(); g.arc(0.72, -0.08, 0.2, 0, TAU); fillA(C.white); g.beginPath(); g.arc(0.72, -0.08, 0.2, 0, TAU); inkStroke(0.04);
  g.beginPath(); g.arc(0.77, -0.08, 0.1, 0, TAU); fillA(C.ink);
  g.restore();
}
function lotus(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shape(() => g.ellipse(0, 0.25, 1.4, 0.28, 0, 0, TAU), C.green, { w: 0.05 });
  const petal = (a, l, w2) => () => { g.save(); g.rotate(a); g.moveTo(0, 0); g.quadraticCurveTo(w2, -l * 0.5, 0, -l); g.quadraticCurveTo(-w2, -l * 0.5, 0, 0); g.restore(); };
  [[-1.0, 1.0, 0.4, '#e05a7a'], [1.0, 1.0, 0.4, '#e05a7a'], [-0.5, 1.3, 0.42, C.pink], [0.5, 1.3, 0.42, C.pink], [0, 1.5, 0.48, C.rose]].forEach(([a, l, w2, c]) => shape(petal(a, l, w2), c, { w: 0.05 }));
  g.restore();
}
function waterBand(y0, y1, t, col = C.blue, o = {}) {
  shape(() => g.rect(-200, y0, 1480, y1 - y0 + 400), col, { ink: false });
  g.strokeStyle = o.line || 'rgba(255,255,255,0.55)'; g.lineWidth = o.lw || 4;
  for (let yy = y0 + 22, k = 0; yy < y1 + 380; yy += o.gap || 34, k++) {
    g.beginPath(); for (let x = -100; x <= 1180; x += 24) g.lineTo(x, yy + Math.sin(x * 0.025 + t * 1.6 + k) * 7); g.globalAlpha = REVEAL.f * (o.a ?? 0.8); g.stroke(); g.globalAlpha = 1;
  }
}
function tree(x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); const r = R(o.seed || 3);
  shape(() => { g.moveTo(-0.25, 0); g.quadraticCurveTo(-0.1, -2.5, -0.15, -4.5); g.lineTo(0.15, -4.5); g.quadraticCurveTo(0.1, -2.5, 0.3, 0); g.closePath(); }, '#7a4a2a', { w: 0.05, pattern: () => patLines('rgba(0,0,0,0.3)', 0.12, 0.02, 0.2, 6) });
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36, L = 2.0 + r() * 0.8, bx = Math.cos(a) * L, by = -4.4 + Math.sin(a) * L;
    g.beginPath(); g.moveTo(0, -4.3); g.quadraticCurveTo(bx * 0.5, by + 0.5, bx, by); inkStroke(0.12, '#5a3420');
    for (let k = 0; k < 4; k++) { const lx = bx * (0.55 + k * 0.15), ly = by + 0.6 - k * 0.2 + Math.sin(t + i + k) * 0.03; shape(() => g.ellipse(lx, ly, 0.42, 0.18, a + 0.6 * (k % 2 ? 1 : -1), 0, TAU), k % 2 ? C.green : C.leaf, { w: 0.03, pattern: () => { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(lx - 0.4, ly); g.lineTo(lx + 0.4, ly); g.stroke(); } }); }
  }
  g.restore();
}
function bird(x, y, s, t, col = C.green, flap = true) {
  g.save(); g.translate(x, y); g.scale(s, s); const f = flap ? Math.sin(t * 8 + x) * 0.5 : 0;
  shape(() => { g.ellipse(0, 0, 0.6, 0.3, 0, 0, TAU); }, col, { w: 0.05 });
  shape(() => { g.moveTo(-0.1, -0.1); g.quadraticCurveTo(-0.4, -0.7 - f, -0.9, -0.5 - f * 1.2); g.quadraticCurveTo(-0.4, -0.2, -0.1, -0.1); }, C.yellow, { w: 0.04 });
  shape(() => g.arc(0.55, -0.15, 0.2, 0, TAU), col, { w: 0.04 });
  shape(() => { g.moveTo(0.72, -0.15); g.lineTo(0.95, -0.05); g.lineTo(0.72, -0.05); g.closePath(); }, C.red, { w: 0.03 });
  g.beginPath(); g.arc(0.6, -0.2, 0.05, 0, TAU); fillA(C.ink);
  shape(() => { g.moveTo(-0.55, 0); g.lineTo(-1.1, 0.25); g.lineTo(-1.0, -0.05); g.closePath(); }, C.red, { w: 0.03 });
  g.restore();
}
function horse(x, y, s, t, col, seed = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); const ph = t * 9 + seed, a = Math.sin(ph) * 0.45, b = Math.sin(ph + Math.PI) * 0.45;
  const leg = (lx, ly, ang, ang2) => { const kx = lx + Math.sin(ang) * 0.75, ky = ly + Math.cos(ang) * 0.75; limb(lx, ly, kx, ky, 0.12, 0.09, col); limb(kx, ky, kx + Math.sin(ang2) * 0.7, ky + Math.cos(ang2) * 0.7, 0.09, 0.07, col); };
  leg(-0.9, -1.6, b, b - 0.4); leg(0.9, -1.6, a, a + 0.5);
  shape(() => { g.moveTo(-1.3, -2.1); g.quadraticCurveTo(-2.0, -1.6, -2.2, -0.9); g.quadraticCurveTo(-1.7, -1.4, -1.25, -1.6); }, C.ink, { w: 0.03 });
  shape(() => g.ellipse(0, -2.0, 1.45, 0.62, 0, 0, TAU), col, { w: 0.06, pattern: () => { patDots(C.ink, 0.3, 0.05, -1.6, -2.7, 1.6, -1.3); } });
  shape(() => { g.moveTo(0.9, -2.3); g.quadraticCurveTo(1.25, -3.1, 1.55, -3.4); g.lineTo(2.2, -3.0); g.quadraticCurveTo(2.35, -2.75, 2.1, -2.7); g.lineTo(1.65, -2.85); g.quadraticCurveTo(1.45, -2.4, 1.3, -1.8); g.closePath(); }, col, { w: 0.06 });
  g.beginPath(); for (let i = 0; i < 7; i++) { const u = i / 6; g.lineTo(lerp(0.95, 1.5, u) - 0.15, lerp(-2.35, -3.4, u) - (i % 2 ? 0.25 : 0)); } inkStroke(0.08, C.red);
  shape(() => { g.moveTo(1.55, -3.4); g.lineTo(1.5, -3.75); g.lineTo(1.7, -3.45); g.closePath(); }, col, { w: 0.03 });
  g.beginPath(); g.arc(1.85, -3.05, 0.09, 0, TAU); fillA(C.white); g.beginPath(); g.arc(1.87, -3.05, 0.045, 0, TAU); fillA(C.ink);
  leg(-1.0, -1.6, a * 0.8, a - 0.3); leg(0.8, -1.6, b * 0.8, b + 0.6);
  g.beginPath(); g.moveTo(-1.2, -2.3); g.lineTo(1.0, -2.3); inkStroke(0.12, C.gold);
  g.restore();
}
function temple(x, y, s, t) {
  // Nagara-style shikhara temple (for the Deo Sun Temple), drawn flat in Mithila manner
  g.save(); g.translate(x, y); g.scale(s, s);
  shape(() => g.rect(-3.2, -0.6, 6.4, 0.6), C.maroon, { w: 0.05, pattern: () => patDots(C.yellow, 0.3, 0.05, -3.5, -0.7, 3.5, 0.1) });
  shape(() => g.rect(-2.6, -2.6, 5.2, 2.0), C.orange, { w: 0.05, pattern: () => patScales(C.ink, 0.4, 0.02, -2.8, -2.7, 2.8, -0.5) });
  shape(() => { g.moveTo(-0.6, -0.6); g.lineTo(-0.6, -1.7); g.quadraticCurveTo(0, -2.3, 0.6, -1.7); g.lineTo(0.6, -0.6); g.closePath(); }, C.ink, {});
  shape(() => { g.moveTo(-2.2, -2.6); g.quadraticCurveTo(-2.1, -6.5, -0.5, -8.6); g.lineTo(0.5, -8.6); g.quadraticCurveTo(2.1, -6.5, 2.2, -2.6); g.closePath(); }, C.vermilion,
    { w: 0.06, pattern: () => { for (let yy = -8.4; yy < -2.6; yy += 0.42) { g.strokeStyle = C.ink; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-3, yy); g.lineTo(3, yy); g.stroke(); } patDots(C.yellow, 0.4, 0.05, -2.4, -8.6, 2.4, -2.6); } });
  shape(() => g.ellipse(0, -8.8, 0.85, 0.28, 0, 0, TAU), C.yellow, { w: 0.05, pattern: () => patLines(C.ink, 0.12, 0.02, 1.57, 2) });
  shape(() => { g.moveTo(-0.25, -9.05); g.quadraticCurveTo(0, -9.6, 0.25, -9.05); g.closePath(); }, C.gold, { w: 0.04 });
  g.beginPath(); g.moveTo(0, -9.5); g.lineTo(0, -10.6); inkStroke(0.05);
  const fl = Math.sin(t * 3) * 0.1;
  shape(() => { g.moveTo(0, -10.6); g.quadraticCurveTo(0.7, -10.5 + fl, 1.1, -10.2 + fl); g.lineTo(0, -10.1); g.closePath(); }, C.saffron, { w: 0.03 });
  g.restore();
}
function chulha(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  shape(() => { g.moveTo(-1.2, 0); g.lineTo(-1.0, -1.2); g.lineTo(1.0, -1.2); g.lineTo(1.2, 0); g.closePath(); }, '#b8774a', { w: 0.05, pattern: () => patDots('rgba(90,40,10,0.35)', 0.25, 0.04, -1.3, -1.3, 1.3, 0) });
  shape(() => { g.moveTo(-0.45, 0); g.lineTo(-0.45, -0.55); g.quadraticCurveTo(0, -0.9, 0.45, -0.55); g.lineTo(0.45, 0); g.closePath(); }, '#2a1208', {});
  for (let i = 0; i < 3; i++) { const fl = 1 + 0.2 * nz(t * 7, i); shape(() => { g.moveTo(-0.3 + i * 0.3, -0.05); g.quadraticCurveTo(-0.35 + i * 0.3, -0.4 * fl, -0.25 + i * 0.3 + nz(t * 5, i) * 0.04, -0.62 * fl); g.quadraticCurveTo(-0.15 + i * 0.3, -0.35 * fl, -0.2 + i * 0.3, -0.05); g.closePath(); }, i === 1 ? C.yellow : C.orange, { w: 0.02 }); }
  g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, -0.4, 0, 0, -0.4, 1.6); gr.addColorStop(0, 'rgba(255,150,40,0.5)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.fillRect(-1.6, -2, 3.2, 3.2); g.restore();
  g.restore();
}
function steam(x, y, s, t, n = 3) {
  for (let k = 0; k < n; k++) {
    g.beginPath(); for (let i = 0; i <= 12; i++) { const u = i / 12; g.lineTo(x + (k - 1) * 18 * s + Math.sin(t * 2 + u * 5 + k) * 10 * s, y - u * 140 * s); }
    g.strokeStyle = `rgba(255,255,255,${0.35})`; g.lineWidth = 6 * s; g.lineCap = 'round'; g.stroke();
  }
}
function moon(x, y, r, sky) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, r, x, y, r * 3); gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); g.restore(); shape(() => { g.arc(x, y, r, 0, TAU); }, C.cream, { w: r * 0.05 }); g.beginPath(); g.arc(x + r * 0.42, y - r * 0.18, r * 0.82, 0, TAU); fillA(sky); }
function stars(n, seed, y1, t) { const r = R(seed); for (let i = 0; i < n; i++) { const x = r() * 1080, y = r() * y1, a = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i)); g.fillStyle = `rgba(255,240,200,${a})`; g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); } }
function ripplesAt(x, y, w, t) { g.strokeStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; g.lineWidth = 3; g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(x, y, w * (0.6 + k), w * 0.12 * (0.6 + k), 0, 0, TAU); g.stroke(); } g.globalAlpha = 1; }
