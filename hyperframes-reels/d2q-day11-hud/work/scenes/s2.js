      const TEX_IDS = ["bs_put", "bs_d"];
      const NUM_KEYS = ["normal", "model"];
      // ---- s2: "Then the interviewer asks: so why does the market quote a different volatility for every strike?" ----
      // s1's strip and chart carry over unchanged (no scan-in). On "asks:" a scan swaps the formula strip for the INTERVIEW
      // QUESTION plate, whose "?" locks on "why". On "market quote" a market quote (navy diamond) appears on each option;
      // on "different" the quotes slide off the 20% line to their own levels (model.iv_pct; illustrative, values not
      // printed: they are s11's payoff), each with a gap line, and the flat line turns dashed: BLACK–SCHOLES: ONE σ.
      // On "strike?" the 80 quote, the most different, locks with a "?". Scan-erase at the end.
      // words: 0 Then 1 the 2 interviewer 3 asks: 4 so 5 why 6 does 7 the 8 market 9 quote 10 a 11 different
      //        12 volatility 13 for 14 every 15 strike?
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s2-cv").getContext("2d");
      const w = (i) => W[i];
      const SIG = 100 * NUM.normal.sigma_annual, KS = NUM.model.strikes, IV = NUM.model.iv_pct;
      // as in s1 (same place across the cut)
      const PS = { x: 40, y: 566, w: 1000, h: 204 }, PX = { x: 40, y: 784, w: 1000, h: 682 };
      const F = QC.frame(170, 936, 820, 424, [76, 124], [10, 35]);
      // the most different quote: the one farthest from the flat line (the 80 strike)
      const KQ = KS.reduce((a, K) => (Math.abs(IV[K] - SIG) > Math.abs(IV[a] - SIG) ? K : a), KS[0]);
      const tAsk = w(3) - 0.08, tWhy = w(5) + 0.04, tMkt = w(8), tDiff = w(11), tLab = w(12) + 0.06, tQ = w(15) + 0.17;
      const Q1 = "Why a different volatility", Q2 = "for every strike?", QS = 42, QX = PS.x + PS.w - 120;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      let ROOT = null;
      function init() { ROOT = document.querySelector('[data-composition-id="s2"]'); QC.tex.init(ROOT, TEX, T); }
      // a market quote: a navy diamond on a white halo, with a ring
      const dia = (x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); };
      function quote(x, y, a, s = 1, pulse = 0) {
        const r = 10 * s;
        g.save();
        g.fillStyle = `rgba(255,255,255,${0.95 * a})`; dia(x, y, r + 4); g.fill();
        g.fillStyle = T.hi(a); dia(x, y, r); g.fill();
        g.strokeStyle = T.hi(0.45 * a); g.lineWidth = 1.5; dia(x, y, r + 9); g.stroke();
        if (pulse > 0 && pulse < 1) { g.strokeStyle = T.hi(0.8 * a * (1 - pulse)); dia(x, y, r + 9 + 30 * pulse); g.stroke(); }
        g.restore();
      }
      // QC.tag's look with the box width given apart from the text, so a label can roll from one text to another
      const L1 = "σ = " + SIG.toFixed(0) + "% FOR EVERY STRIKE", L2 = "BLACK–SCHOLES: ONE σ";
      function tagW(s) { g.save(); g.letterSpacing = "1px"; g.font = `600 19px ${HUD.FONT.ui}`; const v = g.measureText(s).width + 18; g.restore(); return v; }
      function tagRoll(s, wd, x, y) {   // right-aligned at x, box bottom at y
        g.save(); g.letterSpacing = "1px"; g.font = `600 19px ${HUD.FONT.ui}`; g.textBaseline = "alphabetic"; g.textAlign = "left";
        g.fillStyle = T.line(0.95); g.fillRect(x - wd, y - 30, wd, 30);
        g.beginPath(); g.rect(x - wd, y - 30, wd, 30); g.clip();
        g.fillStyle = "rgba(255,255,255,1)"; g.fillText(s, x - wd + 9, y - 8);
        g.restore();
      }
      // a scan line limited to the strip (the swap from formula to question)
      function stripScan(x, a) {
        if (a <= 0 || x <= PS.x + 1 || x >= PS.x + PS.w - 1) return;
        g.save();
        const gr = g.createLinearGradient(x - 60, 0, x + 6, 0);
        gr.addColorStop(0, T.line(0)); gr.addColorStop(1, T.line(0.16 * a));
        g.fillStyle = gr; g.fillRect(x - 60, PS.y, 66, PS.h);
        g.strokeStyle = T.line(0.9 * a); g.lineWidth = 2; g.beginPath(); g.moveTo(x, PS.y); g.lineTo(x, PS.y + PS.h); g.stroke();
        g.restore();
      }
      function draw() {
        if (!ROOT) return;   // the timeline renders once before init() (compose.py's tail): nothing to draw yet
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.STAGE.x1, xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;   // no scan-in: s1's chart carries over
        QC.clipStage(g, xIn, xOut);
        // ---- the strip: s1's formula until "asks:", then a scan swaps in the interview question ----
        QC.panel(g, T, PS.x, PS.y, PS.w, PS.h, { op: 0.9 });
        const kW = clamp((t - tAsk) / 0.45), xW = lerp(PS.x, PS.x + PS.w, eio(kW));
        if (kW < 1) {
          const clip = [Math.max(xOut, xW), xIn];
          QC.tex.show("bs_put", { x: 540, y: PS.y + 20, size: 40, align: "center", valign: "top", lock: true, clip });
          QC.tex.show("bs_d", { x: 540, y: PS.y + 80, size: 40, align: "center", valign: "top", lock: true, clip });
        }
        // the question card: a title row like a panel's, the question, and a large "?" that locks on "why"
        const kQm = clamp((t - (tWhy - 0.22)) / 0.22), qb = PS.y + 166;
        if (kW > 0) {
          g.save(); g.beginPath(); g.rect(PS.x, PS.y, xW - PS.x, PS.h); g.clip();
          const kR = clamp((t - tAsk - 0.1) / 0.5);
          g.fillStyle = T.line(1); g.fillRect(PS.x + 24, PS.y + 22, 30, 4);
          QC.text(g, T, "02", PS.x + 24, PS.y + 54, { size: 19, wt: 400, mono: true, c: "dim" });
          QC.text(g, T, "INTERVIEW QUESTION", PS.x + 62, PS.y + 54, { size: 26, wt: 600, ls: 2, roll: kR, frame: f });
          QC.text(g, T, Q1, PS.x + 24, PS.y + 118, { size: QS, wt: 600 });
          QC.text(g, T, Q2, PS.x + 24, PS.y + 172, { size: QS, wt: 600 });
          QC.text(g, T, "?", QX, qb, { size: 124, wt: 600, align: "center", c: kQm >= 1 ? "hi" : "dim" });
          g.restore();
          stripScan(xW, 1 - clamp((kW - 0.9) * 10));
        }
        if (kQm > 0) {
          g.save(); g.font = `600 124px ${HUD.FONT.ui}`; g.letterSpacing = "0px"; g.textAlign = "center"; const m = g.measureText("?"); g.restore();
          QC.lock(g, T, [QX - m.actualBoundingBoxLeft, qb - m.actualBoundingBoxAscent, QX + m.actualBoundingBoxRight, qb + m.actualBoundingBoxDescent],
            kQm, { pad: 14, flash: hit(t, tWhy) });
        }
        // ---- the chart, as s1 left it ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { title: "Black–Scholes · one σ", index: "01", sub: "implied vol by strike", tag: "MODEL", frame: f });
        QC.axes(g, T, F, { xt: KS, yt: [10, 15, 20, 25, 30, 35], yf: (v) => v + "%", xl: "strike K", yl: "implied vol" });
        // the flat line turns dashed on "different"
        const kD = clamp((t - tDiff) / 0.3);
        if (kD < 1) QC.line(g, T, F, F.xr, [SIG, SIG], { c: "line", w: 3.4, a: 1 - kD });
        if (kD > 0) QC.line(g, T, F, F.xr, [SIG, SIG], { c: "line", w: 3, dash: [14, 10], a: kD, glow: false });
        // its label: s1's tag rolls over to BLACK–SCHOLES: ONE σ (the box eases to the new width)
        const kLb2 = clamp((t - tDiff) / 0.35), tx = F.x + F.w - 6, ty = F.Y(SIG) - 24;
        if (kLb2 <= 0) QC.tag(g, T, L1, tx, ty, { c: "line", align: "right", size: 19 });
        else tagRoll(kLb2 < 1 ? HUD.rollText(L2, kLb2, f, 9) : L2, lerp(tagW(L1), tagW(L2), eio(kLb2)), tx, ty);
        // the options on the line (s1's dots), smaller once the quotes arrive
        const kM = clamp((t - tMkt) / 0.3);
        KS.forEach((K) => QC.dot(g, T, F.X(K), F.Y(SIG), { c: "line", r: lerp(6, 4.5, kM), a: 1 - 0.3 * kM }));
        // the market quotes: appear on "market quote", slide to their own levels on "different", each with a gap line
        KS.forEach((K, i) => {
          const kA = clamp((t - (tMkt + i * 0.035)) / 0.2);
          if (kA <= 0) return;
          const kS = eio(clamp((t - (tDiff - 0.04 + i * 0.03)) / 0.5)), x = F.X(K), y0 = F.Y(SIG), y = lerp(y0, F.Y(IV[K]), kS);
          if (kS > 0) { g.save(); g.strokeStyle = T.hi(0.55); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y); g.stroke(); g.restore(); }
          quote(x, y, clamp(kA * 2), 0.6 + 0.4 * eo(kA), clamp((t - (tMkt + i * 0.035) - 0.2) / 0.25));
        });
        // MARKET QUOTES · ILLUSTRATIVE, under the quotes that fall
        const kLb = clamp((t - tLab) / 0.3);
        if (kLb > 0) {
          const by = F.y + F.h - 26, tx = F.x + F.w - 6;
          const tb = QC.tag(g, T, "ILLUSTRATIVE", tx, by + 7, { c: "hi", align: "right", a: kLb, size: 18 });
          const lw = QC.text(g, T, "MARKET QUOTES", tb[0] - 14, by, { size: 24, wt: 600, ls: 1.5, align: "right", a: kLb, roll: kLb, frame: f });
          quote(tb[0] - 14 - lw - 20, by - 9, kLb, 0.7);
        }
        // "strike?": the 80 quote, the most different, locks with a "?"
        const kQ = clamp((t - (tQ - 0.22)) / 0.22);
        if (kQ > 0) {
          const x = F.X(KQ), y = F.Y(IV[KQ]), bb = [x - 10, y - 10, x + 10, y + 10];
          QC.lock(g, T, bb, kQ, { pad: 14, flash: hit(t, tQ) });
          if (t >= w(15)) QC.tag(g, T, "?", x - 24, y - 32, { c: "hi", align: "right", size: 30, a: clamp((t - w(15)) / 0.12) });
        }
        g.restore();
        QC.scanLine(g, T, xOut);
        QC.tex.end();
      }
