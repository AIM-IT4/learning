      const TEX_IDS = ["flat", "skew"];
      const NUM_KEYS = ["bell", "normal", "model"];
      // ---- s13: "Real returns have fat tails, so low-strike puts cost more, and implied vol rises as the strike falls."
      // The ANSWER layout continued from s12 (no scan-in: the header and the top row hold exactly as s12 left them). The
      // bottom row lights up and fills: FAT TAILS (the fat-tailed density over the dashed normal, same spread, log scale;
      // its left tail sits far above the normal's: MORE CRASHES; tag ILLUSTRATIVE) on "fat tails" -> the arrow on "so" ->
      // IMPLIED VOL: SMILE (the simulated implied vols by strike) with the low strikes 80-90 highlighted on "low-strike puts
      // cost more"; an arrow runs along the curve from 120 down to 80, rising, on "implied vol rises as the strike falls",
      // and the skew formula locks on "falls". Scan-erase at the end.
      // words: 0 Real 1 returns 2 have 3 fat tails, 4 so 5 low-strike 6 puts 7 cost 8 more, 9 and 10 implied 11 vol
      //        12 rises 13 as 14 the 15 strike 16 falls.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24, FONT = HUD.FONT;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s13-cv").getContext("2d");
      const w = (i) => W[i];
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
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
      // s12 has ended: its header and top row are drawn at their end state, the bottom row's slots as s12 left them
      const A = { hd: 0, ans: 0, L0: 0, ax: 0, nT: 0, n0: 0, n1: 1, thin: 0, sig: 0, arr: 0, R0: 0, iv: 0, flat: 0, f1: 1, fx: 0, lk: 0 };
      const DONE = 99;
      // the smile through the nine simulated points (a monotone cubic, as in s11)
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
      const IVK = KS.map((k) => M.iv_pct[String(k)]), SM = smooth(KS, IVK);
      const CX = []; for (let k = KS[0]; k <= KS[KS.length - 1] + 1e-9; k += 0.25) CX.push(k);
      const CY = CX.map(SM);
      const Fd2 = FD(R2), Fv2 = FV(R2);
      // the left tail where the fat-tailed density sits above the normal: from -5% up to where they cross
      const iX = B.x.findIndex((x, i) => x < 0 && LF[i] <= LN[i]), XW = B.x.slice(0, iX + 1);
      // the arrow's path: the smile, pushed 22 px off the curve (outside the smile), in px
      const OFF = (() => {
        const P = CX.map((x, i) => [Fv2.X(x), Fv2.Y(CY[i])]);
        return P.map((p, i) => {
          const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
          return [p[0] + 22 * dy / L, p[1] - 22 * dx / L];
        });
      })();
      // the arrow along the curve, from 120 (k = 0) down to 80 (k = 1), rising
      function along(k, c) {
        if (k <= 0) return;
        const n = OFF.length, u = (n - 1) * (1 - k), i0 = Math.floor(u), fr = u - i0, b = OFF[Math.min(n - 1, i0 + 1)];
        const front = [lerp(OFF[i0][0], b[0], fr), lerp(OFF[i0][1], b[1], fr)], back = OFF[Math.min(n - 1, i0 + 6)];
        let dx = front[0] - back[0], dy = front[1] - back[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        g.save(); g.strokeStyle = T[c](0.95); g.fillStyle = T[c](0.95); g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(OFF[n - 1][0], OFF[n - 1][1]);
        for (let i = n - 2; i > i0; i--) g.lineTo(OFF[i][0], OFF[i][1]);
        g.lineTo(front[0] - dx * 12, front[1] - dy * 12); g.stroke();
        g.beginPath(); g.moveTo(front[0] + dx * 4, front[1] + dy * 4);
        g.lineTo(front[0] - dx * 15 - dy * 9, front[1] - dy * 15 + dx * 9); g.lineTo(front[0] - dx * 15 + dy * 9, front[1] - dy * 15 - dx * 9);
        g.closePath(); g.fill(); g.restore();
      }
      // the beats, on the words
      const tLit = 0.08, tNorm = w(0) + 0.1, tFatT = w(3) - 0.04, tFat0 = w(3), tFat1 = w(3) + 0.55, tWedge = w(3) + 0.45;
      const tCrash = w(3) + 0.55, tR0 = w(3) + 0.42, tArr = w(4) - 0.06, tCur0 = w(5) - 0.04, tCur1 = w(6) + 0.04;
      const tBand = w(6), tCost = w(7), tSk = w(10), tUp0 = w(12), tUp1 = w(16) - 0.04, tLk = w(16) + 0.04;
      const st = { t: 0 };
      // init() is also called from draw(): the composed timeline's fromTo renders draw() once before init() runs, and a
      // formula shown at t = 0 would otherwise throw (no formula yet) and stop the scene from registering
      let texReady = false;
      function init() { if (texReady) return; texReady = true; QC.tex.init(document.querySelector('[data-composition-id="s13"]'), TEX, T); }
      function draw() {
        init();
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0, clip = [xOut, QC.STAGE.x1];
        QC.clipStage(g, QC.STAGE.x1, xOut);
        header(DONE, A, f);
        const kLit = clamp((t - tLit) / 0.4);
        slots(1, lerp(SLOT, 1, kLit));
        topRow(DONE, A, f, clip);
        const y0 = R2, Fd = Fd2, Fv = Fv2;
        // ---- FAT TAILS: the fat-tailed density over the normal (dashed), same spread ----
        head(PL.x, y0, PL.w, { bar: kLit, index: "13", title: "Fat tails", roll: clamp((t - tFatT) / 0.42), frame: f,
          sub: "student-t · same spread", subA: clamp((t - tFatT - 0.15) / 0.3), tag: "ILLUSTRATIVE", tagA: clamp((t - tFatT) / 0.3) });
        const kNm = eio(clamp((t - tNorm) / 0.5));
        if (kNm > 0) {
          QC.line(g, T, Fd, B.x, LN, { k: kNm, c: "hi", w: 2, dash: [8, 6], glow: false, a: 0.7 });
          QC.text(g, T, "NORMAL", Fd.X(4.9), Fd.y + Fd.h - 6, { size: 18, mono: true, c: "dim", align: "right", a: clamp((t - tNorm - 0.3) / 0.3) });
        }
        const kW = clamp((t - tWedge) / 0.3), pulse = Math.sin(Math.PI * clamp((t - tBand) / 0.6));
        if (kW > 0) {
          g.save(); g.beginPath();
          XW.forEach((x, i) => (i ? g.lineTo : g.moveTo).call(g, Fd.X(x), Fd.Y(LF[i])));
          for (let i = XW.length - 1; i >= 0; i--) g.lineTo(Fd.X(XW[i]), Fd.Y(LN[i]));
          g.closePath(); g.fillStyle = T.line((0.3 + 0.25 * pulse) * kW); g.fill(); g.restore();
        }
        const kFt = eio(clamp((t - tFat0) / (tFat1 - tFat0)));
        if (kFt > 0) {
          QC.area(g, T, Fd, B.x, LF, { k: kFt, base: Fd.yr[0], fa: 0.08 });
          QC.line(g, T, Fd, B.x, LF, { k: kFt, c: "line", w: 3, head: true });
        }
        const xc = -4.6;
        pin("MORE CRASHES", Fd.x + 6, Fd.y + 36, Fd.X(xc), Fd.Y(at(B.x, LF, xc)), clamp((t - tCrash) / 0.35));
        // ---- so: the arrow, then IMPLIED VOL: SMILE ----
        arrow(y0, clamp((t - tArr) / 0.35));
        head(PR.x, y0, PR.w, { bar: kLit, title: "Implied vol: smile", roll: clamp((t - tR0) / 0.42), frame: f,
          tag: "SIMULATED", tagA: clamp((t - tR0) / 0.3) });
        // the low strikes, 80-90: the puts that pay in a crash cost more
        const kB = clamp((t - tBand) / 0.3);
        if (kB > 0) {
          const bx0 = Fv.X(KS[0]) - 13, bx1 = Fv.X(90) + 13;
          g.save(); g.fillStyle = T.line((0.1 + 0.08 * pulse) * kB); g.fillRect(bx0, Fv.y, bx1 - bx0, Fv.h * eo(kB) );
          g.setLineDash([4, 5]); g.strokeStyle = T.line(0.6 * kB); g.lineWidth = 1.4;
          g.beginPath(); [bx0, bx1].forEach((x) => { g.moveTo(x, Fv.y + Fv.h); g.lineTo(x, Fv.y + Fv.h * (1 - eo(kB))); }); g.stroke(); g.restore();
          QC.tag(g, T, "PUTS COST MORE", bx1, Fv.y + 30, { c: "hi", a: clamp((t - tCost) / 0.25), size: 18 });
        }
        const kC = clamp((t - tCur0) / (tCur1 - tCur0));
        if (kC > 0) {
          const xh = lerp(CX[0], CX[CX.length - 1], eio(kC));
          QC.line(g, T, Fv, CX, CY, { x1: xh, c: "line", w: 3.4, head: kC < 1 });
          KS.forEach((k, i) => { const kd = kC >= 1 ? 1 : clamp((xh - k) / 2.5 + 0.5); if (kd > 0) QC.dot(g, T, Fv.X(k), Fv.Y(IVK[i]), { r: 4.5, s: eo(kd), a: kd }); });
        }
        // implied vol rises as the strike falls: the arrow along the curve, then the skew formula locks on "falls"
        const locked = t >= tLk;
        along(eio(clamp((t - tUp0) / (tUp1 - tUp0))), locked ? "acc" : "hi");
        const kSk = clamp((t - tSk) / 0.45);
        if (kSk > 0) {
          const bb = QC.tex.show("skew", { x: PR.x + 24, y: y0 + 72, size: 30, valign: "top", k: kSk, a: clamp(kSk * 3), lock: locked, clip }).bb;
          if (locked) QC.lock(g, T, bb, clamp((t - tLk) / 0.3), { pad: 6, flash: hit(t, tLk + 0.3) });
        }
        g.restore();
        QC.scanLine(g, T, xOut);
        QC.tex.end();
      }
