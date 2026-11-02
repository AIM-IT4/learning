// Gesture library for the cast: each gesture places one wrist relative to the body (shoulder, chest, chin) and sets
// the hand's pose and orientation; Gest.track() moves between gestures the way a motion designer would key it
// (anticipation, an arced path, the hand shape forming on arrival, a damped settle).
(function () {
  const V = (x, y) => ({ x, y }), clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hmix = (a, b, u) => u <= 0 ? a : u >= 1 ? b : { a, b, u };
  const PI = Math.PI;
  function headPt(z, p, hx, hy) {
    const L = z.L, s = p.s || 1, la = p.lean || 0, ha = la + (p.tilt || 0), u = Cast.K * s * (z.S.hs || Cast.HS), hf = p.hf != null ? p.hf : (p.f || 0);
    const hms = Math.abs(hf) < .3 ? 1 : Math.sign(hf) || 1;
    const cx = p.x + Math.sin(la) * L.T * s + Math.sin(ha) * (L.NECK + L.R) * s, cy = p.y - Math.cos(la) * L.T * s - Math.cos(ha) * (L.NECK + L.R) * s;
    const lx = hms * hx * u, ly = hy * u;
    return V(cx + lx * Math.cos(ha) - ly * Math.sin(ha), cy + lx * Math.sin(ha) + ly * Math.cos(ha));
  }
  const FISTL = { c: [.62, .7, .76, .8], s: .02, ta: .35, to: .55, tc: .55, fx: -.15 };
  // a: arm (0 = the character's right, on screen left in front view); sd: its screen side (-1 left, +1 right)
  const G = {
    rest: (z, p, a, sd, m) => ({ hand: V(p.x + sd * 42 * m.s, p.y + 2 * m.s), hb: sd, pose: 'relaxed' }),
    pocket: (z, p, a, sd, m) => ({ hand: V(p.x + sd * 30 * m.s, p.y - 14 * m.s), hb: sd, pose: 'pocket', aim: PI / 2 - sd * .18, aimW: 1, ff: 1.14 }),
    wave: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 34 * m.s, m.sh[a].y - 78 * m.s), hb: -sd, pose: 'wave', aim: -PI / 2 + sd * .12, aimW: 1, face: [0, 0, 1], faceW: 1 }),
    point: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 80 * m.s, m.sh[a].y - 58 * m.s), hb: -sd, pose: 'point', aim: sd > 0 ? -.62 : -PI + .62, aimW: 1 }),
    one: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 21 * m.s, m.sh[a].y + 6 * m.s), hb: -sd, pose: 'point', aim: -PI / 2 - sd * .06, aimW: 1, face: [0, 0, 1], faceW: 1 }),
    two: (z, p, a, sd, m) => Object.assign(G.one(z, p, a, sd, m), { pose: 'two' }),
    four: (z, p, a, sd, m) => Object.assign(G.one(z, p, a, sd, m), { pose: 'four' }),
    // talking beats: an open hand in front of the body, palm up and a little toward the listener
    beat: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x - sd * 6 * m.s, m.sh[a].y + 66 * m.s), hb: sd, pose: 'present', aim: sd > 0 ? -.55 : Math.PI + .55, aimW: .8, face: [0, -1, .7], faceW: .9, ff: .62 }),
    // shrug: both forearms out, palms up
    shrug: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 46 * m.s, m.sh[a].y + 58 * m.s), hb: -sd, pose: 'open', aim: sd > 0 ? -.35 : Math.PI + .35, aimW: 1, face: [0, -1, .45], faceW: 1 }),
    // hand on the chest ("that's you" / "me")
    chest: (z, p, a, sd, m) => ({ hand: V(p.x - sd * 4 * m.s, m.sh[a].y + 30 * m.s), hb: sd, pose: 'present', aim: sd > 0 ? Math.PI - .25 : .25, aimW: 1, face: [0, 0, -1], faceW: .8 }),
    // point at the viewer: forearm toward the camera, index up and out
    pointCam: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x - sd * 4 * m.s, m.sh[a].y + 46 * m.s), hb: sd * .5, pose: 'point', aim: -Math.PI / 2 - sd * .5, aimW: .7, face: [0, 0, 1], faceW: .4, ff: .45 }),
    three: (z, p, a, sd, m) => Object.assign(G.one(z, p, a, sd, m), { pose: 'three' }),
    thumb: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x - sd * 14 * m.s, m.sh[a].y + 52 * m.s), hb: sd * .8, ff: .5, pose: 'thumbsup', aim: sd > 0 ? PI : 0, aimW: 1, face: [0, 0, -1], faceW: 1 }),
    ok: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 21 * m.s, m.sh[a].y + 6 * m.s), hb: -sd, pose: 'ok', aim: -PI / 2 + sd * .1, aimW: 1, face: [-sd * .8, 0, 1], faceW: 1 }),
    present: (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 66 * m.s, m.sh[a].y + 66 * m.s), hb: -sd, pose: 'present', aim: sd > 0 ? -.25 : PI + .25, aimW: 1, face: [0, -1, .6], faceW: 1 }),
    think: (z, p, a, sd, m) => { const chin = headPt(z, p, -sd * 8, 35); return { hand: V(chin.x - sd * 3 * m.s, chin.y + 16 * m.s), hb: sd, pose: FISTL, aim: -PI / 2 - sd * .1, aimW: 1, face: [0, 0, -1], faceW: 1 }; },
  };
  const marks = (z, p) => { const s = p.s || 1, A = z.anchorsAt(p.f || 0, s, p.lean || 0); return { s, sh: A.shoulders.map(q => V(p.x + q.x, p.y + q.y)), hip: A.hips.map(q => V(p.x + q.x, p.y + q.y)) }; };
  // palm direction blend. With the hand's axis known (th: its world angle mid-move) the palm turns about that axis, as a forearm
  // does: a blend never runs along the axis (where the palm direction is undefined and the hand would flip), and a turn of about
  // half a circle goes the way that shows the palm to the camera. Without it, opposite directions turn through palm-sideways
  // (toward the body's midline) instead of through zero
  function faceMix(A, B, e, a, th) {
    const n = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); }, nl = (P, Q, w) => n(P.map((x, k) => lerp(x, Q[k], w)));
    const a1 = n(A), b1 = n(B), d = a1[0] * b1[0] + a1[1] * b1[1] + a1[2] * b1[2];
    if (th != null && d <= -.2) {
      const h = [Math.cos(th), Math.sin(th), 0], dt = (P, Q) => P[0] * Q[0] + P[1] * Q[1] + P[2] * Q[2], cr = (P, Q) => [P[1] * Q[2] - P[2] * Q[1], P[2] * Q[0] - P[0] * Q[2], P[0] * Q[1] - P[1] * Q[0]];
      const oh = v => { const k = dt(v, h), w = v.map((x, j) => x - k * h[j]), l = Math.hypot(...w); return l > .3 ? w.map(x => x / l) : null; };
      const pa = oh(a1), pb = oh(b1);
      if (pa && pb) {
        const rot = (v, g) => { const c = Math.cos(g), s = Math.sin(g), hv = cr(h, v); return v.map((x, k) => x * c + hv[k] * s); };
        const p0 = Math.atan2(dt(cr(pa, pb), h), dt(pa, pb)), alt = p0 - 2 * Math.PI * (p0 >= 0 ? 1 : -1), P = n([(a === 0 ? 1 : -1) * .5, 0, 1]);
        const phi = Math.abs(p0) < 2.8 ? p0 : (dt(rot(pa, p0 / 2), P) >= dt(rot(pa, alt / 2), P) ? p0 : alt);
        return rot(pa, phi * e);
      }
    }
    if (d > -.2) return nl(a1, b1, e);
    const mid = [a === 0 ? 1 : -1, 0, 0];
    return e < .5 ? nl(a1, mid, e * 2) : nl(mid, b1, e * 2 - 1);
  }
  // one gesture applied to arm a of pose p (in place); u blends from the arm's current state
  function apply(z, p, a, name, extra) {
    const m = marks(z, p), sd = a === 0 ? -1 : 1, o = extra || {}, g = G[name](z, p, a, sd, m, o);
    for (const k in o) if (k !== 'target') g[k] = o[k];          // opts may carry a target (a point or a function of time) for aimed gestures
    return g;
  }
  // keyed gesture track for one arm: keys [[t, name, dur?, opts?], ...]; returns state at t
  function track(z, keys, a) {
    const ease = u => { u = clamp(u, 0, 1); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    const st = (t, p, i) => {
      const [t1, n1, d1 = .55, o1] = keys[i], cur = apply(z, p, a, n1, o1);
      if (i === 0 || t >= t1 + d1) {
        // moving hold: a held hand drifts a little instead of freezing (less for hands at rest)
        const r = Object.assign({ u: 1 }, cur), h0 = i === 0 ? 0 : t1 + d1, w = sstep(h0, h0 + .45, t) * (p.s || 1) * (n1 === 'rest' || n1 === 'home' ? .5 : 1.3);
        if (w) r.hand = V(r.hand.x + w * Math.sin(t * 1.13 + a * 1.9 + i), r.hand.y + w * 1.15 * Math.sin(t * 1.61 + a * .7 + i * 1.3));
        return r;
      }
      // the move starts from where the hand actually is (a held drift, or a move still under way)
      const prev = st(t1, p, i - 1), u = (t - t1) / d1;
      // wrist path: wind-up against the move, arc, overshoot and settle
      // the path bows away from the shoulder (clearing it), or, for moves across the front of the body ('in'), toward the midline
      const m = marks(z, p), sd = a === 0 ? -1 : 1, inside = o1 && o1.side === 'in';
      const dist = Math.hypot(cur.hand.x - prev.hand.x, cur.hand.y - prev.hand.y) || 1, RO = { bow: (o1 && o1.bow != null) ? o1.bow : .1, wind: Math.min(.04, 8 * m.s / dist), over: .04, pivot: inside ? V(m.sh[a].x + sd * 400, m.sh[a].y) : m.sh[a], minR: inside ? 0 : 62 * m.s };
      const R = Motion.reach(t, t1, d1, prev.hand, cur.hand, RO), R0 = Motion.reach(t - .08, t1, d1, prev.hand, cur.hand, RO);
      R.v = V((R.p.x - R0.p.x) / .08, (R.p.y - R0.p.y) / .08);            // the hand's follow-through trails the wrist's recent motion
      const e = ease(u), sh = sstep(.15, .9, u);            // the hand shape forms over most of the move
      const mixA = (A, B, w) => A == null ? B : B == null ? A : A + Math.atan2(Math.sin(B - A), Math.cos(B - A)) * w;
      return {
        // swivel: on moves across the front of the body the elbow stays at the side and the forearm turns toward the camera
        u, hand: R.p, vel: R.v, hb: lerp(prev.hb, cur.hb, sstep(.25, .75, u)) * (1 - ((o1 && o1.swivel) || 0) * Math.sin(Math.PI * u)), pose: hmix(prev.pose, cur.pose, sh),
        // the hand turns over the whole move, not in a flick in the middle of it
        aim: mixA(prev.aim, cur.aim, sstep(.08, .92, u)), aimW: lerp(prev.aim != null ? (prev.aimW ?? 1) : 0, cur.aim != null ? (cur.aimW ?? 1) : 0, sstep(.06, .92, u)),
        face: !prev.face ? cur.face : !cur.face ? prev.face : faceMix(prev.face, cur.face, e, a, prev.aim != null && cur.aim != null && Math.abs(Math.atan2(Math.sin(cur.aim - prev.aim), Math.cos(cur.aim - prev.aim))) < .8 ? mixA(prev.aim, cur.aim, .5) : null),
        faceW: lerp(prev.face ? (prev.faceW ?? 1) : 0, cur.face ? (cur.faceW ?? 1) : 0, sstep(.1, .9, u)),
        ff: lerp(prev.ff || 1, cur.ff || 1, e), rot: lerp(prev.rot || 0, cur.rot || 0, e),
      };
    };
    return (t, p) => { let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++; return st(t, p, i); };
  }
  // write an arm state into a pose
  function put(p, a, st) {
    const ar = (k, v, d) => { if (!p[k]) p[k] = [d, d]; else p[k] = p[k].slice(); p[k][a] = v; };
    ar('hand', st.hand, null); ar('hb', st.hb, 1); ar('handPose', st.pose, 'relaxed');
    ar('handAim', st.aim != null ? st.aim : null, null); ar('handAimW', st.aim != null ? (st.aimW ?? 1) : 0, 0);
    ar('handFace', st.face || null, null); ar('handFaceW', st.face ? (st.faceW ?? 1) : 0, 0);
    ar('ff', st.ff || 1, 1); ar('handRot', st.rot || 0, 0); if (st.vel) ar('handVel', st.vel, null);
    return p;
  }
  window.Gest = { G, apply, track, put, headPt, marks, FISTL, hmix };
})();
