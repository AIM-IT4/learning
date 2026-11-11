// scenes.js - the scene painters. SC.name(t, T, v): draw the scene at time t of a T-second shot (v = variant).
'use strict';
const SC = {};
const BPS = 123.05 / 60;                       // beats per second, for things that pulse with the song
const beatPulse = (t, off = 0) => Math.exp(-((t * BPS + off) % 1) * 5);

// ---------------------------------------------------------------- 1. the hill: Kabir in the grass with a daisy
function kabirLying(t, o = {}) {
  const [sk] = SKIN.kabir;
  // legs: one knee up
  limb(760, 650, 560, 520, 66, 58, TROUSER); limb(560, 520, 420, 640, 58, 50, TROUSER); fillEll(395, 652, 46, 22, '#3b2e28', -0.3);
  limb(770, 670, 420, 690, 66, 54, '#262b37'); fillEll(392, 690, 44, 20, '#3b2e28');
  // torso lying on its back: jacket and tee
  smooth([[780, 700], [770, 620], [840, 585], [1000, 565], [1110, 572], [1150, 615], [1140, 690], [980, 712]], true, 0.4); g.fillStyle = DENIM[0]; g.fill();
  smooth([[880, 600], [1000, 572], [1100, 580], [1110, 615], [990, 618], [890, 640]], true, 0.4); g.fillStyle = TEE; g.fill();
  smooth([[780, 700], [770, 650], [900, 690], [1120, 680], [1140, 700], [980, 715]], true, 0.4); g.fillStyle = DENIM[1]; g.fill();
  // the raised arm, twirling the daisy above his face
  const tw = o.twirl ?? t * 2.4, lift = Math.sin(t * 1.2) * 6;
  limb(1100, 600, 1150, 430 + lift, 50, 42, DENIM[0]); limb(1150, 430 + lift, 1228, 382 + lift, 40, 34, DENIM[2]);
  const hx = 1238, hy = 376 + lift;
  g.strokeStyle = '#4f7a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(hx + 4, hy - 2); g.quadraticCurveTo(hx + 22, hy - 30, hx + 26, hy - 64); g.stroke();
  hand('kabir', hx, hy, -0.6, 1.25);
  daisy(hx + 26, hy - 70, 2.1, o.petals ?? 12, tw);
  // head, face up, body to the left
  g.save(); g.translate(1268, 616); g.transform(0, -1, -1, 0, 0, 0); g.scale(1.62, 1.62);
  headProfile('kabir', { eye: o.eye || 'open', mouth: o.mouth || 'smile', blink: o.blink || 0 });
  g.restore();
}
SC.hill = (t, T, v = {}) => {
  const close = v.close, u = t / T;
  if (close) cam(lerp(1230, 1250, ease(u)), lerp(470, 440, ease(u)), lerp(2.0, 2.25, ease(u)));
  else cam(lerp(1000, 1060, ease(u)), lerp(560, 470, easeIn(u * 0.9)), lerp(1.42, 1.58, ease(u)));
  layer(0.15, () => { sky(GOLD_SKY); sunDisc(1560, 380, 46, t); cloud(400, 180, 120, 3, t); cloud(980, 120, 90, 7, t); cloud(1400, 230, 70, 11, t, { a: 0.8 }); });
  layer(0.35, () => { hillCurve(-800, 2800, 560, 90, 4, '#a9b98a'); hillCurve(-800, 2800, 620, 70, 9, '#8ea561'); });
  layer(0.7, () => { hillCurve(-800, 2800, 690, 40, 12, '#71913a'); grass(-600, 2600, 700, 260, t, 21, { h: 60, w: 6, rim: 'rgba(255,220,140,0.6)' }); wildflowers(-400, 2400, 640, 700, 50, t, 5); });
  layer(1, () => {
    g.fillStyle = lingrad(0, 690, 0, 1300, [[0, '#6f8f36'], [1, '#2f4a18']]); g.fillRect(-600, 690, 3200, 900);
    grass(-600, 2600, 900, 420, t, 44, { h: 170, w: 12, cols: ['#3f5c1e', '#4f7026', '#5f822e'] });
    const blow = close && t > 0.55, petalsLeft = close ? 12 - Math.floor(clamp((t - 0.6) / 0.25, 0, 3)) : 12;
    kabirLying(t, { mouth: blow ? 'blow' : 'smile', petals: petalsLeft, twirl: close ? 0.4 + t * 0.6 : undefined, blink: (t % 3.1) < 0.12 ? 1 : 0 });
    if (close && t > 0.6) { // petals blown off, drifting up into the light
      for (let i = 0; i < 6; i++) { const k = clamp((t - 0.6 - i * 0.12) / 1.4); if (k <= 0) continue; const x = 1264 + k * (60 + i * 25) + Math.sin(k * 6 + i) * 14, y = 306 - k * (140 + i * 18); g.save(); g.translate(x, y); g.rotate(k * 5 + i); g.scale(1, 0.45 + 0.5 * Math.abs(Math.sin(k * 8 + i))); fillEll(0, 0, 9, 4, 'rgba(255,252,244,0.97)'); g.restore(); }
    }
    grass(-600, 2600, 760, 360, t, 33, { h: 120, w: 9, rim: 'rgba(255,220,140,0.7)', cols: ['#4a6a22', '#5f8230', '#78993a', '#8daa45'] });
    wildflowers(200, 1900, 700, 760, 30, t, 9);
  });
  layer(0, () => { motes(t, 30, 4); });
};

