      const NUM_KEYS = ["normal", "model"];
      // ---- s1, the hook: "You know Black-Scholes uses one volatility for every option."
      // Frame 1 already shows the hero: a big glossy volatility dial and a hand of five option tickets (K 80/90/100/110/
      // 120, model.strikes) fanned under it. On "Black-Scholes" the tickets deal out into a row and a MODEL card slides
      // in; chrome pipes grow from the dial to every ticket. On "one volatility" the needle springs to σ = 20%
      // (normal.sigma_annual) and an INPUT card names the one input. On "for every option" brand-blue light runs down
      // the pipes and each ticket's σ field flips to the same 20% (split-flap). The tickets carry into s2 as they stand.
      // words: 0 You 1 know 2 Black-Scholes 3 uses 4 one 5 volatility 6 for 7 every 8 option.
      const g = document.getElementById("s1-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { }
      const SIG = Math.round(100 * NUM.normal.sigma_annual);                  // 20
      const KS = NUM.model.strikes.filter((k) => k % 10 === 0);               // 80, 90, 100, 110, 120
      // the tickets' row (shared with s2: the same slots)
      const TW = K.TK.W, TH = K.TK.H, TY = K.TK.Y, TX = K.TK.X;
      // the dial
      const GX = 540, GY = 800, GR = 262;
      const tDeal = w(2) - 0.06, dealAt = (i) => tDeal + 0.075 * i, DEAL = 0.46;
      const tSwing = w(4) - 0.05, tPipe = tDeal + 0.5, tFlow = w(7) - 0.26, tIn1 = w(2), tIn2 = w(4) + 0.12, tFoot = w(7) + 0.12;
      // the pipe network: from under the dial's nameplate down to a manifold, a stub down to each ticket
      const MY = 1166, FOOT = GY + GR + 60, TC = (i) => TX(i) + TW / 2;
      const MAIN = [[GX, FOOT], [GX, MY]], MAN = [[TC(0), MY], [TC(4), MY]];
      const STUB = (i) => [[TC(i), MY], [TC(i), TY + 8]];
      const SPEED = 1500;                                                     // px a second for the light in the pipes
      const tMan = tFlow + (MY - FOOT) / SPEED;                               // the light reaches the manifold
      const tStub = (i) => tMan + Math.abs(TC(i) - GX) / SPEED;
      const tArrive = (i) => tStub(i) + (TY + 8 - MY) / SPEED;
      // a σ cell's flap sequence: blank, a few spinning digits, the value
      const DIG = String(SIG).split("");
      const seqs = (i) => DIG.map((d, j) => ["–"].concat([0, 1, 2].map((q) => String(Math.floor(K.rnd(i * 7 + j * 3 + q) * 10))), [d])).concat([["%", "%"]]);
      function fanPose(i, t) {
        const th = (i - 2) * 0.22 + 0.012 * Math.sin(t * 2.2 + i), PX = 540, PY = 2110, R = 760;
        return { cx: PX + R * Math.sin(th), cy: PY - R * Math.cos(th) + 3 * Math.sin(t * 1.9 + i), rot: th, sc: 0.94 };
      }
      function ticketPose(i, t) {
        const f = fanPose(i, Math.min(t, dealAt(i))), u = t - dealAt(i);
        const rx = TX(i) + TW / 2, ry = TY + TH / 2;
        if (u <= 0) return f;
        const q = eo(clamp(u / DEAL)), p = K.spring(u, 0.45, 14);
        return { cx: lerp(f.cx, rx, q), cy: lerp(f.cy, ry, q) - 70 * Math.sin(Math.PI * clamp(u / DEAL)) + K.bob(t, i * 1.3, 2.5) * clamp(u - 0.6),
                 rot: lerp(f.rot, 0, p), sc: lerp(f.sc, 1, q) };
      }
      function miniCard(x, y, wd, h, lab, val, valCol, P) {
        g.save(); K.apply(g, x + wd / 2, y + h / 2, P);
        K.card(g, x, y, wd, h, { r: 24, blur: 30, dy: 14 });
        K.text(g, lab, x + 24, y + 42, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.5) });
        K.text(g, val, x + 24, y + 88, { size: 36, c: valCol || C.ink, maxW: wd - 44 });
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -170, dur: 0.3 }) : K.still;   // the dial and its cards leave for s2
        // ---- the pipes, under everything (they grow from the dial once the tickets have landed); the light runs down
        // the main pipe, out along the manifold both ways and down each stub
        const pg = clamp((t - tPipe) / 0.4);
        if (pg > 0) {
          g.save(); K.apply(g, GX, GY, out);
          const fl = (t0, len) => clamp((t - t0) * SPEED / len);
          for (let i = 0; i < 5; i++) K.pipe(g, STUB(i), 26, { grow: clamp(pg * 2 - 1), flow: fl(tStub(i), TY + 8 - MY) });
          K.pipe(g, MAN, 26, { grow: 1, a: clamp(pg * 3 - 0.6) });
          K.pipe(g, [[GX, MY], [TC(0), MY]], 26, { base: false, flow: fl(tMan, GX - TC(0)) });
          K.pipe(g, [[GX, MY], [TC(4), MY]], 26, { base: false, flow: fl(tMan, TC(4) - GX) });
          K.pipe(g, MAIN, 26, { grow: clamp(pg * 3), flow: fl(tFlow, MY - FOOT) });
          if (pg > 0.5) {
            for (let i = 0; i < 5; i++) K.collar(g, TC(i), MY, 40, 38, true);
            K.collar(g, GX, FOOT + 4, 44, 18, false);
          }
          g.restore();
        }
        // ---- the dial
        // the needle springs (and overshoots); the readout only counts up to the value, never past it
        const v = t < tSwing ? 0.4 + 0.25 * Math.sin(t * 9) : SIG * K.spring(t - tSwing, 0.3, 10.5);
        const rv = Math.round(SIG * eo(clamp((t - tSwing) / 0.34)));
        const glow = t > tSwing + 0.34 ? 0.5 + 0.5 * Math.exp(-(t - tSwing - 0.34) * 2.5) : 0;
        const gy = GY + K.bob(t, 0.4, 3);
        g.save(); K.apply(g, GX, gy, out);
        K.gauge(g, GX, gy, GR, { v, max: 2 * SIG, label: "VOLATILITY", readout: t < tSwing ? "σ = ––" : "σ = " + rv + "%", rw: 300, glow });
        g.restore();
        // ---- the two cards: the model (on "Black-Scholes") and its one input (on "one volatility")
        // (both on screen from frame 1; the input's value is a "?" until the needle locks, then pops to 20%)
        const bob1 = { dx: 0, dy: K.bob(t, 2.1, 4), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 }, bob2 = { dx: 0, dy: K.bob(t, 0.3, 4), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 };
        const kv = clamp((t - (tSwing + 0.34)) / 0.22), pop = 1 + 0.12 * Math.sin(Math.PI * kv);
        miniCard(40, 516, 252, 108, "MODEL", "Black–Scholes", C.ink, K.combine(bob1, out));
        miniCard(788, 980, 252, 108, "ONE INPUT", kv > 0 ? "σ = " + SIG + "%" : "σ = ?", C.blue, K.combine(Object.assign({}, bob2, { sc: kv > 0 ? pop : 1 }), out));
        // ---- the tickets: dealt from the hand to the row; each σ field flips to 20% as the light reaches it
        if (t <= NEXT) {
          for (let i = 0; i < 5; i++) {
            const P = ticketPose(i, t), ta = tArrive(i);
            const sig = seqs(i).map((sq) => K.flapState(sq, ta, 0.065, t));
            const hl = t > ta ? Math.exp(-(t - ta) * 3) : 0;
            g.save(); g.translate(P.cx, P.cy); g.rotate(P.rot); g.scale(P.sc, P.sc);
            K.ticket(g, -TW / 2, -TH / 2, TW, TH, { K: KS[i], sig, hl });
            g.restore();
          }
        }
        // ---- the footer chip: one σ for every strike
        const kf = clamp((t - tFoot) / 0.3);
        if (kf > 0) {
          g.save(); K.apply(g, 540, 1604, out);
          K.chip(g, "ONE σ = " + SIG + "% FOR EVERY STRIKE", 540, 1604, { k: kf, size: 30, align: "center", fill: C.blue, col: C.white, badge: "✓", badgeFill: C.white, badgeCol: C.blue, badgeSize: 24, shadow: "rgba(37,99,235,0.4)", stroke: "rgba(0,0,0,0)" });
          g.restore();
        }
      }
