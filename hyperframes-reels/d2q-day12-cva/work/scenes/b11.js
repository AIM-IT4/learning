      // ---- b11, recap + call to action (vo 106.88-113.36, then a hold to film 116.0): "Simulate, take the exposure, price the
      // default, add it up. Comment C V A, and we'll DM you the notebook." Four recap rows light in order with their code
      // lines (the code layer makes them active): simulate (lines 5-8), exposure (9-10), default (11-12), add it up (13-16).
      // On "Comment" they give way to the call to action, the biggest type on screen: "Comment CVA" (CVA landing letter by
      // letter), "→ we'll DM you the notebook"; a comment field types CVA and sends; the DM arrives from Desk2Quant (the
      // real logo): "cva_day12.ipynb · here's your notebook" with a notebook icon; "Day 13 tomorrow" from ~vo 113.4; gentle
      // pulses through the hold.
      const g = document.getElementById("b11-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      function init() { K.load({ logo: "assets/logo.png" }, "b11-images", () => draw()); }
      const ROWS = [["simulate", "lines 5-8", CUE.simulate], ["exposure", "lines 9-10", CUE.exposure], ["default", "lines 11-12", CUE.default],
        ["add it up", "lines 13-16", CUE.add]];
      function recap(T, a) {
        if (a <= 0) return;
        g.save(); g.globalAlpha *= a;
        K.text(g, ROWS.length + " steps · " + CODE.length + " lines", 540, 446, { size: 22, mono: true, wt: 700, ls: 2, c: C.steelD, align: "center" });
        ROWS.forEach(([s, lines, t], i) => {
          const y = 520 + i * 104, k = eo(clamp((T - t + 0.04) / 0.3)), u = T - t;
          const P = K.life(T, T0 + 0.1 + i * 0.07, null, { dy: 30, rot: 0, yaw: 0, pitch: 0.1, sc: 0.96, fade: 0.15 });
          g.save(); K.apply(g, 540, y, P);
          K.rr(g, 150, y - 40, 780, 80, 40); g.fillStyle = mix("#f7f6f2", C.blueL, k); g.fill();
          g.strokeStyle = mix(C.steelL, C.blue, k); g.lineWidth = 2.5; g.stroke();
          const s_ = k > 0 && u < 0.5 ? 1 + 0.18 * Math.exp(-u * 8) * Math.sin(Math.min(u, 0.5) * 16) : 1;
          g.save(); g.translate(196, y); g.scale(s_, s_);
          g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fillStyle = mix(C.white, C.blue, k); g.fill();
          g.strokeStyle = mix(C.steel, C.blue, k); g.lineWidth = 2.5; g.stroke();
          if (k > 0.5) K.check(g, 0, 2, 28, C.white, 5);
          else K.text(g, String(i + 1), 0, 9, { size: 26, mono: true, wt: 700, c: C.steelD, align: "center" });
          g.restore();
          K.text(g, s, 244, y + 14, { size: 40, ls: -0.5, c: mix(C.steel, C.ink, k) });
          K.text(g, lines, 900, y + 8, { size: 22, mono: true, c: mix(C.steel, C.blue, k), align: "right" });
          g.restore();
        });
        g.restore();
      }
      function notebookIcon(x, y, s) {
        g.save(); g.fillStyle = C.white; g.strokeStyle = C.white; g.lineWidth = 3;
        K.rr(g, x - s * 0.36, y - s * 0.46, s * 0.72, s * 0.92, 5); g.stroke();
        for (let i = 0; i < 4; i++) g.fillRect(x - s * 0.5, y - s * 0.34 + i * s * 0.22, s * 0.2, 3);
        g.fillRect(x - s * 0.14, y - s * 0.2, s * 0.36, 3); g.fillRect(x - s * 0.14, y - s * 0.06, s * 0.36, 3); g.fillRect(x - s * 0.14, y + s * 0.08, s * 0.24, 3);
        g.restore();
      }
      function cta(T) {
        const k0 = clamp((T - CUE.comment + 0.08) / 0.3); if (k0 <= 0) return;
        const breathe = (ph) => 1 + 0.025 * Math.sin(2 * Math.PI * (T - CUE.end) / 2.2 + ph) * clamp((T - CUE.end) / 0.5);
        // the headline: the biggest type on screen
        const s1 = "Comment ", sz = 100, cvaShown = T < CUE.c ? "" : T < CUE.v ? "C" : T < CUE.a ? "CV" : "CVA";
        const w1 = K.tw(g, s1, sz, false, -2), w2 = K.tw(g, "CVA", sz, false, -2), x0 = 540 - (w1 + w2) / 2, y = 520;
        const p = K.spring(T - CUE.comment + 0.08, 0.55, 13), sc = lerp(0.85, 1, p) * breathe(0);
        g.save(); g.globalAlpha *= clamp(k0 * 2); g.translate(540, y - 36); g.scale(sc, sc); g.translate(-540, -(y - 36));
        K.text(g, s1, x0, y, { size: sz, ls: -2, c: C.ink });
        let px = x0 + w1;
        for (let i = 0; i < cvaShown.length; i++) {
          const ch = cvaShown[i], t = [CUE.c, CUE.v, CUE.a][i], u = T - t, s_ = u < 0.4 ? lerp(1.35, 1, back(clamp(u / 0.25), 2)) : 1;
          const cw = K.tw(g, ch, sz, false, -2);
          g.save(); g.translate(px + cw / 2, y - 36); g.scale(s_, s_); g.translate(-(px + cw / 2), -(y - 36));
          K.text(g, ch, px, y, { size: sz, ls: -2, c: C.blue }); g.restore();
          px += cw;
        }
        g.restore();
        const kd = clamp((T - CUE.and_ + 0.05) / 0.3);
        if (kd > 0) K.text(g, "→ we'll DM you the notebook", 540, 578, { size: 30, mono: true, wt: 700, c: C.steelD, align: "center", a: kd });
        // the comment field: CVA types on the spoken letters, then sends
        const fy = 616, fh = 66, fx = 130, fw = 820, sendT = CUE.and_, ks = clamp((T - sendT) / 0.25);
        g.save(); g.globalAlpha *= clamp(k0 * 2);
        K.rr(g, fx, fy, fw, fh, fh / 2); g.fillStyle = C.white; g.fill(); g.strokeStyle = mix(C.blue, C.steelL, ks); g.lineWidth = 3; g.stroke();
        if (cvaShown && ks < 1) {
          K.text(g, cvaShown, fx + 34, fy + fh / 2 + 12, { size: 34, c: C.ink, a: 1 - ks });
          if (T < sendT && Math.floor(T / 0.4) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(fx + 38 + K.tw(g, cvaShown, 34, false), fy + 16, 3, fh - 32); }
        } else if (!cvaShown || ks >= 1) K.text(g, "Add a comment…", fx + 34, fy + fh / 2 + 10, { size: 28, mono: true, c: C.steel });
        const bx = fx + fw - fh / 2 - 6, by = fy + fh / 2, pr = T > sendT - 0.08 && T < sendT + 0.1 ? 1 - Math.abs(T - sendT) / 0.1 : 0;
        g.save(); g.translate(bx, by); g.scale(1 - 0.1 * pr, 1 - 0.1 * pr);
        g.beginPath(); g.arc(0, 0, fh / 2 - 8, 0, Math.PI * 2); g.fillStyle = cvaShown ? C.blue : C.steelL; g.fill();
        K.plane(g, -2, 2, 30, C.white, 3.5); g.restore();
        const ur = T - sendT;
        if (ur > 0 && ur < 0.5) { g.save(); g.strokeStyle = rgba(C.blue, 0.7 * (1 - ur / 0.5)); g.lineWidth = 4; g.beginPath(); g.arc(bx, by, 26 + 40 * eo(ur / 0.5), 0, Math.PI * 2); g.stroke(); g.restore(); }
        // the sent comment flies up and away
        if (ks > 0 && ks < 1) K.text(g, "CVA", fx + 34, fy + fh / 2 + 12 - 60 * eio(ks), { size: 34, c: C.blue, a: 1 - ks });
        g.restore();
        // the DM: from Desk2Quant (the real logo), the notebook
        const kb = T - CUE.dm + 0.1;
        if (kb > 0) {
          const pb = K.spring(kb, 0.55, 13), bxx = 130, byy = 724, bw = 820, bh = 110;
          g.save(); g.globalAlpha *= clamp(kb / 0.12); g.translate(bxx, byy + bh); g.scale(lerp(0.6, 1, pb), lerp(0.6, 1, pb)); g.translate(-bxx, -(byy + bh));
          const lg = K.pic("logo", 56);
          g.save(); g.beginPath(); g.arc(bxx + 28, byy + bh - 28, 28, 0, Math.PI * 2); g.fillStyle = C.white; g.fill(); g.restore();
          if (lg) g.drawImage(lg, bxx, byy + bh - 56, 56, 56);
          K.bubble(g, bxx + 76, byy, bw - 76, bh, { fill: C.blue, shadow: "rgba(37,99,235,0.3)", r: 30 });
          g.save(); K.rr(g, bxx + 100, byy + 20, 70, 70, 14); g.fillStyle = "rgba(255,255,255,0.18)"; g.fill(); g.restore();
          notebookIcon(bxx + 135, byy + 55 + 2 * Math.sin(2 * Math.PI * (T - CUE.dm) / 1.8), 46);
          K.text(g, "cva_day12.ipynb", bxx + 192, byy + 50, { size: 30, mono: true, wt: 700, c: C.white });
          K.text(g, "here's your notebook", bxx + 192, byy + 86, { size: 24, mono: true, c: "rgba(255,255,255,0.88)" });
          g.restore();
        }
        // Day 13 tomorrow
        const k13 = clamp((T - CUE.notebook - 0.34) / 0.35);
        if (k13 > 0) K.text(g, "Day 13 tomorrow →", 540, 908 + 10 * (1 - eo(k13)), { size: 26, mono: true, wt: 700, ls: 1, c: C.steelD, align: "center", a: k13 });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, null);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        const out = 1 - eio(clamp((T - CUE.comment + 0.15) / 0.3));
        g.save(); g.translate(0, -40 * (1 - out)); recap(T, out); g.restore();
        cta(T);
        g.restore();
      }