// ---------------------------------------------------------------- 2. the sky: clouds drift into a heart
function heartPts(n) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]); } return out; }
const HEART = heartPts(26);
SC.sky = (t, T, v = {}) => {
  const u = t / T, form = v.formed ? 1 : ease(clamp((t + 0.2) / (T * 0.85)));
  cam(960, lerp(620, 500, ease(u)), lerp(1.0, 1.14, ease(u)));
  layer(0.2, () => { sky(GOLD_SKY.map(([o, c]) => [o, c]), -800, -900, W + 1600, H + 1500); sunDisc(1500, 980, 60, t); cloud(200, 260, 110, 13, t, { a: 0.85 }); cloud(1700, 200, 130, 17, t, { a: 0.85 }); cloud(1600, 760, 90, 19, t, { a: 0.7 }); });
  layer(0.6, () => {
    const cx = 960, cy = 470, s = 17;
    const r = R(41), puffs = [], inside = (x, y) => { let c = false; for (let i = 0, j = HEART.length - 1; i < HEART.length; j = i++) { const [xi, yi] = HEART[i], [xj, yj] = HEART[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    HEART.forEach(([hx, hy]) => puffs.push([hx, hy, 1.15 + r() * 0.5]));
    for (let y = -14; y <= 16; y += 2.6) for (let x = -16; x <= 16; x += 2.6) if (inside(x, y)) puffs.push([x + (r() - 0.5), y + (r() - 0.5), 1.5 + r() * 0.5]);
    for (const pass of [0, 1, 2]) {
      puffs.forEach(([hx, hy, pr], i) => {
        const side = hx < 0 ? -1 : 1, sx = cx + side * (380 + (i % 7) * 26) + hx * 7, sy = cy + 60 + hy * 6;
        const x = lerp(sx, cx + hx * s, form), y = lerp(sy, cy + hy * s, form), rr = pr * 30;
        const col = ['#e4b3b4', '#f9ddcc', '#fff9ef'][pass], off = [7, 0, -8][pass], sc = [1.05, 0.95, 0.7][pass];
        fillEll(x + off * 0.4 - (pass === 2 ? 4 : 0), y + off, rr * sc, rr * sc, col);
      });
    }
    if (form > 0.8) { const a = (form - 0.8) / 0.2; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * a * (0.7 + 0.3 * beatPulse(t)); g.strokeStyle = '#ffd38a'; g.lineWidth = 14; g.filter = 'blur(10px)'; smooth(HEART.map(([hx, hy]) => [cx + hx * s, cy + hy * s]), true, 0.5); g.stroke(); g.restore(); }
  });
  layer(1, () => petals(t, 14, 7, { vx: 70, vy: -50, size: 11 }));
  layer(0, () => motes(t, 20, 9, { a: 0.5 }));
};

// ---------------------------------------------------------------- 3. the swing under the banyan tree
function banyan(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#4a3427'; smooth([[-70, 0], [-50, -300], [-90, -520], [-20, -560], [40, -480], [60, -300], [90, 0]], true, 0.4); g.fill();
  limb(-10, -480, 900, -560, 70, 30, '#4a3427'); limb(-30, -500, -500, -620, 60, 26, '#4a3427');
  g.strokeStyle = '#5b4232'; g.lineWidth = 6; for (let i = 0; i < 16; i++) { const rx = 100 + i * 52 + (i % 3) * 9, sw = Math.sin(t * 0.9 + i) * 6; g.beginPath(); g.moveTo(rx, -520 - i * 2.2); g.quadraticCurveTo(rx + sw, -300, rx + sw * 1.5, -120 - (i % 4) * 40); g.stroke(); }
  const r = R(77), greens = ['#2c461b', '#375a22', '#45702a', '#578a33', '#6c9f3e'];
  for (let i = 0; i < 260; i++) { const lx = -600 + r() * 1700, ly = -840 + r() * 360 + Math.abs(lx - 300) * 0.08, rr = 22 + r() * 40, c = greens[(r() * 5) | 0]; fillEll(lx + Math.sin(t * 0.8 + i) * 2, ly, rr, rr * 0.62, c, r() * 0.6 - 0.3); }
  for (let i = 0; i < 120; i++) { const lx = -560 + r() * 1650, ly = -860 + r() * 220; fillEll(lx, ly, 14 + r() * 18, 8 + r() * 10, 'rgba(190,220,110,0.5)', r() - 0.5); }
  g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const lx = -500 + r() * 1500, ly = -820 + r() * 240; fillEll(lx, ly, 16 + r() * 22, 10 + r() * 12, 'rgba(255,200,110,0.18)'); } g.restore();
  g.restore();
}
function nainaSwing(t, th, vel) {
  const [sk] = SKIN.naina, wind = clamp(-vel * 1.4, -1, 1);
  // ropes (two, slight perspective) from the pivot to the plank
  g.strokeStyle = '#d8b582'; g.lineWidth = 9; g.beginPath(); g.moveTo(-26, -560); g.lineTo(-40, 0); g.moveTo(26, -560); g.lineTo(70, 0); g.stroke();
  g.fillStyle = '#6b4a2f'; path([[-70, -6], [100, -6], [104, 14], [-74, 14]]); g.fill();
  // dupatta streaming behind
  g.save(); g.globalAlpha = 0.85; g.fillStyle = DUP; smooth([[-30, -250], [10, -260], [-120 - wind * 80, -230 + Math.sin(t * 6) * 14], [-300 - wind * 120, -190 + Math.sin(t * 6 + 1) * 30], [-260 - wind * 100, -150], [-90, -150]], true, 0.5); g.fill(); g.restore();
  // legs forward
  limb(10, -16, 130, -26, 44, 38, '#f1d6de'); limb(130, -26, 160, 120, 38, 32, '#f1d6de'); fillEll(168, 132, 24, 11, sk);
  // kameez
  smooth([[-40, -230], [40, -232], [52, -120], [70, -10], [-60, -2], [-56, -120]], true, 0.35); g.fillStyle = PINK[0]; g.fill();
  smooth([[-40, -230], [-10, -232], [-30, -10], [-60, -2], [-56, -120]], true, 0.35); g.fillStyle = PINK[1]; g.fill();
  // arms to the rope
  limb(20, -215, 64, -150, 26, 22, PINK[0]); limb(64, -150, 52, -262, 22, 18, sk); hand('naina', 52, -268, -1.6, 0.8);
  // head tilted back, laughing
  g.save(); g.translate(4, -296); g.rotate(-0.18 + th * 0.15); g.scale(1.3, 1.3);
  headProfile('naina', { eye: 'happy', mouth: 'laugh', hairWind: 0.35 + wind * 0.45, hairLen: 150 });
  g.restore();
}
SC.swing = (t, T, v = {}) => {
  const u = t / T;
  cam(lerp(1010, 1040, ease(u)), lerp(560, 540, ease(u)), lerp(1.3, 1.4, ease(u)), Math.sin(t * 2.85) * 0.012);
  layer(0.15, () => { sky(GOLD_SKY); sunDisc(760, 470, 52, t); cloud(1500, 200, 90, 23, t, { a: 0.8 }); });
  layer(0.4, () => { hillCurve(-800, 2800, 640, 60, 14, '#9fb27e'); hillCurve(-800, 2800, 690, 40, 18, '#7f9a4e'); });
  layer(0.8, () => { g.fillStyle = '#6b8a35'; g.fillRect(-800, 720, 3600, 800); banyan(380, 760, 1.0, t); grass(-800, 2800, 730, 200, t, 51, { h: 50, w: 6, rim: 'rgba(255,214,140,0.6)' }); });
  layer(1, () => {
    const P = 2.85, th = 0.42 * Math.sin(TAU * t / P + 0.6), vel = Math.cos(TAU * t / P + 0.6);
    g.save(); g.translate(1060, 205); g.rotate(th); g.translate(0, 560); g.scale(1.15, 1.15); nainaSwing(t, th, vel); g.restore();
    grass(-800, 2800, 1080, 300, t, 61, { h: 150, w: 10, rim: 'rgba(255,214,140,0.7)' });
  });
  layer(0, () => { petals(t, 10, 15, { vx: 90, vy: -30, size: 10 }); motes(t, 24, 12); });
};

// ---------------------------------------------------------------- 4. the window at dusk: the dandelion
function bougainvillea(x, y, s, t, seed) {
  const r = R(seed); g.save(); g.translate(x, y); g.scale(s, s);
  for (let i = 0; i < 26; i++) { const lx = (r() - 0.5) * 260, ly = (r() - 0.5) * 160; fillEll(lx, ly, 18 + r() * 14, 10 + r() * 8, ['#3f6a2c', '#548238'][(r() * 2) | 0], r() * 3); }
  for (let i = 0; i < 46; i++) { const lx = (r() - 0.5) * 260 + Math.sin(t * 1.2 + i) * 2, ly = (r() - 0.5) * 150; fillEll(lx, ly, 9 + r() * 7, 9 + r() * 7, ['#d63a8c', '#e85aa2', '#c42a7a', '#f07ab8'][(r() * 4) | 0]); }
  g.restore();
}
function dandelion(x, y, s, gone, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#7da34a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 60, -4, 130); g.stroke();
  const n = 60;
  for (let i = 0; i < n; i++) { if (i / n < gone) continue; const a = i / n * TAU + i * 0.37, L = 26 + (i % 3) * 3; g.strokeStyle = 'rgba(255,255,250,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke(); fillEll(Math.cos(a) * L, Math.sin(a) * L, 3, 3, 'rgba(255,255,255,0.9)'); }
  fillEll(0, 0, 6, 6, '#c9b98a');
  g.restore();
}
SC.window = (t, T, v = {}) => {
  const u = t / T, out = v.out;
  if (out) cam(980, 500, lerp(1.3, 1.42, ease(u))); else cam(lerp(960, 985, ease(u)), lerp(560, 500, ease(u)), lerp(1.0, 1.28, ease(u)));
  const blowT = out ? 0 : 1.6, blowing = out || t > blowT, gone = out ? 0.6 + 0.4 * clamp(t / T) : clamp((t - blowT) / 1.2) * 0.6;
  layer(0.9, () => {
    g.fillStyle = lingrad(0, -200, 0, 1300, [[0, '#f0b9a0'], [0.5, '#f4c8a6'], [1, '#d9a07e']]); g.fillRect(-600, -400, 3200, 1900);
    const r = R(5); for (let i = 0; i < 60; i++) fillEll(-500 + r() * 3000, -300 + r() * 1700, 40 + r() * 80, 20 + r() * 30, 'rgba(160,90,60,0.06)');
    // window opening with a warm dim room behind
    g.fillStyle = lingrad(0, 200, 0, 900, [[0, '#3b241c'], [1, '#5a3626']]); g.fillRect(620, 170, 680, 760); glow(1150, 300, 260, 'rgba(255,190,110,0.35)');
    g.fillStyle = '#5c3d28'; g.fillRect(600, 150, 720, 26); g.fillRect(600, 150, 24, 800); g.fillRect(1296, 150, 24, 800);
    // shutters, open
    for (const [sx, dir] of [[420, -1], [1320, 1]]) { g.fillStyle = '#7b5636'; path([[sx, 170], [sx + 180, 190], [sx + 180, 930], [sx, 950]]); g.fill(); g.strokeStyle = '#5c3d28'; g.lineWidth = 4; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(sx + 14, 220 + k * 80); g.lineTo(sx + 166, 228 + k * 80); g.stroke(); } }
    bougainvillea(540, 170, 1.3, t, 3); bougainvillea(1380, 150, 1.4, t, 8); bougainvillea(380, 520, 1.0, t, 12); bougainvillea(1560, 560, 1.1, t, 15);
  });
  layer(1, () => {
    const [sk] = SKIN.naina;
    // shoulders and arms on the sill
    smooth([[700, 960], [760, 760], [960, 720], [1160, 760], [1220, 960]], true, 0.4); g.fillStyle = PINK[0]; g.fill();
    g.save(); g.globalAlpha = 0.9; g.fillStyle = DUP; smooth([[730, 800], [900, 730], [1020, 740], [1180, 820], [1200, 960], [720, 960]], true, 0.4); g.fill(); g.restore();
    limb(800, 860, 870, 700, 46, 38, PINK[0]); hand('naina', 880, 650, -1.4, 1.5);          // the arm under her chin
    g.save(); g.translate(960, 560); g.rotate(-0.08); g.scale(2.3, 2.3);
    const bl = (t % 2.7) < 0.12 ? 1 : 0;
    faceFront('naina', { turn: 0.15, mouth: blowing && !out && t < blowT + 1.3 ? 'blow' : 'smile', blink: bl, look: [0.6, -0.2], hairLen: 160 });
    g.restore();
    limb(1120, 900, 1150, 760, 44, 36, PINK[0]); hand('naina', 1150, 740, -1.9, 1.4);
    dandelion(1158, 640, 1.5, gone, t);
    g.fillStyle = '#6b4a30'; g.fillRect(560, 930, 800, 60); g.fillStyle = '#4e3522'; g.fillRect(560, 985, 800, 30);
  });
  layer(0, () => { // seeds floating out toward the camera
    if (!blowing) return;
    const r = R(31), t0 = out ? -2 : blowT;
    for (let i = 0; i < 26; i++) { const k = (t - t0 - i * 0.05) / 2.6; if (k <= 0) continue; const ang = -0.9 + r() * 1.3, sp = 380 + r() * 520, z = 1 + k * 2.2;
      const x = 1200 + Math.cos(ang) * sp * k + Math.sin(k * 5 + i) * 30, y = 520 + Math.sin(ang) * sp * k - k * 120;
      g.save(); g.translate(x, y); g.scale(z, z); g.globalAlpha = clamp(1.4 - k); g.strokeStyle = 'rgba(255,255,250,0.9)'; g.lineWidth = 0.9;
      for (let j = 0; j < 9; j++) { const a = j / 9 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9 - 6); g.stroke(); } g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 10); g.stroke(); g.restore(); }
    motes(t, 16, 21, { a: 0.5 });
  });
};

