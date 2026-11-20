      const TEX_IDS = [];
      const NUM_KEYS = ["model"];
      // ---- s11: "At the money, implied vol is 15.6%. At 90, 20.7. At 80, 29.7. One stock, one model, and the flat line
      // bends into a smile." The payoff: implied vol by strike from the million simulated months of s10. The money strike
      // 100 is locked on the strike axis; its point lands at 15.6% and a dashed flat line (ONE σ) runs out from it. 90 and
      // 80 land on that line and rise to 20.7% and 29.7%, each locking with a big rolling value as it is said; a table
      // (strike · Monte Carlo price · implied vol) fills as they land. The other six strikes join on "One stock, one model";
      // on "the flat line bends into a smile" the flat line bends through all nine points, and on "smile." the area under
      // it fills and glows (the film's one solid moment): THE SMILE. No erase at the end: the smile holds across the cut,
      // and s12 opens on this exact frame (the chart block below is copied into s12 byte for byte) and erases it there.
      // words: 0 At 1 the 2 money, 3 implied 4 vol 5 is 6 15.6%. 7 At 8 90, 9 20.7. 10 At 11 80, 12 29.7. 13 One
      //        14 stock, 15 one 16 model, 17 and 18 the 19 flat 20 line 21 bends 22 into 23 a 24 smile.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s11-cv").getContext("2d");
      const w = (i) => W[i];
      // ======== the s11 smile chart: identical code in s11 and s12 (s12 opens on its final frame) ========
      // SMILE.chart(t, f, S) draws the chart at time t; S holds the beat times (s11 sets them from its words, s12 draws
      // the chart at its end state). Its own scope, so its names never meet the scene's.
      const SMILE = (function () {
        const M = NUM.model, KS = M.strikes, IV = Object.fromEntries(KS.map((k) => [k, M.iv_pct[String(k)]]));
        const ROW = Object.fromEntries(M.rows.map((r) => [r.K, r]));
        const K0 = M.S0, ATM = IV[K0];                        // the money strike (S = 100) and its implied vol, 15.6%
        const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const SUB = `S = ${K0} · σ = ${Math.round(M.sigma * 100)}% · ${QC.MINUS}${Math.round(-M.crash * 100)}% crash, 1 in ` +
          `${M.crash_every_years} years · ${comma(M.paths)} paths`;
        // the smile: a monotone cubic through the nine points (no overshoot between strikes)
        function smooth(xs, ys) {
          const n = xs.length, d = [], m = new Array(n);
          for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
          m[0] = d[0]; m[n - 1] = d[n - 2];
          for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
          for (let i = 0; i < n - 1; i++) {
            if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
            const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
            if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
          }
          return (x) => {
            let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
            const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
            return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
          };
        }
        const SM = smooth(KS, KS.map((k) => IV[k]));
        const CX = []; for (let k = KS[0]; k <= KS[KS.length - 1] + 1e-9; k += 0.25) CX.push(k);
        const CY = CX.map(SM);
        // layout: one chart panel over the stage; the table sits in the empty upper right of the chart
        const PX = { x: 40, y: 566, w: 1000, h: 900 };
        const F = QC.frame(150, 740, 850, 610, [77, 123], [10, 35]);
        const TB = { x: 646, y: 748, w: 354, h: 300 };
        const HERO = [K0, 90, 80], RISE = 0.36, OTHERS = KS.filter((k) => !HERO.includes(k));
        const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
        const pFmt = (v) => { if (v >= 0.01) return v.toFixed(3); const e = Math.floor(Math.log10(v)); return (v / 10 ** e).toFixed(1) + "×" + QC.pow10(e); };
        const xTickY = F.y + F.h + 12 + 21;
        const tOn = (k, S) => HERO.includes(k) ? S.tL[k] - RISE : S.tO0 + OTHERS.indexOf(k) * S.tOs;   // when a point shows
        // where a point is at time t (data y), and how far it has come in
        function point(k, t, S) {
          const t0 = tOn(k, S);
          if (t < t0) return null;
          if (k === K0) return { v: ATM, a: clamp((t - t0) / 0.2) };
          const kr = eio(clamp((t - t0) / (HERO.includes(k) ? RISE : 0.32)));
          return { v: lerp(ATM, IV[k], kr), a: clamp((t - t0) / 0.15), kr };
        }
        function chart(t, f, S) {
          QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp(t / 0.45), title: `Implied vol by strike · ${M.T_months} month`,
            index: "11", sub: SUB, tag: "SIMULATED", frame: f });
          QC.axes(g, T, F, { k: clamp((t - 0.15) / 0.5), xt: KS, yt: [10, 15, 20, 25, 30, 35], yf: (v) => v + "%",
            xl: "strike K", yl: "implied vol" });
          // ---- the strikes as they are said: a target box on the axis label (100 = AT THE MONEY) ----
          HERO.forEach((k) => {
            const kb = clamp((t - S.tTick[k]) / 0.35); if (kb <= 0) return;
            const px = F.X(k), half = k >= 100 ? 26 : 18;
            const fade = k === K0 ? 1 : 1 - 0.55 * clamp((t - S.tL[k] - 0.5) / 0.4);
            QC.lock(g, T, [px - half, xTickY - 19, px + half, xTickY + 5], kb, { pad: 8, alpha: fade,
              tag: k === K0 ? "AT THE MONEY" : undefined, flash: hit(t, S.tTick[k] + 0.35) });
          });
          // ---- the table: strike · Monte Carlo price · implied vol, filling as the points land ----
          const kTb = clamp((t - (S.tL[K0] - 0.45)) / 0.35);
          if (kTb > 0) {
            QC.panel(g, T, TB.x, TB.y, TB.w, TB.h, { open: kTb, op: 0.95 });
            const a = clamp((kTb - 0.4) * 2);
            QC.text(g, T, "PRICE → IMPLIED VOL", TB.x + 18, TB.y + 36, { size: 19, wt: 600, ls: 1.5, c: "hi", a, maxW: TB.w - 36 });
            QC.text(g, T, "  K  TYPE", TB.x + 18, TB.y + 66, { size: 18, mono: true, c: "dim", a });
            QC.text(g, T, "MC PRICE", TB.x + 236, TB.y + 66, { size: 18, mono: true, c: "dim", a, align: "right" });
            QC.text(g, T, "IMP VOL", TB.x + TB.w - 22, TB.y + 66, { size: 18, mono: true, c: "dim", a, align: "right" });
            KS.forEach((k, i) => {
              const t0 = HERO.includes(k) ? S.tL[k] - 0.32 : tOn(k, S), kr = clamp((t - t0) / 0.3);
              const y = TB.y + 98 + i * 23.5, R = ROW[k], locked = HERO.includes(k) && t >= S.tL[k];
              const left = `${String(k).padStart(3)}  ${R.type.toUpperCase().padEnd(4)}`;
              // the strikes wait in the table (pale), each row fills as its point lands
              QC.text(g, T, left, TB.x + 18, y, { size: 20, mono: true, c: kr > 0 ? "hi" : "dim", a: kr > 0 ? 1 : 0.55 * a });
              if (kr <= 0) return;
              QC.text(g, T, pFmt(R.price_mc), TB.x + 236, y, { size: 20, mono: true, c: "hi", align: "right", roll: kr, frame: f, seed: i + 20 });
              QC.text(g, T, IV[k].toFixed(1) + "%", TB.x + TB.w - 22, y, { size: 20, mono: true, c: locked ? "acc" : "hi", align: "right", roll: kr, frame: f, seed: i + 40 });
            });
          }
          // ---- ONE σ: the dashed flat line at the money's 15.6%, running out from the money point ----
          const kF = eo(clamp((t - S.tFlat0) / 0.55)), yA = F.Y(ATM);
          const bend = eio(clamp((t - S.tBend0) / (S.tBend1 - S.tBend0)));
          if (kF > 0) {
            const hiK = clamp((t - S.tFlatHi) / 0.2) * (1 - clamp((t - S.tBend0) / 0.3));   // brightens on "flat line"
            const a = (0.8 + 0.2 * hiK) * (1 - 0.45 * bend), x0 = F.X(K0);
            g.save(); g.setLineDash([12, 8]); g.lineDashOffset = -t * 30 * hiK; g.strokeStyle = T.hi(0.8 * a); g.lineWidth = 2 + 1.4 * hiK;
            g.beginPath(); g.moveTo(lerp(x0, F.x, kF), yA); g.lineTo(lerp(x0, F.x + F.w, kF), yA); g.stroke(); g.restore();
            QC.tag(g, T, "ONE σ", F.x + F.w - 8, yA - 12, { c: "hi", align: "right", a: clamp((kF - 0.7) * 3.3) * (1 - 0.3 * bend), size: 19 });
          }
          // ---- the guides: up from the strike axis to the line, then the gap from the line to the point ----
          HERO.forEach((k) => {
            const kg = clamp((t - S.tUp[k]) / 0.32); if (kg <= 0) return;
            const px = F.X(k), y0 = F.Y(F.yr[0]), fade = (1 - 0.6 * clamp((t - S.tL[k] - 0.4) / 0.5)) * (1 - bend);
            g.save(); g.setLineDash([5, 6]); g.strokeStyle = T.line(0.75 * fade); g.lineWidth = 1.6;
            g.beginPath(); g.moveTo(px, y0); g.lineTo(px, lerp(y0, yA, eo(kg))); g.stroke(); g.restore();
            const p = point(k, t, S);
            if (p && k !== K0 && bend < 1) {
              g.save(); g.strokeStyle = T.hi(0.55 * (1 - bend)); g.lineWidth = 1.8;
              g.beginPath(); g.moveTo(px, yA); g.lineTo(px, F.Y(p.v)); g.stroke(); g.restore();
            }
          });
          // ---- the line bends into the smile; on "smile." the area under it fills and glows ----
          const kS = clamp((t - S.tSmile + 0.04) / 0.2);
          if (t >= S.tBend0 - 0.02) {
            const ys = CY.map((v) => lerp(ATM, v, bend));
            if (kS > 0) {
              const top = F.Y(IV[KS[0]]), base = F.Y(F.yr[0]);
              const gr = g.createLinearGradient(0, top, 0, base);
              gr.addColorStop(0, T.line(0.46 * kS)); gr.addColorStop(1, T.line(0.1 * kS));
              g.save(); g.beginPath(); g.moveTo(F.X(CX[0]), base);
              CX.forEach((x, i) => g.lineTo(F.X(x), F.Y(ys[i])));
              g.lineTo(F.X(CX[CX.length - 1]), base); g.closePath(); g.fillStyle = gr; g.fill(); g.restore();
            }
            g.save(); g.shadowColor = T.line(0.9); g.shadowBlur = 22 * kS;
            QC.line(g, T, F, CX, ys, { c: "line", w: 3.4 + 1.2 * kS });
            g.restore();
          }
          // ---- the nine points ----
          KS.forEach((k) => {
            const p = point(k, t, S); if (!p) return;
            const hero = HERO.includes(k), locked = hero && t >= S.tL[k];
            const s = hero ? 1 + 0.35 * Math.sin(Math.PI * clamp((t - S.tL[k]) / 0.25)) : 1;
            QC.dot(g, T, F.X(k), F.Y(p.v), { c: locked ? "acc" : "line", r: hero ? 7 : 5.5, s: s * eo(p.a), a: p.a });
          });
          // ---- the big rolling values ride up with their points and lock as said ----
          HERO.forEach((k) => {
            const p = point(k, t, S); if (!p) return;
            const roll = clamp((t - (S.tL[k] - RISE)) / RISE);
            if (roll <= 0) return;
            const px = F.X(k), py = F.Y(p.v);
            QC.value(g, T, IV[k].toFixed(1), px + 30, py - 20, { size: 68, roll, frame: f, unit: "%", flash: hit(t, S.tL[k]), seed: k });
            QC.lock(g, T, [px - 8, py - 8, px + 8, py + 8], clamp((t - S.tL[k]) / 0.3), { pad: 14, flash: hit(t, S.tL[k] + 0.3) });
          });
          // ---- THE SMILE ----
          const kT = clamp((t - S.tSmile) / 0.18);
          if (kT > 0) {
            const bb = QC.tag(g, T, "THE SMILE", F.X(81.5), F.y + F.h - 26, { c: "hi", a: kT, size: 26 });
            QC.lock(g, T, bb, kT, { pad: 8, flash: hit(t, S.tSmile + 0.18) });
          }
        }
        return { chart, HERO, K0 };
      })();
      // ======== end of the s11 smile chart ========
      // the beats, on the words: the three spoken points (a guide rises from the strike axis, the strike is boxed as it is
      // said, the point lands on the line, rises and its value locks as said), the other six, the bend, the smile
      const K0 = SMILE.K0, tL0 = w(6) + 0.06;
      const S = { tUp: { [K0]: w(3) + 0.12, 90: w(7), 80: w(10) }, tL: { [K0]: tL0, 90: w(9) + 0.06, 80: w(12) + 0.06 },
        tTick: { [K0]: w(2), 90: w(8), 80: w(11) }, tO0: w(13) + 0.02, tOs: 0.16, tFlat0: tL0 + 0.14, tFlatHi: w(19),
        tBend0: w(21) - 0.04, tBend1: w(23) + 0.04, tSmile: w(24) };
      const st = { t: 0 };
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s11"]'), TEX, T); }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6);   // scan-in; no erase: the smile holds into s12
        QC.clipStage(g, xIn, QC.STAGE.x0);
        SMILE.chart(t, f, S);
        g.restore();
        QC.scanLine(g, T, xIn);
        QC.tex.end();
      }
