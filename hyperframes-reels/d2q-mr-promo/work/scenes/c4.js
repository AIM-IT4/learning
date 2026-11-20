      // ---- c4, project 2: "Project two: an FX options desk. Full revaluation against delta-gamma-vega, stressed through the
      // financial crisis, COVID and the 2024 yen unwind."
      // A pricer card for the FX options desk: a two-way toggle "Full revaluation ⟷ Delta-gamma-vega" that a cursor
      // clicks just before "Full" and in "against" (cues stay off the stressed words), over an illustrative chart (labelled): a long straddle's P&L against
      // a spot shock, revalued in full (blue, solid) and by its delta-gamma Taylor expansion (red, dashed; Black-Scholes,
      // 10% vol, 3 months, at the money); the selected one is drawn bold and the gap between them shades in the tails.
      // Right after "stressed" a red STRESSED stamp slams on the pricer (it shakes). Under it, the historical stress library: four
      // slots (the scenario faint in each) that fill on their words: GFC 2008 ("financial crisis"), COVID 2020, 2022 (no title: the product page names
      // it only by its year), YEN UNWIND 2024 ("2024"); then a run highlight cycles through them.
      // words (global): 53 Project 54 two: 55 an 56 FX 57 options 58 desk. 59 Full 60 revaluation 61 against
      //   62 delta-gamma-vega, 63 stressed 64 through 65 the 66 financial 67 crisis, 68 COVID 69 and 70 the 71 2024 72 yen 73 unwind.
      const g = document.getElementById("c4-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { }
      const SC = FACTS.p2_stress, M = FACTS.p2_methods;
      // beats
      const tCard = 0.04, tLib = 0.12, tDesk = w(56) - 0.05, tCur0 = w(58) - 0.1, tClick1 = w(59) - 0.06, tClick2 = w(61) + 0.1;
      const tStamp = w(64), tSlot = [w(66) - 0.04, w(68) - 0.04, w(70) - 0.06, w(71) - 0.04], tRun = w(73) + 0.1;
      const X = 40, W = 1000, Y = 300, H = 540, YL = 866, HL = 474;
      // ---- the illustrative chart: a long at-the-money straddle (Black-Scholes, S0 = K = 100, 10% vol, 3 months, r = 0):
      // its P&L for a spot shock x, revalued in full and by delta-gamma (spot only, so the vega term is zero)
      const N = (z) => { const t_ = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t_ - 1.453152027) * t_) + 1.421413741) * t_ - 0.284496736) * t_ + 0.254829592) * t_ * Math.exp(-z * z / 2); return 0.5 * (1 + Math.sign(z) * y); };
      const SIG = 0.1, TT = 0.25, S0 = 100, KK = 100, sq = SIG * Math.sqrt(TT);
      const straddle = (S) => { const d1 = (Math.log(S / KK) + 0.5 * SIG * SIG * TT) / sq, d2 = d1 - sq; return S * N(d1) - KK * N(d2) + KK * N(-d2) - S * N(-d1); };
      const d10 = (Math.log(S0 / KK) + 0.5 * SIG * SIG * TT) / sq, DEL = 2 * N(d10) - 1, GAM = 2 * Math.exp(-d10 * d10 / 2) / Math.sqrt(2 * Math.PI) / (S0 * sq), V0 = straddle(S0);
      const XS = []; for (let x = -0.2; x <= 0.2001; x += 0.005) XS.push(x);
      const FULL = XS.map((x) => straddle(S0 * (1 + x)) - V0), DGV = XS.map((x) => DEL * S0 * x + 0.5 * GAM * (S0 * x) * (S0 * x));
      function toggle(t, x, y, w_, h) {
        const sel = t < tClick1 ? 0 : t < tClick2 ? 1 : 2;
        const q = sel === 0 ? 0 : sel === 1 ? eio(clamp((t - tClick1) / 0.22)) : 1 + eio(clamp((t - tClick2) / 0.26));
        K.rr(g, x, y, w_, h, h / 2); g.fillStyle = C.mist; g.fill();
        const sw = w_ / 2 - 8;
        if (q > 0) {
          const px = x + 4 + (q <= 1 ? 0 : (q - 1) * (sw + 8)), col = q <= 1 ? C.blue : mix(C.blue, C.red, q - 1);
          g.save(); g.globalAlpha *= clamp(q * 4); g.shadowColor = rgba(C.ink, 0.25); g.shadowBlur = 14; g.shadowOffsetY = 5;
          K.rr(g, px, y + 4, sw, h - 8, (h - 8) / 2); g.fillStyle = col; g.fill(); g.restore();
        }
        const on1 = q > 0 && q < 1.5, on2 = q >= 1.5;
        // the segment labels, each with its line style as a legend mark
        const lab = (s, cx, on, dash, col) => {
          const tw_ = K.tw(g, s, 34), lx = cx - (tw_ + 64) / 2;
          g.save(); g.strokeStyle = on ? C.white : col; g.lineWidth = 6; g.lineCap = "round"; if (dash) g.setLineDash([10, 9]);
          g.beginPath(); g.moveTo(lx, y + h / 2); g.lineTo(lx + 44, y + h / 2); g.stroke(); g.restore();
          K.text(g, s, lx + 64, y + h / 2 + 12, { size: 34, c: on ? C.white : C.ink });
        };
        lab(M[0], x + w_ / 4, on1, false, C.blue);
        lab(M[1], x + 3 * w_ / 4, on2, true, C.red);
        return sel;
      }
      function chart(t, sel, Fr) {
        const kd = eo(clamp((t - tCard - 0.2) / 0.7));
        g.save(); g.strokeStyle = rgba(C.ink, 0.85); g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(Fr.x, Fr.y + Fr.h); g.lineTo(Fr.x + Fr.w, Fr.y + Fr.h); g.stroke();
        g.setLineDash([6, 8]); g.strokeStyle = rgba(C.ink, 0.25); g.lineWidth = 2.5; g.beginPath(); g.moveTo(Fr.X(0), Fr.y); g.lineTo(Fr.X(0), Fr.y + Fr.h); g.stroke(); g.restore();
        // the gap between the two in the tails, once delta-gamma-vega is selected
        const kg = clamp((t - tClick2) / 0.4);
        if (kg > 0) {
          g.save(); g.globalAlpha *= kg * 0.9; g.beginPath();
          XS.forEach((x, i) => (i ? g.lineTo(Fr.X(x), Fr.Y(DGV[i])) : g.moveTo(Fr.X(x), Fr.Y(DGV[i]))));
          for (let i = XS.length - 1; i >= 0; i--) g.lineTo(Fr.X(XS[i]), Fr.Y(FULL[i]));
          g.closePath(); g.fillStyle = rgba(C.red, 0.13); g.fill(); g.restore();
        }
        const wF = sel === 1 ? 8 : sel === 2 ? 5 : 6, wD = sel === 2 ? 8 : sel === 1 ? 4.5 : 5.5;
        K.line(g, Fr, XS, FULL, { c: C.blue, w: wF, k: kd, a: sel === 2 ? 0.55 : 1, clip: false, glow: sel === 1 ? 0.5 : 0 });
        K.line(g, Fr, XS, DGV, { c: C.red, w: wD, k: kd, a: sel === 1 ? 0.45 : 1, dash: [16, 12], clip: false, glow: sel === 2 ? 0.5 : 0 });
        K.text(g, "← SPOT DOWN", Fr.x, Fr.y + Fr.h + 40, { size: 25, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.text(g, "SPOT UP →", Fr.x + Fr.w, Fr.y + Fr.h + 40, { size: 25, mono: true, ls: 2, align: "right", c: rgba(C.ink, 0.55) });
        K.text(g, "P&L", Fr.x - 4, Fr.y - 14, { size: 25, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
      }
      function pricer(t, P) {
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X, Y, W, H, { r: 32, blur: 50, dy: 26 });
        K.chip(g, "PROJECT 2", X + 36, Y + 64, { size: 32, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(224,49,49,0.35)", h: 60, padX: 24 });
        const kd = clamp((t - tDesk) / 0.3);
        K.text(g, FACTS.p2_desk.toUpperCase(), X + 268, Y + 74, { size: 28, mono: true, ls: 3, c: mix("#9aa4b2", C.ink, kd) });
        K.prov(g, "ILLUSTRATIVE", X + W - 36, Y + 64, { align: "right", col: C.steelD, size: 23 });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 122, W - 60, 2);
        const sel = toggle(t, X + 36, Y + 148, W - 72, 92);
        const Fr = K.frame(X + 96, Y + 300, W - 180, 170, [-0.2, 0.2], [0, 33]);
        chart(t, sel, Fr);
        // STRESSED
        if (t > tStamp) K.stamp(g, "STRESSED", X + W - 250, Y + 360, { u: t - tStamp, rot: -0.12, size: 62, col: C.red, ground: C.white, seed: 9, fill: "rgba(255,255,255,0.9)" });
        g.restore();
      }
      function library(t, P) {
        g.save(); K.apply(g, 540, YL + HL / 2, P);
        K.card(g, X, YL, W, HL, { r: 32, blur: 44, dy: 22 });
        K.text(g, "HISTORICAL STRESS LIBRARY", X + 40, YL + 58, { size: 27, mono: true, ls: 3, c: rgba(C.ink, 0.6) });
        const cw = (W - 72 - 24) / 2, ch = 168;
        const run = t > tRun ? Math.floor((t - tRun) / 0.32) % 4 : -1;
        SC.forEach(([name, yr], i) => {
          const x = X + 36 + (i % 2) * (cw + 24), y = YL + 92 + Math.floor(i / 2) * (ch + 22), u = t - tSlot[i];
          if (u <= 0) {   // waiting: a dashed slot with the scenario faint in it
            K.rr(g, x, y, cw, ch, 22); g.fillStyle = "#f4f6fa"; g.fill();
            g.setLineDash([12, 10]); g.strokeStyle = rgba(C.ink, 0.14); g.lineWidth = 3; K.rr(g, x, y, cw, ch, 22); g.stroke(); g.setLineDash([]);
            g.beginPath(); g.arc(x + 58, y + ch / 2, 34, 0, Math.PI * 2); g.strokeStyle = "#d5dbe4"; g.lineWidth = 3; g.stroke();
            if (name) { K.text(g, yr, x + 114, y + 82, { size: 62, ls: -1, c: "#d0d6df" }); K.text(g, name, x + 116, y + 126, { size: 28, mono: true, ls: 2, c: "#d0d6df", maxW: cw - 130 }); }
            else K.text(g, yr, x + 114, y + ch / 2 + 23, { size: 62, ls: -1, c: "#d0d6df" });
            return;
          }
          const p = K.spring(u, 0.5, 15), sc = lerp(0.6, 1, p), dx = 160 * (1 - eo(clamp(u / 0.3)));
          g.save(); g.translate(x + cw / 2 + dx, y + ch / 2); g.scale(sc, sc); g.translate(-(x + cw / 2), -(y + ch / 2)); g.globalAlpha *= clamp(u / 0.1);
          const hot = run === i;
          K.card(g, x, y, cw, ch, { r: 22, blur: 22, dy: 10, fill: hot ? "#fff5f5" : C.white, stroke: hot ? rgba(C.red, 0.7) : rgba(C.ink, 0.12) });
          g.beginPath(); g.arc(x + 58, y + ch / 2, 34, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
          g.save(); g.strokeStyle = C.white; g.lineWidth = 6; g.lineCap = "round"; g.lineJoin = "round";
          g.beginPath(); g.moveTo(x + 44, y + ch / 2 - 14); g.lineTo(x + 70, y + ch / 2 + 12); g.moveTo(x + 70, y + ch / 2 - 4); g.lineTo(x + 70, y + ch / 2 + 12); g.lineTo(x + 54, y + ch / 2 + 12); g.stroke(); g.restore();
          if (name) {
            K.text(g, yr, x + 114, y + 82, { size: 62, ls: -1 });
            K.text(g, name, x + 116, y + 126, { size: 28, mono: true, ls: 2, c: C.red, maxW: cw - 130 });
          } else K.text(g, yr, x + 114, y + ch / 2 + 23, { size: 62, ls: -1 });
          g.restore();
        });
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -60, dur: 0.2, sc: 0.95 }) : K.still;
        const bob = (ph) => ({ dx: 0, dy: K.bob(T0 + t, ph, 3), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
        const sh = K.shake(t - tStamp - 0.12, 12, 3);
        library(t, K.combine(K.combine(K.enter(t - tLib, { dy: 130, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.92 }), bob(1.6)), out));
        const Pp = K.combine(K.combine(K.enter(t - tCard, { dy: 150, pitch: 0.45, yaw: 0, rot: 0.02, sc: 0.92 }), bob(0.3)), out);
        Pp.dx += sh[0]; Pp.dy += sh[1];
        pricer(t, Pp);
        // the cursor: in from the right, clicks "Full revaluation", then "Delta-gamma-vega", then away
        if (t > tCur0 && t < tStamp + 0.5) {
          const c = K.cursorAt(t, [[tCur0, 1120, 1180], [tClick1 - 0.05, 300, Y + 210], [tClick2 - 0.4, 300, Y + 210], [tClick2 - 0.05, 790, Y + 210], [tStamp + 0.45, 1150, Y + 120]], [tClick1, tClick2]);
          K.cursor(g, c.x, c.y, { p: c.p, r: c.r, s: 1.3 });
        }
        K.floor(g);
      }
