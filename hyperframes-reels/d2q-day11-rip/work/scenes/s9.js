      const NUM_KEYS = ["model", "fan"];
      const TEX_IDS = ["model", "model_par"];
      // ---- s9, simulate: "Let's simulate it. A stock with 15% volatility that crashes 20% about once every 10 years."
      // A simulation control panel: the model's formulas (model, model_par) on top; a cursor drags three sliders on the
      // spoken words: volatility σ to 15% (model.sigma), crash size to −20% (model.crash), crashes to 1 per 10 years
      // (model.crash_every_years). Meanwhile the 40-path fan (fan, seed 2) draws out over ten years, each crash a red drop.
      // words (global): 131 Let's 132 simulate 133 it. 134 A 135 stock 136 with 137-138 15% 139 volatility 140 that
      //   141 crashes 142-143 20% 144 about 145 once 146 every 147 10 148 years.
      const g = document.getElementById("s9-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s9-tex", { ink: { ink: C.ink, acc: C.red, blu: C.blue } }, () => draw()); }
      const M = NUM.model, FN = NUM.fan;
      const SIGP = Math.round(M.sigma * 100), CRP = Math.round(-M.crash * 100), EVERY = M.crash_every_years, YRS = FN.days / 252;
      const tCard = 0.05, tForm = w(132) - 0.05, tFan0 = w(133), tFan1 = NEXT - 0.15;
      const drags = [[w(137) - 0.05, 0.38], [w(142) - 0.05, 0.55], [w(147) - 0.06, 0.62]];   // [when the drag starts, how long]
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const ROWS = [
        { lab: "VOLATILITY σ", val: SIGP + "%", v: SIGP / 40, col: C.blue },
        { lab: "CRASH SIZE", val: K.MINUS + CRP + "%", v: CRP / 40, col: C.red },
        { lab: "CRASHES", val: "1 per " + EVERY + " yrs", v: (1 / EVERY) / 0.4, col: C.red }];
      const RY = (i) => Y0 + 330 + i * 116, SX0 = X0 + 60, SW = W0 - 120;
      const Fr = K.frame(X0 + 120, Y0 + 720, W0 - 170, 330, [0, YRS], [Math.log(30), Math.log(450)]);
      const lv = (v) => Math.log(v);
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const P = K.enter(t - tCard, { dy: 240, pitch: 0.45, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, blur: 50, dy: 26 });
        K.rr(g, X0 + 34, Y0 + 32, 58, 58, 16); g.fillStyle = C.blue; g.fill();
        g.beginPath(); g.moveTo(X0 + 54, Y0 + 46); g.lineTo(X0 + 80, Y0 + 61); g.lineTo(X0 + 54, Y0 + 76); g.closePath(); g.fillStyle = C.white; g.fill();
        K.text(g, "Simulation", X0 + 112, Y0 + 76, { size: 42 });
        K.prov(g, "SIMULATED · seed " + FN.seed, X0 + W0 - 34, Y0 + 61, { align: "right", col: C.blue });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y0 + 118, W0 - 60, 2);
        // the model
        K.tex(g, "model", X0 + 44, Y0 + 200, 52, { valign: "middle", k: clamp((t - tForm) / 0.5) });
        K.tex(g, "model_par", X0 + W0 - 40, Y0 + 200, 34, { align: "right", valign: "middle", k: clamp((t - tForm - 0.3) / 0.5) });
        // the sliders, set by the cursor on the spoken words
        const pts = [[0, 1000, 1700]], clicks = [];
        drags.forEach(([t0, d], i) => { pts.push([t0 - 0.02, SX0 + 4, RY(i) + 56]); pts.push([t0 + d, SX0 + SW * ROWS[i].v, RY(i) + 56]); clicks.push(t0); });
        const cur = K.cursorAt(t, pts, []);
        ROWS.forEach((R, i) => {
          const [t0, d] = drags[i], q = eio(clamp((t - t0) / d)), y = RY(i);
          const press = t > t0 - 0.05 && t < t0 + d + 0.08 ? 1 : 0;
          K.text(g, R.lab, SX0, y, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.6) });
          K.text(g, q >= 1 ? R.val : q > 0 ? "…" : "–", X0 + W0 - 60, y + 6, { size: 44, align: "right", c: q > 0 ? R.col : rgba(C.ink, 0.3) });
          K.slider(g, SX0, y + 56, SW, R.v * q, { col: R.col, p: press });
          if (q >= 1 && t - (t0 + d) < 0.4) { const u = (t - t0 - d) / 0.4; g.save(); g.strokeStyle = rgba(R.col, 0.6 * (1 - u)); g.lineWidth = 4; g.beginPath(); g.arc(SX0 + SW * R.v, y + 56, 24 + 30 * eo(u), 0, Math.PI * 2); g.stroke(); g.restore(); }
        });
        // the fan: 40 simulated paths over ten years, drawn out left to right; every crash a red drop
        K.text(g, FN.paths + " PATHS · " + Math.round(YRS) + " YEARS", X0 + 44, Fr.y - 30, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.axes(g, Fr, { k: clamp((t - tFan0) / 0.4), xt: [0, 2, 4, 6, 8, 10], xf: (v) => v + "y", yt: [lv(50), lv(100), lv(200), lv(400)], yf: (v) => String(Math.round(Math.exp(v))), size: 26, grid: true });
        const kf = clamp((t - tFan0) / (tFan1 - tFan0)), nPts = FN.values[0].length, nShow = Math.max(0, Math.floor(kf * (nPts - 1)));
        if (nShow > 1) {
          const X = (j) => Fr.X(j * FN.step / 252), Y = (v) => Fr.Y(lv(v));
          g.save(); g.beginPath(); g.rect(Fr.x, Fr.y - 10, Fr.w + 10, Fr.h + 10); g.clip();
          g.lineJoin = "round"; g.lineCap = "round";
          FN.values.forEach((p, k) => {
            g.beginPath(); for (let j = 0; j <= nShow; j++) (j ? g.lineTo(X(j), Y(p[j])) : g.moveTo(X(j), Y(p[j])));
            g.strokeStyle = rgba(C.blue, 0.42); g.lineWidth = 2.6; g.stroke();
          });
          FN.values.forEach((p, k) => FN.crash_days[k].forEach((d) => {
            const j = Math.floor(d / FN.step); if (j + 1 > nShow) return;
            g.beginPath(); g.moveTo(X(j), Y(p[j])); g.lineTo(X(j + 1), Y(p[j + 1])); g.strokeStyle = C.red; g.lineWidth = 6; g.stroke();
            g.beginPath(); g.arc(X(j + 1), Y(p[j + 1]), 5, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
          }));
          // the drawing front
          if (kf < 1) { g.strokeStyle = rgba(C.blue, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(X(nShow), Fr.y); g.lineTo(X(nShow), Fr.y + Fr.h); g.stroke(); }
          g.restore();
        }
        const nCr = FN.crash_days.reduce((s, d) => s + d.filter((x) => Math.floor(x / FN.step) + 1 <= nShow).length, 0);
        if (nCr > 0) K.chip(g, nCr + " CRASHES", Fr.x + Fr.w, Fr.y - 34, { k: 1, size: 28, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(229,72,77,0.3)" });
        if (t < drags[2][0] + drags[2][1] + 0.4) K.cursor(g, cur.x, cur.y, { p: t > drags[0][0] - 0.05 ? 0.6 : 0, a: 1 - clamp((t - drags[2][0] - drags[2][1] - 0.1) / 0.3) });
        g.restore();
      }
