      const TEX_IDS = [];
      const NUM_KEYS = ["spx1987", "crash"];
      // ---- s3: "On October 19th, 1987, the S&P 500 fell 20.47% in one day." ----
      // The real S&P 500 daily candles, 1 Sep - 30 Oct 1987, drawn day by day; 19 Oct is locked on the date axis as it is
      // said; the 19 Oct candle drops 282.70 -> 224.84 on "fell", and -20.47% locks on "20.47%"; the days after appear
      // faint on "in one day", so the one candle stands alone.
      // words: 0 On 1 October 2 19th, 3 1987, 4 the 5 S&P 6 500 7 fell 8 20.47% 9 in 10 one 11 day.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s3-cv").getContext("2d");
      const w = (i) => W[i];
      const S = NUM.spx1987, CR = NUM.crash, n = S.date.length, ci = S.crash_index;
      const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const lab = (i) => { const p = S.date[i].split("-"); return `${+p[2]} ${MON[+p[1] - 1]}`; };
      const PX = { x: 40, y: 566, w: 1000, h: 884 };
      const F = QC.frame(150, 716, 850, 626, [-0.9, n - 0.1], [200, 340]);
      const XS = S.date.map((_, i) => i);
      const xt = [0, S.date.indexOf("1987-09-15"), S.date.indexOf("1987-10-01"), ci];
      const before = { open: S.open.slice(0, ci), high: S.high.slice(0, ci), low: S.low.slice(0, ci), close: S.close.slice(0, ci) };
      const crash = { open: [S.open[ci]], high: [S.high[ci]], low: [S.low[ci]], close: [S.close[ci]] };
      const after = { open: S.open.slice(ci + 1), high: S.high.slice(ci + 1), low: S.low.slice(ci + 1), close: S.close.slice(ci + 1) };
      const tDate = w(2), tC0 = 0.4, tC1 = w(4) + 0.1, tCrash = w(7) - 0.06, tLock = w(8), tAfter = w(9) - 0.1;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s3"]'), TEX, T); }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;
        QC.clipStage(g, xIn, xOut);
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp(t / 0.45), title: "S&P 500 · daily", index: "03",
          sub: "1 Sep – 30 Oct 1987 · open, high, low, close", tag: "REAL DATA", frame: f });
        QC.axes(g, T, F, { k: clamp((t - 0.15) / 0.5), xt, xf: lab, yt: [200, 220, 240, 260, 280, 300, 320, 340],
          xl: "trading days", yl: "index level" });
        // 19 Oct locked on the date axis as it is said
        const kD = clamp((t - tDate) / 0.35);
        if (kD > 0) {
          const px = F.X(ci), py = F.y + F.h + 33;
          QC.lock(g, T, [px - 40, py - 20, px + 40, py + 8], kD, { pad: 10, tag: "MON 19 OCT", flash: hit(t, tDate + 0.35) });
        }
        // the days before, drawn one by one
        const nB = lerp(0, ci, clamp((t - tC0) / (tC1 - tC0)));
        QC.candles(g, T, F, before, XS.slice(0, ci), { n: nB, bw: 12 });
        // the last close before the crash
        const k16 = clamp((t - (tC1 - 0.1)) / 0.4);
        if (k16 > 0) {
          QC.hline(g, T, F, CR.close_prev, { k: k16, c: "hi", a: 0.8 });
          QC.tag(g, T, "FRI 16 OCT  282.70", F.x + 10, F.Y(CR.close_prev) - 10, { c: "hi", a: k16, size: 18 });
        }
        // the crash candle: 282.70 -> 224.84 on "fell"
        const kC = clamp((t - tCrash) / 0.45);
        if (kC > 0) {
          QC.candles(g, T, F, crash, [ci], { n: eio(kC), bw: 15, hl: kC >= 1 && t >= tLock ? 0 : -1 });
          QC.hline(g, T, F, CR.close, { k: clamp((kC - 0.6) * 2.5), c: "acc", a: 0.9 });
          QC.tag(g, T, "MON 19 OCT  224.84", F.x + 10, F.Y(CR.close) + 34, { c: "acc", a: clamp((kC - 0.7) * 3.3), size: 18 });
          // the drop, measured beside the candle
          const x = F.X(ci) + 26, y0 = F.Y(CR.close_prev), y1 = lerp(y0, F.Y(CR.close), eio(kC));
          g.save(); g.strokeStyle = T.acc(0.9); g.lineWidth = 2;
          g.beginPath(); g.moveTo(x - 6, y0); g.lineTo(x + 6, y0); g.moveTo(x, y0); g.lineTo(x, y1); g.moveTo(x - 6, y1); g.lineTo(x + 6, y1); g.stroke();
          g.restore();
          QC.text(g, T, "−57.86", x + 12, (y0 + y1) / 2 + 8, { size: 22, mono: true, c: "acc", a: clamp((kC - 0.5) * 2) });
        }
        // -20.47% locks on "20.47%", with a target box on the candle and a callout
        const kL = clamp((t - (tLock - 0.3)) / 0.4);
        if (kL > 0) {
          const cx = F.X(ci);
          QC.lock(g, T, [cx - 14, F.Y(CR.close_prev), cx + 14, F.Y(CR.close)], clamp((t - tLock) / 0.3),
            { pad: 14, flash: hit(t, tLock + 0.3) });
          const bx = 186, by = 1066;
          QC.leader(g, T, [cx - 4, F.Y(CR.close) + 4], [cx - 70, by + 64], [bx + 400, by + 64], clamp((t - tLock) / 0.4));
          QC.panel(g, T, bx - 22, by - 52, 444, 196, { open: clamp((t - tLock + 0.1) / 0.3), op: 0.95 });
          QC.text(g, T, "19 OCT 1987 · ONE DAY", bx, by - 10, { size: 21, wt: 600, ls: 2, c: "hi", a: clamp((t - tLock) / 0.3), roll: clamp((t - tLock) / 0.4), frame: f });
          QC.value(g, T, "−20.47", bx - 4, by + 92, { size: 104, roll: kL, frame: f, unit: "%", flash: hit(t, tLock) });
          QC.text(g, T, "282.70 → 224.84 · S&P 500 close", bx, by + 128, { size: 21, mono: true, c: "line", a: clamp((t - tLock - 0.2) / 0.4) });
        }
        // the days after, faint: one candle stands alone
        const kA = clamp((t - tAfter) / 0.5);
        if (kA > 0) {
          QC.candles(g, T, F, after, XS.slice(ci + 1), { n: lerp(0, n - ci - 1, kA), bw: 11, a: 0.32 });
          const pulse = clamp((t - w(10)) / 0.6);
          if (pulse > 0 && pulse < 1) QC.dot(g, T, F.X(ci), F.Y(CR.close), { c: "acc", r: 6, pulse });
        }
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
