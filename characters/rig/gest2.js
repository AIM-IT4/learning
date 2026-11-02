// Gesture set v2 for the talking reel. Rules: elbows stay soft and low, hands work in the space in front of the torso,
// pointing and presenting aim at real targets (opts.target: a point, or a function of time), beats are one-handed,
// relaxed hands keep their fingers together. Loaded after gest.js; overrides and extends Gest.G.
(function () {
  const V = (x, y) => ({ x, y }), PI = Math.PI, G = Gest.G, HP = Hand.POSES;
  const tgtOf = o => o && o.target ? (typeof o.target === 'function' ? o.target() : o.target) : null;
  const toward = (m, a, T, reach) => { const S = m.sh[a], d = Math.hypot(T.x - S.x, T.y - S.y) || 1, ux = (T.x - S.x) / d, uy = (T.y - S.y) / d, r = 120 * m.s * reach;
    return { S, ux, uy, ang: Math.atan2(uy, ux), at: V(S.x + ux * r, S.y + uy * r) }; };

  // ---- hand shapes
  HP.rest = { c: [.16, .2, .25, .3], s: .02, ta: .16, to: .3, tc: .3, fx: .06, dv: .02, ph: .5 };       // fingers together, soft curl
  HP.blade = { c: [.04, .05, .07, .1], s: .03, ta: .22, to: .28, tc: .12, fx: -.04 };                    // flat hand, fingers together
  HP.offer = { c: [.1, .12, .15, .2], s: .32, ta: .62, to: .24, tc: .08, fx: -.22 };                     // open palm, gently cupped

  // ---- arm gestures (positions relative to the shoulder, at scale 1; sd: the arm's screen side)
  // rest: arms hang with a soft elbow turned toward the camera; relaxed hands, fingers together
  // (every gesture sets a full-weight palm direction, so hand turns always blend between two defined directions)
  G.rest = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 9 * m.s, m.sh[a].y + 112 * m.s), hb: sd * .5, pose: 'rest', face: [-sd, .1, .35], faceW: 1 });
  const chest0 = G.chest; G.chest = (z, p, a, sd, m, o) => Object.assign(chest0(z, p, a, sd, m, o), { faceW: 1 });
  // home: a forearm resting across the belt line, the hand relaxed near the middle (a presenter's neutral)
  G.home = (z, p, a, sd, m) => ({ hand: V(p.x - sd * 4 * m.s, m.sh[a].y + 90 * m.s), hb: sd, pose: 'rest', aim: sd > 0 ? PI - .3 : .3, aimW: .75, face: [0, -.2, -1], faceW: 1 });
  // present: an open palm to the side; the elbow low, the forearm rising a little
  G.present = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 66 * m.s, m.sh[a].y + 42 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.3 : PI + .3, aimW: 1, face: [sd * .35, -1, .5], faceW: 1 });
  // presentTo: the open palm offered toward a target, the hand ~62% of the arm's reach along the line to it
  G.presentTo = (z, p, a, sd, m, o) => { const w = toward(m, a, tgtOf(o), o.reach || .62);
    return { hand: V(w.at.x, w.at.y + 10 * m.s), hb: -sd, pose: 'offer', aim: w.ang + sd * .1, aimW: 1, face: [w.ux * .45, -1, .5], faceW: 1 }; };
  // pointAt: the index finger on the line from the shoulder to the target
  G.pointAt = (z, p, a, sd, m, o) => { const T = tgtOf(o), S = m.sh[a], dx = T.x - S.x, dy = T.y - S.y, el = Math.atan2(-dy, Math.abs(dx)), mx = o.maxEl ?? .95;
    let h, re = !!o.drop;
    if (el > mx) { const sx = Math.abs(dx) < .35 * Math.abs(dy) ? sd : Math.sign(dx), r = 120 * m.s * (o.reachUp ?? .95);
      h = V(S.x + sx * Math.cos(mx) * r, S.y - Math.sin(mx) * r + (o.drop || 0) * m.s); re = true; }
    else { const u = Math.max(0, Math.min(1, (el - .3) / .6)), w = toward(m, a, T, o.reach || .8 + .13 * u * u * (3 - 2 * u)); h = V(w.at.x, w.at.y + (o.drop || 0) * m.s); }
    return { hand: h, hb: o.hb ?? -sd * .85, pose: 'point', aim: re ? Math.atan2(T.y - h.y, T.x - h.x) : Math.atan2(dy, dx), aimW: 1, face: [0, 1, .3], faceW: 1 }; };
  // shrug: elbows in at the sides, forearms out and level, palms up
  G.shrug = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 42 * m.s, m.sh[a].y + 79 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.28 : PI + .28, aimW: 1, face: [sd * .3, -1, .5], faceW: 1 });
  G.shrug2 = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 45 * m.s, m.sh[a].y + 73 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.34 : PI + .34, aimW: 1, face: [sd * .3, -1, .5], faceW: 1 });   // the other arm, a little higher (no twinning)
  // beat: a one-handed blade in front of the chest, palm to the midline, fingers up and a little out
  // explain: a palm-up hand out at the side of the waist, elbow tucked in (the talking hand; beats ride on it)
  G.explain = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 30 * m.s, m.sh[a].y + 80 * m.s), hb: -sd * .45, pose: 'offer', aim: sd > 0 ? .2 : PI - .2, aimW: 1, face: [sd * .2, -1, .7], faceW: 1 });
  G.explainHi = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 36 * m.s, m.sh[a].y + 62 * m.s), hb: -sd * .45, pose: 'offer', aim: sd > 0 ? .05 : PI - .05, aimW: 1, face: [sd * .25, -1, .7], faceW: 1 });
  G.beat = G.explain;
  // homeOpen: the waist hand turns palm-up (a small "here's the thing")
  G.homeOpen = (z, p, a, sd, m) => ({ hand: V(p.x + sd * 8 * m.s, m.sh[a].y + 80 * m.s), hb: sd, pose: 'offer', aim: sd > 0 ? PI - .25 : .25, aimW: .8, face: [0, -1, .55], faceW: 1 });
  // you: an open hand offered toward the camera, palm up ("over to you")
  G.you = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 38 * m.s, m.sh[a].y + 54 * m.s), hb: -sd * .45, pose: 'offer', aim: sd > 0 ? .3 : PI - .3, aimW: 1, face: [sd * .1, -1, .85], faceW: 1, ff: .82 });
  // wave: upper arm out, forearm up, the palm to the camera beside the head
  G.wave = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 56 * m.s, m.sh[a].y - 60 * m.s), hb: -sd, pose: 'wave', aim: -PI / 2 + sd * .12, aimW: 1, face: [0, 0, 1], faceW: 1 });
  // lift: a palm-up hand rising at the side (the floor coming up); high: the hand up above the head, palm up, pushing
  G.raiseLow = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 50 * m.s, m.sh[a].y + 84 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.05 : PI + .05, aimW: 1, face: [sd * .2, -1, .4], faceW: 1 });
  G.raiseMid = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 58 * m.s, m.sh[a].y + 30 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.2 : PI + .2, aimW: 1, face: [sd * .2, -1, .4], faceW: 1 });
  G.high = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 34 * m.s, m.sh[a].y - 92 * m.s), hb: -sd, pose: 'offer', aim: sd > 0 ? -.15 : PI + .15, aimW: 1, face: [0, -1, .25], faceW: 1 });
})();
// air quotes: both hands up beside the head, index and middle fingers flicking down
Hand.POSES.quote = { c: [-.03, -.02, .95, 1], s: .45, ta: .3, to: .62, tc: 1.05, ph: .35 };
Hand.POSES.quoteCurl = { c: [.55, .62, .95, 1], s: .4, ta: .3, to: .62, tc: 1.05, ph: .35 };
Gest.G.quote = (z, p, a, sd, m) => ({ hand: { x: m.sh[a].x + sd * 32 * m.s, y: m.sh[a].y - 6 * m.s }, hb: -sd, pose: 'quote', aim: -Math.PI / 2 + sd * .22, aimW: 1, face: [0, 0, 1], faceW: 1 });
Gest.G.quoteCurl = (z, p, a, sd, m) => Object.assign(Gest.G.quote(z, p, a, sd, m), { pose: 'quoteCurl' });
// presentLow: an open palm toward a target but kept at chest height (elevation capped), so a high target never turns it into a wave
Gest.G.presentLow = (z, p, a, sd, m, o) => { const T = typeof o.target === 'function' ? o.target() : o.target, S = m.sh[a], dx = T.x - S.x, dy = T.y - S.y;
  const el = Math.min(Math.atan2(-dy, Math.abs(dx)), o.maxUp ?? .38), ux = Math.sign(dx || sd) * Math.cos(el), uy = -Math.sin(el), r = 120 * m.s * (o.reach || .6);
  return { hand: { x: S.x + ux * r, y: S.y + uy * r + 28 * m.s }, hb: -sd, pose: 'offer', aim: Math.atan2(uy, ux), aimW: 1, face: [ux * .45, -1, .5], faceW: 1 }; };
