      // ---- b04, inputs → output (vo 27.80-36.95): "Three inputs: what the client could owe us over time, how likely they are
      // to default, and how much we'd recover. One output: the C V A." On "Three inputs" three empty slots; each fills with
      // its card on its words: EXPOSURE · what they could owe us, over time (a mini blue hump: the simulated EE; the code
      // types lines 2 and 4), DEFAULT · how likely (a mini red rising curve: the default probability), RECOVERY · how much we
      // get back (a ring sweeping to 40 %; line 3 types). On "One output" arrows run from the three cards into a CVA box:
      // "one number".
      const g = document.getElementById("b04-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const CW_ = 268, CH_ = 270, CY = 424, XS_ = [100, 406, 712];
      const REC = Math.round(NUM.R * 100);
      function slot(x, k) {
        if (k <= 0) return;
        g.save(); g.globalAlpha *= k; g.setLineDash([9, 8]); K.rr(g, x, CY, CW_, CH_, 20); g.strokeStyle = rgba(C.steel, 0.8); g.lineWidth = 2; g.stroke(); g.restore();
      }
      function cardIn(i, T, t0, title, sub, col, drawMini) {
        const P = K.life(T, t0, null, { dy: 50, rot: 0, yaw: 0.15, pitch: 0.12, sc: 0.92, fade: 0.12 });
        if (P.a <= 0) return;
        const x = XS_[i];
        g.save(); K.apply(g, x + CW_ / 2, CY + CH_ / 2, P);
        K.card(g, x, CY, CW_, CH_, { r: 20, blur: 24, dy: 10, shadow: "rgba(40,32,12,0.16)", stroke: false });
        K.rr(g, x, CY, CW_, CH_, 20); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
        g.fillStyle = col; K.rr(g, x, CY, CW_, 8, 4); g.fill();
        K.text(g, title, x + 22, CY + 50, { size: 26, mono: true, wt: 700, ls: 2, c: col });
        sub.forEach((s, j) => K.text(g, s, x + 22, CY + 84 + j * 26, { size: 19, mono: true, c: C.steelD }));
        drawMini(x, T - t0);
        g.restore();
      }
      const XS = [0].concat(NUM.t), EE = [0].concat(NUM.ee), PD = [0].concat(NUM.pd);
      function mini(x, ys, col, u, top) {
        const Fr = K.frame(x + 24, CY + top, CW_ - 48, CH_ - top - 26, [0, NUM.T], [0, Math.max(...ys) * 1.1]), k = eio(clamp((u - 0.1) / 0.9));
        g.save(); g.strokeStyle = rgba(C.ink, 0.35); g.lineWidth = 1.5; g.beginPath(); g.moveTo(Fr.x, Fr.y + Fr.h); g.lineTo(Fr.x + Fr.w, Fr.y + Fr.h); g.stroke(); g.restore();
        K.area(g, Fr, XS, ys, { k, c: col, fa: 0.22, grad: true });
        K.line(g, Fr, XS, ys, { k, c: col, w: 4, head: true });
      }
      function ring(x, u) {
        const cx = x + CW_ / 2, cy = CY + 196, r = 50, k = eio(clamp((u - 0.1) / 0.8)) * NUM.R;
        g.save(); g.lineCap = "round";
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = C.steelL; g.lineWidth = 14; g.stroke();
        if (k > 0) { g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * k); g.strokeStyle = C.ink; g.lineWidth = 14; g.stroke(); }
        g.restore();
        K.text(g, REC + "%", cx, cy + 11, { size: 30, align: "center", c: C.ink, a: clamp((u - 0.5) / 0.3) });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        // three empty slots on "Three inputs"
        XS_.forEach((x, i) => slot(x, clamp((T - CUE.three - i * 0.08) / 0.25)));
        cardIn(0, T, CUE.what - 0.04, "EXPOSURE", ["what they could owe", "us, over time"], C.blue, (x, u) => mini(x, EE, C.blue, u, 138));
        cardIn(1, T, CUE.how1 - 0.04, "DEFAULT", ["how likely"], C.red, (x, u) => mini(x, PD, C.red, u, 138));
        cardIn(2, T, CUE.how2 - 0.04, "RECOVERY", ["how much we", "get back"], C.ink, (x, u) => ring(x, u));
        // one output: arrows into the CVA box
        const ka = clamp((T - CUE.one + 0.04) / 0.5), bx = 380, by = 790, bw = 320, bh = 116;
        if (ka > 0) {
          g.save(); g.strokeStyle = C.ink; g.lineWidth = 3; g.lineCap = "round";
          XS_.forEach((x, i) => {
            const x0 = x + CW_ / 2, y0 = CY + CH_ + 12, x1 = 540 + (i - 1) * 70, y1 = by - 14, kk = eo(clamp(ka * 1.3 - i * 0.15));
            if (kk <= 0) return;
            const xe = lerp(x0, x1, kk), ye = lerp(y0, y1, kk);
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(xe, ye); g.stroke();
            if (kk > 0.95) { const an = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1);
              g.lineTo(x1 - 14 * Math.cos(an - 0.45), y1 - 14 * Math.sin(an - 0.45)); g.lineTo(x1 - 14 * Math.cos(an + 0.45), y1 - 14 * Math.sin(an + 0.45)); g.closePath(); g.fillStyle = C.ink; g.fill(); }
          });
          g.restore();
        }
        const kb = T - CUE.c + 0.08;
        if (kb > 0) {
          const p = K.spring(kb, 0.5, 14), s = lerp(0.6, 1, p);
          g.save(); g.globalAlpha *= clamp(kb / 0.1); g.translate(540, by + bh / 2); g.scale(s, s); g.translate(-540, -(by + bh / 2));
          g.save(); g.shadowColor = "rgba(37,99,235,0.4)"; g.shadowBlur = 26; g.shadowOffsetY = 10;
          K.rr(g, bx, by, bw, bh, 24); g.fillStyle = C.blue; g.fill(); g.restore();
          const s3 = T < CUE.v ? "C" : T < CUE.a ? "CV" : "CVA";
          K.text(g, s3, 540, by + bh / 2 + 27, { size: 76, ls: -1, c: C.white, align: "center" });
          g.restore();
          const kn = clamp((T - CUE.a + 0.1) / 0.25);
          if (kn > 0) K.text(g, "one number", bx + bw + 26, by + bh / 2 + 9, { size: 26, mono: true, wt: 700, c: C.blue, a: kn });
          const ko = clamp((T - CUE.one + 0.05) / 0.3);
          K.text(g, "output", bx - 26, by + bh / 2 + 9, { size: 22, mono: true, c: C.steelD, align: "right", a: ko });
        }
        const ki = clamp((T - CUE.three + 0.05) / 0.3);
        if (ki > 0 && T < CUE.what + 0.2) K.text(g, "3 inputs", 540, CY + CH_ / 2 + 10, { size: 30, mono: true, wt: 700, c: C.steel, align: "center", a: ki * (1 - clamp((T - CUE.what + 0.1) / 0.3)) });
        g.restore();
      }
