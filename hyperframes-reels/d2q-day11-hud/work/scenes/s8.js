      const TEX_IDS = ["newton", "iv_def"];
      const NUM_KEYS = ["bscurve", "put90"];
      // ---- s8: "Put that higher price into Black-Scholes and solve for the volatility: it comes out higher. That's
      // implied volatility." The 90 put's Black-Scholes price as a function of sigma; the market (simulated) price as a
      // level; Newton's method walks down the curve onto it (30% -> 23.2% -> 21.1% -> 20.74%); the root locks at 20.7%,
      // higher than the one-volatility 15.6%; the definition locks in orange on "implied volatility".
      // words: 0 Put 1 that 2 higher 3 price 4 into 5 Black-Scholes 6 and 7 solve 8 for 9 the 10 volatility:
      //        11 it 12 comes 13 out 14 higher. 15 That's 16 implied volatility.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s8-cv").getContext("2d");
      const w = (i) => W[i];
      const B = NUM.bscurve, P90 = NUM.put90;
      const SX = B.sigma.map((s) => 100 * s), PY = B.price, MKT = B.market;
      const NW = B.newton.map((p) => ({ s: 100 * p.sigma, p: p.price }));
      const IV = 100 * B.iv, ONE = 100 * B.one_vol;
      const PX = { x: 40, y: 724, w: 1000, h: 742 };
      const F = QC.frame(170, 872, 820, 470, [5, 35], [0, 0.5]);
      const tMkt = w(0) + 0.1, tCurve0 = w(4) - 0.1, tCurve1 = w(6), tOne = w(6) + 0.05, tN0 = w(7), tStep = 0.32;
      const tRoot = w(14) - 0.05, tDef = w(15) - 0.1, tLockDef = w(16) + 0.15;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const pct = (v) => v.toFixed(2) + "%";
      const st = { t: 0 };
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s8"]'), TEX, T); }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the top strip: the task, then Newton's step, then the definition ----
        QC.panel(g, T, 40, 566, 1000, 142, { open: clamp(t / 0.45), op: 0.9 });
        const aTask = clamp((t - 0.25) / 0.3) * (1 - clamp((t - (tN0 - 0.15)) / 0.2));
        QC.text(g, T, "SOLVE FOR σ:  BLACK–SCHOLES PRICE = MARKET PRICE", 540, 649, { size: 30, wt: 600, ls: 1.5, align: "center",
          a: aTask, roll: clamp((t - 0.25) / 0.5), frame: f, maxW: 920 });
        const aNew = clamp((t - tN0) / 0.2) * (1 - clamp((t - (tDef - 0.1)) / 0.2));
        if (aNew > 0) QC.tex.show("newton", { x: 540, y: 637, size: 44, align: "center", valign: "middle", a: aNew,
          k: clamp((t - tN0) / 0.45), clip });
        const aDef = clamp((t - tDef) / 0.2);
        let defBox = null;
        if (aDef > 0) defBox = QC.tex.show("iv_def", { x: 540, y: 637, size: 52, align: "center", valign: "middle", a: aDef,
          k: clamp((t - tDef) / 0.4), lock: t >= tLockDef, clip }).bb;
        if (defBox && t >= tLockDef) QC.lock(g, T, defBox, clamp((t - tLockDef) / 0.3), { pad: 12, flash: hit(t, tLockDef + 0.3) });
        // ---- the chart ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp((t - 0.1) / 0.45), title: "Black–Scholes price · 90 put", index: "08",
          sub: "S = 100 · K = 90 · 1 month · r = 0", tag: "MODEL", frame: f });
        QC.axes(g, T, F, { k: clamp((t - 0.25) / 0.5), xt: [5, 10, 15, 20, 25, 30, 35], xf: (v) => v + "%",
          yt: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yf: (v) => v.toFixed(2), xl: "volatility σ", yl: "put price" });
        // the market price: the higher price from the simulation
        const kM = clamp((t - tMkt) / 0.5);
        if (kM > 0) QC.hline(g, T, F, MKT, { k: kM, c: "acc", dash: [12, 8], label: "MARKET PRICE  " + MKT.toFixed(3), at: "start", size: 19 });
        // the Black-Scholes curve, drawn left to right on "into Black-Scholes"
        const kC = clamp((t - tCurve0) / (tCurve1 - tCurve0));
        QC.line(g, T, F, SX, PY, { k: eio(kC), c: "line", w: 3.4, head: true });
        // what one volatility charges: 15.6% -> 0.014
        const kO = clamp((t - tOne) / 0.35);
        if (kO > 0) {
          const ox = F.X(ONE), oy = F.Y(P90.price_one_vol);
          QC.vline(g, T, F, ONE, { k: kO, c: "hi", a: 0.6, dash: [6, 6] });
          QC.dot(g, T, ox, oy, { c: "hi", r: 6, a: kO });
          QC.tag(g, T, "ONE σ 15.6% → " + P90.price_one_vol.toFixed(3), ox - 14, oy - 22, { c: "hi", align: "right", a: kO, size: 18 });
        }
        // Newton: from 30% (on the curve) slide down the tangent to the market level, drop to the curve, repeat
        const tbl = [];
        for (let i = 0; i < NW.length - 1; i++) {
          const t0 = tN0 + 0.12 + i * tStep, k1 = clamp((t - t0) / (tStep * 0.6)), k2 = clamp((t - t0 - tStep * 0.6) / (tStep * 0.4));
          const a = NW[i], b = NW[i + 1];
          if (t >= t0 - 0.12) { QC.dot(g, T, F.X(a.s), F.Y(a.p), { c: "line", r: 5.5 }); tbl.push(i); }
          if (k1 > 0) {
            const xe = lerp(a.s, b.s, eo(k1)), ye = lerp(a.p, MKT, eo(k1));
            g.save(); g.strokeStyle = T.hi(0.85); g.lineWidth = 2; g.beginPath(); g.moveTo(F.X(a.s), F.Y(a.p)); g.lineTo(F.X(xe), F.Y(ye)); g.stroke(); g.restore();
          }
          if (k2 > 0) {
            g.save(); g.setLineDash([5, 5]); g.strokeStyle = T.line(0.7); g.lineWidth = 1.6;
            g.beginPath(); g.moveTo(F.X(b.s), F.Y(MKT)); g.lineTo(F.X(b.s), F.Y(lerp(MKT, b.p, eo(k2)))); g.stroke(); g.restore();
          }
        }
        if (t >= tN0 + 0.12 + (NW.length - 2) * tStep + tStep * 0.6) tbl.push(NW.length - 1);
        // the iterations, as a table
        if (t >= tN0) {
          const tx = 214, ty = 920, a = clamp((t - tN0) / 0.25) * (1 - 0.5 * clamp((t - tRoot) / 0.4));
          QC.text(g, T, "n     σₙ        P(σₙ)", tx, ty, { size: 20, mono: true, c: "dim", a });
          tbl.filter((i) => i <= 3).forEach((i, r) => {
            const last = i === 3 && t >= tRoot, row = `${i}   ${pct(NW[i].s).padStart(7)}   ${NW[i].p.toFixed(4)}`;
            QC.text(g, T, row, tx, ty + 32 + r * 30, { size: 22, mono: true, c: last ? "acc" : "hi", a, roll: clamp((t - (tN0 + 0.12 + i * tStep)) / 0.25), frame: f, seed: i });
          });
        }
        // the root: 20.7%, higher than one volatility's 15.6%
        const kR = clamp((t - tRoot) / 0.35);
        if (kR > 0) {
          const rx = F.X(IV), ry = F.Y(MKT);
          QC.vline(g, T, F, IV, { k: kR, c: "acc", dash: [8, 6] });
          QC.dot(g, T, rx, ry, { c: "acc", r: 7, pulse: clamp((t - tRoot) / 0.8) });
          QC.lock(g, T, [rx - 8, ry - 8, rx + 8, ry + 8], clamp((t - tRoot) / 0.3), { pad: 16, tag: t >= tLockDef ? "IMPLIED VOL" : "ROOT", flash: hit(t, tRoot + 0.3) });
          QC.value(g, T, IV.toFixed(1), rx + 30, F.y + F.h - 40, { size: 64, roll: clamp((t - tRoot) / 0.35), frame: f, unit: "%", flash: hit(t, tRoot + 0.35) });
          // higher: an arrow along the axis from 15.6% to 20.7%
          const ka = clamp((t - tRoot - 0.15) / 0.4), y = F.y + F.h - 16, x0 = F.X(ONE), x1 = lerp(x0, rx, eo(ka));
          if (ka > 0) {
            g.save(); g.strokeStyle = T.acc(0.95); g.fillStyle = T.acc(0.95); g.lineWidth = 4;
            g.beginPath(); g.moveTo(x0, y); g.lineTo(x1 - 6, y); g.stroke();
            g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 - 12, y - 7); g.lineTo(x1 - 12, y + 7); g.closePath(); g.fill(); g.restore();
          }
        }
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
