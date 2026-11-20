      const TEX_IDS = ["payoff"];
      const NUM_KEYS = ["model", "put90"];
      // ---- s7: "And what pays in a crash? A low-strike put. So traders pay more for it." ----
      // The 90 put's payoff at expiry against the stock price. On "crash?" an arrow on the x axis takes the stock from
      // S0 = 100 to 80 (the model's -20% crash); on "low-strike" the payoff formula types in and the strike K = 90 is
      // marked; on "put." the hockey stick max(90 - S_T, 0) draws and the payoff at 80 (= 10) locks. On "So traders pay
      // more for it" a compact price comparison: one sigma (15.6%) 0.014 against 0.090 with crashes (x6.4), 0.090
      // locking on "more" (s8 then starts from that market price).
      // words: 0 And 1 what 2 pays 3 in 4 a 5 crash? 6 A 7 low-strike 8 put. 9 So 10 traders 11 pay 12 more 13 for 14 it.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio, fmt } = QC;
      const g = document.getElementById("s7-cv").getContext("2d");
      const w = (i) => W[i];
      const M = NUM.model, P90 = NUM.put90;
      const K = P90.K, S0 = M.S0, SC = S0 * (1 + M.crash), PAY = Math.max(K - SC, 0);
      const CRASH = "CRASH " + fmt(100 * M.crash, 0) + "%";
      const PX = { x: 40, y: 724, w: 1000, h: 742 };
      const F = QC.frame(170, 872, 820, 470, [60, 120], [0, 30]);
      const SX = [], SY = [];
      for (let i = 0; i <= 120; i++) { const s = 60 + i * 0.5; SX.push(s); SY.push(Math.max(K - s, 0)); }
      // the hockey stick draws over [tSt0, tSt1] with an ease; tAt(x) = when its head passes x
      const tQ = 0.25, tS0 = 0.5, tArr = w(5) - 0.08, tTex = w(7) - 0.12, tK = w(7) + 0.02;
      const tSt0 = w(8) - 0.12, tSt1 = w(8) + 0.3;
      const inv = (k) => (k < 0.5 ? Math.cbrt(k / 4) : 1 - Math.cbrt(2 * (1 - k)) / 2);
      const tAt = (x) => tSt0 + inv((x - 60) / 60) * (tSt1 - tSt0);
      const t80 = tAt(SC), tPay = t80 + 0.2;
      const tCmp = w(9) - 0.04, tB = w(11) - 0.06, tMore = w(12) - 0.08;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      // the comparison box (upper right of the chart, where the payoff is zero)
      const BX = { x: 470, y: 884, w: 546, h: 226 }, LB = 218;
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s7"]'), TEX, T); }
      function arrow(x0, x1, y, k, a) {   // a thick arrow along y, from x0 towards x1, drawn up to k
        if (k <= 0) return;
        const xe = lerp(x0, x1, eo(k)), dir = Math.sign(x1 - x0);
        g.save(); g.strokeStyle = T.acc(0.95 * a); g.fillStyle = T.acc(0.95 * a); g.lineWidth = 5; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, y); g.lineTo(xe - dir * 12, y); g.stroke();
        g.beginPath(); g.moveTo(xe, y); g.lineTo(xe - dir * 18, y - 10); g.lineTo(xe - dir * 18, y + 10); g.closePath(); g.fill();
        g.restore();
      }
      function bar(x, y, len, h, c, a) {
        if (len <= 0 || a <= 0) return;
        g.save(); g.fillStyle = T[c](0.22 * a); g.fillRect(x, y, len, h);
        g.strokeStyle = T[c](0.9 * a); g.lineWidth = 1.6; g.strokeRect(x + 0.5, y + 0.5, len - 1, h - 1); g.restore();
      }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the top strip: the question, then the payoff formula on "low-strike put" ----
        QC.panel(g, T, 40, 566, 1000, 142, { open: clamp(t / 0.45), op: 0.9 });
        const aQ = clamp((t - tQ) / 0.3) * (1 - clamp((t - (tTex - 0.15)) / 0.2));
        QC.text(g, T, "WHAT PAYS IN A CRASH?", 540, 649, { size: 34, wt: 600, ls: 2, align: "center", a: aQ,
          roll: clamp((t - tQ) / 0.5), frame: f });
        const aF = clamp((t - tTex) / 0.2);
        if (aF > 0) QC.tex.show("payoff", { x: 540, y: 637, size: 54, align: "center", valign: "middle", a: aF,
          k: clamp((t - tTex) / 0.45), clip });
        // ---- the chart ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp((t - 0.1) / 0.45), title: `${K} put · payoff at expiry`, index: "07",
          sub: `strike K = ${K} · stock today S₀ = ${S0} · ${M.T_months} month`, tag: "MODEL", frame: f });
        QC.axes(g, T, F, { k: clamp((t - 0.25) / 0.5), xt: [60, 70, 80, 90, 100, 110, 120], yt: [0, 10, 20, 30],
          xl: "stock price at expiry", yl: "put payoff" });
        const y0 = F.Y(0);
        // the strike K = 90, marked on "low-strike"
        const kK = clamp((t - tK) / 0.3);
        if (kK > 0) {
          const xk = F.X(K), top = y0 - 96;
          g.save(); g.setLineDash([7, 6]); g.strokeStyle = T.hi(0.7); g.lineWidth = 2;
          g.beginPath(); g.moveTo(xk, y0); g.lineTo(xk, lerp(y0, top, eo(kK))); g.stroke(); g.restore();
          QC.tag(g, T, `K = ${K}`, xk, top - 4, { c: "hi", align: "center", a: clamp((kK - 0.5) * 2), size: 19 });
        }
        // the payoff, drawn left to right on "put."
        const kS = clamp((t - tSt0) / (tSt1 - tSt0));
        if (kS > 0) QC.line(g, T, F, SX, SY, { k: eio(kS), c: "line", w: 3.6, head: true });
        // the stock today, then the crash: 100 -> 80 along the axis on "crash?"
        const aS0 = clamp((t - tS0) / 0.25);
        if (aS0 > 0) QC.dot(g, T, F.X(S0), y0, { c: "hi", r: 6, a: aS0 });
        const kA = clamp((t - tArr) / 0.35);
        arrow(F.X(S0) - 10, F.X(SC), y0, kA, 1);
        QC.tag(g, T, CRASH, F.X(K) + 22, y0 - 20, { c: "acc", a: clamp((kA - 0.5) * 2.5), size: 19 });
        // where the crash lands, the put pays 10: locks just after the stick passes 80
        const kP = clamp((t - t80) / 0.2);
        if (kP > 0) {
          const px = F.X(SC), py = F.Y(PAY);
          g.save(); g.setLineDash([6, 6]); g.strokeStyle = T.acc(0.85); g.lineWidth = 2;
          g.beginPath(); g.moveTo(px, y0); g.lineTo(px, lerp(y0, py, eo(kP))); g.stroke(); g.restore();
          if (kP >= 1) {
            QC.dot(g, T, px, py, { c: "acc", r: 7, pulse: clamp((t - tPay) / 0.7) });
            QC.lock(g, T, [px - 8, py - 8, px + 8, py + 8], clamp((t - tPay) / 0.3), { pad: 14, flash: hit(t, tPay + 0.3) });
          }
          const kv = clamp((t - t80) / 0.35);
          QC.text(g, T, "PAYS", px - 32, py + 54, { size: 24, wt: 600, ls: 2, align: "right", a: clamp(kv * 3) });
          QC.value(g, T, PAY.toFixed(0), px - 32, py + 136, { size: 84, align: "right", roll: kv, frame: f, flash: hit(t, t80 + 0.35) });
        }
        // ---- the price comparison: what the 90 put costs with one sigma, and with crashes ----
        const kB = clamp((t - tCmp) / 0.3);
        if (kB > 0) {
          const bx = BX.x + 24, rx = BX.x + BX.w - 24, by = BX.y;
          QC.panel(g, T, BX.x, BX.y, BX.w, BX.h, { open: kB, op: 0.96 });
          const aH = clamp((t - tCmp - 0.05) / 0.25);
          QC.text(g, T, `${K} PUT · PRICE TODAY`, bx, by + 38, { size: 21, wt: 600, ls: 2, c: "hi", a: aH, roll: clamp((t - tCmp) / 0.4), frame: f });
          // one sigma, flat at the at-the-money 15.6%
          const kA1 = clamp((t - tCmp - 0.1) / 0.3);
          QC.text(g, T, `ONE σ (${(100 * P90.atm_iv).toFixed(1)}%)`, bx, by + 86, { size: 25, wt: 500, c: "hi", a: clamp(kA1 * 3) });
          QC.value(g, T, P90.price_one_vol.toFixed(3), rx, by + 90, { size: 46, align: "right", roll: kA1, frame: f, lc: "hi", seed: 3 });
          bar(bx, by + 102, LB / P90.ratio * eo(kA1), 12, "line", clamp(kA1 * 3));
          // with crashes: the bar grows 6.4 times on "pay more"; 0.090 locks on "more"
          const kB1 = clamp((t - tB) / 0.25), kG = clamp((t - (tB + 0.04)) / (tMore - tB - 0.04));
          const locked = t >= tMore;
          QC.text(g, T, "WITH CRASHES", bx, by + 168, { size: 25, wt: 500, c: "hi", a: kB1 });
          const vB = QC.value(g, T, P90.price_model.toFixed(3), rx, by + 180, { size: 62, align: "right", roll: clamp((t - tB) / (tMore - tB)),
            frame: f, flash: hit(t, tMore), seed: 7, a: kB1 });
          bar(bx, by + 192, lerp(LB / P90.ratio, LB, eio(kG)), 12, locked ? "acc" : "line", kB1);
          const kR = clamp((t - tMore) / 0.2);
          if (kR > 0) {
            QC.tag(g, T, "×" + P90.ratio.toFixed(1), bx + LB + 12, by + 216, { c: "acc", a: kR, size: 23 });
            if (vB.bb) QC.lock(g, T, vB.bb, clamp((t - tMore) / 0.25), { pad: 10, flash: hit(t, tMore + 0.25) });
          }
        }
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
