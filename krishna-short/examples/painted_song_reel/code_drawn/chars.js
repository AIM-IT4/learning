// chars.js - Kabir and Naina, drawn with shapes: heads in profile and from the front, hands, bodies, small
// full figures. Local units: a head is ~100 units tall, centred on (0, 0); callers translate/rotate/scale.
'use strict';
const SKIN = { kabir: ['#b8795a', '#93573d', '#d69a77'], naina: ['#c98f69', '#a56c4d', '#e8b291'] };
const HAIR = '#16100e', HAIR_HI = '#3e2e28';
const DENIM = ['#7fa3c8', '#5c80a8', '#aac4df'], TEE = '#f4f0e7', TROUSER = '#2d3341';
const PINK = ['#f2a8be', '#d7869f', '#fad0dc'], DUP = 'rgba(248,176,198,0.82)', GOLD = '#e3b54b', BINDI = '#c8102e', LIP = '#c45f6c';

// ---------------------------------------------------------------- head in profile, facing +x
function headProfile(who, o = {}) {
  const [sk, sh, hi] = SKIN[who], fem = who === 'naina';
  if (fem) nainaHairBack(o);
  // neck
  limb(-6, 30, -10, 95, 34, 38, sh);
  // skull + face
  fillEll(-6, -10, 44, 46, sk);
  const face = fem
    ? [[16, -46], [33, -24], [36, -12], [34, -5], [39, 0], [47, 9], [45, 13], [39, 16], [41, 21], [38, 24], [40, 28], [36, 33], [34, 40], [22, 49], [4, 46], [-14, 30], [-20, -10]]
    : [[16, -46], [35, -22], [38, -12], [35, -5], [40, 0], [51, 10], [48, 15], [41, 17], [43, 22], [39, 26], [42, 30], [37, 35], [38, 43], [22, 52], [2, 47], [-14, 30], [-20, -10]];
  smooth(face, true, 0.45); g.fillStyle = sk; g.fill();
  // shading on the jaw and back of the head
  g.save(); smooth(face, true, 0.45); g.clip(); fillEll(-30, 10, 40, 60, rgba(sh.startsWith('#') ? sh : '#93573d', 0.45)); g.restore();
  // cheek light
  fillEll(22, 4, 12, 9, rgba(hi, 0.35));
  // ear
  fillEll(-6, 6, 8, 12, sh); fillEll(-5, 6, 5, 8, sk);
  // eye
  const eo = o.eye || 'open', bl = o.blink || 0;
  if (eo === 'closed' || bl > 0.6) { g.strokeStyle = '#2a1a14'; g.lineWidth = 2.6; g.beginPath(); g.arc(30, -6, 7, 0.2, Math.PI - 0.6); g.stroke(); }
  else if (eo === 'happy') { g.strokeStyle = '#2a1a14'; g.lineWidth = 2.8; g.beginPath(); g.arc(30, -3, 7, Math.PI + 0.5, TAU - 0.2); g.stroke(); }
  else {
    g.beginPath(); g.moveTo(24, -6); g.quadraticCurveTo(31, -11, 37, -6); g.quadraticCurveTo(31, -1, 24, -6); g.fillStyle = '#f5ece4'; g.fill();
    fillEll(33, -6, 3.2, 4.2, '#2b1a12'); fillEll(33.8, -7.2, 1, 1, '#fff');
    g.strokeStyle = '#1d120d'; g.lineWidth = fem ? 3 : 2.2; g.beginPath(); g.moveTo(23, -7); g.quadraticCurveTo(31, -12.5, 38, -6.5); g.stroke();
  }
  if (fem && eo !== 'happy') { g.strokeStyle = '#1d120d'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(32 + k * 2.5, -10); g.lineTo(35 + k * 3, -14); g.stroke(); } }
  // brow
  g.strokeStyle = HAIR; g.lineWidth = fem ? 2.4 : 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, -17); g.quadraticCurveTo(31, -21, 38, -16); g.stroke();
  // mouth
  const m = o.mouth || 'smile';
  if (m === 'laugh') { g.beginPath(); g.moveTo(34, 22); g.quadraticCurveTo(41, 21, 42, 24); g.quadraticCurveTo(39, 33, 33, 30); g.closePath(); g.fillStyle = '#5a1e22'; g.fill(); fillEll(39, 23.5, 3, 1.5, '#fff'); }
  else if (m === 'blow') { fillEll(43, 26, 3.5, 3.2, fem ? LIP : '#8e4a3c'); fillEll(43.5, 26, 1.6, 1.6, '#3b1515'); }
  else { g.strokeStyle = fem ? LIP : '#6e3628'; g.lineWidth = fem ? 3.2 : 2.4; g.beginPath(); g.moveTo(34, 25); g.quadraticCurveTo(39, 28, 42, 24); g.stroke(); }
  if (fem) { fillEll(34, -24, 2.4, 2.4, BINDI); fillEll(-4, 26, 4, 5, GOLD); fillEll(-4, 33, 5, 6.5, GOLD); }
  // hair
  if (fem) nainaHairTopProfile(o); else kabirHairProfile(o);
}
function kabirHairProfile(o) {
  const w = o.hairWind || 0;
  const pts = [[24, -36], [32, -48], [26 + w * 4, -60], [8 + w * 6, -66], [-16 + w * 6, -64], [-38 + w * 4, -54], [-52, -34], [-54, -10], [-46, 10], [-36, 20], [-26, 12], [-20, -4], [-8, -22], [8, -30]];
  smooth(pts, true, 0.5); g.fillStyle = HAIR; g.fill();
  g.strokeStyle = HAIR_HI; g.lineWidth = 2.6; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-30 + k * 12, -50 + k * 2); g.quadraticCurveTo(-10 + k * 10, -60, 16 + k * 4 + w * 4, -50 + k * 3); g.stroke(); }
}
function nainaHairBack(o) {
  const w = o.hairWind || 0, L = o.hairLen || 160;
  const pts = [[-20, -50], [-48, -30], [-58, 10], [-62 - w * 20, 60], [-70 - w * 50, L * 0.75], [-60 - w * 70, L], [-40 - w * 55, L * 0.95], [-30 - w * 35, L * 0.6], [-20 - w * 10, 40], [-10, 0]];
  smooth(pts, true, 0.5); g.fillStyle = HAIR; g.fill();
  g.strokeStyle = HAIR_HI; g.lineWidth = 2.5;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-40 + k * 4, -10); g.bezierCurveTo(-50 - w * 20, 40, -60 - w * 40 + k * 6, L * 0.6, -55 - w * 60 + k * 5, L * 0.9); g.stroke(); }
}
function nainaHairTopProfile(o) {
  const pts = [[22, -42], [10, -56], [-14, -60], [-38, -50], [-50, -30], [-50, -6], [-40, 10], [-28, 4], [-20, -16], [-6, -34]];
  smooth(pts, true, 0.5); g.fillStyle = HAIR; g.fill();
  g.strokeStyle = HAIR_HI; g.lineWidth = 2.5; g.beginPath(); g.moveTo(16, -46); g.quadraticCurveTo(-10, -60, -40, -40); g.stroke();
}

