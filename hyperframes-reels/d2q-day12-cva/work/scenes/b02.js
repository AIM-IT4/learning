      // ---- b02, the series card (vo 13.50-16.40): "Making Quant Easy, day twelve." At ~vo 13.3 a big white card rises over
      // the chart area (the code card empties at the same time, in the code layer): MAKING QUANT EASY (mono 700, blue,
      // letter-spaced), DAY 12/30 (D2QSans ~124 px), "CVA · counterparty credit risk" and a large copy of the 30-day strip.
      // Each part lights on its word; days 1-11 fill in as the card lands; day 12 lights brand blue on "twelve". At ~vo 16.2
      // the card lifts away and the chart card returns.
      const g = document.getElementById("b02-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const X = 50, Y = 374, W = 980, H = 620, CX = 540;
      // a word that lights from 30 % steel to its colour at time t
      const lit = (T, t) => eo(clamp((T - t + 0.04) / 0.16));
      function words(T, parts, y, size, mono, o = {}) {
        const ws = parts.map(([s]) => K.tw(g, s, size, mono, o.ls || 0, o.wt));
        let x = CX - ws.reduce((p, v) => p + v, 0) / 2;
        parts.forEach(([s, t, col], i) => {
          const k = lit(T, t);
          K.text(g, s, x, y, { size, mono, wt: o.wt, ls: o.ls || 0, c: mix(C.steel, col, k), a: 0.45 + 0.55 * k });
          x += ws[i];
        });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const P = K.life(T, CUE.card, CUE.lift, { dy: 110, rot: 0, yaw: 0, pitch: 0.14, sc: 0.95, fade: 0.12, z: 0.62, w: 13 },
          { dy: -90, dur: 0.3, rot: 0, pitch: 0.12, sc: 0.97 });
        if (P.a <= 0) return;
        g.save(); K.apply(g, CX, Y + H / 2, P);
        K.card(g, X, Y, W, H, { r: 30, blur: 64, dy: 30, shadow: "rgba(40,32,12,0.28)" });
        K.rr(g, X, Y, W, H, 30); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
        words(T, [["MAKING ", CUE.making, C.blue], ["QUANT ", CUE.quant, C.blue], ["EASY", CUE.easy, C.blue]], 524, 30, true, { wt: 700, ls: 8 });
        words(T, [["DAY ", CUE.day, C.ink], ["12", CUE.twelve, C.blue], ["/30", CUE.twelve, C.ink]], 672, 124, false, { ls: -3 });
        K.text(g, "CVA · counterparty credit risk", CX, 736, { size: 28, mono: true, c: C.steelD, align: "center" });
        // the big 30-day strip: days 1-11 fill in as the card lands, day 12 lights on "twelve"
        const x0 = 110, x1 = 970, sy = 784, sh = 52, k12 = eo(clamp((T - CUE.twelve + 0.02) / 0.12));
        const S = K.strip(g, x0, x1, sy, sh, 12, k12, T, { gap: 7, r: 8, lw: 2.5, glow: 18, ringR: 12,
          fill: (d) => (T - (CUE.card + 0.2 + d * 0.06)) / 0.12 });
        K.text(g, "1", S.X(1), sy + sh + 34, { size: 20, mono: true, c: C.steelD, align: "center" });
        K.text(g, "30", S.X(30), sy + sh + 34, { size: 20, mono: true, c: C.steelD, align: "center" });
        K.text(g, "12 · today", S.X(12), sy + sh + 34, { size: 20, mono: true, wt: 700, c: mix(C.steel, C.blue, k12), align: "center", a: 0.4 + 0.6 * k12 });
        g.restore();
      }