// ---------------------------------------------------------------- 5. close-up: plucking petals
SC.petals = (t, T) => {
  cam(960, 540, lerp(1.0, 1.08, t / T));
  layer(0.3, () => { g.fillStyle = lingrad(0, 0, 0, H, [[0, '#a9c45e'], [0.6, '#6f9636'], [1, '#3f5f22']]); g.fillRect(-400, -400, W + 800, H + 800);
    for (let i = 0; i < 30; i++) { const r = R(i + 3); const x = r() * W, y = r() * H * 0.75, rr = 40 + r() * 100; glow(x, y, rr, 'rgba(255,230,160,0.45)'); }
    for (let i = 0; i < 14; i++) { const r = R(i + 90); g.save(); g.filter = 'blur(18px)'; g.globalAlpha = 0.6; limb(r() * W, H + 60, r() * W + (r() - 0.5) * 200, H * (0.2 + r() * 0.4), 50, 20, ['#4f7428', '#3e5c20', '#6a8f35'][i % 3]); g.restore(); } });
  layer(1, () => {
    const half = T / 2, pl = Math.min(1, Math.floor(t / half)), pk = (t - pl * half) / half;
    const petalsLeft = 7 - pl, cx = 1080, cy = 520, ds = 8;
    g.strokeStyle = '#4f7a2a'; g.lineWidth = 16; g.beginPath(); g.moveTo(1120, 1200); g.quadraticCurveTo(1160, 860, cx, cy); g.stroke();
    daisy(cx, cy, ds, petalsLeft - 1, 0.3, { total: 12 });
    const pa = 0.3 + (petalsLeft - 1) / 12 * TAU, mid = 15 * ds, px0 = cx + Math.sin(pa) * mid, py0 = cy - Math.cos(pa) * mid;
    const pull = easeOut(clamp((pk - 0.2) / 0.35)), fall = clamp((pk - 0.55) / 0.45);
    const px = px0 - pull * 120, py = py0 - pull * 50;
    if (fall <= 0) { g.save(); g.translate(px, py); g.rotate(pa - pull * 0.6); fillEll(0, 0, 4.2 * ds, 12 * ds, '#fbf8f0'); g.strokeStyle = 'rgba(190,180,160,0.5)'; g.lineWidth = 2; g.stroke(); g.restore(); }
    else { g.save(); g.translate(px - fall * 220, py + fall * 520); g.rotate(pa + fall * 4); g.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(fall * 7))); fillEll(0, 0, 4.2 * ds, 12 * ds, '#fbf8f0'); g.restore(); }
    // the hand: fingertips on the petal while pinching, opening as it lets go
    const hs = 9, ang = -0.5, tip = [18.8 * hs, -23.95 * hs];
    const hx = (fall > 0 ? px0 - 120 : px) - tip[0], hy = (fall > 0 ? py0 - 50 : py) - tip[1];
    limb(hx - 520, hy + 520, hx - 60, hy + 60, 240, 190, DENIM[0]); fillEll(hx - 90, hy + 90, 120, 100, DENIM[2], -0.8);
    hand('kabir', hx, hy, ang, hs, fall > 0 ? 'open' : 'pinch');
  });
  layer(0, () => motes(t, 24, 5));
};

