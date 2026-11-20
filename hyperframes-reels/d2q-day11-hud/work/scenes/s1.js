      const TEX_IDS = ["bs_put", "bs_d"];
      const NUM_KEYS = ["normal", "model"];
      // ---- s1: "You know Black-Scholes uses one volatility for every option." ----
      // The Black-Scholes put and its d1,2 type in on "Black-Scholes"; on "one volatility" their σs lock orange (a target box
      // on each σ) while a flat line at σ = 20% (normal.sigma_annual) draws across implied vol by strike; on "every option"
      // nine options (strikes 80..120, model.strikes) land on it one by one, tagged σ = 20% FOR EVERY STRIKE.
      // The strip and the chart carry into s2 exactly as they stand at the end: no erase.
      // words: 0 You 1 know 2 Black-Scholes 3 uses 4 one 5 volatility 6 for 7 every 8 option.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s1-cv").getContext("2d");
      const w = (i) => W[i];
      const SIG = 100 * NUM.normal.sigma_annual, KS = NUM.model.strikes;
      // shared with s2 (same place across the cut): the strip, the chart panel, the plot frame
      const PS = { x: 40, y: 566, w: 1000, h: 204 }, PX = { x: 40, y: 784, w: 1000, h: 682 };
      const F = QC.frame(170, 936, 820, 424, [76, 124], [10, 35]);
      const tF0 = w(2) - 0.04, tF1 = w(2) + 0.16, tSig = w(4) + 0.17, tL0 = w(4) - 0.05, tL1 = w(5) + 0.3;
      const tD0 = w(6) + 0.1, tDs = 0.05, tTag = w(8) - 0.02;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      let ROOT = null, SIGF = [];
      function init() { ROOT = document.querySelector('[data-composition-id="s1"]'); QC.tex.init(ROOT, TEX, T); SIGF = sigmaFrac(); }
      // where bs_d's σs (its \class{acc} parts) sit in its box, as fractions, computed once from the typeset SVG itself (the
      // transforms down to each glyph and the glyph's outline points): nothing reads layout
      function sigmaFrac() {
        const svg = new DOMParser().parseFromString(TEX.bs_d.svg, "image/svg+xml").documentElement;
        const vb = svg.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
        return [...svg.querySelectorAll(".acc path")].map((p) => {
          let m = [1, 1, 0, 0];                                     // x' = m0 x + m2, y' = m1 y + m3, up to the root
          for (let n = p; n && n !== svg; n = n.parentNode) {
            [...(n.getAttribute("transform") || "").matchAll(/(translate|scale)\(([^)]*)\)/g)].reverse().forEach(([, op, a]) => {
              const v = a.trim().split(/[\s,]+/).map(Number), sy = v.length > 1 ? v[1] : v[0];
              m = op === "translate" ? [m[0], m[1], m[2] + v[0], m[3] + (v[1] || 0)] : [m[0] * v[0], m[1] * sy, m[2] * v[0], m[3] * sy];
            });
          }
          const X = [], Y = []; let cx = 0, cy = 0;                 // the outline's points (absolute M L Q T H V)
          for (const [, c, args] of p.getAttribute("d").matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
            const v = (args.match(/-?\d*\.?\d+/g) || []).map(Number);
            if (c === "H") v.forEach((x) => { cx = x; X.push(cx); Y.push(cy); });
            else if (c === "V") v.forEach((y) => { cy = y; X.push(cx); Y.push(cy); });
            else for (let k = 0; k + 1 < v.length; k += 2) { cx = v[k]; cy = v[k + 1]; X.push(cx); Y.push(cy); }
          }
          const xs = X.map((x) => m[0] * x + m[2]), ys = Y.map((y) => m[1] * y + m[3]);
          return [(Math.min(...xs) - vb[0]) / vb[2], (Math.min(...ys) - vb[1]) / vb[3], (Math.max(...xs) - vb[0]) / vb[2], (Math.max(...ys) - vb[1]) / vb[3]];
        });
      }
      // bs_d shown centred at cx, top at y, em px: its σ boxes in canvas px
      const sigmaBoxes = (cx, y, em) => { const bw = TEX.bs_d.w * em, bh = TEX.bs_d.h * em, x0 = cx - bw / 2;
        return SIGF.map((q) => [x0 + q[0] * bw, y + q[1] * bh, x0 + q[2] * bw, y + q[3] * bh]); };
      function draw() {
        if (!ROOT) return;   // the timeline renders once before init() (compose.py's tail): nothing to draw yet
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = QC.STAGE.x0;   // no scan-erase: the chart continues into s2
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the formula strip: the Black-Scholes put, typed in on "Black-Scholes"; its σs lock on "one volatility" ----
        QC.panel(g, T, PS.x, PS.y, PS.w, PS.h, { open: clamp(t / 0.45), op: 0.9 });
        const lockS = t >= tSig;
        QC.tex.show("bs_put", { x: 540, y: PS.y + 20, size: 40, align: "center", valign: "top", k: clamp((t - tF0) / 0.42), lock: lockS, clip });
        QC.tex.show("bs_d", { x: 540, y: PS.y + 80, size: 40, align: "center", valign: "top", k: clamp((t - tF1) / 0.5), lock: lockS, clip });
        // a target box on each σ as they lock; released after the beat, so the formula stays clean (the σs stay orange)
        const kS = clamp((t - (tSig - 0.22)) / 0.22), aS = 1 - clamp((t - (tSig + 0.55)) / 0.25);
        if (kS > 0 && aS > 0) sigmaBoxes(540, PS.y + 80, 40).forEach((bb) => QC.lock(g, T, bb, kS, { pad: 7, flash: hit(t, tSig), alpha: aS }));
        // ---- the chart: implied vol by strike ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp((t - 0.1) / 0.45), title: "Black–Scholes · one σ", index: "01",
          sub: "implied vol by strike", tag: "MODEL", frame: f });
        QC.axes(g, T, F, { k: clamp((t - 0.2) / 0.5), xt: KS, yt: [10, 15, 20, 25, 30, 35], yf: (v) => v + "%",
          xl: "strike K", yl: "implied vol" });
        // one volatility: a flat line at σ = 20% across every strike
        const kL = clamp((t - tL0) / (tL1 - tL0));
        if (kL > 0) QC.line(g, T, F, F.xr, [SIG, SIG], { k: eio(kL), c: "line", w: 3.4, head: true });
        // every option: nine strikes land on the line, one by one
        KS.forEach((K, i) => {
          const t0 = tD0 + i * tDs, k = clamp((t - t0) / 0.16);
          if (k <= 0) return;
          QC.dot(g, T, F.X(K), F.Y(SIG) - 44 * (1 - eo(k)), { c: "line", r: 6, a: clamp(k * 2), pulse: clamp((t - t0 - 0.16) / 0.22) });
        });
        const kT = clamp((t - tTag) / 0.25);
        if (kT > 0) QC.tag(g, T, "σ = " + SIG.toFixed(0) + "% FOR EVERY STRIKE", F.x + F.w - 6, F.Y(SIG) - 24, { c: "line", align: "right", a: kT, size: 19 });
        g.restore();
        QC.scanLine(g, T, xIn);
        QC.tex.end();
      }
