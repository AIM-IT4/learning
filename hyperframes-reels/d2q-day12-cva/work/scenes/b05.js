      // ---- b05, simulate (vo 36.95-51.25): "Our trade: a five-year swap on a hundred million, where we receive fixed. We
      // simulate ten thousand paths for rates. If rates rise, the swap moves against us. If they fall, the client owes us."
      // A deal ticket with three slots; its chips land on their words (5-year swap, $100m, we receive fixed; the code makes
      // line 2 active and types line 5). Under it, the trade's payment timeline: on "five-year" a thin axis 0-5 years draws
      // and the five yearly payment dots pop one by one; on "hundred million" "$100m notional"; on "receive fixed" a
      // brand-blue arrow up at each payment ("fixed in") and a steel arrow down ("floating out"). On "We simulate" the
      // ticket and its timeline lift away together, the axes draw (years 0-5, rate move in %)
      // and the 40 shown rate paths draw left to right ("10,000 simulated paths (40 shown)"; lines 6-7 type). On "rise" a
      // "rates up" chip marks the upper paths; as "the swap moves" the same 40 paths morph into swap values in $m (rates up
      // means the swap is worth less to us, so the chip rides down with them), and on "against" the negative parts turn red:
      // "rates up → we owe the client" (line 8 types). On "fall" the positive parts turn blue: "rates down → client owes
      // us". The labels clear just before b06, which opens on this exact picture (K.simChart draws both).
      const g = document.getElementById("b05-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const CHIPS = [[NUM.T + "-year swap", CUE.fiveyear, C.white, C.ink], ["$" + NUM.N + "m", CUE.hundred, C.white, C.ink],
        ["we receive fixed", CUE.receive, C.blue, C.white]];
      // the payment timeline under the ticket: years 0..T on a thin axis, a payment at the end of each year; fixed in (up,
      // brand blue) and floating out (down, steel) at each payment
      const TL = { x0: 230, x1: 930, y: 806 };
      const tlX = (yr) => lerp(TL.x0, TL.x1, yr / NUM.T);
      function arrowV(x, y0, y1, col, k) {
        if (k <= 0) return;
        const ye = lerp(y0, y1, eo(k)), d = Math.sign(y1 - y0);
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, y0); g.lineTo(x, ye - d * 6); g.stroke();
        g.beginPath(); g.moveTo(x, ye + d * 2); g.lineTo(x - 8, ye - d * 11); g.lineTo(x + 8, ye - d * 11); g.closePath(); g.fill();
        g.restore();
      }
      function timeline(T) {
        const ka = eio(clamp((T - CUE.fiveyear + 0.04) / 0.5)); if (ka <= 0) return;
        const y = TL.y;
        // the axis and the years
        g.save(); g.strokeStyle = rgba(C.ink, 0.7); g.lineWidth = 2; g.lineCap = "round";
        g.beginPath(); g.moveTo(TL.x0, y); g.lineTo(lerp(TL.x0, TL.x1, ka), y); g.stroke(); g.restore();
        for (let yr = 0; yr <= NUM.T; yr++) {
          const a = clamp((ka * NUM.T - yr + 0.6) / 0.6); if (a <= 0) continue;
          g.save(); g.globalAlpha *= a; g.strokeStyle = rgba(C.ink, 0.5); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(tlX(yr), y - 5); g.lineTo(tlX(yr), y + 5); g.stroke(); g.restore();
          K.text(g, String(yr), tlX(yr), y + 34, { size: 18, mono: true, c: C.steelD, align: "center", a });
        }
        K.text(g, "years", TL.x0 - 24, y + 34, { size: 18, mono: true, c: C.steelD, align: "right", a: ka });
        // the payments: one dot a year, popping one by one
        for (let yr = 1; yr <= NUM.T; yr++) {
          const u = T - (CUE.fiveyear + 0.08 + 0.12 * yr); if (u <= 0) continue;
          const s = back(clamp(u / 0.25), 2.4);
          g.save(); g.translate(tlX(yr), y); g.scale(s, s);
          g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
          g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill(); g.restore();
        }
        // the notional on "hundred million"
        const kn = clamp((T - CUE.hundred + 0.04) / 0.3);
        if (kn > 0) K.text(g, "$" + NUM.N + "m notional", TL.x1, y - 116 + 8 * (1 - eo(kn)), { size: 22, mono: true, wt: 700, c: C.ink, align: "right", a: kn });
        // on "receive fixed": fixed in (up, blue) and floating out (down, steel) at each payment
        for (let yr = 1; yr <= NUM.T; yr++) {
          const x = tlX(yr);
          arrowV(x - 18, y - 12, y - 84, C.blue, clamp((T - CUE.receive - 0.06 * (yr - 1) + 0.04) / 0.3));
          arrowV(x + 18, y + 12, y + 72, C.steel, clamp((T - CUE.receive - 0.15 - 0.06 * (yr - 1)) / 0.3));
        }
        const kf = clamp((T - CUE.receive - 0.05) / 0.3), kfl = clamp((T - CUE.receive - 0.25) / 0.3);
        if (kf > 0) K.text(g, "fixed in", 100, y - 40, { size: 22, mono: true, wt: 700, c: C.blue, a: kf });
        if (kfl > 0) K.text(g, "floating out", 100, y + 78, { size: 22, mono: true, wt: 700, c: C.steelD, a: kfl });
      }
      function ticket(T, P) {
        if (P.a <= 0) return;
        g.save(); K.apply(g, 540, 680, P);
        timeline(T);
        K.rr(g, 100, 420, 880, 200, 22); g.fillStyle = "#f7f6f2"; g.fill(); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
        K.text(g, "OUR TRADE", 132, 470, { size: 22, mono: true, wt: 700, ls: 3, c: C.steelD });
        K.text(g, "interest-rate swap · simulated", 948, 470, { size: 18, mono: true, c: C.steel, align: "right" });
        const sz = 30, gap = 22, ws = CHIPS.map(([s]) => K.tw(g, s, sz, true, 0, 700) + 48);
        let x = 540 - (ws.reduce((p, v) => p + v, 0) + gap * 2) / 2;
        CHIPS.forEach(([s, t, fill, col], i) => {
          const y = 556, h = 64, k = clamp((T - t + 0.04) / 0.3);
          // the empty slot, then the chip
          g.save(); g.setLineDash([8, 7]); K.rr(g, x, y - h / 2, ws[i], h, h / 2); g.strokeStyle = rgba(C.steel, 0.7 * (1 - clamp(k * 3))); g.lineWidth = 2; g.stroke(); g.restore();
          if (k > 0) K.chip(g, s, x, y, { k, size: sz, mono: true, wt: 700, fill, col, h, padX: 24, stroke: fill === C.white ? "rgba(13,21,38,0.14)" : "rgba(0,0,0,0)",
            shadow: fill === C.blue ? "rgba(37,99,235,0.35)" : "rgba(52,40,14,0.18)" });
          x += ws[i] + gap;
        });
        g.restore();
      }
      // a label chip that rides with the paths: text grows from `s0` to `s1` at t1
      function rider(T, s0, s1, t0, t1, x, y, col) {
        const k = clamp((T - t0 + 0.04) / 0.3); if (k <= 0) return;
        const s = T < t1 ? s0 : s1, kc = T < t1 ? 0 : eo(clamp((T - t1) / 0.25));
        const fill = mix(C.ink, col, kc);
        K.tag(g, s, x, y, { k, size: 24, h: 46, fill, padX: 18 });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        if (st.t >= NEXT) return;                         // b06 carries this exact picture on from here
        const A = K.xfade(T, T0, null);
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        // the deal ticket, lifting away on "We simulate"
        ticket(T, K.life(T, CUE.our - 0.05, CUE.we - 0.05, { dy: 60, rot: 0, yaw: 0, pitch: 0.1, sc: 0.96, fade: 0.15 }, { dy: -70, dur: 0.3, rot: 0, pitch: 0.08 }));
        // the chart: axes, the rate paths drawing, the morph into swap values, the tints
        const ax = clamp((T - CUE.we) / 0.5), k = eio(clamp((T - CUE.simulate) / 1.6));
        const m = clamp((T - CUE.rise - 0.4) / Math.max(0.5, CUE.against - CUE.rise - 0.5)), neg = eo(clamp((T - CUE.against + 0.04) / 0.35)), pos = eo(clamp((T - CUE.fall + 0.04) / 0.35));
        const Fv = K.simChart(g, NUM, { ax, k, m, neg, pos, tag: clamp((T - CUE.paths) / 0.3) });
        // the end of each rate path lands one by one once they are drawn, and clears as the paths start to move
        const ke = (T - CUE.simulate - 1.6) / 1.3, ko = 1 - clamp((T - CUE.rise - 0.4) / 0.3);
        if (ke > 0 && ko > 0 && Fv) {
          const Fr0 = K.frame(K.SIM.X, K.SIM.Y, K.SIM.W, K.SIM.H, [0, NUM.T], K.SIM.R), n = NUM.rate_paths_pct.length;
          g.save(); g.globalAlpha *= ko;
          for (let p = 0; p < n; p++) {
            const a = clamp(ke * n - p); if (a <= 0) break;
            const r = NUM.rate_paths_pct[p], v = r[r.length - 1];
            g.beginPath(); g.arc(Fr0.X(NUM.T), Fr0.Y(v), 3.5 * a, 0, Math.PI * 2); g.fillStyle = rgba(C.ink, 0.55); g.fill();
          }
          g.restore();
        }
        // the riders: "rates up" sits on the upper paths, then rides down with the morph; "rates down" on the positive side
        const out = 1 - clamp((T - (T0 + NEXT - 0.3)) / 0.25);
        if (out > 0) {
          g.save(); g.globalAlpha *= out;
          const yUp = lerp(520, 818, eio(m));
          rider(T, "rates up", "rates up → we owe the client", CUE.rise, CUE.against, 560, yUp, C.red);
          rider(T, "rates down", "rates down → client owes us", CUE.fall, CUE.client, 560, 520, C.blue);
          g.restore();
        }
        g.restore();
      }
