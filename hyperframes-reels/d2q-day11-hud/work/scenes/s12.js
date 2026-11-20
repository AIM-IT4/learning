      const TEX_IDS = ["flat"];
      const NUM_KEYS = ["bell", "normal", "model"];
      // ---- s12: "So here's the answer: with normal returns and one volatility, implied vol would be flat across strikes."
      // It opens on s11's last frame (the smile, drawn by the chart block copied from s11 byte for byte), holds it through
      // "So here's" and scan-erases it over "the answer:". Then the ANSWER layout scans in, built across s12 and s13 with no
      // erase between them: a header (THE ANSWER, with the s2 question)
      // and two rows, each a small density chart -> an arrow -> a small implied-vol chart. s12 builds the top row: NORMAL
      // RETURNS (the normal density of daily moves on a log scale: thin tails; its spread, ONE σ, on "one volatility") ->
      // IMPLIED VOL: FLAT (one level, the money's 15.6%, at every strike 80-120, on "flat across strikes"), the flat formula
      // under its title, locked on "strikes". Holds into s13 (no erase).
      // words: 0 So 1 here's 2 the 3 answer: 4 with 5 normal 6 returns 7 and 8 one 9 volatility, 10 implied 11 vol
      //        12 would 13 be 14 flat 15 across 16 strikes.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24, FONT = HUD.FONT;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s12-cv").getContext("2d");
      const w = (i) => W[i];
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
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
      // ======== the ANSWER layout: identical code in s12 and s13 (s13 draws the top row at its end state) ========
      const B = NUM.bell, M = NUM.model, KS = M.strikes, ATM = M.iv_pct[String(M.S0)], SD = NUM.normal.sd_day_pct;
      const LN = B.normal.map(Math.log10), LF = B.fat.map(Math.log10);
      const HD = { x: 40, y: 566, w: 1000, h: 56 }, RH = 414, R1 = 632, R2 = 1056;
      const SLOT = 0.42;   // how lit a chart slot is while it waits for its data
      const PL = { x: 40, w: 458 }, PR = { x: 582, w: 458 };
      const FD = (y0) => QC.frame(PL.x + 84, y0 + 136, 346, 198, [-5, 5], [-4.4, 1.0]);   // density, log10
      const FV = (y0) => QC.frame(PR.x + 84, y0 + 136, 346, 198, [77, 123], [10, 35]);     // implied vol, %
      const DAX = { xt: [-4, -2, 0, 2, 4], xf: (v) => (v < 0 ? QC.MINUS : v > 0 ? "+" : "") + Math.abs(v) + (v ? "%" : ""),
        yt: [0, -2, -4], yf: () => "", xl: "daily move", yl: "density", size: 20 };   // tick labels: logTicks()
      const VAX = { xt: [80, 90, 100, 110, 120], yt: [10, 20, 30], yf: (v) => v + "%", xl: "strike K", size: 20 };
      const at = (xs, ys, x) => { let i = 1; while (i < xs.length - 1 && xs[i] < x) i++; return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1])); };
      // the log-density tick labels: "10" and a raised exponent, both in the tick face (no superscript characters: those
      // come from a fallback font that the canvas can resolve differently in s12 and s13, and the labels would change at the cut)
      function logTicks(F, k, a = 1) {
        const ke = eo(k), yt = DAX.yt;
        g.save(); g.fillStyle = T.hi(0.85 * a); g.textBaseline = "alphabetic"; g.textAlign = "left";
        yt.forEach((v, i) => {
          const ka = clamp((ke - i / yt.length * 0.6) * 3); if (ka <= 0) return;
          const e = String(v), x1 = F.x - 14, py = F.Y(v) + 20 * 0.36;
          g.globalAlpha = ka;
          g.font = `400 14px ${FONT.mono}`; const we = g.measureText(e).width;
          g.fillText(e, x1 - we, py - 9);
          g.font = `400 20px ${FONT.mono}`; g.fillText("10", x1 - we - 1 - g.measureText("10").width, py);
        });
        g.restore();
      }
      // a mini panel's title row, drawn as QC.panel draws its own, but with each part on its own word
      function head(x, y, pw, o) {
        g.save(); g.textBaseline = "alphabetic"; g.textAlign = "left";
        const kb = o.bar ?? 1;
        if (kb > 0) { g.globalAlpha = clamp(kb * 2); g.fillStyle = T.line(1); g.fillRect(x + 24, y + 22, 30 * eo(kb), 4); }
        let tx = x + 24;
        if (o.index && kb > 0) { g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(o.index, tx, y + 54); tx += 38; }
        g.globalAlpha = 1;
        if (o.title && o.roll > 0) {
          const s = o.title.toUpperCase();
          g.letterSpacing = "2px"; g.font = `600 ${o.ts ?? 24}px ${FONT.ui}`; g.fillStyle = T.hi(1);
          g.fillText(HUD.rollText(s, o.roll, o.frame ?? 0, 5), tx, y + 54);
          if (o.suffix && o.sroll > 0) g.fillText(HUD.rollText(o.suffix.toUpperCase(), o.sroll, o.frame ?? 0, 9), tx + g.measureText(s).width, y + 54);
        }
        if (o.sub && (o.subA ?? 1) > 0) {
          g.globalAlpha = o.subA ?? 1; g.letterSpacing = "1px"; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1);
          g.fillText(o.sub.toUpperCase().replace(/Σ/g, "σ"), x + 24, y + 82);
        }
        if (o.tag && (o.tagA ?? 1) > 0) {
          g.globalAlpha = o.tagA ?? 1; g.letterSpacing = "1.5px"; g.font = `600 17px ${FONT.ui}`;
          const tw = g.measureText(o.tag).width + 20, bx = x + pw - 24 - tw;
          g.strokeStyle = T.line(0.9); g.lineWidth = 1.2; g.strokeRect(bx, y + 32, tw, 28);
          g.fillStyle = T.line(1); g.fillText(o.tag, bx + 10, y + 52);
        }
        g.restore();
      }
      // the arrow from a row's density chart to its implied-vol chart
      function arrow(y0, k) {
        if (k <= 0) return;
        const ya = y0 + 136 + 99, x0 = PL.x + PL.w + 10, x1 = lerp(x0 + 18, PR.x - 8, eo(k));
        g.save(); g.strokeStyle = T.hi(0.95); g.fillStyle = T.hi(0.95); g.lineWidth = 5; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, ya); g.lineTo(x1 - 14, ya); g.stroke();
        g.beginPath(); g.moveTo(x1, ya); g.lineTo(x1 - 18, ya - 11); g.lineTo(x1 - 18, ya + 11); g.closePath(); g.fill();
        g.restore();
      }
      // a tag on a chart with a thin leader down to the point it names
      function pin(s, tx, ty, px, py, k, o = {}) {
        if (k <= 0) return;
        g.save(); g.strokeStyle = T.hi(0.7 * k); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px, lerp(py, ty + 4, eo(k))); g.stroke();
        g.fillStyle = T.hi(k); g.beginPath(); g.arc(px, py, 3.5, 0, 2 * Math.PI); g.fill(); g.restore();
        QC.tag(g, T, s, tx, ty, { c: o.c || "hi", a: clamp((k - 0.4) * 2.5), size: 18 });
      }
      // the header: THE ANSWER, and the interview question it answers
      function header(t, A, f) {
        const k = clamp((t - A.hd) / 0.4);
        if (k <= 0) return;
        QC.panel(g, T, HD.x, HD.y, HD.w, HD.h, { open: k, op: 0.9 });
        g.save(); g.fillStyle = T.line(clamp(k * 2)); g.fillRect(HD.x + 24, HD.y + 18, 4, 20); g.restore();
        QC.text(g, T, "THE ANSWER", HD.x + 42, HD.y + 38, { size: 28, wt: 600, ls: 3, c: "hi", roll: clamp((t - A.ans + 0.3) / 0.42), frame: f });
        QC.text(g, T, "Q: WHY A DIFFERENT VOLATILITY FOR EVERY STRIKE?", HD.x + HD.w - 24, HD.y + 36,
          { size: 19, mono: true, ls: 1, c: "dim", align: "right", a: clamp((t - A.ans + 0.1) / 0.4) });
      }
      // the top row: NORMAL RETURNS -> IMPLIED VOL: FLAT
      function topRow(t, A, f, clip) {
        const y0 = R1, Fd = FD(y0), Fv = FV(y0);
        // NORMAL RETURNS: the normal density of daily moves (log scale), thin tails, its spread ONE σ
        const kP = clamp((t - A.L0) / 0.4);
        QC.panel(g, T, PL.x, y0, PL.w, RH, { open: kP });
        head(PL.x, y0, PL.w, { bar: kP, index: "12", title: "Normal returns", roll: clamp((t - A.nT) / 0.42), frame: f,
          sub: "daily moves · log scale", subA: clamp((t - A.nT - 0.15) / 0.3), tag: "MODEL", tagA: clamp((t - A.nT) / 0.3) });
        QC.axes(g, T, Fd, { ...DAX, k: clamp((t - A.ax) / 0.5) });
        logTicks(Fd, clamp((t - A.ax) / 0.5));
        const kS = clamp((t - A.sig) / 0.3);
        if (kS > 0) {   // ONE σ: the band of ±1 standard deviation
          g.save(); g.fillStyle = T.line(0.1 * kS); g.fillRect(Fd.X(-SD), Fd.y, Fd.X(SD) - Fd.X(-SD), Fd.h);
          g.setLineDash([4, 5]); g.strokeStyle = T.line(0.6 * kS); g.lineWidth = 1.4; g.beginPath();
          [-SD, SD].forEach((v) => { g.moveTo(Fd.X(v), Fd.y + Fd.h); g.lineTo(Fd.X(v), Fd.y + Fd.h * (1 - eo(kS))); });
          g.stroke(); g.restore();
          QC.tag(g, T, "ONE σ", Fd.X(0), Fd.y + Fd.h - 10, { c: "hi", align: "center", a: clamp((t - A.sig - 0.15) / 0.25), size: 18 });
        }
        const kN = eio(clamp((t - A.n0) / (A.n1 - A.n0)));
        if (kN > 0) {
          QC.area(g, T, Fd, B.x, LN, { k: kN, base: Fd.yr[0], fa: 0.08 });
          QC.line(g, T, Fd, B.x, LN, { k: kN, c: "line", w: 3, head: true });
        }
        const kTh = clamp((t - A.thin) / 0.35), xt = -4.4;
        pin("THIN TAILS", Fd.x + 6, Fd.y + 36, Fd.X(xt), Fd.Y(at(B.x, LN, xt)), kTh);
        // the arrow, then IMPLIED VOL: FLAT (its slot waits pale, like the bottom row's, and lights on "implied vol")
        arrow(y0, clamp((t - A.arr) / 0.35));
        const kSl = clamp((t - A.L0 - 0.1) / 0.5), kR = clamp((t - A.R0) / 0.4), aR = lerp(SLOT, 1, kR);
        QC.panel(g, T, PR.x, y0, PR.w, RH, { open: kSl, a: aR });
        head(PR.x, y0, PR.w, { bar: kR, title: "Implied vol:", roll: clamp((t - A.iv) / 0.4), suffix: " flat", sroll: clamp((t - A.flat) / 0.3),
          frame: f, tag: "MODEL", tagA: clamp((t - A.iv) / 0.3) });
        QC.axes(g, T, Fv, { ...VAX, k: clamp((kSl - 0.3) / 0.7), a: aR });
        const kF = clamp((t - A.flat) / (A.f1 - A.flat));
        if (kF > 0) {
          const xh = lerp(KS[0], KS[KS.length - 1], eo(kF));
          QC.line(g, T, Fv, [KS[0], KS[KS.length - 1]], [ATM, ATM], { x1: xh, c: "line", w: 3.4, head: kF < 1 });
          KS.forEach((k) => { const kd = kF >= 1 ? 1 : clamp((xh - k) / 2.5 + 0.5); if (kd > 0) QC.dot(g, T, Fv.X(k), Fv.Y(ATM), { r: 4.5, s: eo(kd), a: kd }); });
        }
        const kFo = clamp((t - A.fx) / 0.45);
        if (kFo > 0) {
          const bb = QC.tex.show("flat", { x: PR.x + 24, y: y0 + 72, size: 30, valign: "top", k: kFo, a: clamp(kFo * 3), clip }).bb;
          const kL = clamp((t - A.lk) / 0.3);
          if (kL > 0) QC.lock(g, T, bb, kL, { pad: 6, flash: hit(t, A.lk + 0.3) });
        }
      }
      // the bottom row's slots: in s12 they wait, pale and empty; s13 lights them and fills them
      function slots(kOpen, aLit) {
        if (kOpen <= 0) return;
        QC.panel(g, T, PL.x, R2, PL.w, RH, { open: kOpen, a: aLit });
        QC.panel(g, T, PR.x, R2, PR.w, RH, { open: kOpen, a: aLit });
        const ka = clamp((kOpen - 0.3) / 0.7);
        QC.axes(g, T, FD(R2), { ...DAX, k: ka, a: aLit });
        logTicks(FD(R2), ka, aLit);
        QC.axes(g, T, FV(R2), { ...VAX, k: ka, a: aLit });
      }
      // ======== end of the shared layout ========
      // the opening: s11's smile at its end state, held from the cut, scan-erased over "the answer:"
      const S11 = { tUp: {}, tL: {}, tTick: {}, tO0: 0, tOs: 0, tFlat0: 0, tFlatHi: 0, tBend0: 0, tBend1: 1, tSmile: 0 };
      SMILE.HERO.forEach((k) => { S11.tUp[k] = 0; S11.tL[k] = 0; S11.tTick[k] = 0; });
      const DONE = 99, tE0 = w(1) + 0.02, tE1 = tE0 + 0.38;
      // the top row's beats, on the words; the layout scans in once the smile is erased (all done by 4.45 s, before the
      // cut into s13)
      const A = { hd: tE1, ans: tE1 + 0.36, L0: tE1 + 0.1, ax: tE1 + 0.3, nT: w(5) - 0.06, n0: w(5) + 0.14, n1: w(6) + 0.4,
        thin: w(6) + 0.4, sig: w(8), arr: w(9) + 0.3, R0: w(10) - 0.1, iv: w(10) - 0.04, flat: w(14), f1: w(16) - 0.02,
        fx: w(14) + 0.04, lk: w(16) - 0.15 };
      const st = { t: 0 };
      // init() is also called from draw(): the composed timeline's fromTo renders draw() once before init() runs, and a
      // formula shown at t = 0 would otherwise throw (no formula yet) and stop the scene from registering
      let texReady = false;
      function init() { if (texReady) return; texReady = true; QC.tex.init(document.querySelector('[data-composition-id="s12"]'), TEX, T); }
      function draw() {
        init();
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        if (t < tE1) {   // s11's smile, held from the cut, erased over "the answer:"
          const xOut = QC.scanOut(t, tE1, tE1 - tE0);
          QC.clipStage(g, QC.STAGE.x1, xOut);
          SMILE.chart(DONE, f, S11);
          g.restore();
          QC.scanLine(g, T, xOut);
        } else {         // then the ANSWER layout scans in
          const xIn = QC.scanIn(t, tE1, 0.6);
          QC.clipStage(g, xIn, QC.STAGE.x0);
          header(t, A, f);
          slots(clamp((t - A.L0 - 0.1) / 0.5), SLOT);
          topRow(t, A, f, [QC.STAGE.x0, xIn]);
          g.restore();
          QC.scanLine(g, T, xIn);
        }
        QC.tex.end();
      }