// ---------------------------------------------------------------- face from the front (turn -1..1 = yaw)
function faceFront(who, o = {}) {
  const [sk, sh, hi] = SKIN[who], fem = who === 'naina', tn = o.turn || 0, fx = tn * 12;
  if (fem) nainaHairBackFront(o);
  limb(0, 40, 0, 100, fem ? 30 : 36, fem ? 34 : 42, sh);                  // neck
  fillEll(-40 + tn * 8, 4, 7, 12, sh); fillEll(40 + tn * 8, 4, 7, 12, sh); // ears
  const face = [[0 + fx * 0.2, -52], [28 + tn * 6, -46], [40 - Math.max(0, tn) * 8, -22], [40 - Math.max(0, tn) * 8, 6], [33 - Math.max(0, tn) * 6, 30], [16 + fx * 0.5, 48], [fx * 0.6, 54], [-16 + fx * 0.5, 48], [-33 + Math.max(0, -tn) * 6, 30], [-40 + Math.max(0, -tn) * 8, 6], [-40 + Math.max(0, -tn) * 8, -22], [-28 + tn * 6, -46]];
  smooth(face, true, 0.5); g.fillStyle = sk; g.fill();
  g.save(); smooth(face, true, 0.5); g.clip();
  fillEll(-34 + fx, 10, 20, 60, rgba('#7a4630', 0.18)); fillEll(10 + fx, -20, 30, 24, rgba(hi, 0.25));
  fillEll(-20 + fx, 18, 9, 6, 'rgba(230,110,110,0.18)'); fillEll(20 + fx, 18, 9, 6, 'rgba(230,110,110,0.18)');
  g.restore();
  // eyes
  const lk = o.look || [0, 0], bl = o.blink || 0, closed = o.eyes === 'closed' || bl > 0.55, happy = o.eyes === 'happy';
  for (const sx of [-1, 1]) {
    const ex = sx * 16 + fx, ey = -4;
    if (closed) { g.strokeStyle = '#2a1a14'; g.lineWidth = 2.6; g.beginPath(); g.arc(ex, ey - 3, 8, 0.25, Math.PI - 0.25); g.stroke(); }
    else if (happy) { g.strokeStyle = '#2a1a14'; g.lineWidth = 3; g.beginPath(); g.arc(ex, ey + 3, 8, Math.PI + 0.4, TAU - 0.4); g.stroke(); }
    else {
      g.beginPath(); g.moveTo(ex - 10, ey); g.quadraticCurveTo(ex, ey - 9, ex + 10, ey); g.quadraticCurveTo(ex, ey + 6, ex - 10, ey); g.fillStyle = '#f6eee6'; g.fill();
      g.save(); g.beginPath(); g.moveTo(ex - 10, ey); g.quadraticCurveTo(ex, ey - 9, ex + 10, ey); g.quadraticCurveTo(ex, ey + 6, ex - 10, ey); g.clip();
      fillEll(ex + lk[0] * 3, ey - 1 + lk[1] * 2, 5.6, 5.6, '#3a2216'); fillEll(ex + lk[0] * 3, ey - 1 + lk[1] * 2, 2.8, 2.8, '#0d0806'); fillEll(ex + lk[0] * 3 + 1.8, ey - 3 + lk[1] * 2, 1.4, 1.4, '#fff');
      g.restore();
      g.strokeStyle = '#1a100c'; g.lineWidth = fem ? 3.4 : 2.4; g.beginPath(); g.moveTo(ex - 11, ey + 0.5); g.quadraticCurveTo(ex, ey - 10, ex + 11, ey - 0.5); g.stroke();
      if (fem) { g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(ex + sx * (4 + k * 3), ey - 7 + k); g.lineTo(ex + sx * (7 + k * 4), ey - 12 + k * 1.5); g.stroke(); } g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex - 9, ey + 2); g.quadraticCurveTo(ex, ey + 6, ex + 9, ey + 2); g.stroke(); }
    }
    g.strokeStyle = HAIR; g.lineWidth = fem ? 2.6 : 4.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 11, ey - 15); g.quadraticCurveTo(ex, ey - 20 - (o.brow || 0), ex + 11, ey - 15); g.stroke();
  }
  // nose
  g.strokeStyle = rgba('#6e3a28', 0.6); g.lineWidth = 2.2; g.beginPath(); g.moveTo(fx * 1.1 + 2, 4); g.quadraticCurveTo(fx * 1.2 + 5, 15, fx * 1.1 + 1, 18); g.stroke();
  fillEll(fx * 1.1 - 4, 19, 2.2, 1.4, rgba('#5a2c1e', 0.5)); fillEll(fx * 1.1 + 4, 19, 2.2, 1.4, rgba('#5a2c1e', 0.5));
  // mouth
  const m = o.mouth || 'smile', mx = fx * 1.05;
  if (m === 'laugh') { g.beginPath(); g.moveTo(mx - 13, 29); g.quadraticCurveTo(mx, 27, mx + 13, 29); g.quadraticCurveTo(mx, 44, mx - 13, 29); g.fillStyle = '#5a1e22'; g.fill(); g.beginPath(); g.moveTo(mx - 11, 29.5); g.quadraticCurveTo(mx, 28, mx + 11, 29.5); g.lineTo(mx + 9, 32); g.quadraticCurveTo(mx, 31, mx - 9, 32); g.fillStyle = '#fff'; g.fill(); }
  else if (m === 'blow') { fillEll(mx, 31, 5, 4.5, fem ? LIP : '#8e4a3c'); fillEll(mx, 31, 2.2, 2, '#3b1515'); }
  else { g.strokeStyle = fem ? LIP : '#6e3628'; g.lineWidth = fem ? 4 : 2.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx - 11, 29); g.quadraticCurveTo(mx, 36, mx + 11, 29); g.stroke(); if (fem) fillEll(mx, 33, 6, 2.2, rgba(LIP, 0.6)); }
  if (fem) { fillEll(fx, -24, 2.8, 2.8, BINDI); }
  if (fem) nainaHairFront(o); else kabirHairFront(o);
  if (fem) for (const sx of [-1, 1]) { const ex = sx * 41 + tn * 8; fillEll(ex, 20, 3.5, 4, GOLD); g.beginPath(); g.moveTo(ex - 6, 32); g.quadraticCurveTo(ex, 22, ex + 6, 32); g.closePath(); g.fillStyle = GOLD; g.fill(); fillEll(ex, 33, 6, 2, '#c99a33'); }
  if (o.dupatta) { // sheer dupatta held over the lower face
    const k = o.dupatta; g.save(); g.globalAlpha = 0.92 * k; g.beginPath(); g.moveTo(-60, 10 + (1 - k) * 60); g.bezierCurveTo(-30, 2 + (1 - k) * 60, 30, 2 + (1 - k) * 60, 60, 10 + (1 - k) * 60); g.lineTo(70, 120); g.lineTo(-70, 120); g.closePath();
    g.fillStyle = lingrad(0, 0, 0, 120, [[0, 'rgba(250,190,208,0.9)'], [1, 'rgba(240,160,186,0.95)']]); g.fill();
    g.strokeStyle = 'rgba(255,230,238,0.7)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-50 + i * 25, 14 + (1 - k) * 60); g.quadraticCurveTo(-45 + i * 25, 60, -55 + i * 25, 115); g.stroke(); }
    g.restore();
  }
}
function kabirHairFront(o) {
  const w = o.hairWind || 0;
  const pts = [[-46, -4], [-49, -32], [-40, -56], [-18, -68], [10, -69], [34, -60], [47, -40], [47, -8], [41, -26], [31, -41], [14, -47], [-6, -46], [-25, -40], [-38, -26]];
  smooth(pts, true, 0.5); g.fillStyle = HAIR; g.fill();
  // a soft wave falling over the forehead, swept to one side
  smooth([[-30, -52], [-4, -62], [26 + w * 4, -56], [40 + w * 6, -36], [30 + w * 4, -30], [18, -42], [-2, -44], [-20, -38]], true, 0.5); g.fill();
  g.strokeStyle = HAIR_HI; g.lineWidth = 2.6; g.lineCap = 'round';
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-30 + k * 9, -58 + k); g.quadraticCurveTo(-4 + k * 7, -66, 24 + k * 3 + w * 4, -50 + k * 3); g.stroke(); }
}
function nainaHairBackFront(o) {
  const w = o.hairWind || 0, L = o.hairLen || 150;
  const pts = [[-46, -40], [-58, 0], [-64 - w * 20, 60], [-60 - w * 40, L], [-30, L + 10], [0, L - 10], [30, L + 10], [60 + w * 10, L], [64, 60], [58, 0], [46, -40], [0, -62]];
  smooth(pts, true, 0.5); g.fillStyle = HAIR; g.fill();
}
function nainaHairFront(o) {
  const w = o.hairWind || 0;
  g.fillStyle = HAIR;
  smooth([[0, -58], [-30, -52], [-46, -30], [-50, 0], [-52 - w * 6, 40], [-58 - w * 14, 90], [-44 - w * 10, 70], [-40, 30], [-38, -6], [-30, -32], [-12, -46]], true, 0.5); g.fill();
  smooth([[0, -58], [30, -52], [46, -30], [50, 0], [52 + w * 4, 40], [56 + w * 8, 92], [44 + w * 6, 70], [40, 30], [38, -6], [30, -32], [12, -46]], true, 0.5); g.fill();
  g.strokeStyle = HAIR_HI; g.lineWidth = 2.4; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 6, -54); g.quadraticCurveTo(sx * 40, -46, sx * 46, 10); g.stroke(); }
  g.strokeStyle = '#7a4a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -60); g.lineTo(0, -48); g.stroke();
}

