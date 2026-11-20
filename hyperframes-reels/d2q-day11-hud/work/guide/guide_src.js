      // ===== The guide: D, the desk quant from the Desk2Quant character kit =====
      // Light-blue Oxford with rolled sleeves, navy quilted gilet, lanyard with a plain badge, chinos, glasses. He stands
      // in the lower right (x 760-1060, y 1478-1920), framed from about mid-thigh up, above the scenes and below the HUD
      // chrome and subtitles. He talks with the narrator's voice (LIPS), breathes, blinks, shifts his weight, and acts each
      // beat in CUES: he points at the exact chart element the voice names (the arm nearest it, the index finger aimed at
      // it, the hand kept inside his own zone so it never covers the chart or the chip rail), presents with an open palm on
      // explanatory phrases, keeps one talking hand, and waves only to sign off. Everything is a pure function of t.
      const SVG = document.getElementById("mc-sv");
      const { V, mk, clamp, lerp, sstep, E, castIn, stand, breathe, lookTrack, facing } = Kit;
      const G = Gest.G;

      // ---- placement: hair top at y 1550, scale 1.55 (about 600 px hair to sole; the legs run off the frame bottom)
      const S = 1.55, X0 = 958, HEAD_TOP = 1550, GROUND = HEAD_TOP + 385.8 * S;
      const ZONE = { x0: 765, x1: 1055, y0: 1491 };             // where his hands may go (the chart ends at y 1478, the chip rail at x 760)
      let NOW = 0;                                             // film time of the frame being drawn (moving targets read it)

      // ---- lip sync: three base-36 digits per 1/60 s from the voice (open, wide, round); the mouth opens with the first
      const LV = [], LW = [], LR = [];
      for (let i = 0; i + 2 < LIPS.length; i += 3) { LV.push(parseInt(LIPS[i], 36) / 35); LW.push(parseInt(LIPS[i + 1], 36) / 35); LR.push(parseInt(LIPS[i + 2], 36) / 35); }
      const lipAt = (A, t) => { const f = (t - LIPS_T0) * LIPS_HZ; if (f < 0 || f >= A.length - 1) return 0; const i = Math.floor(f); return lerp(A[i], A[i + 1], f - i); };

      // syllables from the same track: each rise out of a dip is a stressed onset; the ones after a pause start a phrase.
      // They drive the small head nods and the beats of the talking hand, so both stay locked to the voice.
      const SYL = [], NODS = [];
      {
        const n = LV.length, at = (i) => LV[clamp(i, 0, n - 1)];
        const sm = LV.map((_, i) => (at(i - 2) + 2 * at(i - 1) + 3 * at(i) + 2 * at(i + 1) + at(i + 2)) / 9);
        let lastNod = -9;
        for (let i = 2; i < n - 2; i++) {
          if (!(sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && sm[i] > 0.38)) continue;
          let j = i, mn = sm[i];
          while (j > 0 && i - j < 30 && sm[j - 1] <= sm[j] + 0.02) { j--; mn = Math.min(mn, sm[j]); }
          if (sm[i] - mn < 0.16) continue;
          let k = j; while (k < i && sm[k] < (mn + sm[i]) / 2) k++;
          let q = j; while (q > 0 && sm[q - 1] < 0.08) q--;
          const t = LIPS_T0 + k / LIPS_HZ, phrase = (j - q) / LIPS_HZ > 0.16;
          if (!SYL.length || t - SYL[SYL.length - 1][0] > 0.15) SYL.push([t, Math.min(1, sm[i])]);
          if ((phrase || sm[i] > 0.72) && t - lastNod > 0.6) { NODS.push([t, phrase ? 1 : 0.7]); lastNod = t; }
        }
      }
      const pulses = (L, t, a, w, d, span) => { let s = 0; for (const [t0, k] of L) { const u = t - t0 + a; if (u <= 0) break; if (u < span) s += k * Math.exp(-u * w) * Math.sin(u * d); } return s; };
      const nodAt = (t) => pulses(NODS, t, 0.04, 8, 22, 0.55);
      const accentAt = (t) => pulses(SYL, t, 0.05, 7, 16, 0.6);

      // ---- gestures kept inside the zone (composition-local additions to the kit's gesture set)
      const tgtOf = (o) => (typeof o.target === "function" ? o.target() : o.target);
      // the rig's arm IK (cast.js ik()), to know where the elbow will be for a wrist position
      const elbowOf = (A, Tw, l1, l2, bend) => {
        const dx = Tw.x - A.x, dy = Tw.y - A.y, d = Math.hypot(dx, dy), mx = l1 + l2, soft = 0.08 * mx;
        const ds = d > mx - soft ? mx - soft * Math.exp(-(d - (mx - soft)) / soft) : d, dd = Math.min(Math.max(ds, Math.abs(l1 - l2) + 0.5), mx - 0.01);
        const th = Math.atan2(dy, dx), a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd))));
        const c = Math.cos(th), s = Math.sin(th), h = l1 * Math.sin(a) * bend, f = l1 * Math.cos(a);
        return V(A.x + f * c + h * s, A.y + f * s - h * c);
      };
      // a hand with its wrist at W, aimed at angle th, fingers L long, half as wide as hw, and its elbow (sleeve radius er):
      // inside the zone?
      const inZ = (q, r) => q.x - r >= ZONE.x0 && q.x + r <= ZONE.x1 && q.y - r >= ZONE.y0;
      const fits = (W, th, L, hw, El, er) => {
        const c = Math.cos(th), s = Math.sin(th);
        return [W, V(W.x + c * L, W.y + s * L), V(W.x + c * L * 0.55 - s * hw, W.y + s * L * 0.55 + c * hw), V(W.x + c * L * 0.55 + s * hw, W.y + s * L * 0.55 - c * hw)]
          .every((q) => inZ(q, 0)) && (!El || inZ(El, er));
      };
      // the longest reach r in [lo, hi] at which the hand (and the elbow) still fit: the reach shrinks toward the shoulder
      const fitReach = (at, aim, L, hw, lo, hi, elb, er) => {
        const ok = (r) => { const W = at(r); return fits(W, aim(W), L, hw, elb ? elb(W) : null, er); };
        if (ok(hi)) return hi;
        for (let k = 0; k < 16; k++) { const r = (lo + hi) / 2; if (ok(r)) lo = r; else hi = r; }
        return lo;
      };
      // pointZ: the index finger aimed exactly at the target. The arm rises along the line to it, capped at maxEl (so a high
      // target never turns into a raised hand) and only as far as the zone allows; the finger is then re-aimed at the target.
      G.pointZ = (z, p, a, sd, m, o) => {
        const T = tgtOf(o), Sh = m.sh[a], dx = T.x - Sh.x, dy = T.y - Sh.y, el = Math.atan2(-dy, Math.abs(dx));
        const sx = Math.abs(dx) < 0.18 * Math.abs(dy) ? sd : Math.sign(dx), elA = Math.min(el, o.maxEl ?? 0.88);
        const u = V(sx * Math.cos(elA), -Math.sin(elA)), drop = (o.drop || 0) * m.s;
        const at = (r) => V(Sh.x + u.x * r, Sh.y + u.y * r + drop), aim = (W) => Math.atan2(T.y - W.y, T.x - W.x), hb = o.hb ?? -sd * 0.3;
        const elb = (W) => elbowOf(Sh, W, z.L.U * m.s, z.L.F * m.s, hb);
        const W = at(fitReach(at, aim, 42 * m.s, 9 * m.s, 20 * m.s, 120 * m.s * (o.reach ?? 0.84), elb, 11 * m.s));
        return { hand: W, hb, pose: "point", aim: aim(W), aimW: 1, face: [0, 1, 0.3], faceW: 1 };
      };
      // presentZ: an open palm out to the side at chest height, turned toward the target, pulled in until it fits the zone
      G.presentZ = (z, p, a, sd, m, o) => {
        const T = tgtOf(o), Sh = m.sh[a], dx = T.x - Sh.x, dy = T.y - Sh.y, dir = Math.sign(dx) || sd;
        const el = Math.atan2(-dy, Math.abs(dx)), k = Math.max(-0.5, Math.min(1, el / 0.6)), e = Math.max(-0.35, Math.min(0.42, el));
        const th = Math.atan2(-Math.sin(e), dir * Math.cos(e));
        const at = (r) => V(Sh.x + dir * 72 * r * m.s, Sh.y + (44 - 24 * k) * m.s + (o.drop || 0) * m.s), hb = o.hb ?? -sd;
        const elb = (W) => elbowOf(Sh, W, z.L.U * m.s, z.L.F * m.s, hb);
        const W = at(fitReach(at, () => th, 40 * m.s, 12 * m.s, 0.05, o.reach ?? 1, elb, 11 * m.s));
        return { hand: W, hb, pose: "offer", aim: th, aimW: 1, face: [dir * 0.45, -1, 0.5], faceW: 1 };
      };

      // flatZ: a flat hand, palm down, marking a level at his side ("flat", "never"); o.dy: how far below the shoulder;
      // o.glide() (0..1) slides it outward, a slow horizontal sweep
      G.flatZ = (z, p, a, sd, m, o) => {
        const Sh = m.sh[a], k = o.glide ? o.glide() : 0, th = sd > 0 ? -0.06 : Math.PI + 0.06, hb = -sd;
        const at = (r) => V(Sh.x + sd * (30 + 30 * k) * r * m.s, Sh.y + (o.dy ?? 66) * m.s);
        const elb = (W) => elbowOf(Sh, W, z.L.U * m.s, z.L.F * m.s, hb);
        const W = at(fitReach(at, () => th, 40 * m.s, 10 * m.s, 0.2, 1, elb, 11 * m.s));
        return { hand: W, hb, pose: "blade", aim: th, aimW: 1, face: [0, 1, 0.3], faceW: 1 };
      };

      // ---- what he points at: chart elements in frame px, from the scene code (work/scenes/sN.js); some move with the scene
      // (t: film time, c: the beat's cue time; the scene's own timings, relative to the cue)
      const eio = (u) => E.io(clamp(u, 0, 1));
      const s13smile = (K) => {                                  // s13's smile (bottom answer row): strike -> px
        const KS = [80, 85, 90, 95, 100], IV = [29.7, 26.4, 20.7, 16.7, 15.6], i = clamp(Math.floor((K - 80) / 5), 0, 3), f = clamp((K - KS[i]) / 5, 0, 1);
        return V(666 + (K - 77) / 46 * 346, 1390 - (lerp(IV[i], IV[i + 1], f) - 10) * 7.92);
      };
      const TG = {
        s1line: V(700, 1189),                                     // s1: the flat line at sigma = 20%, right of centre
        s2quotes: V(450, 1190),                                   // s2: the market quotes leaving the line
        s3chart: V(520, 900),                                     // s3: the candles drawing in
        s3crash: V(808, 1180),                                    // s3: the 19 Oct 1987 candle (282.70 -> 224.84)
        s4band: V(575, 1250),                                     // s4: the +-1 sigma band of a typical day
        s4ruler: V(430, 1340),                                    // s4: the sigma ruler running left
        s4pin: (t, c) => V(lerp(700, 196, eio((t - c + 0.44) / 0.48)), 1350),             // s4: along the sigma ruler to the crash pin, -16.2 sigma
        s5bell: V(790, 1150),                                     // s5: the normal curve
        s6dot: (t, c) => t < c + 0.8 ? V(199, 1349) : V(lerp(199, 195, eio((t - c - 0.8) / 0.64)), lerp(1349, 1219, eio((t - c - 0.8) / 0.64))),   // the real crash, then the log axis lifts it
        s6fat: V(480, 1080),                                      // s6: the fat-tailed curve
        s7payoff: V(444, 1185),                                   // s7: the payoff at S_T = 80 (pays 10)
        s7price: V(850, 1045),                                    // s7: 0.014 against 0.090
        s8newton: V(720, 1150),                                   // s8: Newton's steps along the price curve
        s8root: V(600, 1257),                                     // s8: the implied-vol root, 20.7%
        s9fan: (t, c) => V(Math.min(150 + 850 * eio((t - c - 0.06) / 2.2), 560), 1150),   // s9: the fan, following the paths as they draw
        s9crash: V(207, 1187),                                    // s9: the path shown close, its -20% crash
        s10strikes: (t, c) => V(lerp(298, 852, clamp((t - c) / 0.6, 0, 1)), 1180),          // s10: the strike lines dropping in, 80 -> 120
        s10million: V(300, 1400),                                 // s10: 1,000,000 paths
        s11chart: V(575, 1150),
        s11atm: V(575, 1213),                                     // s11: 15.6% at the money; then 90 and 80, each dot rising from the
        s11k90: (t, c) => V(390, 1350 - (lerp(15.6, 20.7, eio((t - c - 0.16) / 0.36)) - 10) * 24.4),   // flat line to its level as
        s11k80: (t, c) => V(205, 1350 - (lerp(15.6, 29.7, eio((t - c - 0.2) / 0.36)) - 10) * 24.4),    // the value is said
        s11smile: V(450, 1080),                                   // s11: the flat line bending into the smile
        s12answer: (t, c) => Kit.mixV(V(175, 595), V(297, 860), eio((t - c - 0.55) / 0.4)),   // s12: THE ANSWER, then its first row (normal returns)
        s12flat: V(760, 921),                                     // s12: implied vol flat across strikes
        s13tail: V(165, 1310),                                    // s13: the fat left tail
        s13low: V(725, 1290),                                     // s13: the low strikes, highlighted
        s13rise: (t, c) => s13smile(Math.min(100, 120 - 40 * eio((t - c - 0.06) / 0.88))),  // s13: up the smile as the strike falls
        s14comment: V(200, 771),                                  // s14: the comment box, FORMULA typing in
        s14sheet: V(300, 1250),                                   // s14: the free Quant Formula Sheet
        s14rows: V(640, 760),                                     // s14: save / share / follow
      };

      // ---- the beats (CUES names): arm 0 works the chart (screen-left, nearest it), arm 1 rests across the belt.
      // a0/a1: [gesture, move seconds, options]; at: the target; lead: the move starts this long before the cue so it lands
      // on the word; face: [expression, weight] (blended from neutral), fd: its delay; look: "cam" | "tgt" | a target key;
      // turn: "cam" (toward the viewer) | "chart"; beats: the talking hand rides the stressed syllables; shake: a small
      // head shake ("never"); wave: the sign-off wave
      const BEAT = {
        hello:        { a1: ["homeOpen", 0.5, { hb: 0.55 }], lead: 0, face: ["smile", 0.3], look: "cam", turn: "cam" },
        showOneVol:   { a0: ["presentZ", 0.5], at: "s1line", lead: 0.3, face: ["focus", 0.2], look: "tgt", turn: "chart" },
        talk:         { a0: ["explain", 0.45], lead: 0.2, face: ["smile", 0.12], look: "cam", turn: "cam", beats: 1 },
        showQuotes:   { a0: ["presentZ", 0.5], at: "s2quotes", lead: 0.3, face: ["focus", 0.25], look: "tgt", turn: "chart" },
        askYou:       { a0: ["you", 0.45], lead: 0.25, face: ["stuck", 0.35], look: "cam", turn: "cam" },
        watchChart:   { at: "s3chart", lead: 0.1, face: ["focus", 0.25], look: "tgt", turn: "chart" },
        pointCrash:   { a0: ["pointZ", 0.5], at: "s3crash", lead: 0.36, face: ["focus", 0.45], look: "tgt", turn: "chart" },
        showBell:     { a0: ["presentZ", 0.5], at: "s4band", lead: 0.3, face: ["smile", 0.12], look: "tgt", turn: "chart" },
        watchRuler:   { at: "s4ruler", lead: 0.1, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        pointSigma:   { a0: ["pointZ", 0.5], at: "s4pin", lead: 0.45, face: ["wow", 0.58], look: "tgt", turn: "chart" },
        showNormal:   { a0: ["presentZ", 0.5], at: "s5bell", lead: 0.3, face: ["smile", 0.12], look: "tgt", turn: "chart" },
        never:        { a0: ["flatZ", 0.42, { dy: 92 }], glide: [0.05, 0.5], lead: 0.18, face: ["focus", 0.3], look: "cam", turn: "cam", shake: 1 },
        pointDid:     { a0: ["pointZ", 0.5], at: "s6dot", lead: 0.08, face: ["wow", 0.6], fd: 0.38, look: "tgt", turn: "chart" },
        showFat:      { a0: ["presentZ", 0.5], at: "s6fat", lead: 0.3, face: ["focus", 0.25], look: "tgt", turn: "chart" },
        askWhat:      { a0: ["explainHi", 0.45], lead: 0.2, face: ["stuck", 0.3], look: "cam", turn: "cam" },
        pointPayoff:  { a0: ["pointZ", 0.5], at: "s7payoff", lead: 0.3, face: ["focus", 0.35], look: "tgt", turn: "chart" },
        showPrice:    { a0: ["presentZ", 0.5], at: "s7price", lead: 0.28, face: ["smile", 0.15], look: "tgt", turn: "chart" },
        showSolve:    { a0: ["presentZ", 0.5], at: "s8newton", lead: 0.3, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        pointRoot:    { a0: ["pointZ", 0.5], at: "s8root", lead: 0.36, face: ["focus", 0.25], look: "tgt", turn: "chart" },
        pointPaths:   { a0: ["pointZ", 0.5], at: "s9fan", lead: 0.3, face: ["focus", 0.2], look: "tgt", turn: "chart" },
        pointCrashes: { a0: ["pointZ", 0.5], at: "s9crash", lead: 0.32, face: ["focus", 0.35], look: "tgt", turn: "chart" },
        sweepStrikes: { a0: ["pointZ", 0.45], at: "s10strikes", lead: 0.3, face: ["focus", 0.35], look: "tgt", turn: "chart" },
        showMillion:  { a0: ["presentZ", 0.5], at: "s10million", lead: 0.3, face: ["smile", 0.15], look: "tgt", turn: "chart" },
        watchSmile:   { at: "s11chart", lead: 0.1, face: ["focus", 0.2], look: "tgt", turn: "chart" },
        pointAtm:     { a0: ["pointZ", 0.5], at: "s11atm", lead: 0.38, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        point90:      { a0: ["pointZ", 0.5], at: "s11k90", lead: 0.32, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        point80:      { a0: ["pointZ", 0.5], at: "s11k80", lead: 0.32, face: ["focus", 0.35], look: "tgt", turn: "chart" },
        showSmile:    { a0: ["presentZ", 0.5], at: "s11smile", lead: 0.3, face: ["smile", 0.15], look: "tgt", turn: "chart" },
        smile:        { lead: 0.05, face: ["smile", 0.8], look: "cam", turn: "cam" },
        pointAnswer:  { a0: ["pointZ", 0.5], at: "s12answer", lead: 0.12, face: ["smile", 0.12], look: "tgt", turn: "chart" },
        flatAcross:   { a0: ["flatZ", 0.45, { dy: 64 }], glide: [0.1, 0.7], at: "s12flat", lead: 0.3, face: ["smile", 0.12], look: "tgt", turn: "chart" },
        pointTail:    { a0: ["pointZ", 0.5], at: "s13tail", lead: 0.34, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        pointLowK:    { a0: ["pointZ", 0.5], at: "s13low", lead: 0.3, face: ["focus", 0.3], look: "tgt", turn: "chart" },
        traceRise:    { a0: ["pointZ", 0.5], at: "s13rise", lead: 0.3, face: ["smile", 0.15], look: "tgt", turn: "chart" },
        pointComment: { a0: ["pointZ", 0.5], at: "s14comment", lead: 0.25, face: ["smile", 0.2], look: "tgt", turn: "chart" },
        you:          { a0: ["you", 0.45], lead: 0.22, face: ["smile", 0.35], look: "cam", turn: "cam" },
        showSheet:    { a0: ["presentZ", 0.5], at: "s14sheet", lead: 0.28, face: ["smile", 0.25], look: "tgt", turn: "chart" },
        showRows:     { a0: ["presentZ", 0.5], at: "s14rows", lead: 0.28, face: ["smile", 0.2], look: "tgt", turn: "chart" },
        wave:         { a0: ["wave", 0.5], lead: 0.18, face: ["smile", 0.6], look: "cam", turn: "cam", wave: 1 },
      };
      const BASE_FACE = ["smile", 0.12];                          // between beats: neutral, a little warmth
      const IDLE = ["rest", "home"];                              // arm 0 hangs, arm 1 rests across the belt
      const FACE_TURN = { cam: -0.06, chart: -0.2 };              // body facing (front view; negative turns him toward the chart)

      // ---- build the tracks from CUES: [time, beat, seconds held, hop (unused: he does not hop)]
      const cues = CUES.map(([t, name, hold]) => ({ t, name, hold, b: BEAT[name] || {} })).sort((a, b) => a.t - b.t);
      const startOf = (c) => Math.max(0, c.t - (c.b.lead || 0));
      const keys = [[[0, IDLE[0], 0.5, {}]], [[0, IDLE[1], 0.5, {}]]];
      const faceK = [[0, BASE_FACE[0], BASE_FACE[1]]], lookK = [[0, V(0, 1)]], turnK = [[0, FACE_TURN.cam]];
      const acc = [], waves = [], shakes = [];
      const lookAt = (P, from) => { const dx = P.x - from.x, dy = P.y - from.y, l = Math.hypot(dx, dy) || 1; return V(7 * dx / l, 7 * dy / l); };
      const HEAD = V(X0 - 6, HEAD_TOP + 50);
      cues.forEach((c, i) => {
        const b = c.b, t0 = startOf(c), next = i + 1 < cues.length ? startOf(cues[i + 1]) : 1e9, end = Math.min(c.t + c.hold, next - 0.05);
        const target = b.at ? TG[b.at] : null;
        const tf = typeof target === "function" ? ((f, tc) => () => f(NOW, tc))(target, c.t) : target;
        [0, 1].forEach((a) => {
          const K = keys[a], g = b["a" + a], last = K[K.length - 1];
          if (g) {
            const gl = b.glide ? ((tc, g0, gd) => () => E.s(clamp((NOW - tc - g0) / gd, 0, 1)))(c.t, b.glide[0], b.glide[1]) : null;
            K.push([t0, g[0], g[1], Object.assign({ target: tf, glide: gl }, g[2] || {})]);
            if (end < next - 0.6) K.push([end, IDLE[a], 0.55, {}]);
            if (b.beats) acc.push([a, t0 + g[1], end]);
          } else if (last[1] !== IDLE[a]) K.push([t0, IDLE[a], 0.5, {}]);
        });
        const tf0 = c.t + (b.fd || 0), fk = b.face || BASE_FACE;
        if (tf0 - faceK[faceK.length - 1][0] < 0.3) faceK.pop();
        faceK.push([tf0, fk[0], fk[1]]);
        if (end < next - 0.4) faceK.push([end + 0.1, BASE_FACE[0], BASE_FACE[1]]);
        const lk = b.look === "tgt" && tf ? (typeof tf === "function" ? "fn" : lookAt(tf, HEAD)) : V(0, 1);
        lookK.push([b.look === "tgt" ? t0 : c.t, lk === "fn" ? tf : lk]);
        if (b.look === "tgt" && end < next - 0.4) lookK.push([end + 0.15, V(0, 1)]);
        turnK.push([t0, FACE_TURN[b.turn || "cam"], 0.6]);
        if (b.wave) waves.push([t0 + b.a0[1], end]);
        if (b.shake) shakes.push(c.t);
        // the ending: after the wave the hands come home and he holds a warm smile to the camera
        if (i === cues.length - 1) { faceK.pop(); faceK.push([end + 0.1, "smile", 0.35]); }
      });
      [keys[0], keys[1], faceK, lookK, turnK].forEach((K) => K.sort((p, q) => p[0] - q[0]));
      // body turns need room to finish: drop a turn that repeats the last one or comes too soon after it
      for (let k = turnK.length - 1; k > 0; k--) if (turnK[k][1] === turnK[k - 1][1]) turnK.splice(k, 1);
      for (let k = 1; k < turnK.length; k++) if (turnK[k][0] - turnK[k - 1][0] < 0.7) { turnK.splice(k, 1); k--; }
      for (let k = turnK.length - 1; k > 0; k--) if (turnK[k][1] === turnK[k - 1][1]) turnK.splice(k, 1);

      // ---- expressions: [t, name, weight] blended from neutral; a change of expression passes through neutral
      const FD = 0.28;
      function face(t) {
        let i = 0; while (i < faceK.length - 1 && t >= faceK[i + 1][0]) i++;
        const [t1, n1, w1] = faceK[i];
        if (i === 0) return { expr: "neutral", expr2: n1, exprU: w1 };
        const [, n0, w0] = faceK[i - 1], e = sstep(0, 1, (t - t1) / FD);
        if (n0 === n1) return { expr: "neutral", expr2: n1, exprU: lerp(w0, w1, e) };
        return e < 0.5 ? { expr: "neutral", expr2: n0, exprU: w0 * (1 - 2 * e) } : { expr: "neutral", expr2: n1, exprU: w1 * (2 * e - 1) };
      }
      // ---- eyes: saccades between the viewer and the target (a moving target is followed)
      function look(t) {
        let i = 0; while (i < lookK.length - 1 && t >= lookK[i + 1][0]) i++;
        const val = (k) => (typeof lookK[k][1] === "function" ? lookAt(lookK[k][1](), HEAD) : lookK[k][1]);
        if (i === 0) return val(0);
        return Kit.mixV(val(i - 1), val(i), E.io(clamp((t - lookK[i][0]) / 0.12, 0, 1)));
      }
      const turn = facing(turnK);
      // blinks: a natural track, plus one now and then as the eyes jump between the viewer and the chart
      const BL = Motion.blinkTrack(11, 0.3, DUR);
      lookK.forEach(([t], k) => { if (k > 0 && k % 3 === 0 && BL.every((b) => Math.abs(b - t) > 1.2)) BL.push(t + 0.02); });
      BL.sort((a, b) => a - b);
      const blinkAt = (t) => { let b = 1; for (const c of BL) { if (c > t + 0.1) break; if (c > t - 0.25) b = Math.min(b, Motion.blink(t, [c])); } return b; };

      // ---- the figure
      const DQ = castIn(mk("g", {}, SVG), "D");
      const gest = [0, 1].map((a) => Gest.track(DQ, keys[a], a));
      function poseAt(t) {
        NOW = t;
        const T = turn(t), xp = face(t), br = breathe(t, 0.4) * 2.4 * S / 1.75;
        const sway = 2.0 * Math.sin((2 * Math.PI * t) / 6.7) + 0.9 * Math.sin((2 * Math.PI * t) / 3.9 + 1.3);
        // "never": a small, slow shake of the head (a roll: the front-view head is one drawing)
        let shake = 0;
        for (const c of shakes) { const u = t - c; if (u > 0 && u < 0.9) shake += 0.03 * Math.sin(2 * Math.PI * 2.2 * u) * Math.sin(Math.PI * u / 0.9); }
        const p = stand(DQ, X0 + sway, GROUND, S, { f: T.f, hf: T.hf, smear: T.smear, headSmear: T.headSmear,
          tilt: (T.tilt || 0) + 0.035 * nodAt(t) + 0.012 * Math.sin((2 * Math.PI * t) / 5.3) + shake, ...xp });
        p.y += br; p.hand = p.hand.map((h) => V(h.x, h.y + br));
        [0, 1].forEach((a) => Gest.put(p, a, gest[a](t, p)));
        // the talking hand rides the stressed syllables
        for (const [ai, a0, a1] of acc) if (t > a0 - 0.1 && t < a1 + 0.15) {
          const k = sstep(a0 - 0.1, a0 + 0.15, t) * (1 - sstep(a1 - 0.1, a1 + 0.15, t));
          p.hand[ai] = V(p.hand[ai].x, p.hand[ai].y + 5 * S * k * accentAt(t));
        }
        // the wave: a relaxed side-to-side of the open hand at the wrist
        for (const [w0, w1] of waves) if (t > w0 - 0.1 && t < w1 + 0.2) {
          const k = sstep(w0 - 0.1, w0 + 0.2, t) * (1 - sstep(w1 - 0.2, w1 + 0.2, t));
          p.handRot = p.handRot.slice(); p.handRot[0] = (p.handRot[0] || 0) + 0.3 * k * Math.sin(2 * Math.PI * 1.9 * (t - w0));
        }
        const lk = look(t); p.look = V(lk.x + (T.look ? T.look.x : 0), lk.y);
        p.talkV = clamp(lipAt(LV, t) * 1.05, 0, 1);
        p.talkW = 1 + 0.14 * lipAt(LW, t) - 0.22 * lipAt(LR, t);
        const smiling = xp.expr2 === "smile" && xp.exprU > 0.45;
        p.blink = smiling ? 1 : Math.min(T.blink ?? 1, blinkAt(t));
        p.shadow = 0;
        return p;
      }

      // ---- aim: the 3D hand turns the index finger a few degrees off its commanded aim (more the further sideways he
      // points), so after posing, measure the drawn finger (knuckle -> tip) and turn it onto the target: two passes
      const K0 = keys[0];
      // the target the finger should be on at t, blended the way Gest.track blends the aim between two keys
      function pointTarget(t) {
        let i = 0; while (i < K0.length - 1 && t >= K0[i + 1][0]) i++;
        const [t1, n1, d1, o1] = K0[i], prev = i > 0 ? K0[i - 1] : null, u = clamp((t - t1) / d1, 0, 1);
        if (n1 === "pointZ" && prev && prev[1] === "pointZ" && u < 1) return Kit.mixV(tgtOf(prev[3]), tgtOf(o1), sstep(0.08, 0.92, u));
        if (n1 === "pointZ") return tgtOf(o1);
        return prev && prev[1] === "pointZ" && u < 1 ? tgtOf(prev[3]) : null;
      }
      function fingerErr(T) {
        const a = DQ.arms[0], W = a.W, f = a.hand.fingers[0].m, kw = Cast.K * S;
        const kx = W.x + +f[1].getAttribute("x1") * kw, ky = W.y + +f[1].getAttribute("y1") * kw;
        const tx = W.x + +f[3].getAttribute("x2") * kw, ty = W.y + +f[3].getAttribute("y2") * kw;
        const d = Math.atan2(ty - ky, tx - kx) - Math.atan2(T.y - ty, T.x - tx);
        return clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.25, 0.25);
      }
      const st = { t: 0 };
      function draw() {
        const t = st.t, p = poseAt(t), T = pointTarget(t), hp = p.handPose[0];
        DQ.pose(p);
        // the correction comes in as the finger straightens (a curled finger has no direction to correct)
        const ext = !hp || typeof hp === "string" ? (hp === "point" ? 1 : 0) : hp.a === "point" && hp.b === "point" ? 1 : hp.b === "point" ? hp.u : hp.a === "point" ? 1 - hp.u : 0;
        const w = T ? sstep(0.55, 1, ext) : 0;
        if (w > 0.001 && p.handAim[0] != null) {
          p.handAim = p.handAim.slice();
          for (let k = 0; k < 2; k++) { p.handAim[0] -= fingerErr(T) * w; DQ.pose(p); }
        }
      }
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(st, { t: 0 }, { t: DUR, duration: DUR, ease: "none", onUpdate: draw }, 0);
      draw();
      window.__timelines["mc"] = tl;
