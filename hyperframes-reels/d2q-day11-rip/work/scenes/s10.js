      const NUM_KEYS = ["model", "ends"];
      const TEX_IDS = ["mc_price"];
      // ---- s10, a million paths: "Price one-month options at strikes from 80 to 120, on a million simulated paths."
      // A card: a 1,000,000 PATHS counter rolls up (model.paths, landing on "million") beside the Monte Carlo price
      // (mc_price); glossy balls pour from a funnel into the histogram of one-month outcomes (ends: every bin's share of a
      // million, the crash paths red at the bottom); nine strike cards 80 … 120 (model.strikes) deal in on "strikes from
      // 80 to 120" and tick to PRICED on "a million simulated paths".
      // words (global): 149 Price 150 one-month 151 options 152 at 153 strikes 154 from 155 80 156 to 157-158 120, 159 on
      //   160 a 161 million 162 simulated 163 paths.
      const g = document.getElementById("s10-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s10-tex", { ink: { ink: C.ink, acc: C.blue } }, () => draw()); }
      const M = NUM.model, E = NUM.ends, KS = M.strikes, NB = E.all.length;
      const tCard = 0.05, tCnt0 = 0.3, tCnt1 = w(161) + 0.15, tPour0 = 0.4, tPour1 = w(163) + 0.1, tCards = w(153) - 0.05, tPriced = w(161);
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const HX0 = X0 + 70, HW = W0 - 140, HY = Y0 + 820, HH = 440;           // the histogram's box (bottom at HY)
      const BW = HW / NB, RB = 9;                                            // bin width, ball radius
      const MAXB = Math.floor((HH - 20) / (2 * RB));                          // balls in the tallest bin
      const nBalls = E.all.map((c) => Math.max(c > 0 ? 1 : 0, Math.round(c / Math.max(...E.all) * MAXB)));
      const nRed = E.all.map((c, i) => (c > 0 ? Math.round(nBalls[i] * E.crash[i] / c) : 0));
      const TOT = nBalls.reduce((a, b) => a + b, 0);
      // the order the balls land in: bin by bin, interleaved so the histogram grows everywhere at once
      const ORDER = []; for (let lvl = 0; lvl < MAXB; lvl++) for (let i = 0; i < NB; i++) if (lvl < nBalls[i]) ORDER.push([i, lvl]);
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const P = K.enter(t - tCard, { dy: 240, pitch: 0.45, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, blur: 50, dy: 26 });
        K.text(g, M.T_months + "-month options", X0 + 40, Y0 + 76, { size: 42 });
        K.prov(g, "SIMULATED · seed " + M.seed, X0 + W0 - 34, Y0 + 61, { align: "right", col: C.blue });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y0 + 118, W0 - 60, 2);
        // the counter: paths simulated
        const v = Math.round(M.paths * eio(clamp((t - tCnt0) / (tCnt1 - tCnt0))));
        K.text(g, "SIMULATED PATHS", X0 + 44, Y0 + 172, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.text(g, K.comma(v), X0 + 40, Y0 + 282, { size: 92, c: v >= M.paths ? C.blue : C.ink, ls: -2 });
        K.tex(g, "mc_price", X0 + W0 - 36, Y0 + 236, 30, { align: "right", valign: "middle", k: clamp((t - 0.5) / 0.6) });
        // the histogram of one-month outcomes, filled by balls pouring from a funnel
        const nOn = Math.floor(TOT * clamp((t - tPour0) / (tPour1 - tPour0)));
        K.text(g, "WHERE THE STOCK ENDS IN " + M.T_months + " MONTH", X0 + 44, Y0 + 372, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        // the funnel
        const fx = HX0 + HW * ((100 - E.edges[0]) / (E.edges[NB] - E.edges[0])), fy = Y0 + 406;
        g.save(); g.beginPath(); g.moveTo(fx - 70, fy); g.lineTo(fx + 70, fy); g.lineTo(fx + 16, fy + 52); g.lineTo(fx - 16, fy + 52); g.closePath();
        const fg = g.createLinearGradient(fx - 70, 0, fx + 70, 0); fg.addColorStop(0, "#8a95a8"); fg.addColorStop(0.45, "#f1f4f8"); fg.addColorStop(1, "#7d889b");
        g.fillStyle = fg; g.fill(); g.restore();
        const bx = (i) => HX0 + (i + 0.5) * BW, byl = (lvl) => HY - RB - 2 - lvl * 2 * RB;
        for (let q = 0; q < Math.min(nOn, ORDER.length); q++) {
          const [i, lvl] = ORDER[q];
          K.ball(g, bx(i), byl(lvl), RB, lvl < nRed[i] ? C.red : C.blue);
        }
        // a few balls in flight from the funnel to their bins
        for (let q = nOn; q < Math.min(nOn + 10, ORDER.length) && t < tPour1; q++) {
          const [i, lvl] = ORDER[q], u = clamp(1 - (q - nOn) / 10);
          const x = lerp(fx, bx(i), u), y = lerp(fy + 60, byl(lvl), u * u);
          K.ball(g, x, y, RB, lvl < nRed[i] ? C.red : C.blue);
        }
        // the axis: stock price in a month
        g.fillStyle = C.ink; g.fillRect(HX0 - 6, HY, HW + 12, 4);
        [70, 80, 90, 100, 110, 120, 130].forEach((s) => { const x = HX0 + HW * (s - E.edges[0]) / (E.edges[NB] - E.edges[0]); g.fillRect(x - 1.5, HY, 3, 10); K.text(g, String(s), x, HY + 42, { size: 26, mono: true, align: "center", c: rgba(C.ink, 0.75) }); });
        if (nOn > 40) K.chip(g, "CRASH PATHS", HX0 + 4, HY - 70, { k: clamp((t - tPour0 - 1.2) / 0.3), size: 26, mono: true, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 46 });
        // the nine strike cards, dealt in on "strikes from 80 to 120", ticked PRICED on "a million simulated paths"
        const cw = (W0 - 80 - 8 * 10) / 9, cy = Y0 + H0 - 150;
        KS.forEach((k, i) => {
          const u = t - (tCards + 0.06 * i); if (u <= 0) return;
          const pr = clamp((t - (tPriced + 0.07 * i)) / 0.2);
          const x = X0 + 40 + i * (cw + 10), dy = 60 * (1 - K.spring(u, 0.5, 14));
          g.save(); g.globalAlpha *= clamp(u / 0.12); g.translate(0, dy);
          K.rr(g, x, cy, cw, 120, 18); g.fillStyle = pr > 0 ? K.mix("#eef1f6", C.blue, pr) : C.mist; g.fill();
          K.text(g, String(k), x + cw / 2, cy + 52, { size: 38, align: "center", c: pr > 0.5 ? C.white : C.ink });
          if (pr > 0) K.check(g, x + cw / 2, cy + 88, 26 * back(pr, 2.6), C.yel, 5);
          else K.text(g, "K", x + cw / 2, cy + 94, { size: 26, mono: true, align: "center", c: rgba(C.ink, 0.45) });
          g.restore();
        });
        if (t > tPriced + 0.6) K.text(g, "PRICED", X0 + W0 - 40, cy - 18, { size: 26, mono: true, ls: 3, align: "right", c: C.blue, a: clamp((t - tPriced - 0.6) / 0.2) });
        g.restore();
      }
