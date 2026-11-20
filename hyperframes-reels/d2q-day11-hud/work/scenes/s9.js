      const TEX_IDS = ["model", "model_par"];
      const NUM_KEYS = ["model", "fan"];
      // ---- s9: "Let's simulate it. A stock with 15% volatility that crashes 20% about once every 10 years." ----
      // The model in the strip (dS/S = sigma dW - 20% dN; sigma = 15%, lambda = 0.1 a year), typed in as it is said:
      // sigma dW is locked on "15% volatility", -20% dN types in on "that crashes" and locks orange on "20%", lambda
      // types in and locks on "once every 10 years". The chart: 40 simulated 10-year paths (every 5th trading day, log
      // price axis) draw left to right on "simulate it", each crash marked by an orange tick on its drop; on "crashes"
      // the marks pulse and one path (its crash takes it from inside the fan to its lowest edge) is shown close; on
      // "once every 10 years" the counter: 24 of 40 paths had a crash, 36 crashes in 400 path-years.
      // words: 0 Let's 1 simulate 2 it. 3 A 4 stock 5 with 6 15% 7 volatility 8 that 9 crashes 10 20% 11 about 12 once
      //        13 every 14 10 15 years.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio, fmt } = QC;
      const g = document.getElementById("s9-cv").getContext("2d");
      const w = (i) => W[i];
      const M = NUM.model, FAN = NUM.fan;
      const YRS = FAN.days / 252, PY = FAN.paths * YRS;                 // 10 years, 400 path-years
      const XS = FAN.values[0].map((_, i) => (i * FAN.step) / 252);
      const LV = FAN.values.map((p) => p.map((v) => Math.log10(v)));
      const CRS = [];                                                     // every crash: path, x (years), log price before/after
      FAN.crash_days.forEach((ds, p) => ds.forEach((d) => {
        const i = Math.floor(d / FAN.step);
        CRS.push({ p, x: d / 252, i, a: LV[p][i], b: LV[p][i + 1] });
      }));
      // the path shown close: its crash takes it from inside the fan to the fan's lowest edge
      const HP = FAN.crash_days[8].length ? 8 : FAN.crash_days.findIndex((d) => d.length);
      const HC = CRS.find((c) => c.p === HP);
      const PX = { x: 40, y: 754, w: 1000, h: 712 };
      const F = QC.frame(150, 902, 850, 440, [0, YRS], [Math.log10(25), Math.log10(600)]);
      const YT = [25, 50, 100, 200, 400].map(Math.log10);
      // strip layout: the model on top (size 42, top-aligned), the parameters below (size 36, on a baseline)
      const MS = 42, PS = 36, MY = 578, PB = 716;
      const mW = TEX.model.w * MS, mX = 540 - mW / 2, mBase = MY + (TEX.model.h - TEX.model.a) * MS;
      const pW = TEX.model_par.w * PS, pX = 540 - pW / 2;
      const K1 = 5.36 / TEX.model.w, KP1 = 4.45 / TEX.model_par.w;    // reveal up to "dS/S = sigma dW" and "sigma = 15%,"
      const BOX_SW = [mX + 3.0 * MS, mBase - 0.72 * MS, mX + 5.22 * MS, mBase + 0.05 * MS];         // sigma dW
      const BOX_DN = [mX + 5.56 * MS, mBase - 0.76 * MS, mX + TEX.model.w * MS, mBase + 0.06 * MS];  // -20% dN
      const BOX_LA = [pX + 5.18 * PS, PB - 0.75 * PS, pX + TEX.model_par.w * PS, PB + 0.21 * PS];   // lambda = 0.1 a year
      const tP0 = w(1), tP1 = w(1) + 2.2;                                  // the paths draw
      const tM1 = w(3) - 0.04, tPar = w(6) - 0.06, tSW = w(6), tM2 = w(8), tDN = w(10);
      const tHi = w(9), tUn = w(11), tLa = w(12), tLaL = w(14), tC = w(12) - 0.1, tC1 = w(12), tC2 = w(13) - 0.06;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      function init() { QC.tex.init(document.querySelector('[data-composition-id="s9"]'), TEX, T); }
      function tick(c, a, big) {   // a crash: a small orange tick along its drop
        if (a <= 0) return;
        const x = F.X(c.x), y0 = F.Y(c.a), y1 = F.Y(c.b), lw = big ? 4.2 : 2.6;
        g.save(); g.lineCap = "round";
        g.strokeStyle = `rgba(255,255,255,${0.85 * a})`; g.lineWidth = lw + 3; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
        g.strokeStyle = T.acc(0.95 * a); g.lineWidth = lw; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
        g.fillStyle = T.acc(a); g.beginPath(); g.arc(x, y1, big ? 4.4 : 2.8, 0, 2 * Math.PI); g.fill();
        g.restore();
      }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the strip: the model, typed in as it is said ----
        QC.panel(g, T, 40, 566, 1000, 172, { open: clamp(t / 0.45), op: 0.9 });
        const aTask = clamp((t - 0.25) / 0.3) * (1 - clamp((t - (tM1 - 0.18)) / 0.18));   // "Let's simulate it."
        QC.text(g, T, "MONTE CARLO: SIMULATE THE STOCK PRICE", 540, 663, { size: 30, wt: 600, ls: 1.5, align: "center", a: aTask,
          roll: clamp((t - 0.25) / 0.5), frame: f, maxW: 920 });
        const kM = t < tM2 ? K1 * clamp((t - tM1) / 0.42) : lerp(K1, 1, clamp((t - tM2) / 0.36));
        const lockDN = t >= tDN;
        if (kM > 0) QC.tex.show("model", { x: mX, y: MY, size: MS, valign: "top", k: kM, lock: lockDN, clip });
        const kPar = t < tLa ? KP1 * clamp((t - tPar) / 0.24) : lerp(KP1, 1, clamp((t - tLa) / 0.34));
        if (kPar > 0) QC.tex.show("model_par", { x: pX, y: PB, size: PS, k: kPar, clip });
        // sigma dW is emphasised on "15% volatility"; -20% dN locks on "20%"; lambda on "once every 10 years"
        const kSW = clamp((t - tSW) / 0.3) * (1 - clamp((t - (tM2 - 0.1)) / 0.25));
        if (kSW > 0) QC.lock(g, T, BOX_SW, kSW, { pad: 6, flash: hit(t, tSW + 0.3) });
        if (lockDN) QC.lock(g, T, BOX_DN, clamp((t - tDN) / 0.3), { pad: 8, flash: hit(t, tDN + 0.3) });
        const kLa = clamp((t - (tLaL - 0.25)) / 0.25);
        if (kLa > 0) QC.lock(g, T, BOX_LA, kLa, { pad: 7, flash: hit(t, tLaL) });
        // ---- the chart ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: clamp((t - 0.1) / 0.45), title: `simulated paths · ${YRS} years`, index: "09",
          sub: `${FAN.paths} paths · S₀ = ${M.S0} · plotted every ${FAN.step} trading days`, tag: "SIMULATED", frame: f });
        QC.axes(g, T, F, { k: clamp((t - 0.25) / 0.5), xt: [0, 2, 4, 6, 8, 10], yt: YT, yf: (v) => String(Math.round(10 ** v)),
          xl: "years", yl: "price · log scale" });
        // the paths, left to right (thin, translucent); the one shown close is drawn last
        const kP = clamp((t - tP0) / (tP1 - tP0)), x1 = YRS * eio(kP);
        const kH = clamp((t - tHi) / 0.3) * (1 - clamp((t - tUn) / 0.4));
        const aOther = lerp(0.34, 0.13, kH);
        if (kP > 0) {
          const heads = [];
          for (let p = 0; p < FAN.paths; p++) {
            if (p === HP && t >= tHi) continue;
            const r = QC.line(g, T, F, XS, LV[p], { x1, c: "line", w: 1.25, a: aOther, glow: false });
            if (r && kP < 1) heads.push(r.end);
          }
          if (kP < 1) {
            const hx = F.X(x1);
            g.save(); g.strokeStyle = T.line(0.35); g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, F.y); g.lineTo(hx, F.y + F.h); g.stroke();
            g.fillStyle = T.line(0.8); heads.forEach((e) => { g.beginPath(); g.arc(e[0], e[1], 2.4, 0, 2 * Math.PI); g.fill(); }); g.restore();
          }
        }
        // the crash marks: each appears as the scan passes it; on "crashes" they pulse, then step back while one
        // path's crash is shown close, and come back for the count
        const aDim = 1 - 0.6 * clamp((t - (tHi + 0.5)) / 0.25) * (1 - clamp((t - tUn) / 0.3));
        CRS.forEach((c) => {
          const a = clamp((x1 - c.x) / 0.12);
          if (a <= 0) return;
          if (!(c === HC && t >= tHi)) tick(c, a * aDim, false);
          const kp = clamp((t - tHi - c.x / YRS * 0.2) / 0.45);
          if (kp > 0 && kp < 1) {
            g.save(); g.strokeStyle = T.acc(0.75 * (1 - kp)); g.lineWidth = 1.6;
            g.beginPath(); g.arc(F.X(c.x), (F.Y(c.a) + F.Y(c.b)) / 2, 6 + 16 * eo(kp), 0, 2 * Math.PI); g.stroke(); g.restore();
          }
        });
        // one path shown close: navy, over the dimmed fan, its crash locked
        if (t >= tHi) {
          const kh = clamp((t - tHi) / 0.3);
          QC.line(g, T, F, XS, LV[HP], { c: "rgba(255,255,255,0.9)", w: 6, a: kh, glow: false });
          QC.line(g, T, F, XS, LV[HP], { c: "hi", w: 2.8, a: kh, glow: false });
          tick(HC, 1, true);
          const cx = F.X(HC.x), ya = F.Y(HC.a), yb = F.Y(HC.b);
          QC.lock(g, T, [cx - 7, ya, cx + 7, yb], clamp((t - tHi - 0.1) / 0.3), { pad: 12, flash: hit(t, tHi + 0.4) });
          const kT = clamp((t - (tDN - 0.1)) / 0.25);
          if (kT > 0) {
            QC.tag(g, T, "CRASH " + fmt(100 * M.crash, 0) + "%", cx - 18, yb + 64, { c: "acc", a: kT, size: 20 });
            QC.text(g, T, `${FAN.values[HP][HC.i].toFixed(2)} → ${FAN.values[HP][HC.i + 1].toFixed(2)}`, cx - 18, yb + 92,
              { size: 20, mono: true, c: "hi", a: clamp((t - tDN) / 0.3) });
          }
        }
        // the counter: 24 of 40 paths had a crash; 36 crashes in 400 path-years
        const kC = clamp((t - tC) / 0.3);
        if (kC > 0) {
          const bx = 164, by = 906;
          QC.panel(g, T, bx, by, 466, 110, { open: kC, op: 0.96 });
          const k1 = clamp((t - tC1) / 0.3), k2 = clamp((t - tC2) / 0.3);
          const n1 = Math.round(FAN.with_crash * eo(k1)), n2 = Math.round(FAN.crashes * eo(k2));
          const nx = bx + 82, lx = bx + 96;   // numbers right-aligned in a fixed slot, so the labels never move
          QC.value(g, T, String(n1), nx, by + 48, { size: 44, align: "right", roll: k1 >= 1 ? 1 : 0.999, frame: f, flash: hit(t, tC1 + 0.3), a: clamp(k1 * 4) });
          QC.text(g, T, `OF ${FAN.paths} PATHS HAD A CRASH`, lx, by + 46, { size: 24, wt: 500, c: "hi", a: clamp(k1 * 3) });
          QC.value(g, T, String(n2), nx, by + 95, { size: 44, align: "right", roll: k2 >= 1 ? 1 : 0.999, frame: f, flash: hit(t, tC2 + 0.3), a: clamp(k2 * 4) });
          QC.text(g, T, `CRASHES IN ${Math.round(PY)} PATH-YEARS`, lx, by + 93, { size: 24, wt: 500, c: "hi", a: clamp(k2 * 3) });
        }
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