// ---------------------------------------------------------------- 6. the bed at night, seen from the ceiling
SC.bed = (t, T, v = {}) => {
  const u = t / T, calm = v.calm;
  cam(960, 540, lerp(1.02, 1.14, ease(u)), lerp(-0.05, 0.05, u));
  layer(1, () => {
    g.fillStyle = '#2a2033'; g.fillRect(-600, -600, 3200, 2400);
    g.fillStyle = '#3a2a24'; for (let i = 0; i < 18; i++) g.fillRect(-600 + i * 180, -600, 170, 2400);
    // bed
    g.fillStyle = '#4a3328'; g.fillRect(560, 60, 800, 1060);
    g.fillStyle = lingrad(0, 120, 0, 1100, [[0, '#dfe3ee'], [1, '#c4cadb']]); g.fillRect(590, 90, 740, 1040);
    smooth([[700, 120], [1220, 120], [1240, 300], [680, 300]], true, 0.4); g.fillStyle = '#f1f2f7'; g.fill();   // pillow
    // Kabir under the sheet, face up
    const [sk, sh] = SKIN.kabir, turn = calm ? 0 : Math.sin(t * 2.3) * 0.5, look = calm ? [0, 0] : [Math.sin(t * 2.3) * 0.8, -0.2];
    smooth([[760, 420], [1160, 420], [1200, 560], [1180, 760], [740, 760], [720, 560]], true, 0.4); g.fillStyle = TEE; g.fill();
    limb(800, 480, 880, 590, 76, 66, sk); limb(1120, 480, 1040, 585, 76, 66, sk);
    const pulse = beatPulse(t) * (calm ? 1 : 0.7);
    glow(960, 600, 120 + 40 * pulse, `rgba(255,110,130,${0.25 + 0.35 * pulse})`);
    hand('kabir', 900, 610, 0.2, 1.7, 'open'); hand('kabir', 1010, 590, 2.9, 1.7, 'open');
    smooth([[600, 700], [1320, 680], [1330, 1130], [590, 1130]], true, 0.2); g.fillStyle = '#b7bfd6'; g.fill();
    g.strokeStyle = 'rgba(120,130,170,0.5)'; g.lineWidth = 5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(650 + i * 130, 720); g.quadraticCurveTo(700 + i * 120, 900, 640 + i * 140, 1120); g.stroke(); }
    g.save(); g.translate(960 + turn * 20, 250); g.rotate(turn * 0.25); g.scale(1.9, 1.9);
    faceFront('kabir', { turn, look, eyes: calm ? 'happy' : (t % 2.2 < 0.12 ? 'closed' : undefined), mouth: 'smile' });
    g.restore();
  });
  layer(1, () => { // moonlight through the window and the turning fan's shadow
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(150,170,255,0.10)'; path([[-200 + i * 170, -300], [-80 + i * 170, -300], [900 + i * 170, 1400], [780 + i * 170, 1400]]); g.fill(); }
    g.restore();
    g.save(); g.translate(1020, 520); g.rotate(t * 5.5); g.fillStyle = 'rgba(10,8,25,0.28)'; g.filter = 'blur(8px)';
    for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); ell(0, -260, 50, 240); g.fill(); } g.restore();
  });
  layer(0, () => { g.fillStyle = 'rgba(20,30,90,0.18)'; g.fillRect(0, 0, W, H); });
};

