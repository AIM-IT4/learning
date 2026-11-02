// Desk2Quant character kit: helpers to stage the cast (A–G) and drive them over time.
// Load order: rig/hand.js, rig/cast.js, rig/quants.js, rig/motion.js, rig/gest.js, rig/gest2.js, (sets/env.js), kit.js.
// Everything is deterministic in t (seconds), so a page can expose window.seek(t) and be rendered frame by frame.
(function () {
  const NS = 'http://www.w3.org/2000/svg', V = (x, y) => ({ x, y });
  const mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mixV = (a, b, u) => V(lerp(a.x, b.x, u), lerp(a.y, b.y, u));
  const E = { io: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, o: u => 1 - Math.pow(1 - u, 3), i: u => u * u * u, s: u => u * u * (3 - 2 * u) };
  const P = (t, a, d) => clamp((t - a) / d, 0, 1);

  // ---- the cast ----
  // gender drives voice casting: female characters get a female voice, male characters a male voice (see voice/README.md)
  const CAST = {
    A: { gender: 'male', role: 'aspirant', look: 'orange bomber, crew tee, cropped charcoal trousers, cream socks; can hold a coffee cup' },
    B: { gender: 'male', role: 'aspirant', look: 'oversized brown jacket, cream turtleneck, wide grey-blue jeans, fade haircut' },
    C: { gender: 'female', role: 'aspirant', look: 'plum bob, rust tee, maroon open vest, cream cargo joggers, chunky sneakers, sling backpack' },
    D: { gender: 'male', role: 'desk quant (front-office strat)', look: 'light-blue Oxford, sleeves rolled, navy quilted gilet, lanyard, tan chinos, glasses' },
    E: { gender: 'female', role: 'quant researcher', look: 'high bun, round glasses, sage sweater over a white collar, charcoal trousers, loafers' },
    F: { gender: 'male', role: 'quant developer', look: 'wavy hair, short beard, charcoal hoodie, headphones round the neck, black joggers' },
    G: { gender: 'female', role: 'head of quant research', look: 'silver bob, glasses, camel blazer over a white top, black trousers' },
  };

  // ---- staging ----
  const CASTS = [];
  // a cast member drawn inside parent group g; who: 'A'..'G'
  const castIn = (g, who) => { const cg = mk('g', {}, g), z = new Cast(cg, who); CASTS.push({ z, g: cg, who }); return z; };
  // standing pose with feet on ground g at x, scale s (1 = ~640 units tall, hair top to sole)
  function stand(z, x, g, s = 1, o = {}) {
    const y = g - (z.L.TH + z.L.SH - 2) * s;
    return Object.assign({ x, y, s, f: 0, hand: [V(x - 42 * s, y + 2 * s), V(x + 42 * s, y + 2 * s)], hb: [-1, 1],
      foot: [V(x - 22 * s, g - 4 * s), V(x + 22 * s, g - 4 * s)], footExact: true, ground: g, expr: 'neutral' }, o);
  }
  const breathe = (t, ph = 0) => Math.sin((t + ph) * 2 * Math.PI / 3.1);
  // blend two full poses (walk-to-stand hand-offs and the like)
  function lerpPose(a, b, u) {
    if (u <= 0) return a; if (u >= 1) return b;
    const o = Object.assign({}, b);
    for (const k of ['x', 'y', 'f', 'hf', 'lean', 'tilt', 'ground']) if (a[k] != null || b[k] != null) o[k] = lerp(a[k] != null ? a[k] : (k === 'hf' ? (a.f || 0) : 0), b[k] != null ? b[k] : (k === 'hf' ? (b.f || 0) : 0), u);
    o.hand = [0, 1].map(i => mixV(a.hand[i], b.hand[i], u)); o.foot = [0, 1].map(i => mixV(a.foot[i], b.foot[i], u));
    o.footRot = [0, 1].map(i => lerp((a.footRot || [])[i] || 0, (b.footRot || [])[i] || 0, u)); o.footExact = a.footExact || b.footExact;
    o.look = mixV(a.look || V(0, 0), b.look || V(0, 0), u);
    const hb = q => q.hb || [-1, 1], fb = q => q.fb || [Cast.kneeBend(q.f || 0, 0), Cast.kneeBend(q.f || 0, 1)], ff = q => q.ff || [1, 1], fu = q => q.fu || [1, 1];
    o.hb = [0, 1].map(i => lerp(hb(a)[i], hb(b)[i], u)); o.fb = [0, 1].map(i => lerp(fb(a)[i], fb(b)[i], u)); o.ff = [0, 1].map(i => lerp(ff(a)[i], ff(b)[i], u)); o.fu = [0, 1].map(i => lerp(fu(a)[i], fu(b)[i], u));
    const HP = q => q.handPose || ['relaxed', 'relaxed'];
    o.handPose = [0, 1].map(i => HP(a)[i] === HP(b)[i] ? HP(a)[i] : { a: HP(a)[i], b: HP(b)[i], u: E.s(u) });
    o.handRot = [0, 1].map(i => lerp((a.handRot || [])[i] || 0, (b.handRot || [])[i] || 0, u));
    const wrapA = d => Math.atan2(Math.sin(d), Math.cos(d));
    o.handAim = [0, 1].map(i => { const A = (a.handAim || [])[i], B = (b.handAim || [])[i]; return A == null ? B : B == null ? A : A + wrapA(B - A) * u; });
    o.handAimW = [0, 1].map(i => lerp((a.handAim || [])[i] != null ? ((a.handAimW || [])[i] ?? 1) : 0, (b.handAim || [])[i] != null ? ((b.handAimW || [])[i] ?? 1) : 0, u));
    o.handFace = [0, 1].map(i => { const A = (a.handFace || [])[i], B = (b.handFace || [])[i]; return !A ? B : !B ? A : A.map((q, k) => lerp(q, B[k], u)); });
    o.handFaceW = [0, 1].map(i => lerp((a.handFace || [])[i] ? ((a.handFaceW || [])[i] ?? 1) : 0, (b.handFace || [])[i] ? ((b.handFaceW || [])[i] ?? 1) : 0, u));
    o.handVel = null;
    return o;
  }

  // ---- keyed tracks ----
  const keyAt = (K, t) => { let i = 0; while (i < K.length - 1 && t >= K[i + 1][0]) i++; return i; };
  // expressions: [[t, 'neutral'|'smile'|'focus'|'aha'|'wow'|'calm'|'stuck'], ...], each change blends over 0.22 s
  function acting(K) { return t => { let i = K.length - 1; while (i > 0 && t < K[i][0]) i--; const u = i > 0 ? sstep(K[i][0], K[i][0] + .22, t) : 1; return { expr: i > 0 ? K[i - 1][1] : K[0][1], expr2: K[i][1], exprU: u }; }; }
  const closedX = x => (['smile', 'calm'].includes(x.expr2) && x.exprU > .3) || (['smile', 'calm'].includes(x.expr) && x.exprU < .7);
  // body turns: [[t, facing (-1 left profile .. 0 front .. 1 right profile), dur], ...] (anticipation, smear and settle from Motion.turn)
  function facing(K) { return t => { const i = keyAt(K, t), still = f => ({ f, hf: f, look: V(0, 0), tilt: 0, blink: 1, smear: 0, headSmear: 0 });
    if (i === 0) return still(K[0][1]); const [t0, fb, d = .5] = K[i], fa = K[i - 1][1]; if (t >= t0 + d + .6) return still(fb); return Motion.turn(t, t0, d, fa, fb); }; }
  // eye direction: [[t, V(x, y)], ...] (x right, y down; V(0, 1) = to camera)
  function lookTrack(K) { return t => { const i = keyAt(K, t); if (i === 0 || t < K[0][0]) return K[0][1]; return mixV(K[i - 1][1], K[i][1], E.io(P(t, K[i][0], .1))); }; }
  // speech-driven nods and hand accents from word timings [{ text, start }] of one speaker
  const nz = s => s.toLowerCase().replace(/[^a-z0-9&+]/g, '');
  function nodFrom(words) { const ws = words.filter(w => nz(w.text).length > 3);
    return t => { let n = 0; for (const w of ws) { const u = t - w.start + .04; if (u > 0 && u < .55) n += Math.min(1, nz(w.text).length / 9) * Math.exp(-u * 8) * Math.sin(u * 22); } return n; }; }
  function accentFrom(words) { const ws = words.filter(w => nz(w.text).length > 3);
    return t => { let n = 0; for (const w of ws) { const u = t - w.start + .05; if (u > 0 && u < .6) n += Math.min(1, nz(w.text).length / 8) * Math.exp(-u * 7) * Math.sin(u * 16); } return n; }; }
  // mouth openness 0..1 at time t from a lips table (voice/tools/make_lips.py writes window.LIPS = { fps, C: [...], D: [...] })
  const lipFrom = (LIPS, who) => t => { const a = LIPS && LIPS[who]; if (!a) return 0; const x = t * LIPS.fps, i = Math.floor(x); if (i < 0 || i >= a.length - 1) return 0; return lerp(a[i], a[i + 1], x - i); };

  // ---- the talking presenter: stand + breathing + turns + acting + two gesture tracks + accents + looks + lips + blinks ----
  // o: { f | turn: facing(K), act: acting(K), g: [Gest.track(z, keys0, 0), Gest.track(z, keys1, 1)], look: V | lookTrack(K),
  //      lip: t => 0..1, nod: t => n, accent: t => n, acc: [[arm, t0, t1], ...] (stress beats on that arm), blinks: [t, ...], ph, hf, tilt }
  function talker(z, x, g, s, o) {
    const G = [0, 1].map(a => o.g && o.g[a] ? o.g[a] : Gest.track(z, [[0, a ? 'home' : 'rest']], a));
    return t => {
      const T = o.turn ? o.turn(t) : { f: o.f || 0, hf: o.f || 0, look: V(0, 0), tilt: 0, blink: 1, smear: 0, headSmear: 0 }, xp = o.act ? o.act(t) : { expr: 'neutral' }, br = breathe(t, o.ph || 0) * 1.5 * s / 1.75;
      const p = stand(z, x, g, s, { f: T.f, hf: T.hf + (o.hf ? o.hf(t) : 0), smear: T.smear, headSmear: T.headSmear, tilt: (T.tilt || 0) + .035 * (o.nod ? o.nod(t) : 0) + (o.tilt ? o.tilt(t) : 0), ...xp });
      p.y += br; p.hand = p.hand.map(h => V(h.x, h.y + br));
      [0, 1].forEach(a => Gest.put(p, a, G[a](t, p)));
      for (const [ai, a0, a1] of (o.acc || [])) if (o.accent && t > a0 - .1 && t < a1 + .15) { const k = sstep(a0 - .1, a0 + .15, t) * (1 - sstep(a1 - .1, a1 + .15, t)); p.hand[ai] = V(p.hand[ai].x, p.hand[ai].y + 6.5 * s * k * o.accent(t)); }
      const lk = o.look ? (typeof o.look === 'function' ? o.look(t) : o.look) : V(0, 1); p.look = V(lk.x + (T.look ? T.look.x : 0), lk.y);
      p.talkV = o.lip ? o.lip(t) : 0; p.blink = closedX(xp) ? 1 : Math.min(T.blink ?? 1, Motion.blink(t, o.blinks || []));
      return p;
    };
  }

  // joint positions of every posed cast member (tools/moaudit.mjs reads this through window.__probe)
  function probe() { const out = {};
    CASTS.forEach((c, k) => { const z = c.z; if (!z.Hc) return; const key = c.who + k + ':'; out[key + 'H'] = [z.Hc.x, z.Hc.y];
      z.arms.forEach((a, i) => { out[key + 'W' + i] = [a.W.x, a.W.y]; out[key + 'E' + i] = [a.E.x, a.E.y]; if (a.tipW) a.tipW.forEach((q, j) => out[key + 'T' + i + j] = [q.x, q.y]); });
      (z.knees || []).forEach((q, i) => out[key + 'K' + i] = [q.x, q.y]); (z.ankles || []).forEach((q, i) => out[key + 'A' + i] = [q.x, q.y]); });
    return out; }

  window.Kit = { V, mk, clamp, lerp, sstep, mixV, E, P, CAST, CASTS, castIn, stand, breathe, lerpPose, acting, facing, lookTrack, nodFrom, accentFrom, lipFrom, talker, probe };
})();