// lab helper: a gesture defined inline, opts.fn(z, p, a, sd, m, opts)
Gest.G.raw = (z, p, a, sd, m, o) => o.fn(z, p, a, sd, m, o);
// presentSide: the open palm presented out to the side at chest height, turned toward a target (a list or a panel above or beside);
// the hand never rises past the shoulder line, so a high target can't turn it into a wave
Gest.G.presentSide = (z, p, a, sd, m, o) => { const T = typeof o.target === 'function' ? o.target() : o.target, S = m.sh[a], dx = T.x - S.x, dy = T.y - S.y, dir = Math.sign(dx) || sd;
  const el = Math.atan2(-dy, Math.abs(dx)), k = Math.max(-.5, Math.min(1, el / .6)), e = Math.max(-.35, Math.min(.42, el)), r = (o.reach || 1) * m.s;
  return { hand: { x: S.x + dir * 72 * r, y: S.y + (44 - 24 * k) * m.s }, hb: -sd, pose: 'offer', aim: Math.atan2(-Math.sin(e), dir * Math.cos(e)), aimW: 1, face: [dir * .45, -1, .5], faceW: 1 }; };
// level: a flat hand, palm down, marking a level (the floor at the hip or the waist, the ceiling beside or above the head)
{ const lvl = (dx, dy, aimIn) => (z, p, a, sd, m) => ({ hand: { x: m.sh[a].x + sd * dx * m.s, y: m.sh[a].y + dy * m.s }, hb: -sd, pose: 'blade',
    aim: aimIn ? (sd > 0 ? Math.PI - .06 : .06) : (sd > 0 ? -.06 : Math.PI + .06), aimW: 1, face: [0, 1, .3], faceW: 1 });
  Gest.G.levelLow = lvl(46, 100, false); Gest.G.levelMid = lvl(54, 62, false); Gest.G.levelUp = lvl(40, -38, true); Gest.G.levelHigh = lvl(30, -96, true); }
