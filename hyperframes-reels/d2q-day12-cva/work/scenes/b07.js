      // ---- b07, default (vo 64.46-78.46): "Next, default. The client's credit spread is a hundred and twenty basis points.
      // With forty percent recovery, the credit triangle gives a hazard rate of two percent a year: about a nine and a half
      // percent chance of default in five years." On "Next, default." the card clears to a PD panel (years 0-5, 0-12 %). Chips
      // land on their words: "credit spread S = 120 bp", "recovery R = 40%". On "credit triangle" the formula λ = S / (1 − R)
      // writes in (lines 11-12 type); on "two percent a year" it completes: = 1.2% / 0.6 = 2% a year. On "nine and a half
      // percent chance of default in five years" the red PD curve draws, ending at "9.5% by year 5" (the console prints it).
      const g = document.getElementById("b07-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const S_BP = Math.round(NUM.S * 1e4), R_PC = Math.round(NUM.R * 100), S_PC = (NUM.S * 100).toFixed(1), ONE_R = (1 - NUM.R).toFixed(1);
      const LAM = Math.round(NUM.lam * 100), PD5 = (NUM.pd5 * 100).toFixed(1);
      const XS = [0].concat(NUM.t), PD = [0].concat(NUM.pd.map((v) => v * 100));
      const Fr = K.frame(150, 628, 790, 246, [0, NUM.T], [0, 12]);
      function formula(T) {
        const k1 = clamp((T - CUE.credit2 + 0.05) / 0.5), k2 = clamp((T - CUE.two + 0.04) / 0.6);
        if (k1 <= 0) return;
        const y = 532, p1a = "λ", p1b = " = S / (1 − R)", p2 = "  = " + S_PC + "% / " + ONE_R + " = ", p3 = LAM + "% a year";
        const width = (sz) => [p1a, p1b, p2, p3].reduce((q, s) => q + K.tw(g, s, sz, false, -0.5), 0);
        let sz = 42; while (sz > 28 && width(sz) > 840) sz -= 1;
        const wa = K.tw(g, p1a, sz, false, -0.5), wb = K.tw(g, p1b, sz, false, -0.5), w2 = K.tw(g, p2, sz, false, -0.5), w3 = K.tw(g, p3, sz, false, -0.5);
        const x0 = 540 - (wa + wb + w2 + w3) / 2;
        g.save(); g.beginPath(); g.rect(x0 - 10, y - 60, (wa + wb + 20) * eio(k1) + (w2 + w3) * eio(k2), 120); g.clip();
        K.text(g, p1a, x0, y, { size: sz, ls: -0.5, c: C.red });
        K.text(g, p1b, x0 + wa, y, { size: sz, ls: -0.5, c: C.ink });
        K.text(g, p2, x0 + wa + wb, y, { size: sz, ls: -0.5, c: C.steelD });
        K.text(g, p3, x0 + wa + wb + w2, y, { size: sz, ls: -0.5, c: C.red });
        g.restore();
        const kt = clamp((T - CUE.triangle + 0.05) / 0.3), kh = clamp((T - CUE.hazard + 0.05) / 0.3);
        const ws = K.tw(g, " = ", sz, false, -0.5);
        if (kt > 0) K.text(g, "credit triangle", Math.max(x0 + 150, x0 + wa + ws), y + 36, { size: 19, mono: true, wt: 700, c: C.steelD, a: kt });
        if (kh > 0) {
          g.save(); g.globalAlpha *= kh; g.fillStyle = C.red; g.fillRect(x0, y + 10, wa * eo(kh), 3); g.restore();
          K.text(g, "hazard rate", x0, y + 36, { size: 19, mono: true, wt: 700, c: C.red, a: kh });
        }
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        // the chips on their words
        const kS = clamp((T - CUE.credit + 0.04) / 0.3), kR = clamp((T - CUE.forty + 0.04) / 0.3);
        if (kS > 0) {
          K.chip(g, "credit spread  S = " + S_BP + " bp", 100, 442, { k: kS, size: 24, mono: true, wt: 700, h: 50, padX: 18, fill: C.white, col: C.ink, stroke: "rgba(13,21,38,0.14)" });
          const kn = clamp((T - CUE.hundred + 0.04) / 0.25);
          if (kn > 0) { const w0 = K.tw(g, "credit spread  S = ", 24, true, 0, 700), w1 = K.tw(g, S_BP + " bp", 24, true, 0, 700);
            g.save(); g.globalAlpha *= kn; g.fillStyle = C.red; g.fillRect(118 + w0, 462, w1 * eo(kn), 3); g.restore(); }
        }
        const kb = clamp((T - CUE.basis + 0.05) / 0.3);
        if (kb > 0) K.text(g, "= " + S_PC + "% a year", 118, 494, { size: 19, mono: true, c: C.steelD, a: kb });
        const kg = clamp((T - CUE.recovery + 0.05) / 0.3);
        if (kg > 0) K.text(g, "we get " + R_PC + "% back", 962, 494, { size: 19, mono: true, c: C.steelD, align: "right", a: kg });
        if (kR > 0) K.chip(g, "recovery  R = " + R_PC + "%", 980, 442, { k: kR, size: 24, mono: true, wt: 700, h: 50, padX: 18, align: "right", fill: C.white, col: C.ink, stroke: "rgba(13,21,38,0.14)" });
        formula(T);
        // the PD panel: axes from the start, the red curve on "nine and a half percent ... in five years"
        const ax = clamp((T - T0 - 0.15) / 0.6);
        K.thinAxes(g, Fr, { k: ax, xt: [0, 1, 2, 3, 4, 5], yt: [0, 4, 8, 12], yf: (v) => v + "%", xl: "years", yl: "chance of default by t" });
        // the question the panel answers: a dashed guide at year 5 with a "?", until the curve's end label lands
        const kq = clamp((T - CUE.q) / 0.3) * (1 - clamp((T - CUE.five) / 0.3));
        if (kq > 0) {
          const qx = Fr.X(NUM.T);
          g.save(); g.globalAlpha *= kq; g.setLineDash([6, 7]); g.strokeStyle = rgba(C.red, 0.55); g.lineWidth = 2;
          g.beginPath(); g.moveTo(qx, Fr.y + Fr.h); g.lineTo(qx, lerp(Fr.y + Fr.h, Fr.y + 8, eo(clamp((T - CUE.q) / 0.5)))); g.stroke(); g.restore();
          const bob = 3 * Math.sin(2 * Math.PI * (T - CUE.q) / 1.6);
          K.tag(g, "?", qx, Fr.y + 22 + bob, { k: kq, size: 26, h: 44, padX: 14, fill: C.red, align: "center", shadow: "rgba(224,49,49,0.3)" });
          K.text(g, "by year " + NUM.T, qx - 30, Fr.y + 30, { size: 18, mono: true, c: C.red, align: "right", a: kq });
        }
        const kc = eio(clamp((T - CUE.nine + 0.1) / 1.6));
        if (kc > 0) {
          K.area(g, Fr, XS, PD, { k: kc, c: C.red, fa: 0.16, grad: true });
          const r = K.line(g, Fr, XS, PD, { k: kc, c: C.red, w: 5, head: true });
          const ke = clamp((T - CUE.five + 0.05) / 0.3);
          if (ke > 0) {
            const ex = Fr.X(NUM.T), ey = Fr.Y(NUM.pd5 * 100);
            K.dot(g, ex, ey, { r: 9, c: C.red, s: back(ke, 2.2), pulse: ((T - CUE.five) % 1.4) / 1.4 });
            K.tag(g, PD5 + "% by year " + NUM.T, ex - 24, ey - 40, { k: ke, size: 24, h: 46, fill: C.red, align: "right", shadow: "rgba(224,49,49,0.3)" });
          }
        }
        g.restore();
      }