// ---------------------------------------------------------------- hands (simplified), torsos, small figures
function hand(who, x, y, ang, s, pose = 'hold') {
  const [sk, sh] = SKIN[who];
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  fillEll(0, 0, 20, 17, sk);
  if (pose === 'open') { for (let i = 0; i < 4; i++) limb(10, -10 + i * 7, 34, -16 + i * 9, 7.5, 6, sk); limb(-4, 10, 12, 22, 8, 6.5, sk); }
  else if (pose === 'pinch') { for (let i = 1; i < 4; i++) limb(6, -2 + i * 6, 15, i * 6, 8, 7, sk); limb(8, -8, 27, -15, 7.5, 6, sk); limb(-6, 6, 10, 3, 9.5, 8.5, sk); limb(10, 3, 25, -12, 8.5, 6.5, sk); g.strokeStyle = rgba('#5a2c1e', 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(6, -6); g.quadraticCurveTo(12, 0, 6, 8); g.stroke(); }
  else { for (let i = 0; i < 4; i++) limb(10, -10 + i * 7, 20, -8 + i * 7, 8, 7, sk); limb(-2, 10, 16, 2, 8, 6.5, sh); }
  g.restore();
}
// a small standing figure (rooftops, bazaar crowd hero, dream): feet at (0,0), height h; o.arm = wave 0..1
function figureSmall(who, h, t, o = {}) {
  const s = h / 520, fem = who === 'naina', [sk, sh] = SKIN[who];
  g.save(); g.scale(s, s);
  if (fem) {
    limb(-18, -230, -22, -10, 26, 22, '#f1d6de'); limb(18, -230, 22, -10, 26, 22, '#f1d6de');           // salwar
    smooth([[-58, -400], [58, -400], [70, -170], [74, -120], [-74, -120], [-70, -170]], true, 0.3); g.fillStyle = PINK[0]; g.fill(); // kameez
    g.fillStyle = PINK[1]; smooth([[-58, -400], [-30, -400], [-50, -120], [-74, -120], [-70, -170]], true, 0.3); g.fill();
    g.save(); g.globalAlpha = 0.85; g.fillStyle = DUP; smooth([[-60, -400], [-20, -410], [-90 - (o.wind || 0) * 60, -200], [-120 - (o.wind || 0) * 120, -60], [-80, -80], [-40, -300]], true, 0.5); g.fill(); g.restore();
  } else {
    limb(-20, -240, -24, -10, 32, 28, TROUSER); limb(20, -240, 24, -10, 32, 28, TROUSER);
    smooth([[-62, -410], [62, -410], [66, -230], [-66, -230]], true, 0.2); g.fillStyle = DENIM[0]; g.fill();
    g.fillStyle = TEE; path([[-18, -410], [18, -410], [14, -240], [-14, -240]]); g.fill();
  }
  const sl = fem ? PINK[0] : DENIM[0];
  if (!o.armsUp) { limb(-56, -390, -70, -250, 24, 20, sl); hand(who, -72, -244, 1.6, 0.9); }
  const wa = o.arm || 0;
  if (o.armsUp) { const sw = Math.sin(t * 4) * 0.08; limb(-56, -390, -150, -560, 24, 20, sl); hand(who, -158, -574, -2.2 + sw, 0.9, 'open'); limb(56, -390, 150, -560, 24, 20, sl); hand(who, 158, -574, -1.0 - sw, 0.9, 'open'); }
  else if (wa > 0) { const a = -1.2 - 0.9 * wa + 0.35 * Math.sin(t * 9) * wa; limb(56, -390, 56 + Math.cos(a) * 130, -390 + Math.sin(a) * 130, 24, 20, sl); hand(who, 56 + Math.cos(a) * 140, -390 + Math.sin(a) * 140, a, 0.9, 'open'); }
  else { limb(56, -390, 70, -250, 24, 20, sl); hand(who, 72, -244, 1.5, 0.9); }
  g.translate(0, -470); g.scale(0.95, 0.95); faceFront(who, { turn: o.turn || 0, mouth: o.mouth || 'smile', eyes: o.eyes, hairLen: 130, hairWind: o.wind || 0 });
  g.restore();
}
