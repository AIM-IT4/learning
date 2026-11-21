      // ---- b10, the interview question (vo 95.70-106.88): "Interview favourite: why does exposure peak a third of the way
      // in? Early on, rates haven't moved much. Near the end, few payments are left. The peak sits in between." An
      // INTERVIEW Q card (white, blue left border) asks "Why does exposure peak a third of the way in?" ("peak" and "a third"
      // underline as said); just before "Early" it docks as the chart heading. A shape chart (no scale: each curve as a share
      // of its maximum) over 0 .. T: on "Early on, rates haven't moved much" a dashed blue √t curve, "how far rates can move
      // ∝ √t" (the code underlines dx in line 8); on "Near the end, few payments are left" a steel line, "payments left ∝
      // (T − t)" (underline (T - t)); on "The peak sits in between" their product draws as the bold blue hump, a peak dot
      // and drop line at T/3 = 20 months, and the chip "EE(t) ∝ (T − t)·√t → peak at T/3".
      const g = document.getElementById("b10-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const TT = NUM.T, MO = Math.round(TT / 3 * 12);
      const Fr = K.frame(150, 566, 790, 248, [0, TT], [0, 1.12]);
      const N = 100, ts = Array.from({ length: N + 1 }, (_, i) => TT * i / N);
      const SQ = ts.map((t) => Math.sqrt(t / TT)), LN = ts.map((t) => (TT - t) / TT);
      const PMAX = (2 * TT / 3) * Math.sqrt(TT / 3), PR = ts.map((t) => (TT - t) * Math.sqrt(t) / PMAX);
      const Q1 = "Why does exposure peak", Q2 = "a third of the way in?", QF = "Why does exposure peak a third of the way in?";
      function qcard(T) {
        const P = K.life(T, CUE.interview - 0.05, CUE.dock, { dy: 70, rot: 0, yaw: 0.12, pitch: 0.14, sc: 0.94, fade: 0.12 }, { dy: -150, dur: 0.3, rot: 0, pitch: 0, sc: 0.62 });
        if (P.a <= 0) return;
        g.save(); K.apply(g, 540, 640, P);
        K.card(g, 100, 512, 880, 256, { r: 22, blur: 34, dy: 14, shadow: "rgba(40,32,12,0.2)", stroke: "rgba(13,21,38,0.1)" });
        g.save(); K.rr(g, 100, 512, 880, 256, 22); g.clip(); g.fillStyle = C.blue; g.fillRect(100, 512, 10, 256); g.restore();
        K.text(g, "INTERVIEW Q", 144, 566, { size: 24, mono: true, wt: 700, ls: 4, c: C.blue });
        K.text(g, Q1, 144, 642, { size: 48, ls: -1, c: C.ink });
        K.text(g, Q2, 144, 706, { size: 48, ls: -1, c: C.ink });
        // "peak" and "a third" underline as said
        const ul = (x0, s, line, t) => { const k = eo(clamp((T - t + 0.04) / 0.25)); if (k <= 0) return;
          g.fillStyle = C.blue; g.fillRect(x0, line + 10, K.tw(g, s, 48, false, -1) * k, 5); };
        ul(144 + K.tw(g, "Why does exposure ", 48, false, -1), "peak", 642, CUE.peak);
        ul(144, "a third", 706, CUE.a3);
        g.restore();
      }
      function heading(T) {
        const k = eo(clamp((T - CUE.dock - 0.1) / 0.3)); if (k <= 0) return;
        g.save(); g.globalAlpha *= k; g.translate(0, 16 * (1 - k));
        g.fillStyle = C.blue; K.rr(g, 100, 418, 6, 40, 3); g.fill();
        K.text(g, "INTERVIEW Q", 122, 432, { size: 16, mono: true, wt: 700, ls: 3, c: C.blue });
        K.text(g, QF, 122, 462, { size: 30, ls: -0.5, c: C.ink, maxW: 860 });
        g.restore();
      }
      function curve(ys, k, col, w, dash) {
        if (k <= 0) return;
        K.line(g, Fr, ts, ys, { k, c: col, w, dash, head: false });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        qcard(T);
        heading(T);
        // the shape chart: axes 0 .. T, no scale
        const ax = clamp((T - CUE.dock - 0.05) / 0.4);
        if (ax > 0) {
          g.save(); g.globalAlpha *= ax; g.strokeStyle = rgba(C.ink, 0.75); g.lineWidth = 2;
          g.beginPath(); g.moveTo(Fr.x, Fr.y - 10); g.lineTo(Fr.x, Fr.y + Fr.h); g.lineTo(Fr.x + Fr.w, Fr.y + Fr.h); g.stroke();
          K.text(g, "0", Fr.x, Fr.y + Fr.h + 30, { size: 20, mono: true, c: C.steelD, align: "center" });
          K.text(g, "T", Fr.X(TT), Fr.y + Fr.h + 30, { size: 22, mono: true, wt: 700, c: C.steelD, align: "center" });
          K.text(g, "time →", Fr.X(TT) - 30, Fr.y + Fr.h + 30, { size: 18, mono: true, c: C.steel, align: "right" });
          g.restore();
        }
        // √t: how far rates can move
        const k1 = eio(clamp((T - CUE.early + 0.05) / 0.9)), l1 = clamp((T - CUE.rates + 0.05) / 0.3);
        curve(SQ, k1, C.blue, 4, [12, 9]);
        if (k1 >= 1) K.dot(g, Fr.X(TT), Fr.Y(1), { r: 7, c: C.blue, pulse: ((T - CUE.early - 0.9) % 1.4) / 1.4, a: 1 - clamp((T - CUE.the) / 0.4) });
        if (l1 > 0) {
          const w1 = K.tw(g, "how far rates can move ∝ √t", 27, true, 0, 700);
          g.save(); g.globalAlpha *= l1; g.setLineDash([10, 7]); g.strokeStyle = C.blue; g.lineWidth = 4;
          g.beginPath(); g.moveTo(940 - w1 - 56, 502); g.lineTo(940 - w1 - 14, 502); g.stroke(); g.restore();
          K.text(g, "how far rates can move ∝ √t", 940, 511, { size: 27, mono: true, wt: 700, c: C.blue, align: "right", a: l1 });
        }
        // T − t: payments left
        const k2 = eio(clamp((T - CUE.near + 0.05) / 0.9)), l2 = clamp((T - CUE.payments + 0.05) / 0.3);
        curve(LN, k2, C.steelD, 4, []);
        if (k2 >= 1) K.dot(g, Fr.X(0), Fr.Y(1), { r: 7, c: C.steelD, pulse: ((T - CUE.near - 0.9) % 1.4) / 1.4, a: 1 - clamp((T - CUE.the) / 0.4) });
        if (l2 > 0) {
          g.save(); g.globalAlpha *= l2; g.strokeStyle = C.steelD; g.lineWidth = 4;
          g.beginPath(); g.moveTo(166, 538); g.lineTo(206, 538); g.stroke(); g.restore();
          K.text(g, "payments left ∝ (T − t)", 218, 547, { size: 27, mono: true, wt: 700, c: C.steelD, a: l2 });
        }
        // the product: the bold blue hump, the peak at T/3, the chip
        const k3 = eio(clamp((T - CUE.the + 0.05) / 0.8));
        if (k3 > 0) {
          K.area(g, Fr, ts, PR, { k: k3, c: C.blue, fa: 0.22, grad: true });
          K.line(g, Fr, ts, PR, { k: k3, c: C.blue, w: 6, head: true });
        }
        const kp = clamp((T - CUE.peak2 - 0.15) / 0.3);
        if (kp > 0) {
          const px = Fr.X(TT / 3), py = Fr.Y(1);
          g.save(); g.setLineDash([7, 7]); g.strokeStyle = rgba(C.ink, 0.6); g.lineWidth = 2;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px, lerp(py, Fr.y + Fr.h, eio(kp))); g.stroke(); g.restore();
          K.dot(g, px, py, { r: 10, c: C.blue, s: back(kp, 2.2), pulse: ((T - CUE.peak2) % 1.4) / 1.4 });
          K.text(g, "T/3 = " + MO + " months", px, Fr.y + Fr.h + 30, { size: 22, mono: true, wt: 700, c: C.blue, align: "center", a: kp });
        }
        const kc = clamp((T - CUE.between + 0.05) / 0.3);
        if (kc > 0) K.tag(g, "EE(t) ∝ (T − t)·√t → peak at T/3", 540, 908, { k: kc, size: 30, h: 62, padX: 24, align: "center" });
        g.restore();
      }
