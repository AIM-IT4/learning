// Desk2Quant motion library for the cast rig (cast.js):
//   Motion.walk   heel-toe walk (contact > down > passing > up) with planted feet that never slide, a weight-led
//                 start and settle, arms swinging against the legs with drag, and the head steadied against the bob
//   Motion.turn   the eyes lead, the head follows, the body comes last; a blink as the head crosses its drawing swap
//   Motion.blink  fast close, a held frame, slower open
//   Motion.talk   syllable-rate mouth with small head accents
//   Motion.reach  arm move with anticipation, an arc and a damped settle
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const V = (x, y) => ({ x, y }), lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ss = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const sstep = (a, b, x) => ss((x - a) / (b - a));
  const io3 = u => { u = clamp(u, 0, 1); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const rot = (p, a) => V(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));
  const herm = (p0, m0, p1, m1, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };

  // ---------------- foot rolling model ----------------
  // The shoe's lower outline (its convex hull, sampled from the drawing) rolls on the floor without slipping. Rotated
  // by th (+ toe down), the foot rests on the hull vertex whose two edges straddle the horizontal: heel strike rocks
  // on the round of the heel, toe-off on the toe spring, and the ankle height comes from the drawing itself.
  const FM = new Map();
  function footModel(z, sv, s) {
    const key = z.who + '|' + sv + '|' + s.toFixed(4); if (FM.has(key)) return FM.get(key);
    const sh = z.S.shoe, SH = sh[sv], k = Cast.K * s * (sh.sc || 1), oy = sh.oy * s;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('style', 'position:absolute;width:0;height:0'); document.body.appendChild(svg);
    const pts = [];
    for (const d of [SH.body, SH.soleF].filter(Boolean)) {
      const el = document.createElementNS(NS, 'path'); el.setAttribute('d', d); svg.appendChild(el);
      const n = el.getTotalLength();
      for (let l = 0; l <= n + 1e-6; l += .4) { const p = el.getPointAtLength(Math.min(l, n)); pts.push([p.x * k, oy + p.y * k]); }
    }
    svg.remove();
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), ch = [];
    for (const p of pts) { while (ch.length >= 2 && cr(ch[ch.length - 2], ch[ch.length - 1], p) >= 0) ch.pop(); ch.push(p); }   // the chain with the largest y (the sole)
    const al = [], S = [0];
    for (let j = 0; j < ch.length - 1; j++) { al.push(Math.atan2(ch[j + 1][1] - ch[j][1], ch[j + 1][0] - ch[j][0])); S.push(S[j] + Math.hypot(ch[j + 1][0] - ch[j][0], ch[j + 1][1] - ch[j][1])); }
    const contact = th => { let j = 0; while (j < al.length && al[j] + th > 0) j++; return j; };
    const j0 = contact(0), M = { ch, S, al, contact, x0: ch[j0][0], s0: S[j0], yf: ch[j0][1] };
    // ankle relative to a flat-foot reference: a along the walk, h up from the flat ankle height
    M.ankle = (pos, th) => { const j = contact(th), r = rot(V(ch[j][0], ch[j][1]), th); return { a: pos + M.x0 + (S[j] - M.s0) - r.x, h: r.y - M.yf, th }; };
    M.minH = th => { const j = contact(th), r = rot(V(ch[j][0], ch[j][1]), th); return r.y - M.yf; };
    FM.set(key, M); return M;
  }

  // ---------------- walk ----------------
  // o: t0 (first weight shift), x0 -> x1, ground (floor y; a planted ankle sits 4 above it, as in stand()),
  //    f facing drawn (1 profile, .55 three-quarter; the sign follows the direction), s scale, T seconds per step,
  //    step natural step length (world units at s=1), bob, lean, arm (swing, rad), lift (swing-foot clearance),
  //    depth (near/far foot offset on the floor), lead (which leg steps first), heel / toe (strike and push-off angles)
  // returns pose(t) with .t1 (when the walker is still again), .N (steps) and .phase(t)
  function walk(z, o) {
    const s = o.s || 1, dir = Math.sign(o.x1 - o.x0) || 1, D = Math.abs(o.x1 - o.x0), af = Math.abs(o.f != null ? o.f : 1), f = dir * af;
    const T = o.T || .5, lead = o.lead || 0, g = o.ground, legLen = (z.L.TH + z.L.SH) * s, prof = af > .9;
    const Lnat = (o.step || 112) * s, N = Math.max(2, Math.round(D / Lnat) + 1), L = D / (N - 1);
    const pre = .4, post = 1.1;
    const bobA = (o.bob != null ? o.bob : 4.5) * s, leanA = o.lean != null ? o.lean : .05, armA = o.arm != null ? o.arm : .38;
    const lift = (o.lift != null ? o.lift : 18) * s, depth = (o.depth != null ? o.depth : prof ? 3 : 8) * s;
    const restH = legLen - 6 * s, walkH = .943 * legLen, ankY = g - 4 * s;
    const thHS = -(o.heel != null ? o.heel : .3), thTO = o.toe != null ? o.toe : .62;
    const anc0 = z.anchorsAt(f, s, 0), near = f >= 0 ? 0 : 1;
    const legs = [0, 1].map(i => {
      const { sv } = z.shoeView(f, i), sv2 = sv === 'front' ? 'q' : sv;
      return { sv: sv2, kq: sv2 === 'q' ? .85 : 1, M: footModel(z, sv2, s), hx: anc0.hips[i].x, dy: i === near ? depth : -depth };
    });
    // plants: where each foot rests (pos = flat ankle position along the walk) and when it lands / lifts
    const plants = [[], []];
    for (const i of [0, 1]) plants[i].push({ pos: 0, qOn: -Infinity, roll: 0, hs: 0, qOff: Infinity, hoff: Infinity, to: thTO });
    for (let k = 1; k <= N; k++) {
      const i = (k - 1 + lead) % 2, P = plants[i], prev = P[P.length - 1], last = k === N, first = k === 1;
      prev.qOff = k - .8; prev.hoff = first ? -.3 : Math.max(prev.qOn + .2, k - 1.3);
      if (first) prev.to = thTO * .8;
      if (last) prev.to = thTO * .75;
      P.push({ pos: Math.min(k, N - 1) * L, qOn: k, roll: last ? .2 : .16, hs: last ? thHS * .45 : thHS, qOff: Infinity, hoff: Infinity, to: thTO, short: first || last });
    }
    const planted = (i, pl, q) => {
      let th = 0;
      if (q < pl.qOn + pl.roll) th = pl.hs * (1 - ss((q - pl.qOn) / pl.roll));                       // heel strike: the toe comes down
      else if (q > pl.hoff) { const u = clamp((q - pl.hoff) / (pl.qOff - pl.hoff), 0, 1); th = pl.to * u * u * (2 - u); }   // heel peels off
      return legs[i].M.ankle(pl.pos, th);
    };
    const swing = (i, A, B, q) => {
      const q0 = A.qOff, q1 = B.qOn, dq = q1 - q0, u = (q - q0) / dq, e = 1e-3;
      const s0 = planted(i, A, q0), sp = planted(i, A, q0 - e), s1 = planted(i, B, q1), sl = B.short ? .65 : 1;
      const a = herm(s0.a, (s0.a - sp.a) / e * dq, s1.a, 0, u);
      const w0 = (s0.th - sp.th) / e * dq, th = herm(s0.th, w0, s1.th, 0, u);
      let h = herm(s0.h, (s0.h - sp.h) / e * dq, s1.h, 0, u) + lift * sl * Math.pow(Math.sin(Math.PI * u), 2) * (1.3 - .6 * u);
      h = Math.max(h, legs[i].M.minH(th));                                                              // never through the floor
      return { a, h, th };
    };
    const footAt = (i, q) => {
      const P = plants[i];
      for (let j = 0; j < P.length; j++) { if (q < P[j].qOn) return swing(i, P[j - 1], P[j], q); if (q < P[j].qOff) return planted(i, P[j], q); }
      return planted(i, P[P.length - 1], q);
    };
    // pelvis progress along the walk: accelerates out of the first step, decelerates into the last (in steps)
    const Hs = q => q <= 0 ? .5 : (.5 + .5 * q) * Math.exp(-3 * q), HN = Hs(N);
    const prog = q => q <= 0 ? 0 : q >= N ? N - 1 : q - .5 + Hs(q) - Hs(N - q) + HN - 2 * HN * q / N;
    const envOf = q => ss((q + pre) / 1.3) * (1 - ss((q - N + 1.2) / 1.9));
    const t1 = o.t0 + (pre + N + post) * T;
    const phase = t => -pre + (t - o.t0) / T;
    const core = q => {
      const env = envOf(q), qc = clamp(q, -pre, N + post);
      const X = o.x0 + dir * L * prog(qc);
      const bob = bobA * env * Math.cos(2 * Math.PI * (qc - .12));
      // stop: the upper body carries on a little, then settles back
      const stopU = qc - N, carry = qc > N - 1 ? .028 * Math.sin(Math.PI * clamp((qc - N + 1) / 1.5, 0, 1)) * Math.exp(-2.2 * Math.max(0, stopU)) : 0;
      const settle = stopU > 0 ? -.012 * Math.sin(2 * Math.PI * clamp(stopU / 1.1, 0, 1)) * Math.exp(-2 * stopU) : 0;
      const lean = dir * (leanA * env + .012 * env * Math.cos(2 * Math.PI * (qc - .05)) + carry + settle + (q < 0 ? .02 * Math.sin(Math.PI * clamp((q + pre) / pre, 0, 1)) : 0));
      const y = ankY - lerp(restH, walkH, env) + bob + (stopU > 0 ? 2.2 * s * Math.sin(Math.PI * clamp(stopU / 1, 0, 1)) * Math.exp(-1.5 * stopU) : 0);
      return { X, y, lean, env };
    };
    const armAt = (i, q, P, sh) => {
      const env = envOf(q), lag = .14, sg = ((i ^ lead) ? -1 : 1), sig = sg * Math.cos(Math.PI * (q - lag)) * env;
      const al = armA * (sig > 0 ? 1.12 * sig : .85 * sig), r = (z.L.U + z.L.F) * s * (.93 - .12 * Math.max(0, sig));
      return V(P.x + sh.x + dir * Math.sin(al) * r * (prof ? 1 : .82), P.y + sh.y + Math.cos(al) * r + (prof ? 0 : .12 * Math.sin(al) * r) * (i === near ? 1 : -1));
    };
    const pose = t => {
      const q = phase(t), C = core(q), P = V(C.X, C.y), A = z.anchorsAt(f, s, C.lean);
      const ft = [0, 1].map(i => footAt(i, clamp(q, -pre, N + post)));
      const foot = ft.map((F, i) => V(o.x0 + dir * F.a + legs[i].hx, ankY - F.h + legs[i].dy));
      const hand = [0, 1].map(i => armAt(i, q, P, A.shoulders[i]));
      const dt = .05, qa = phase(t - 2 * dt), qb = phase(t), Ca = core(qa), Cb = core(qb);      // recent motion (lags), for the hands' follow-through
      const Aa = z.anchorsAt(f, s, Ca.lean), Ab = z.anchorsAt(f, s, Cb.lean);
      const handVel = [0, 1].map(i => { const a = armAt(i, qa, V(Ca.X, Ca.y), Aa.shoulders[i]), b = armAt(i, qb, V(Cb.X, Cb.y), Ab.shoulders[i]); return V((b.x - a.x) / (2 * dt), (b.y - a.y) / (2 * dt)); });
      const lo = C.lean - dir * leanA * C.env;                                                        // the head stays steadier than the torso
      return {
        x: C.X, y: C.y, s, f, hf: f, lean: C.lean, tilt: -.85 * lo - dir * .3 * leanA * C.env - dir * .01 * C.env * Math.cos(2 * Math.PI * (q - .3)),
        foot, footRot: ft.map((F, i) => F.th / legs[i].kq), footExact: true, fb: [dir * (prof ? 1 : .92), dir * (prof ? 1 : .92)],
        hand, hb: [-dir, -dir], handPose: ['relaxed', 'relaxed'], handVel, ground: g, look: V(dir * 2.2, 0),
      };
    };
    pose.t1 = t1; pose.N = N; pose.L = L; pose.T = T; pose.phase = phase; pose.dir = dir;
    return pose;
  }

  // ---------------- blink ----------------
  // 1 = open. Fast close (2 frames at 30 fps), a held frame, slower open (4 frames)
  function blink(t, times) {
    let b = 1;
    for (const c of times) {
      const d = t - c; if (d < -.07 || d > .2) continue;
      const v = d < 0 ? 1 - Math.pow(ss((d + .07) / .07), 1.4) : d < .035 ? 0 : ss((d - .035) / .14);
      b = Math.min(b, v);
    }
    return b;
  }
  // a natural blink track: every 2.2-4.6 s, with an occasional double blink
  function blinkTrack(seed, t0, t1) {
    let r = seed * 9301 + 49297; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const out = []; let b = t0 + .6 + 1.4 * rnd();
    while (b < t1) { out.push(b); if (rnd() < .18) out.push(b + .3); b += 2.2 + 2.4 * rnd(); }
    return out;
  }

  // ---------------- turn ----------------
  // facing f0 -> f1 over [t0, t0 + d]: eyes lead, head follows, body last; returns pose fields
  function turn(t, t0, d, f0, f1, o = {}) {
    const hAt = t => f0 + (f1 - f0) * io3(((t - t0) / d - .05) / .55), bAt = t => f0 + (f1 - f0) * io3(((t - t0) / d - .2) / .75);
    const u = (t - t0) / d, hf = hAt(t), f = bAt(t), dt = 1 / 240;
    const vh = Math.abs(hAt(t + dt) - hAt(t - dt)) / (2 * dt), vb = Math.abs(bAt(t + dt) - bAt(t - dt)) / (2 * dt);
    const near = a => Math.max(Math.exp(-Math.pow((Math.abs(a) - .3) / .07, 2)), Math.exp(-Math.pow((Math.abs(a) - .78) / .07, 2)));
    // the eyes get there first, then centre again as the head catches up
    const ld = Math.sign(f1 - f0) * (o.lookAmt != null ? o.lookAmt : 5) * (ss(u / .2) - ss((u - .45) / .45));
    // blink as the head swaps drawings (a classic turn cheat)
    let blinkT = null;
    if (o.blink !== false) for (let k = 1; k <= 160 && blinkT == null; k++) {
      const ta = t0 + d * (k - 1) / 160, tb = t0 + d * k / 160;
      for (const th of [.3, .78]) if ((Math.abs(hAt(ta)) - th) * (Math.abs(hAt(tb)) - th) <= 0 && Math.abs(hAt(ta)) !== Math.abs(hAt(tb))) { blinkT = tb; break; }
    }
    // anticipation: a small dip of the head away from the turn, then a settle tilt
    const tilt = Math.sign(f1 - f0) * (-.025 * Math.sin(Math.PI * clamp(u / .25, 0, 1)) + .02 * Math.sin(Math.PI * clamp((u - .55) / .45, 0, 1)));
    return {
      f, hf, look: V(ld, 0), tilt, blink: blinkT != null ? blink(t, [blinkT]) : 1, blinkT,
      smear: clamp(near(f) * vb * .1, 0, .55), headSmear: clamp(near(hf) * vh * .1, 0, .6),
    };
  }

  // ---------------- talk ----------------
  // segs: [[t0, t1], ...]; returns {talk, talkT, nod}
  function talk(t, segs) {
    let e = 0; for (const [a, b] of segs) e = Math.max(e, sstep(a - .06, a + .08, t) * (1 - sstep(b - .1, b + .04, t)));
    return { talk: e, talkT: t, nod: e * (.012 * Math.sin(2 * Math.PI * 1.6 * t) + .008 * Math.sin(2 * Math.PI * 2.7 * t + 1)) };
  }

  // ---------------- reach ----------------
  // wrist from a to b over [t0, t0 + d]: a small wind-up against the move, an arc (bow: + to the left of travel),
  // and a damped settle past the target; returns the wrist and its velocity
  function reach(t, t0, d, a, b, o = {}) {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    if (o.pivot) { const mx = (a.x + b.x) / 2 - o.pivot.x, my = (a.y + b.y) / 2 - o.pivot.y; if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; } }   // bow away from the pivot
    // keep the path clear of the pivot (a wrist swinging past the shoulder): bow at least enough to pass at radius minR
    let bowL = (o.bow != null ? o.bow : .12) * l;
    // (only for moves that start and end outside that radius: a hand working near the shoulder takes no detour; capped)
    if (o.pivot && o.minR && Math.hypot(a.x - o.pivot.x, a.y - o.pivot.y) > o.minR && Math.hypot(b.x - o.pivot.x, b.y - o.pivot.y) > o.minR) {
      const mx = (a.x + b.x) / 2 - o.pivot.x, my = (a.y + b.y) / 2 - o.pivot.y, along = mx * nx + my * ny, perp = Math.abs(mx * dx / l + my * dy / l);
      const need = Math.sqrt(Math.max(0, o.minR * o.minR - perp * perp)) - along; bowL = Math.max(bowL, Math.min(need, .6 * l)); }
    const at = t => {
      const u = (t - t0) / d; if (u <= 0) return a; if (u >= 1) return b;
      const wind = (o.wind != null ? o.wind : .07) * Math.pow(Math.sin(Math.PI * clamp(u / .32, 0, 1)), 2);   // eases into the anticipation and out of it
      const m = io3((u - .12) / .76), w = clamp((u - .72) / .28, 0, 1), over = (o.over != null ? o.over : .05) * Math.sin(Math.PI * w) * (1 - w);
      const k = m - wind + over, bow = bowL * Math.sin(Math.PI * clamp(m, 0, 1));
      return V(a.x + dx * k + nx * bow, a.y + dy * k + ny * bow);
    };
    const p = at(t), e = 1 / 240, p0 = at(t - e), p1 = at(t + e);
    return { p, v: V((p1.x - p0.x) / (2 * e), (p1.y - p0.y) / (2 * e)) };
  }

  window.Motion = { walk, turn, blink, blinkTrack, talk, reach, footModel, ss, sstep, io3 };
})();
