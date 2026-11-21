      const NUM_KEYS = ["put90", "model"];
      const TEX_IDS = ["payoff"];
      // ---- s7, the put: "And what pays in a crash? A low-strike put. So traders pay more for it."
      // A big option ticket PUT · K 90 · 1 MONTH with its payoff hockey stick (payoff = max(K − S_T, 0)). On "crash" a red
      // arrow takes the stock from 100 to 80 (model.crash) and the payoff lights at 80. On "So traders pay more for it" a
      // cursor clicks BUY again and again and the price tag ticks up from the one-volatility price to the crash-aware
      // price (put90.price_one_vol → put90.price_model), its multiple climbing to 6.4× (put90.ratio).
      // words (global): 98 And 99 what 100 pays 101 in 102 a 103 crash? 104 A 105 low-strike 106 put. 107 So 108 traders
      //   109 pay 110 more 111 for 112 it.
      const g = document.getElementById("s7-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s7-tex", { ink: { ink: C.ink, acc: C.blue } }, () => draw()); }
      const P9 = NUM.put90, M = NUM.model, KK = P9.K, S0 = M.S0, SC = S0 * (1 + M.crash);   // 90, 100, 80
      const tCard = 0.05, tPay = 0.35, tCrash = w(103) - 0.06, tPut = w(105), tBuy0 = w(107), clicks = [w(108) + 0.02, w(109) + 0.02, w(110), w(111)];
      const tRatio = w(112) - 0.05;
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const Fr = K.frame(170, Y0 + 432, 800, 380, [58, 122], [0, 34]);
      const pay = (s) => Math.max(KK - s, 0);
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const P = K.enter(t - tCard, { dy: 240, pitch: 0.45, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, blur: 50, dy: 26 });
        // the ticket's band, notches and perforation
        g.save(); K.rr(g, X0, Y0, W0, H0, 30); g.clip(); g.fillStyle = C.blue; g.fillRect(X0, Y0, W0, 132); g.restore();
        const lowK = clamp((t - tPut) / 0.3);
        K.text(g, "PUT · K " + KK + " · " + M.T_months + " MONTH", X0 + 48, Y0 + 86, { size: 50, c: C.white, ls: 1 });
        if (lowK > 0) K.chip(g, "LOW STRIKE", X0 + W0 - 40, Y0 + 66, { k: lowK, size: 28, align: "right", fill: C.yel, col: C.ink, stroke: "rgba(0,0,0,0)", shadow: "rgba(0,0,0,0.2)" });
        g.fillStyle = C.paper; g.beginPath(); g.arc(X0, Y0 + 140, 16, 0, Math.PI * 2); g.arc(X0 + W0, Y0 + 140, 16, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba(C.ink, 0.2); for (let x = X0 + 30; x < X0 + W0 - 24; x += 18) { g.beginPath(); g.arc(x, Y0 + 140, 3, 0, Math.PI * 2); g.fill(); }
        // left: what it pays; right: its price tag
        K.text(g, "WHAT IT PAYS", X0 + 48, Y0 + 204, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.tex(g, "payoff", X0 + 48, Y0 + 272, 50, { k: clamp((t - tPay) / 0.5) });
        const pr = clamp((t - clicks[0] + 0.05) / (clicks[3] + 0.2 - clicks[0])), price = lerp(P9.price_one_vol, P9.price_model, eio(pr));
        const bump = Math.max(...clicks.map((c) => (t > c && t < c + 0.2 ? Math.sin(Math.PI * (t - c) / 0.2) : 0)));
        g.save(); g.translate(X0 + W0 - 50, Y0 + 270); g.scale(1 + 0.06 * bump, 1 + 0.06 * bump);
        K.rr(g, -330, -96, 330, 150, 24); g.fillStyle = pr > 0 ? C.redL : C.mist; g.fill();
        K.text(g, "PRICE", -306, -56, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        K.count(g, price, 3, -306, 30, { size: 84, c: pr > 0 ? C.red : C.ink });
        g.restore();
        // the multiple of the one-σ price climbs with it, to 6.4× (put90.ratio)
        K.text(g, pr <= 0 ? "at one σ = " + (100 * P9.atm_iv).toFixed(1) + "%" : "× " + (price / P9.price_one_vol).toFixed(1) + " the one-σ price", X0 + W0 - 50, Y0 + 360, { size: pr > 0 ? 30 : 26, mono: true, align: "right", c: pr > 0 ? C.red : rgba(C.ink, 0.6) });
        // the payoff chart: the hockey stick
        K.axes(g, Fr, { k: clamp((t - tCard - 0.15) / 0.4), xt: [60, 70, 80, 90, 100, 110, 120], yt: [0, 10, 20, 30], size: 26, xl: "STOCK AT EXPIRY", yl: "PAYOFF" });
        const xs = [58, KK, 122], kp = clamp((t - tPay) / 0.55);
        K.line(g, Fr, xs, xs.map(pay), { k: eio(kp), c: C.blue, w: 9, head: true });
        // today, and the crash: 100 -> 80; the payoff lights
        const kd = clamp((t - tPay - 0.3) / 0.3);
        if (kd > 0) { g.save(); g.globalAlpha *= kd; g.setLineDash([8, 8]); g.strokeStyle = rgba(C.ink, 0.5); g.lineWidth = 3; g.beginPath(); g.moveTo(Fr.X(S0), Fr.y + Fr.h); g.lineTo(Fr.X(S0), Fr.y + 20); g.stroke(); g.restore();
          K.chip(g, "TODAY " + S0, Fr.X(S0), Fr.y + 6, { k: kd, size: 26, mono: true, align: "center", h: 44 }); }
        const kc = clamp((t - tCrash) / 0.4);
        if (kc > 0) {
          const xa = Fr.X(S0), xb = lerp(xa, Fr.X(SC), eio(kc)), ya = Fr.y + Fr.h - 70;
          g.save(); g.strokeStyle = C.red; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(xa, ya); g.quadraticCurveTo((xa + xb) / 2, ya - 70, xb, ya); g.stroke();
          if (kc > 0.6) { g.beginPath(); g.moveTo(xb + 22, ya - 18); g.lineTo(xb, ya); g.lineTo(xb + 26, ya + 12); g.stroke(); }
          g.restore();
          K.chip(g, "CRASH " + K.MINUS + Math.round(-M.crash * 100) + "%", (xa + Fr.X(SC)) / 2, ya - 82, { k: kc, size: 26, mono: true, align: "center", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 44 });
          if (kc >= 1) {
            const kk = clamp((t - tCrash - 0.4) / 0.3), x = Fr.X(SC);
            g.save(); g.fillStyle = rgba(C.red, 0.18 * kk); g.fillRect(x - 16, Fr.Y(pay(SC)), 32, Fr.Y(0) - Fr.Y(pay(SC))); g.restore();
            K.dot(g, x, Fr.Y(pay(SC)), { r: 14, c: C.red, s: back(kk, 2.2), pulse: clamp((t - tCrash - 0.4) / 0.5) });
            K.chip(g, "PAYS " + pay(SC), x - 30, Fr.Y(pay(SC)) - 50, { k: kk, size: 30, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)" });
          }
        }
        // the BUY button and the cursor clicking it again and again
        const by = Y0 + H0 - 190, bx = X0 + 60, bw = 420, bh = 116;
        const cur = K.cursorAt(t, [[tBuy0 - 0.3, 1000, 1700], [clicks[0] - 0.02, bx + bw / 2 + 40, by + bh / 2 + 6]], clicks);
        K.button(g, "BUY", bx, by, bw, bh, { size: 52, p: cur.p, ls: 6 });
        const nBuy = clicks.filter((c) => t > c).length;
        for (let i = 0; i < nBuy; i++) {   // each click sends up a "+1 BUY" that floats off
          const u = t - clicks[i], a = 1 - clamp((u - 0.22) / 0.2); if (a <= 0) continue;
          K.chip(g, "+1 BUY", bx + bw / 2 + (i % 2 ? 70 : -70), by - 26 - 34 * eo(clamp(u / 0.4)), { k: clamp(u / 0.15), a, size: 28, align: "center", fill: C.ink, col: C.white, stroke: "rgba(0,0,0,0)" });
        }
        const kr = 0;                              // the buy orders stay; the 6.4× rides in the price tag
        if (kr < 1) {
          g.save(); g.globalAlpha *= 1 - kr;
          K.text(g, "BUY ORDERS", bx + bw + 60, by + 30, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
          for (let i = 0; i < 4; i++) {
            const on = clamp((t - clicks[i]) / 0.15), x = bx + bw + 84 + i * 104, y = by + 82;
            g.beginPath(); g.arc(x, y, 30 * (on > 0 ? back(on, 2.6) : 1), 0, Math.PI * 2); g.fillStyle = on > 0 ? C.red : C.mist; g.fill();
            if (on > 0) K.text(g, "+1", x, y + 10, { size: 28, align: "center", c: C.white });
          }
          g.restore();
        }
        if (t > tBuy0 - 0.3) K.cursor(g, cur.x, cur.y, { p: cur.p, r: cur.r });
        g.restore();
      }
