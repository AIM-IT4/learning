      const NUM_KEYS = ["model"];
      const TEX_IDS = ["flat"];
      // ---- s12, the answer (brand-blue block): "So here's the answer: with normal returns and one volatility, implied vol
      // would be flat across strikes." It opens on s11's finished smile card (the smile stays up), which flips on
      // "answer:" into THE ANSWER card: two switches turn on as they are said (NORMAL RETURNS, ONE VOLATILITY), the
      // definition σ_imp(K) = σ for every K (flat) lands on "implied vol would be", and on "flat across strikes" a flat
      // line runs across every strike at σ = 15% (model.sigma). At the cut the card turns away; s13 turns the smile back.
      // words (global): 196 So 197 here's 198 the 199 answer: 200 with 201 normal 202 returns 203 and 204 one 205 volatility,
      //   206 implied 207 vol 208 would 209 be 210 flat 211 across 212 strikes.
      const g = document.getElementById("s12-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s12-tex", { ink: { ink: C.ink, acc: C.blue } }, () => draw()); }
      const M = NUM.model, SMILE = K.smileCard(M), SIGP = Math.round(M.sigma * 100), KS = M.strikes;
      const tFlip = w(199) - 0.06, tN = w(201) - 0.04, tO = w(204) - 0.04, tDef = w(206) - 0.05, tFlat0 = w(210) - 0.06, tFlat1 = w(212) + 0.2;
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const Fr = K.frame(170, Y0 + 742, 810, 270, [77.5, 122.5], [10, 35]);
      // the card turning about its vertical axis: scale x by |cos|, a little shear for depth, a shade near edge-on
      function turned(th, fn) {
        const c = Math.cos(th), sx = Math.max(0.02, Math.abs(c));
        g.save(); g.translate(540, Y0 + H0 / 2); g.transform(sx, 0.12 * Math.sin(th) * (c >= 0 ? 1 : -1), 0, 1, 0, 0); g.translate(-540, -(Y0 + H0 / 2));
        fn();
        if (sx < 0.98) { K.rr(g, X0, Y0, W0, H0, 30); g.fillStyle = `rgba(13,21,38,${0.3 * (1 - sx)})`; g.fill(); }
        g.restore();
      }
      function answer(t) {
        K.card(g, X0, Y0, W0, H0, { r: 30, shadow: "rgba(8,22,90,0.45)", blur: 50, dy: 26 });
        // THE ANSWER, in a big marker box
        const hw = K.tw(g, "THE ANSWER", 92, false, 2);
        K.rr(g, 540 - hw / 2 - 30, Y0 + 54, hw + 60, 130, 18); g.fillStyle = C.yel; g.fill();
        K.text(g, "THE ANSWER", 540, Y0 + 152, { size: 92, ls: 2, align: "center" });
        // the two conditions, switched on as they are said
        const rows = [["NORMAL RETURNS", tN], ["ONE VOLATILITY", tO]];
        rows.forEach(([s, t0], i) => {
          const y = Y0 + 268 + i * 116, on = eio(clamp((t - t0) / 0.25));
          K.rr(g, X0 + 40, y - 46, W0 - 80, 96, 24); g.fillStyle = on > 0.5 ? C.blueL : C.mist; g.fill();
          K.text(g, s, X0 + 80, y + 15, { size: 44, c: on > 0.5 ? C.blueD : rgba(C.ink, 0.45) });
          K.toggle(g, X0 + W0 - 180, y + 2, on, { w: 112, h: 62 });
        });
        // the definition
        K.text(g, "⇒  IMPLIED VOL", X0 + 44, Y0 + 556, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55), a: clamp((t - tDef) / 0.2) });
        K.tex(g, "flat", 540, Y0 + 626, 60, { align: "center", valign: "middle", k: clamp((t - tDef) / 0.5) });
        // the flat line across every strike
        K.axes(g, Fr, { k: clamp((t - tFlip - 0.3) / 0.4), xt: KS, yt: [10, 20, 30], yf: (v) => v + "%", size: 26, xl: "STRIKE K", yl: "IMPLIED VOL" });
        // a faint ghost of the smile with crashes (the simulated model), for contrast with what normal returns would give
        const kg = clamp((t - tFlip - 0.4) / 0.4) * (1 - 0.5 * clamp((t - tFlat0) / 0.4));
        if (kg > 0) {
          K.line(g, Fr, SMILE.CXS, SMILE.CYS, { c: rgba(C.ink, 0.28), w: 5, dash: [12, 10], a: kg });
          K.text(g, "WITH CRASHES: THE SMILE", Fr.X(84), Fr.Y(31), { size: 26, mono: true, c: rgba(C.ink, 0.45), a: kg });
        }
        const kf = clamp((t - tFlat0) / (tFlat1 - tFlat0));
        if (kf > 0) {
          K.line(g, Fr, [77.5, 122.5], [SIGP, SIGP], { k: eio(kf), c: C.blue, w: 10, head: true, glow: 0.5 });
          KS.forEach((k, i) => { const q = clamp((eio(kf) * 45 - (k - 77.5)) / 3); if (q > 0) K.dot(g, Fr.X(k), Fr.Y(SIGP), { r: 10, s: back(q, 2.4) }); });
          K.chip(g, "FLAT: σ = " + SIGP + "% AT EVERY STRIKE", Fr.x + Fr.w, Fr.Y(SIGP) - 58, { k: clamp((kf - 0.6) * 3), size: 30, align: "right", fill: C.yel, col: C.ink, stroke: "rgba(0,0,0,0)" });
        }
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const f = clamp((t - tFlip) / 0.36), th = Math.PI * eio(f);
        if (th < Math.PI / 2) turned(th, () => SMILE.draw(g, 100, SMILE.S_END, K.still));
        else {
          // after the cut the card turns away (s13 turns the smile back in)
          const th2 = t > NEXT ? Math.PI + (Math.PI / 2) * eio(clamp((t - NEXT) / 0.18)) : Math.PI;
          if (th2 < Math.PI * 1.5 - 0.01) turned(th2, () => answer(t));
        }
      }
