      const TEX_IDS = ["mc_price"];
      const NUM_KEYS = ["model", "ends"];
      // ---- s10: "Price one-month options at strikes from 80 to 120, on a million simulated paths." ----
      // The Monte Carlo price types in on "Price one-month options". The panel is where a million simulated months end:
      // the histogram of the 1-month price S_T on a log count axis, the paths that had a crash in the accent, so the
      // crash bump near 80 shows; the nine strikes drop in from 80 to 120 as they are said; on "a million simulated
      // paths" the readout counts up and locks: 1,000,000 paths, 8,171 with a crash (and the bump is locked).
      // words: 0 Price 1 one-month 2 options 3 at 4 strikes 5 from 6 80 7 to 8 120, 9 on 10 a 11 million 12 simulated
      //        13 paths.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio, fmt } = QC;
      const g = document.getElementById("s10-cv").getContext("2d");
      const w = (i) => W[i];
      const M = NUM.model, E = NUM.ends;
      const XC = E.edges.slice(0, -1).map((e, i) => (e + E.edges[i + 1]) / 2), BW = (E.edges[1] - E.edges[0]) * 0.86;
      const bins = (cs) => { const x = [], y = []; cs.forEach((c, i) => { if (c > 1) { x.push(XC[i]); y.push(Math.log10(c)); } }); return { x, y }; };
      const BA = bins(E.all), BC = bins(E.crash);   // every path; the paths that had a crash (bins with a height on the log axis)
      const YT = [0, 1, 2, 3, 4, 5, 6];
      const KS = M.strikes, NK = KS.length;
      const PX = { x: 40, y: 742, w: 1000, h: 724 };
      const F = QC.frame(160, 890, 830, 372, [E.edges[0], E.edges[E.edges.length - 1]], [0, 6]);
      const nf = (v) => Math.round(v).toLocaleString("en-US");
      const tTex = w(0) - 0.04, tBars = 0.45, tK0 = w(6) - 0.12, tK1 = w(8), tN = w(10) - 0.2, tNL = w(11) + 0.04;
      const tC = w(12) - 0.1, tCL = w(13) - 0.12;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s10"]'), TEX, T); }
      function vw(s, size) {   // the width QC.value gives a string, so a label can sit after its final value
        g.save(); g.font = `400 ${size}px ${HUD.FONT.ui}`;
        const adv = g.measureText("0").width * 1.02; let x = 0;
        for (const ch of s) x += ".,: ".includes(ch) ? g.measureText(ch).width * 1.1 : adv;
        g.restore(); return x;
      }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the strip: the Monte Carlo price of a put ----
        QC.panel(g, T, 40, 566, 1000, 160, { open: clamp(t / 0.45), op: 0.9 });
        const aF = clamp((t - tTex) / 0.2);
        if (aF > 0) QC.tex.show("mc_price", { x: 540, y: 646, size: 40, align: "center", valign: "middle", a: aF,
          k: clamp((t - tTex) / 0.8), clip });
        // ---- the chart: where a million one-month paths end ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp((t - 0.1) / 0.45), title: "where a million months end", index: "10",
          sub: `S₀ = ${M.S0} · ${M.T_months} month · σ = ${(100 * M.sigma).toFixed(0)}% · ${fmt(100 * M.crash, 0)}% crashes, ${M.crash_rate.toFixed(1)} a year`,
          tag: "SIMULATED", frame: f });
        const kAx = clamp((t - 0.25) / 0.5);
        QC.axes(g, T, F, { k: kAx, xt: [70, 80, 90, 100, 110, 120, 130], yt: YT, yf: () => "", xl: "price in one month",
          yl: "paths (log)", ylDx: 96 });
        // the y ticks as 10 with a raised exponent, all in one face (pow10's superscripts mix two fonts in the mono face)
        YT.forEach((v, i) => {
          const a = clamp((eo(kAx) - i / YT.length * 0.6) * 3), y = F.Y(v) + 21 * 0.36, x = F.x - 14;
          if (a <= 0) return;
          QC.text(g, T, String(v), x, y - 9, { size: 15, mono: true, align: "right", c: "hi", a: 0.85 * a });
          QC.text(g, T, "10", x - 10, y, { size: 21, mono: true, align: "right", c: "hi", a: 0.85 * a });
        });
        // the histogram: every path (blue), the paths that had a crash (accent)
        const kB = clamp((t - tBars) / 0.85);
        QC.bars(g, T, F, BA.x, BA.y, { bw: BW, base: 0, k: kB, c: "line", fa: 0.2 });
        QC.bars(g, T, F, BC.x, BC.y, { bw: BW, base: 0, k: kB, c: "acc", fa: 0.28 });
        // the strikes drop in from 80 to 120 as they are said
        KS.forEach((K, j) => {
          const t0 = lerp(tK0, tK1, j / (NK - 1)), k = clamp((t - t0) / 0.22);
          if (k <= 0) return;
          const x = F.X(K), y0 = F.y - 2, y1 = lerp(y0, F.y + F.h, eo(k));
          g.save(); g.setLineDash([6, 6]); g.strokeStyle = T.hi(0.6); g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); g.restore();
          QC.text(g, T, String(K), x, F.y - 12, { size: 20, mono: true, align: "center", c: "hi", a: clamp(k * 3) });
          if (k < 1) QC.dot(g, T, x, y1, { r: 3.5, c: "hi" });
        });
        const kS = clamp((t - tK0) / 0.3);
        QC.text(g, T, "STRIKES", F.x + F.w, F.y - 40, { size: 19, wt: 600, ls: 2, align: "right", c: "line", a: kS });
        // the readout: a million paths, 8,171 with a crash
        const kN = clamp((t - tN) / (tNL - tN));
        if (kN > 0) {
          const y = 1426;
          g.save(); g.strokeStyle = T.dim(0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(64, 1356); g.lineTo(64 + 952 * eo(clamp(kN * 2)), 1356); g.stroke(); g.restore();
          const x1 = 64 + vw(nf(M.paths), 60);   // the counters count up right-aligned in their final slot, so labels never move
          QC.value(g, T, nf(M.paths * eo(kN)), x1, y, { size: 60, align: "right", roll: kN >= 1 ? 1 : 0.999, frame: f, flash: hit(t, tNL), a: clamp(kN * 4) });
          QC.text(g, T, "PATHS", x1 + 14, y - 4, { size: 28, wt: 600, ls: 2, c: "hi", a: clamp(kN * 3) });
          const kc = clamp((t - tC) / (tCL - tC));
          if (kc > 0) {
            const xc = 560;
            const x2 = xc + vw(nf(M.paths_with_crash), 60);
            QC.value(g, T, nf(M.paths_with_crash * eo(kc)), x2, y, { size: 60, align: "right", roll: kc >= 1 ? 1 : 0.999, frame: f, flash: hit(t, tCL), a: clamp(kc * 4) });
            QC.text(g, T, "WITH A CRASH", x2 + 14, y - 4, { size: 28, wt: 600, ls: 2, c: "hi", a: clamp(kc * 3) });
          }
        }
        // the crash bump, locked with its count
        const kL = clamp((t - tCL) / 0.3);
        if (kL > 0) QC.lock(g, T, [F.X(70) + 16, F.Y(3.45), F.X(87.6), F.Y(0) - 4], kL, { pad: 10, flash: hit(t, tCL + 0.3) });
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
