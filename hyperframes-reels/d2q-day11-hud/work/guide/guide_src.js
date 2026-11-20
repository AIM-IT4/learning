      // ===== The guide: D, the desk quant from the Desk2Quant character kit, framed as a bust =====
      // Light-blue Oxford with rolled sleeves, navy quilted gilet, lanyard with a plain badge, glasses. He sits in the lower
      // right, head and shoulders, the frame's bottom edge cutting him at the chest (above the scenes, below the HUD chrome
      // and subtitles). He talks with the narrator's voice (LIPS), breathes, blinks and nods on the stressed syllables. When
      // the voice names a chart element he turns his head to it and looks at it, then back to the viewer; on the key beats he
      // brings his near hand up beside the shoulder and points at the exact element (the hand kept below the chart, clear of
      // the chip rail and never in front of his face). He waves only to sign off. Everything is a pure function of t.
      const SVG = document.getElementById("mc-sv");
      const { V, mk, clamp, lerp, sstep, E, castIn, stand, breathe, facing } = Kit;
      const G = Gest.G;

      // ---- placement: a bust. Kit scale 3.5 (his hair top at y 1500, his face about 80 px wide), centred at x 935; the
      // frame's bottom edge cuts him at the chest (the badge), his far shoulder runs off the right edge
      const S = 3.5, X0 = 935, HEAD_TOP = 1500, GROUND = HEAD_TOP + 385.8 * S;
      // where a raised hand may go: below the chart (it ends at y 1478), clear of the chip rail (x 54-760, y 1484-1690; below
      // it, only empty background down to the HUD's corner text), inside the frame, and never in front of his face (faceBox)
      const STAGE_Y = 1500, RAIL_Y = 1716, RAIL_X = 778, LEFT_X = 640, RIGHT_X = 1076;
      const allowed = (q) => q.y >= STAGE_Y && q.x <= RIGHT_X && (q.y >= RAIL_Y ? q.x >= LEFT_X : q.x >= RAIL_X);
      let NOW = 0;                                             // film time of the frame being drawn (moving targets read it)

      // ---- lip sync: three base-36 digits per 1/60 s from the voice (open, wide, round); the mouth opens with the first
      const LV = [], LW = [], LR = [];
      for (let i = 0; i + 2 < LIPS.length; i += 3) { LV.push(parseInt(LIPS[i], 36) / 35); LW.push(parseInt(LIPS[i + 1], 36) / 35); LR.push(parseInt(LIPS[i + 2], 36) / 35); }
      const lipAt = (A, t) => { const f = (t - LIPS_T0) * LIPS_HZ; if (f < 0 || f >= A.length - 1) return 0; const i = Math.floor(f); return lerp(A[i], A[i + 1], f - i); };

      // syllables from the same track: each rise out of a dip is a stressed onset; the ones after a pause start a phrase.
      // They drive the head nods, so the nods stay locked to the voice.
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

      // ---- the raised hand at bust scale (composition-local additions to the kit's gesture set)
      const tgtOf = (o) => (typeof o.target === "function" ? o.target() : o.target);
      // his face, from the pose: a hand must stay left of it (x < x0) unless it is below his chin (y > y1)
      const faceBox = (z, p) => { const H = Gest.headPt(z, p, 0, 0), u = Cast.K * S * Cast.HS; return { x0: H.x - 33 * u, y1: H.y + 40 * u }; };
      // how far a hand (wrist at W, aimed at angle th, L long and 2 hw wide) reaches outside the allowed region, in px summed
      // over sampled points (0 = it fits): onto the chart, past the frame edge, onto the chip rail, or in front of his face
      const intrusion = (W, th, L, hw, fb) => {
        const c = Math.cos(th), s = Math.sin(th);
        let v = 0;
        for (const [f, w] of [[0, 0], [1, 0], [0.8, 0.45], [0.8, -0.45], [0.55, 1], [0.55, -1], [0.25, 1], [0.25, -1]]) {
          const x = W.x + c * L * f - s * hw * w, y = W.y + s * L * f + c * hw * w;
          v += Math.max(0, STAGE_Y - y) + Math.max(0, x - RIGHT_X);
          if (y < RAIL_Y && x < RAIL_X) v += Math.min(RAIL_X - x, RAIL_Y - y + Math.max(0, LEFT_X - x)); else if (y >= RAIL_Y) v += Math.max(0, LEFT_X - x);
          if (x > fb.x0 && y < fb.y1) v += Math.min(x - fb.x0, fb.y1 - y);
        }
        return v;
      };
      // pointB: the near hand up beside the shoulder, the index finger aimed at the target. The wrist sits on an arc round
      // the outer side of the shoulder (clear of the joint), from beside it (out and a little up) to down and out; it
      // takes the first spot on that arc where the whole hand fits for every position the element takes during the beat
      // (o.place), so a target far up and to the left brings the hand lower and further in, and a moving element (a dot
      // rising, a sweep along the strikes) is followed by the finger alone. If no spot fits, the one that intrudes least.
      const ARC = [-20 * Math.PI / 180, 70 * Math.PI / 180], ARC_R = [15, 24];
      G.pointB = (z, p, a, sd, m, o) => {
        const T = tgtOf(o), Sh = m.sh[a], fb = faceBox(z, p), L = 38 * m.s, hw = 8 * m.s;
        const at = (u) => { const q = lerp(ARC[0], ARC[1], u), r = lerp(ARC_R[0], ARC_R[1], u) * m.s; return V(Sh.x + sd * Math.cos(q) * r, Sh.y + Math.sin(q) * r); };
        const aim = (W) => Math.atan2(T.y - W.y, T.x - W.x);
        const PL = o.place || [T], vio = (u) => { const W = at(u); let v = 0; for (const P of PL) v = Math.max(v, intrusion(W, Math.atan2(P.y - W.y, P.x - W.x), L, hw, fb)); return v; };
        const N = 40, vs = []; for (let k = 0; k <= N; k++) vs.push(vio(k / N));
        let u, k0 = vs.findIndex((v) => v <= 0);
        if (k0 >= 0) {
          u = k0 / N;
          if (k0 > 0) { let lo = (k0 - 1) / N, hi = u; for (let j = 0; j < 14; j++) { const mid = (lo + hi) / 2; if (vio(mid) <= 0) hi = mid; else lo = mid; } u = hi; }
        } else {
          let kb = 0; vs.forEach((v, k) => { if (v < vs[kb]) kb = k; });
          let lo = Math.max(0, (kb - 1) / N), hi = Math.min(1, (kb + 1) / N);
          for (let j = 0; j < 24; j++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (vio(m1) <= vio(m2)) hi = m2; else lo = m1; }
          u = (lo + hi) / 2;
        }
        const W = at(u);
        return { hand: W, hb: sd, pose: "point", aim: aim(W), aimW: 1, face: [0, 1, 0.3], faceW: 1 };
      };
      // waveB: the open hand up beside his cheek, palm to the viewer (the sign-off); the fingers a little closer and the thumb
      // in, so the hand stays clear of his face
      Hand.POSES.waveB = { c: [0.02, 0, 0.02, 0.06], s: 0.38, ta: 0.42, to: 0.24, tc: 0.08, fx: -0.14 };
      G.waveB = (z, p, a, sd, m, o) => {
        const Sh = m.sh[a];
        return { hand: V(Sh.x - sd * (o.dx ?? 2) * m.s, Sh.y - (o.up ?? 12) * m.s), hb: sd, pose: "waveB", aim: -Math.PI / 2 + sd * 0.05, aimW: 1, face: [0, 0, 1], faceW: 1 };
      };
      // waveLow: the same open hand lower, in front of the chest: the hand passes through it on the way up and down, so it
      // rises and falls straight, clear of the chip rail
      G.waveLow = (z, p, a, sd, m) => Object.assign(G.waveB(z, p, a, sd, m, { dx: 6, up: -30 }), { pose: "waveB" });
      // idleB: the near arm hangs relaxed, the hand a little out from his side (below the frame). Every spot the hand takes
      // (idle, pointing, waving) keeps the elbow on the same side of the shoulder-to-hand line, so the arm never has to
      // flip its bend on the way between them
      G.idleB = (z, p, a, sd, m) => ({ hand: V(m.sh[a].x + sd * 26 * m.s, m.sh[a].y + 92 * m.s), hb: sd, pose: "rest", face: [-sd, 0.1, 0.35], faceW: 1 });
      // the near arm at bust scale: the elbow stays down, under the shoulder (below the frame unless the hand is up by his
      // cheek), and the forearm rises from it to the hand. The rig's two-bone IK swings the elbow out sideways when the hand
      // comes up beside the shoulder, so it is given the segment lengths that put the elbow here instead (a segment reaching
      // toward the camera draws a little shorter) and the bend that keeps it on this side.
      // (ww: how far into the wave the arm is. For the wave the elbow drops straight down a little in front of the chest, so
      // the forearm rises in front of the body to the hand beside the face and the arm never lines up through the shoulder)
      function elbowDown(p, a, z, ww) {
        const Sh = Gest.marks(z, p).sh[a], W = p.hand[a], sd = a === 0 ? -1 : 1, UP = z.L.U * S, FP = z.L.F * S;
        const smin = (u, v, k) => (u + v - Math.sqrt((u - v) * (u - v) + k * k)) / 2;      // a smooth min: the elbow starts to rise gently
        const E0 = V(lerp(lerp(Sh.x, W.x, 0.3) + sd * 6 * S, Sh.x - sd * 8 * S, ww), smin(W.y + 0.96 * FP, Sh.y + 0.98 * UP, 70));
        const d = Math.hypot(W.x - Sh.x, W.y - Sh.y) || 1, c = (W.x - Sh.x) / d, s = (W.y - Sh.y) / d;
        const side = (E0.x - Sh.x) * s - (E0.y - Sh.y) * c;
        ["fu", "ff", "hb"].forEach((k) => { p[k] = (p[k] || [1, 1]).slice(); });
        // the bend's sign puts the IK's elbow exactly here. Folded, that is seamless where the elbow crosses the shoulder-wrist
        // line; nearly straight, the rig softens the reach and the two sides differ, so there the bend fades through zero
        const l1 = Math.hypot(E0.x - Sh.x, E0.y - Sh.y), l2 = Math.hypot(W.x - E0.x, W.y - E0.y), ext = sstep(0.84, 0.92, d / (l1 + l2));
        p.fu[a] = l1 / UP; p.ff[a] = l2 / FP; p.hb[a] = clamp(side / Math.max(1e-3, 0.1 * UP * ext), -1, 1);
      }

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

      // ---- the beats (CUES names). hand: "point" (the near hand, arm 0) | "wave"; at: the target; lead: the head (and the
      // hand) start this long before the cue so they land on the word; face: [expression, weight] (blended from neutral),
      // fd: its delay; look: he turns his head to the target (lookMax: how long, at most, before he turns back to the
      // viewer); ask: a questioning tilt of the head; shake: a small head shake ("never")
      const BEAT = {
        hello:        { face: ["smile", 0.32] },
        showOneVol:   { at: "s1line", lead: 0.25, face: ["focus", 0.2], look: 1 },
        talk:         { face: ["smile", 0.14] },
        showQuotes:   { at: "s2quotes", lead: 0.25, face: ["focus", 0.25], look: 1 },
        askYou:       { face: ["stuck", 0.35], ask: 1 },
        watchChart:   { at: "s3chart", lead: 0.15, face: ["focus", 0.25], look: 1 },
        pointCrash:   { hand: "point", at: "s3crash", lead: 0.36, face: ["focus", 0.45], look: 1 },
        showBell:     { at: "s4band", lead: 0.25, face: ["smile", 0.12], look: 1 },
        pointSigma:   { hand: "point", at: "s4pin", lead: 0.45, face: ["wow", 0.58], look: 1 },
        showNormal:   { at: "s5bell", lead: 0.25, face: ["smile", 0.12], look: 1 },
        never:        { face: ["focus", 0.3], shake: 1 },
        pointDid:     { hand: "point", at: "s6dot", lead: 0.08, face: ["wow", 0.6], fd: 0.38, look: 1 },
        showFat:      { at: "s6fat", lead: 0.25, face: ["focus", 0.25], look: 1 },
        askWhat:      { face: ["stuck", 0.3], ask: 1 },
        pointPayoff:  { hand: "point", at: "s7payoff", lead: 0.3, face: ["focus", 0.35], look: 1 },
        showPrice:    { at: "s7price", lead: 0.25, face: ["smile", 0.15], look: 1 },
        showSolve:    { at: "s8newton", lead: 0.25, face: ["focus", 0.3], look: 1 },
        pointRoot:    { hand: "point", at: "s8root", lead: 0.36, face: ["focus", 0.25], look: 1 },
        pointPaths:   { hand: "point", at: "s9fan", lead: 0.3, face: ["focus", 0.2], look: 1 },
        pointCrashes: { hand: "point", at: "s9crash", lead: 0.32, face: ["focus", 0.35], look: 1 },
        sweepStrikes: { hand: "point", at: "s10strikes", lead: 0.3, face: ["focus", 0.35], look: 1 },
        showMillion:  { at: "s10million", lead: 0.25, face: ["smile", 0.15], look: 1 },
        watchSmile:   { at: "s11chart", lead: 0.15, face: ["focus", 0.2], look: 1 },
        pointAtm:     { hand: "point", at: "s11atm", lead: 0.38, face: ["focus", 0.3], look: 1 },
        point90:      { hand: "point", at: "s11k90", lead: 0.32, face: ["focus", 0.3], look: 1 },
        point80:      { hand: "point", at: "s11k80", lead: 0.32, face: ["focus", 0.35], look: 1 },
        showSmile:    { at: "s11smile", lead: 0.25, face: ["smile", 0.15], look: 1 },
        smile:        { face: ["smile", 0.8] },
        pointAnswer:  { hand: "point", at: "s12answer", lead: 0.12, face: ["smile", 0.12], look: 1 },
        flatAcross:   { at: "s12flat", lead: 0.2, face: ["smile", 0.12], look: 1 },
        pointTail:    { hand: "point", at: "s13tail", lead: 0.34, face: ["focus", 0.3], look: 1 },
        pointLowK:    { hand: "point", at: "s13low", lead: 0.3, face: ["focus", 0.3], look: 1 },
        traceRise:    { hand: "point", at: "s13rise", lead: 0.3, face: ["smile", 0.15], look: 1 },
        pointComment: { hand: "point", at: "s14comment", lead: 0.25, face: ["smile", 0.2], look: 1, lookMax: 1.0 },
        showSheet:    { at: "s14sheet", lead: 0.2, face: ["smile", 0.25], look: 1, lookMax: 0.8 },
        showRows:     { face: ["smile", 0.25] },
        wave:         { hand: "wave", lead: 0.3, face: ["smile", 0.6] },
      };
      const BASE_FACE = ["smile", 0.12];                          // between beats: neutral, a little warmth
      const POINT = "pointB", HAND_UP = 0.5, HAND_DOWN = 0.6;      // raise and lower times (s)
      const F_BODY = -0.1, HF_CAM = -0.08, HF_CHART = -0.5, HT = 0.45;   // facing: body, head to the viewer / to the chart (3/4), turn time

      // ---- build the tracks from CUES: [time, beat, seconds held, hop (unused: he does not hop)]
      const cues = CUES.map(([t, name, hold]) => ({ t, name, hold, b: BEAT[name] || {} })).sort((a, b) => a.t - b.t);
      const startOf = (c) => Math.max(0, c.t - (c.b.lead || 0));
      const nextStart = (i) => (i + 1 < cues.length ? startOf(cues[i + 1]) : 1e9);
      const IDLE = "idleB";                                       // the near arm idles hanging, the hand below the frame
      const keys = [[[0, IDLE, 0.5, {}]], [[0, "rest", 0.5, {}]]];
      const faceK = [[0, BASE_FACE[0], BASE_FACE[1]]], waves = [], shakes = [], asks = [];
      const lookAt = (P, from) => { const dx = P.x - from.x, dy = P.y - from.y, l = Math.hypot(dx, dy) || 1; return V(7 * dx / l, 7 * dy / l); };
      const HEAD = V(X0, HEAD_TOP + 90);
      const tfOf = (c) => { const tg = c.b.at ? TG[c.b.at] : null; return typeof tg === "function" ? ((f, tc) => () => f(NOW, tc))(tg, c.t) : tg; };
      const looks = [];
      cues.forEach((c, i) => {
        const b = c.b, t0 = startOf(c), next = nextStart(i), end = Math.min(c.t + c.hold, next - 0.05), tf = tfOf(c), K = keys[0];
        if (b.hand === "point") {
          // where the element is over the beat (a moving one is sampled), for the hand's spot
          const raw = TG[b.at], place = typeof raw === "function" ? Array.from({ length: 13 }, (_, k) => raw(lerp(t0, end, k / 12), c.t)) : [raw];
          // from one point to the next the hand travels round the shoulder (a bowed path), not across the joint; up from
          // and down to the belt it travels straight
          K.push([t0, POINT, HAND_UP, { target: tf, place, bow: K[K.length - 1][1] === POINT ? 0.3 : 0 }]);
          if (end < next - 0.6) K.push([end, IDLE, HAND_DOWN, { bow: 0 }]);
        } else if (b.hand === "wave") {
          K.push([t0, "waveLow", 0.32, { bow: 0 }], [t0 + 0.32, "waveB", 0.3, { bow: 0 }]); waves.push([t0 + 0.62, end]);
          K.push([end, "waveLow", 0.3, { bow: 0 }], [end + 0.3, IDLE, 0.45, { bow: 0 }]);
        } else if (K[K.length - 1][1] !== IDLE) K.push([t0, IDLE, HAND_DOWN, { bow: 0 }]);
        const tf0 = c.t + (b.fd || 0), fk = b.face || BASE_FACE;
        if (tf0 - faceK[faceK.length - 1][0] < 0.3) faceK.pop();
        faceK.push([tf0, fk[0], fk[1]]);
        if (end < next - 0.4) faceK.push([end + 0.1, BASE_FACE[0], BASE_FACE[1]]);
        if (b.look && tf) looks.push([t0, Math.min(c.t + clamp(c.hold, 0.8, b.lookMax || 1.5), next - 0.05), tf]);
        if (b.shake) shakes.push(c.t);
        if (b.ask) asks.push([c.t - 0.1, end]);
        // the ending: after the wave the hand comes down and he holds a warm smile to the viewer
        if (i === cues.length - 1) { faceK.pop(); faceK.push([end + 0.1, "smile", 0.35]); }
      });
      [keys[0], faceK].forEach((K) => K.sort((p, q) => p[0] - q[0]));

      // ---- where he looks: chart looks merged when the gap between them is short; the head turns to 3/4 for each run of
      // them and back to the viewer after; the eyes follow each beat's element (a moving element is followed)
      const runs = [];
      for (const L of looks) { const r = runs[runs.length - 1]; if (r && L[0] - r.t1 < 0.9) { r.t1 = Math.max(r.t1, L[1]); r.items.push(L); } else runs.push({ t0: L[0], t1: L[1], items: [L] }); }
      runs.forEach((r) => { r.t1 = Math.max(r.t1, r.t0 + HT + 0.3); });
      const headK = [[0, HF_CAM]], lookK = [[0, V(0, 1)]];
      runs.forEach((r) => {
        headK.push([r.t0, HF_CHART, HT]); headK.push([r.t1, HF_CAM, HT]);
        r.items.forEach((L) => lookK.push([L[0], typeof L[2] === "function" ? L[2] : lookAt(L[2], HEAD)]));
        lookK.push([r.t1, V(0, 1)]);
      });
      const headTurn = facing(headK);
      function look(t) {
        let i = 0; while (i < lookK.length - 1 && t >= lookK[i + 1][0]) i++;
        const val = (k) => (typeof lookK[k][1] === "function" ? lookAt(lookK[k][1](), HEAD) : lookK[k][1]);
        if (i === 0) return val(0);
        return Kit.mixV(val(i - 1), val(i), E.io(clamp((t - lookK[i][0]) / 0.12, 0, 1)));
      }
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
      // ---- blinks: a natural track, minus any blink close to the one he makes as his head turns (Motion.turn blinks as
      // the head drawing swaps)
      const SWAP = headK.slice(1).map((k, i) => Motion.turn(k[0], k[0], HT, headK[i][1], k[1]).blinkT).filter((x) => x != null);
      const BL = Motion.blinkTrack(11, 0.3, DUR).filter((b) => SWAP.every((w) => Math.abs(b - w) > 0.9));
      const blinkAt = (t) => { let b = 1; for (const c of BL) { if (c > t + 0.1) break; if (c > t - 0.25) b = Math.min(b, Motion.blink(t, [c])); } return b; };
      // ---- nods: a small dip of the head on each stressed phrase onset (a pitch, drawn as the head moving down and
      // foreshortening a little), plus the kit's gentle roll accent
      const nodBump = (t) => { let s = 0; for (const [t0, k] of NODS) { const u = t - t0 + 0.02; if (u <= 0) break; if (u < 0.7) s += k * (u / 0.12) * Math.exp(1 - u / 0.12); } return Math.min(1.2, s); };

      // how far into the wave the near arm is (0..1), from its keys, blended over each move as Gest.track blends it
      const isWave = (n) => n === "waveB" || n === "waveLow";
      function waveW(t) {
        const K = keys[0]; let i = 0; while (i < K.length - 1 && t >= K[i + 1][0]) i++;
        const [t1, n1, d1] = K[i], c = isWave(n1) ? 1 : 0;
        if (i === 0 || t >= t1 + d1) return c;
        return lerp(isWave(K[i - 1][1]) ? 1 : 0, c, sstep(0, 1, (t - t1) / d1));
      }

      // ---- the figure
      const DQ = castIn(mk("g", {}, SVG), "D");
      const gest = [0, 1].map((a) => Gest.track(DQ, keys[a], a));
      function poseAt(t) {
        NOW = t;
        const H = headTurn(t), xp = face(t), br = breathe(t, 0.4) * 1.2 * S / 1.75;
        const sway = 2.0 * Math.sin((2 * Math.PI * t) / 6.7) + 0.9 * Math.sin((2 * Math.PI * t) / 3.9 + 1.3);
        // "never": a small, slow shake of the head (a roll, with the eyes); a questioning tilt on the asks
        let shake = 0, ask = 0;
        for (const c of shakes) { const u = t - c; if (u > 0 && u < 0.9) shake += Math.sin(2 * Math.PI * 2.2 * u) * Math.sin(Math.PI * u / 0.9); }
        for (const [a0, a1] of asks) ask += sstep(a0, a0 + 0.3, t) * (1 - sstep(a1, a1 + 0.35, t));
        const toChart = clamp((HF_CAM - H.hf) / (HF_CAM - HF_CHART), 0, 1);
        const p = stand(DQ, X0 + sway, GROUND, S, { f: F_BODY + (H.f - HF_CAM) * 0.25, hf: H.hf, smear: 0, headSmear: H.headSmear,
          tilt: (H.tilt || 0) + 0.03 * nodAt(t) + 0.012 * Math.sin((2 * Math.PI * t) / 5.3) + 0.025 * shake + 0.045 * ask - 0.02 * toChart, ...xp });
        p.y += br; p.hand = p.hand.map((h) => V(h.x, h.y + br));
        [0, 1].forEach((a) => Gest.put(p, a, gest[a](t, p)));
        elbowDown(p, 0, DQ, waveW(t));
        // the wave: a relaxed side-to-side of the open hand at the wrist
        for (const [w0, w1] of waves) if (t > w0 - 0.1 && t < w1 + 0.2) {
          const k = sstep(w0 - 0.1, w0 + 0.2, t) * (1 - sstep(w1 - 0.2, w1 + 0.2, t));
          p.handRot = p.handRot.slice(); p.handRot[0] = (p.handRot[0] || 0) + 0.14 * k * Math.sin(2 * Math.PI * 1.8 * (t - w0));
        }
        const lk = look(t); p.look = V(lk.x + (H.look ? H.look.x : 0) + 2 * shake, lk.y);
        p.talkV = clamp(lipAt(LV, t) * 1.05, 0, 1);
        p.talkW = 1 + 0.14 * lipAt(LW, t) - 0.22 * lipAt(LR, t);
        const smiling = xp.expr2 === "smile" && xp.exprU > 0.45;
        p.blink = smiling ? 1 : Math.min(H.blink ?? 1, blinkAt(t));
        p.shadow = 0;
        return p;
      }

      // ---- aim: the 3D hand turns the index finger off its commanded aim (more the further the wrist has to bend), so
      // after posing, measure the drawn finger (knuckle -> tip) and turn it onto the target: three passes
      const K0 = keys[0];
      // the target the finger should be on at t, blended the way Gest.track blends the aim between two keys
      function pointTarget(t) {
        let i = 0; while (i < K0.length - 1 && t >= K0[i + 1][0]) i++;
        const [t1, n1, d1, o1] = K0[i], prev = i > 0 ? K0[i - 1] : null, u = clamp((t - t1) / d1, 0, 1);
        if (n1 === POINT && prev && prev[1] === POINT && u < 1) return Kit.mixV(tgtOf(prev[3]), tgtOf(o1), sstep(0.08, 0.92, u));
        if (n1 === POINT) return tgtOf(o1);
        return prev && prev[1] === POINT && u < 1 ? tgtOf(prev[3]) : null;
      }
      function fingerErr(T) {
        const a = DQ.arms[0], W = a.W, f = a.hand.fingers[0].m, kw = Cast.K * S;
        const kx = W.x + +f[1].getAttribute("x1") * kw, ky = W.y + +f[1].getAttribute("y1") * kw;
        const tx = W.x + +f[3].getAttribute("x2") * kw, ty = W.y + +f[3].getAttribute("y2") * kw;
        const d = Math.atan2(ty - ky, tx - kx) - Math.atan2(T.y - ty, T.x - tx);
        return clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.4, 0.4);
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
          for (let k = 0; k < 3; k++) { p.handAim[0] -= fingerErr(T) * w; DQ.pose(p); }
        }
        // the nod, on top of the posed head (head units: down and a little foreshortened)
        const n = nodBump(t);
        if (n > 0.001) DQ.headG.setAttribute("transform", DQ.headG.getAttribute("transform") + ` translate(0,${(2.2 * n).toFixed(3)}) scale(1,${(1 - 0.025 * n).toFixed(4)})`);
      }
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(st, { t: 0 }, { t: DUR, duration: DUR, ease: "none", onUpdate: draw }, 0);
      draw();
      window.__timelines["mc"] = tl;