// ---------------------------------------------------------------- 7. her eye, and him in it
function streetlampScene(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#0b1028'; g.fillRect(-300, -300, 600, 600);
  g.fillStyle = 'rgba(255,200,120,0.18)'; path([[40, -160], [180, 200], [-120, 200]]); g.fill();
  g.strokeStyle = '#2c2f40'; g.lineWidth = 8; g.beginPath(); g.moveTo(60, 200); g.lineTo(60, -160); g.quadraticCurveTo(60, -190, 30, -190); g.stroke();
  glow(30, -170, 90, 'rgba(255,210,130,0.9)'); fillEll(30, -172, 12, 8, '#ffe9b8');
  g.save(); g.translate(-30, 190); figureSmall('kabir', 230, t, { mouth: 'smile' }); g.restore();
  g.restore();
}
SC.eye = (t, T) => {
  const u = t / T, z = lerp(1.0, 4.2, easeIn(clamp(u * 1.05)));
  cam(960, lerp(560, 548, u), z);
  layer(1, () => {
    const [sk, sh, hi] = SKIN.naina;
    g.fillStyle = lingrad(0, 0, 0, H, [[0, '#c98a63'], [0.5, sk], [1, '#a86c4b']]); g.fillRect(-400, -400, W + 800, H + 800);
    glow(700, 300, 500, 'rgba(255,210,170,0.25)');
    const blink = clamp(1 - Math.abs(t - 0.7) / 0.12), open = 1 - blink;
    g.save(); g.beginPath(); g.moveTo(330, 560); g.bezierCurveTo(600, 560 - 330 * open, 1320, 560 - 330 * open, 1590, 560); g.bezierCurveTo(1320, 560 + 200 * open, 600, 560 + 200 * open, 330, 560); g.clip();
    g.fillStyle = radgrad(960, 560, 100, 700, [[0, '#fbf6f2'], [1, '#e8cfc8']]); g.fillRect(0, 0, W, H);
    fillEll(960, 548, 225, 225, '#5a3420');
    g.fillStyle = radgrad(960, 548, 80, 225, [[0, '#7a4a2a'], [0.6, '#5a321c'], [1, '#2e170c']]); ell(960, 548, 225, 225); g.fill();
    g.strokeStyle = 'rgba(160,110,60,0.35)'; g.lineWidth = 3; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; g.beginPath(); g.moveTo(960 + Math.cos(a) * 100, 548 + Math.sin(a) * 100); g.lineTo(960 + Math.cos(a) * 215, 548 + Math.sin(a) * 215); g.stroke(); }
    g.save(); ell(960, 548, 98, 98); g.clip(); streetlampScene(960, 548, 0.42, t); g.restore();
    g.save(); g.globalAlpha = 0.85; fillEll(1035, 470, 34, 22, 'rgba(255,255,255,0.8)'); fillEll(890, 625, 14, 10, 'rgba(255,255,255,0.5)'); g.restore();
    g.restore();
    // lids, kohl and lashes
    g.strokeStyle = '#140b08'; g.lineWidth = 34; g.lineCap = 'round'; g.beginPath(); g.moveTo(320, 562); g.bezierCurveTo(600, 560 - 330 * open, 1320, 560 - 330 * open, 1600, 548); g.stroke();
    g.lineWidth = 6; for (let i = 0; i < 26; i++) { const k = i / 25, x = lerp(420, 1520, k), y = 560 - 330 * open * 4 * k * (1 - k) * 0.82; g.beginPath(); g.moveTo(x, y - 10); g.quadraticCurveTo(x + 24 + k * 30, y - 70, x + 40 + k * 60, y - 100 + Math.abs(k - 0.5) * 50); g.stroke(); }
    g.strokeStyle = '#2b1810'; g.lineWidth = 10; g.beginPath(); g.moveTo(360, 566); g.bezierCurveTo(620, 560 + 200 * open, 1310, 560 + 200 * open, 1570, 566); g.stroke();
    g.strokeStyle = rgba('#7a4a35', 0.5); g.lineWidth = 6; g.beginPath(); g.moveTo(400, 300); g.bezierCurveTo(700, 140, 1250, 140, 1560, 280); g.stroke();
    g.strokeStyle = '#1b120e'; g.lineWidth = 26; g.beginPath(); g.moveTo(420, 140); g.bezierCurveTo(700, 40, 1220, 30, 1560, 120); g.stroke();
  });
};

