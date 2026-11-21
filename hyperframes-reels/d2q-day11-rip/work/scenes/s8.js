      const NUM_KEYS = ["bscurve", "put90"];
      const TEX_IDS = ["iv_def", "newton"];
      // ---- s8, implied vol: "Put that higher price into Black-Scholes and solve for the volatility: it comes out higher.
      // That's implied volatility." A solver app: the price 0.090 types into a field (put90.price_model) and flows into a
      // BLACK–SCHOLES box; the cursor clicks SOLVE; Newton's steps roll in (bscurve.newton: 30.0% → 20.7%) while a dot
      // walks down the Black–Scholes price-vs-σ curve to where it crosses the market price; the output field fills
      // 20.7% and a chip says 15.6% → 20.7%, higher. On "That's implied volatility" the definition lands (iv_def).
      // words (global): 113 Put 114 that 115 higher 116 price 117 into 118 Black-Scholes 119 and 120 solve 121 for 122 the
      //   123 volatility: 124 it 125 comes 126 out 127 higher. 128 That's 129-130 implied volatility.
      const g = document.getElementById("s8-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s8-tex", { ink: { ink: C.ink, acc: C.blue } }, () => draw()); }
      const BC = NUM.bscurve, NW = BC.newton, P9 = NUM.put90;
      const MKT = BC.market, IVV = 100 * BC.iv, ONE = 100 * BC.one_vol;
      const PS = BC.market.toFixed(3);                                   // "0.090"
      const tCard = 0.05, tType = w(115) - 0.02, tFlow = w(117) - 0.04, tSolve = w(120) + 0.02, tRow0 = tSolve + 0.12, dRow = 0.24;
      const tOut = w(125) - 0.1, tHigh = w(127) - 0.04, tDef = w(128) + 0.05;
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const ymax = 0.5;
      const Fr = K.frame(642, Y0 + 536, 334, 280, [5, 32], [0, ymax]);
      const nRows = Math.min(NW.length, 5);
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const P = K.enter(t - tCard, { dy: 240, pitch: 0.45, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, blur: 50, dy: 26 });
        K.rr(g, X0 + 34, Y0 + 32, 58, 58, 16); g.fillStyle = C.blue; g.fill();
        K.text(g, "σ", X0 + 63, Y0 + 76, { size: 42, align: "center", c: C.white });
        K.text(g, "Implied vol solver", X0 + 112, Y0 + 76, { size: 42 });
        K.prov(g, "SIMULATED PRICE", X0 + W0 - 34, Y0 + 61, { align: "right", col: C.blue });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y0 + 118, W0 - 60, 2);
        // the pipeline: price -> Black-Scholes -> σ
        const fy = Y0 + 186, fh = 104;
        const nT = t < tType ? 0 : Math.min(PS.length, 1 + Math.floor((t - tType) / 0.07));
        K.field(g, X0 + 40, fy, 250, fh, { label: "", value: nT ? PS.slice(0, nT) : "", size: 52, focus: t > tType && t < tFlow + 0.2 });
        K.text(g, "MARKET PRICE", X0 + 40, fy - 14, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        if (t > tType && t < tFlow && Math.floor(t * 4) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(X0 + 64 + K.tw(g, PS.slice(0, nT), 52), fy + 26, 3, 52); }
        const ax1 = X0 + 302, ax2 = X0 + 668;
        const arrow = (x, y, k, col) => { g.save(); g.strokeStyle = col; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 46, y); g.moveTo(x + 32, y - 13); g.lineTo(x + 46, y); g.lineTo(x + 32, y + 13); g.stroke(); g.restore(); };
        arrow(ax1, fy + fh / 2, 1, t > tFlow ? C.blue : rgba(C.ink, 0.3));
        const glow = clamp((t - tFlow - 0.15) / 0.2) * (1 - clamp((t - tSolve - 1.2) / 0.5));
        g.save(); if (glow > 0) { g.shadowColor = rgba(C.blue, 0.6 * glow); g.shadowBlur = 30 * glow; }
        K.rr(g, X0 + 362, fy, 296, fh, 22); g.fillStyle = glow > 0 ? K.mix("#ffffff", C.blueL, glow) : "#ffffff"; g.fill(); g.lineWidth = 5; g.strokeStyle = C.blue; g.stroke(); g.restore();
        K.text(g, "BLACK–SCHOLES", X0 + 510, fy + fh / 2 + 12, { size: 32, align: "center", c: C.blue });
        if (t > tFlow && t < tFlow + 0.35) { const q = eio((t - tFlow) / 0.35); g.beginPath(); g.arc(lerp(ax1, X0 + 362, q), fy + fh / 2, 11, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); }
        arrow(ax2, fy + fh / 2, 1, t > tOut ? C.blue : rgba(C.ink, 0.3));
        const kOut = clamp((t - tOut) / 0.25);
        K.field(g, X0 + 728, fy, 232, fh, { value: kOut > 0 ? IVV.toFixed(1) + "%" : "σ = ?", size: 50, col: kOut > 0 ? C.blue : rgba(C.ink, 0.4), focus: kOut > 0, fill: kOut > 0 ? C.blueL : C.mist });
        K.text(g, "VOLATILITY", X0 + 728, fy - 14, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        // SOLVE
        const cur = K.cursorAt(t, [[0, 990, 1580], [tFlow, 900, 1250], [tSolve - 0.06, X0 + 820, Y0 + 386]], [tSolve]);
        K.button(g, "SOLVE", X0 + 690, Y0 + 336, 270, 96, { size: 38, p: cur.p, ls: 4 });
        // Newton's steps: rows roll in after the click
        K.text(g, "NEWTON STEPS", X0 + 44, Y0 + 372, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.tex(g, "newton", X0 + 44, Y0 + 470, 34, { valign: "middle", k: clamp((t - tSolve) / 0.4) });
        K.text(g, "STEP   σ", X0 + 44, Y0 + 574, { size: 26, mono: true, c: rgba(C.ink, 0.5) });
        K.text(g, "PRICE", X0 + 420, Y0 + 574, { size: 26, mono: true, c: rgba(C.ink, 0.5), align: "right" });
        for (let i = 0; i < nRows; i++) {
          const k = clamp((t - (tRow0 + i * dRow)) / 0.16); if (k <= 0) continue;
          const y = Y0 + 626 + i * 54, last = i === nRows - 1;
          g.save(); g.globalAlpha *= clamp(k * 2);
          if (last && t > tOut) { K.rr(g, X0 + 40, y - 38, 400, 52, 12); g.fillStyle = C.yel; g.fill(); }
          K.text(g, String(i), X0 + 44, y, { size: 30, mono: true, c: rgba(C.ink, 0.45) });
          K.text(g, (100 * NW[i].sigma).toFixed(1) + "%", X0 + 220, y + 12 * (1 - eo(k)), { size: 34, mono: true, align: "right", c: last ? C.blue : C.ink });
          K.text(g, NW[i].price.toFixed(3), X0 + 420, y + 12 * (1 - eo(k)), { size: 34, mono: true, align: "right" });
          g.restore();
        }
        // the curve: Black-Scholes price against σ; the market price; Newton's dot walks down to the crossing
        K.text(g, "PRICE vs σ", Fr.x - 60, Y0 + 484, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.axes(g, Fr, { k: clamp((t - tCard - 0.2) / 0.4), xt: [10, 20, 30], xf: (v) => v + "%", yt: [0, 0.25, 0.5], yf: (v) => v.toFixed(2), size: 26, grid: true });
        const xs = BC.sigma.map((s) => 100 * s), kc = clamp((t - tFlow) / 0.5);
        K.line(g, Fr, xs, BC.price, { k: eio(kc), c: C.blue, w: 7 });
        if (kc > 0.5) {
          K.hline(g, Fr, MKT, { c: C.red, w: 3, k: clamp((kc - 0.5) * 2) });
          K.text(g, "MARKET " + PS, Fr.x + Fr.w, Fr.Y(MKT) - 14, { size: 26, mono: true, align: "right", c: C.red });
          // the one-σ point (15.6%, 0.014): what one volatility says
          K.dot(g, Fr.X(ONE), Fr.Y(BC.one_vol_price), { r: 10, c: rgba(C.ink, 0.55) });
        }
        // Newton's iterates as a dot walking along the curve
        let ni = -1; for (let i = 0; i < nRows; i++) if (t >= tRow0 + i * dRow) ni = i;
        if (ni >= 0) {
          const a = NW[ni], b = NW[Math.min(nRows - 1, ni + 1)], q = eio(clamp((t - (tRow0 + ni * dRow)) / dRow));
          const sx = lerp(100 * a.sigma, 100 * b.sigma, ni < nRows - 1 ? q : 0), sy = lerp(a.price, b.price, ni < nRows - 1 ? q : 0);
          K.dot(g, Fr.X(sx), Fr.Y(Math.min(ymax, sy)), { r: 12, c: C.blue, pulse: t > tOut ? clamp((t - tOut) / 0.5) : 0 });
        }
        // higher: 15.6% -> 20.7%
        const kh = clamp((t - tHigh) / 0.3);
        if (kh > 0) K.chip(g, ONE.toFixed(1) + "% → " + IVV.toFixed(1) + "% · HIGHER", 540, Y0 + 918, { k: kh, size: 34, align: "center", fill: C.blue, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(37,99,235,0.35)" });
        // the definition
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y0 + 980, W0 - 60, 2);
        K.text(g, "IMPLIED VOLATILITY", X0 + 44, Y0 + 1032, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55), a: clamp((t - tDef) / 0.2) });
        K.tex(g, "iv_def", 540, Y0 + 1074, 50, { align: "center", valign: "middle", k: clamp((t - tDef) / 0.5) });
        if (t > tSolve - 0.6) K.cursor(g, cur.x, cur.y, { p: cur.p, r: cur.r, a: 1 - clamp((t - tSolve - 0.8) / 0.3) });
        g.restore();
      }