// ---------------------------------------------------------------- 8. the dream: Naina twirls above him
function twirlingNaina(t, h) {
  const spin = t * 4.2, sx = Math.cos(spin) * 0.22 + 0.78;
  const ribbon = (front) => { for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(250,${175 + i * 15},${200 + i * 10},${0.55 - i * 0.12})`; g.lineWidth = 30 - i * 8; g.lineCap = 'round'; g.beginPath(); let on = false;
      for (let k = 0; k <= 80; k++) { const a = spin + k / 80 * TAU * 1.3 + i * 0.35, rr = h * 0.32 + k * 1.6, y = -h * 0.62 + Math.sin(a) * rr * 0.28 + k * 1.8; const x = Math.cos(a) * rr, isFront = Math.sin(a) > 0; if (isFront !== front) { on = false; continue; } on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } g.stroke(); } };
  ribbon(false);
  g.save(); g.scale(sx, 1); figureSmall('naina', h, t, { armsUp: true, mouth: 'laugh', eyes: 'happy', wind: Math.sin(spin) * 0.6 }); g.restore();
  ribbon(true);
}
SC.dream = (t, T, v = {}) => {
  const u = t / T, close = v.close;
  if (close) cam(960, 430, lerp(1.7, 1.85, ease(u)), Math.sin(t) * 0.02); else cam(960, lerp(560, 520, ease(u)), lerp(1.0, 1.1, ease(u)));
  layer(0.3, () => { sky([[0, '#0a0f2e'], [0.5, '#1c2160'], [1, '#3a2c6e']]); stars(-200, -200, W + 400, H + 200, 160, t, 7); milkyWay(-200, 900, 2100, -100, t, 0.8); });
  layer(0.6, () => { for (let i = 0; i < 9; i++) { const a = t * 0.25 + i / 9 * TAU; glow(960 + Math.cos(a) * 420, 420 + Math.sin(a) * 160, 260, i % 2 ? 'rgba(160,140,255,0.22)' : 'rgba(255,170,210,0.18)'); }
    g.save(); g.translate(960, 760); twirlingNaina(t, 520); g.restore(); sparklesRing(t); });
  layer(1, () => {
    if (close) return;
    g.fillStyle = lingrad(0, 850, 0, 1100, [[0, '#2c3366'], [1, '#141836']]); g.fillRect(-400, 860, 2800, 400);
    smooth([[420, 900], [860, 870], [1240, 880], [1500, 920], [1500, 1120], [420, 1120]], true, 0.4); g.fillStyle = '#c9d0ea'; g.fill();
    g.save(); g.translate(960, 900); g.rotate(-0.12); g.scale(1.6, 1.6); g.transform(0, -1, -1, 0, 0, 0); headProfile('kabir', { eye: 'closed', mouth: 'smile' }); g.restore();
  });
};
function sparklesRing(t) { const r = R(3); for (let i = 0; i < 40; i++) { const a = r() * TAU + t * 0.4, d = 200 + r() * 360, x = 960 + Math.cos(a) * d, y = 420 + Math.sin(a) * d * 0.5, s = Math.max(0, Math.sin(t * 3 + i)); glow(x, y, 14 + s * 10, `rgba(255,236,190,${0.7 * s})`); } }

// ---------------------------------------------------------------- 9. the box of photographs
function polaroid(x, y, s, rot, t, who = 'naina') {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = 'rgba(30,15,5,0.35)'; g.fillRect(-92, -102, 194, 234);
  g.fillStyle = '#f7f3ea'; g.fillRect(-100, -110, 200, 236);
  g.fillStyle = lingrad(0, -95, 0, 75, [[0, '#f6c79a'], [1, '#e79b8a']]); g.fillRect(-86, -96, 172, 172);
  g.save(); g.beginPath(); g.rect(-86, -96, 172, 172); g.clip(); g.translate(0, 5); g.scale(0.95, 0.95); faceFront(who, { mouth: 'laugh', eyes: 'happy', hairLen: 120 }); g.restore();
  g.restore();
}
SC.box = (t, T, v = {}) => {
  const u = t / T, lift = v.lift;
  cam(lerp(960, 980, u), lerp(560, 520, u), lift ? lerp(1.25, 1.4, ease(u)) : lerp(1.0, 1.1, ease(u)));
  layer(1, () => {
    g.fillStyle = '#5a3a24'; g.fillRect(-500, -500, 2900, 2100);
    g.strokeStyle = 'rgba(40,22,12,0.35)'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(-500, -400 + i * 50); g.bezierCurveTo(400, -380 + i * 50 + Math.sin(i) * 20, 1400, -420 + i * 50, 2400, -400 + i * 50); g.stroke(); }
    // open box
    g.fillStyle = '#6e4325'; g.fillRect(560, 250, 800, 560); g.fillStyle = '#3e2414'; g.fillRect(600, 290, 720, 480);
    g.strokeStyle = '#a8763f'; g.lineWidth = 10; g.strokeRect(575, 265, 770, 530);
    g.fillStyle = '#7a4b2a'; path([[560, 250], [1360, 250], [1400, 80], [600, 80]]); g.fill(); g.strokeStyle = '#a8763f'; g.lineWidth = 8; g.stroke();
    polaroid(800, 520, 1.05, -0.2, t); polaroid(1100, 560, 1.0, 0.15, t);
    // pressed rose and dried daisy
    g.save(); g.translate(720, 690); g.rotate(-0.6); for (let i = 0; i < 7; i++) { g.rotate(TAU / 7); fillEll(0, -16, 16, 26, '#c46d7f'); } fillEll(0, 0, 14, 14, '#9e4a5c'); limb(0, 0, 0, 160, 6, 4, '#5f6f3a'); g.restore();
    daisy(1230, 720, 2.2, 9, 0.5, { petal: '#efe6cf' });
    // hands lifting a photo toward the light
    const k = lift ? 1 : easeOut(clamp((t - 0.4) / (T - 0.6)));
    const px = lerp(950, 1000, k), py = lerp(560, 380, k), ps = lerp(1.0, 1.8, k);
    polaroid(px, py, ps, lerp(0.05, -0.05, k), t);
    hand('kabir', px - 110 * ps, py + 60 * ps, -0.4, 2.2 * ps / 1.6); hand('kabir', px + 110 * ps, py + 60 * ps, Math.PI + 0.4, 2.2 * ps / 1.6);
    limb(px - 140 * ps, py + 90 * ps, px - 260 * ps, 1300, 120, 150, DENIM[0]); limb(px + 140 * ps, py + 90 * ps, px + 260 * ps, 1300, 120, 150, DENIM[0]);
  });
  layer(0, () => { glow(380, 120, 700, 'rgba(255,200,120,0.35)'); motes(t, 20, 8, { a: 0.5 }); });
};

// ---------------------------------------------------------------- 10. the bazaar at dusk
function crowd(t, n, seed, y, s, dir, blur, tint) {
  const r = R(seed); g.save(); if (blur) g.filter = `blur(${blur}px)`;
  for (let i = 0; i < n; i++) { const sp = 90 + r() * 80, x0 = r() * 3400 - 700, h = (330 + r() * 120) * s; const x = ((x0 + dir * sp * t) % 3400 + 3400) % 3400 - 700, bob = Math.abs(Math.sin(t * 6 + i)) * 6;
    const c = tint[(r() * tint.length) | 0];
    g.fillStyle = c; fillEll(x, y - h + bob, h * 0.09, h * 0.11, c); smooth([[x - h * 0.13, y - h * 0.86 + bob], [x + h * 0.13, y - h * 0.86 + bob], [x + h * 0.16, y - h * 0.35], [x + h * 0.08, y], [x - h * 0.08, y], [x - h * 0.16, y - h * 0.35]], true, 0.4); g.fill(); }
  g.restore();
}
function stringLights(x0, x1, y, sag, n, t, seed) {
  g.strokeStyle = 'rgba(40,30,30,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y); g.stroke();
  for (let i = 1; i < n; i++) { const k = i / n, x = lerp(x0, x1, k), yy = y + sag * 4 * k * (1 - k); const tw = 0.7 + 0.3 * Math.sin(t * 3 + i + seed); glow(x, yy + 8, 34, `rgba(255,200,110,${0.55 * tw})`); fillEll(x, yy + 8, 6, 8, `rgba(255,236,170,${tw})`); }
}
SC.bazaar = (t, T, v = {}) => {
  const u = t / T, found = v.found;
  cam(lerp(960, 975, u), lerp(520, 500, u), found ? lerp(1.35, 1.5, ease(u)) : lerp(1.05, 1.18, ease(u)));
  layer(0.25, () => { sky(DUSK_SKY, -800, -700, W + 1600, 1300); });
  layer(0.5, () => {
    const r = R(9), cols = ['#7c3b52', '#4f5e7a', '#8a5a3a', '#5e3d6b', '#3e6a64'];
    for (let i = 0; i < 12; i++) { const x = -600 + i * 280, h = 380 + r() * 220; g.fillStyle = cols[i % 5]; g.fillRect(x, 640 - h, 270, h + 400);
      for (let j = 0; j < 3; j++) { g.fillStyle = r() < 0.6 ? 'rgba(255,200,110,0.85)' : 'rgba(40,30,50,0.6)'; g.fillRect(x + 30 + j * 80, 640 - h + 40, 50, 60); }
      const aw = ['#d94a4a', '#e8b23a', '#3f8f5a', '#d97a3a'][i % 4]; for (let s = 0; s < 6; s++) { g.fillStyle = s % 2 ? '#f7efe0' : aw; path([[x + s * 45, 560], [x + s * 45 + 45, 560], [x + s * 45 + 50, 620], [x + s * 45 - 5, 620]]); g.fill(); }
      glow(x + 135, 690, 160, 'rgba(255,190,100,0.25)'); }
    stringLights(-500, 700, 240, 60, 12, t, 1); stringLights(700, 1700, 220, 70, 12, t, 2); stringLights(1700, 2600, 250, 60, 10, t, 3);
  });
  layer(0.8, () => { g.fillStyle = '#4a3a3e'; g.fillRect(-800, 760, 3600, 800); crowd(t, 16, 4, 900, 1.0, 1, 3, ['#3c3150', '#4b3a4a', '#2f3a52', '#5a4048']); });
  layer(1, () => {
    g.save(); g.translate(960, 1010); figureSmall('naina', 620, t, { turn: found ? -0.1 : Math.sin(t * 1.4) * 0.7, mouth: 'smile', eyes: found ? 'happy' : undefined, wind: Math.sin(t * 2) * 0.2 }); g.restore();
    crowd(t, 7, 8, 1500, 1.6, -1, 10, ['#241c30', '#2c2238', '#1f2533']);
  });
  layer(0, () => { for (let i = 0; i < 10; i++) { const r = R(i + 50); glow(r() * W, r() * H, 80 + r() * 90, 'rgba(255,190,110,0.18)'); } });
};

// ---------------------------------------------------------------- 11. two rooftops under the stars
function building(x, y, w, h, seed, t) {
  const r = R(seed);
  g.fillStyle = '#28305a'; g.fillRect(x, y, w, h); g.fillStyle = '#1d2448'; g.fillRect(x + w * 0.85, y, w * 0.15, h);
  g.fillStyle = '#323b6a'; g.fillRect(x - 10, y - 50, w + 20, 54);                                  // parapet
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const lit = r() < 0.55; const wx = x + 40 + i * (w - 80) / 3, wy = y + 70 + j * 140; g.fillStyle = lit ? '#ffc56a' : '#1a2140'; g.fillRect(wx, wy, 60, 80); if (lit) glow(wx + 30, wy + 40, 90, 'rgba(255,190,100,0.35)'); }
}
SC.rooftops = (t, T, v = {}) => {
  const u = t / T, wave = v.wave;
  cam(960, lerp(520, 500, u), wave ? lerp(1.35, 1.45, ease(u)) : lerp(1.0, 1.12, ease(u)));
  layer(0.2, () => { sky(NIGHT_SKY); stars(-300, -300, W + 600, 900, 260, t, 13); milkyWay(-300, 700, 2200, -200, t); fillEll(1640, 160, 46, 46, '#f3efe0'); glow(1640, 160, 200, 'rgba(220,230,255,0.35)'); });
  layer(0.6, () => { for (let i = 0; i < 8; i++) { const r = R(i + 70); g.fillStyle = '#161c3a'; g.fillRect(-400 + i * 360, 560 + r() * 80, 330, 700); } });
  layer(1, () => {
    building(120, 560, 640, 700, 3, t); building(1160, 530, 680, 760, 9, t);
    g.fillStyle = '#0c1026'; g.fillRect(760, 600, 400, 700); glow(960, 980, 200, 'rgba(255,190,100,0.25)');
    g.save(); g.translate(560, 512); figureSmall('naina', 250, t, { arm: wave ? easeOut(clamp(t / 0.6)) : 0, turn: 0.5, mouth: 'smile', wind: 0.2 }); g.restore();
    g.save(); g.translate(1390, 482); figureSmall('kabir', 268, t + 0.3, { arm: wave ? easeOut(clamp((t - 0.25) / 0.6)) : 0, turn: -0.5, mouth: 'smile' }); g.restore();
  });
  layer(0, () => fireflies(t, 14, 3, [200, 300, 1500, 500]));
};

// ---------------------------------------------------------------- 12. sunset under the tree: the last petal
SC.sunset = (t, T, v = {}) => {
  const u = t / T, lower = clamp((t - 3.9) / 0.9);
  cam(lerp(940, 990, ease(u)), lerp(560, 520, ease(u)), lerp(1.04, 1.22, ease(u)), lerp(-0.01, 0.01, u));
  layer(0.15, () => { sky([[0, '#5a4a8f'], [0.35, '#d9809a'], [0.6, '#f7a66b'], [0.8, '#ffc77a'], [1, '#ffe2a8']]); sunDisc(1180, 610, 70, t); cloud(300, 220, 100, 29, t, { lit: '#ffe0c0', mid: '#f3a99a', dark: '#c77a8a' }); });
  layer(0.4, () => { g.save(); g.globalAlpha = 0.85; banyan(260, 860, 0.85, t); g.restore(); hillCurve(-800, 2800, 760, 40, 3, '#6a5a52'); });
  layer(1, () => {
    g.fillStyle = '#4a3c3a'; g.fillRect(-600, 900, 3000, 600);
    // Kabir, left, in profile, holding out the daisy
    const [sk] = SKIN.kabir;
    smooth([[380, 1100], [400, 760], [520, 700], [640, 720], [690, 820], [700, 1100]], true, 0.4); g.fillStyle = DENIM[0]; g.fill();
    smooth([[560, 720], [640, 725], [680, 820], [690, 1100], [600, 1100]], true, 0.4); g.fillStyle = TEE; g.fill();
    limb(620, 780, 790, 820, 58, 50, DENIM[0]); limb(790, 820, 930, 760, 46, 38, sk); hand('kabir', 940, 750, -0.5, 2.0);
    g.strokeStyle = '#4f7a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(955, 735); g.quadraticCurveTo(980, 690, 985, 640); g.stroke();
    daisy(985, 630, 2.6, 1, 0.2 + Math.sin(t * 2) * 0.1, { total: 12 });
    g.save(); g.translate(560, 560); g.scale(2.1, 2.1); headProfile('kabir', { eye: 'open', mouth: 'smile', hairWind: Math.sin(t * 2) * 0.3 }); g.restore();
    // Naina, right, turned toward him, the dupatta over her face, then lowered
    g.save(); g.translate(1360, 1100);
    smooth([[-230, 0], [-210, -330], [-80, -400], [80, -400], [210, -330], [230, 0]], true, 0.4); g.fillStyle = PINK[0]; g.fill();
    g.save(); g.globalAlpha = 0.9; g.fillStyle = DUP; smooth([[-220, -320], [-60, -420], [120, -400], [260 + Math.sin(t * 2) * 30, -200], [300 + Math.sin(t * 2.4) * 40, 40], [160, 0]], true, 0.5); g.fill(); g.restore();
    const hold = 1 - lower;
    limb(-150, -330, -160 + hold * 40, -470 - hold * 40, 40, 34, PINK[0]); hand('naina', -150 + hold * 50, -500 - hold * 40, -1.2, 1.8);
    g.translate(0, -560); g.scale(2.2, 2.2);
    faceFront('naina', { turn: -0.45, mouth: lower > 0.6 ? 'laugh' : 'smile', eyes: lower > 0.6 ? 'happy' : undefined, look: [-0.7, 0], dupatta: hold, hairWind: 0.3 + Math.sin(t * 2) * 0.2, hairLen: 170 });
    g.restore();
  });
  layer(0, () => { petals(t, 12, 41, { vx: 50, vy: -25, size: 10 }); fireflies(t, 12, 9, [0, 200, W, 600]); motes(t, 24, 3); });
};
