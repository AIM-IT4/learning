      // ---- b01, the hook (vo 0.00-13.50): "In the 2008 crisis, two-thirds of banks' counterparty losses weren't defaults.
      // They were C V A: the price of default risk, going up. By the end of this video, you'll price it in sixteen lines of
      // Python." Frame 1 is complete: the heading, one wide bar split 2/3 | 1/3 (outlined grey) and the source line. On
      // "two-thirds" the left 2/3 fills brand blue with a big white 2/3; on "weren't defaults" the right 1/3 fills red
      // ("1/3 actual defaults") and the blue part shows "?"; on "C V A" the "?" becomes CVA, letter by letter as spoken; on
      // "the price of default risk, going up" its sub-label lands word by word under the blue part, with a small rising
      // spread sparkline (illustrative). On "By the end of this video" the card cross-fades to the finished result: the EE
      // hump (simulated) and the big $64,563, "CVA of a 5-year swap". The code card brightens on "sixteen" (code layer).
      // b02's series card covers all this at ~vo 13.3.
      const g = document.getElementById("b01-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba, CC } = K;
      const st = { t: 0 };
      const SRC = FACTS.bcbs_2011.on_screen_source_line;
      // the claim says "two-thirds" ... "one-third": shown as 2/3 and 1/3
      const TWO = /two-thirds/.test(FACTS.bcbs_2011.claim) ? "2/3" : "?", ONE = /one-third/.test(FACTS.bcbs_2011.claim) ? "1/3" : "?";
      const BX = 100, BY = 584, BW = 880, BH = 200, SPLIT = BX + BW * 2 / 3, GAP = 5;
      const L = [BX, SPLIT - GAP], R = [SPLIT + GAP, BX + BW];
      function seg(x0, x1, k, col, T) {
        const w = x1 - x0;
        K.rr(g, x0, BY, w, BH, 16); g.fillStyle = "#f7f6f2"; g.fill();
        g.strokeStyle = rgba(C.steel, 0.9); g.lineWidth = 2.5; g.stroke();
        if (k > 0) { g.save(); K.rr(g, x0, BY, w, BH, 16); g.clip(); g.fillStyle = col; g.fillRect(x0, BY, w * k, BH); g.restore(); }
      }
      function lesson(T) {
        K.text(g, "Counterparty credit losses in the 2008 crisis", BX, 446, { size: 36, ls: -0.5, maxW: BW });
        const kL = eo(clamp((T - CUE.two) / 0.45)), kR = eo(clamp((T - CUE.werent) / 0.4));
        seg(L[0], L[1], kL, C.blue, T); seg(R[0], R[1], kR, C.red, T);
        // frame 1 reads as a question: a faint "?" in each outlined part, gone as the part fills
        [[L, kL], [R, kR]].forEach(([S, k]) => {
          if (k >= 1) return;
          K.text(g, "?", (S[0] + S[1]) / 2, BY + BH / 2 + 34, { size: 96, align: "center", c: C.steel, a: 0.55 * (1 - clamp(k * 2.5)) });
        });
        // a light sweep across the empty bar before "two-thirds"
        const sw = clamp((T - 0.3) / 1.5);
        if (sw > 0 && sw < 1 && kL === 0) {
          g.save(); K.rr(g, BX, BY, BW, BH, 16); g.clip();
          const sx = lerp(BX - 160, BX + BW + 60, eio(sw)), gr = g.createLinearGradient(sx, 0, sx + 160, 0);
          gr.addColorStop(0, rgba(C.blue, 0)); gr.addColorStop(0.5, rgba(C.blue, 0.1)); gr.addColorStop(1, rgba(C.blue, 0));
          g.fillStyle = gr; g.fillRect(sx, BY, 160, BH); g.restore();
        }
        // 2/3 in the blue part
        const u2 = T - CUE.two - 0.12;
        if (u2 > 0) {
          const p = K.spring(u2, 0.55, 14);
          g.save(); g.globalAlpha *= clamp(u2 / 0.12); g.translate(BX + 34, BY + BH / 2); g.scale(lerp(0.7, 1, p), lerp(0.7, 1, p));
          K.text(g, TWO, 0, 44, { size: 124, ls: -3, c: C.white }); g.restore();
        }
        // 1/3 actual defaults in the red part
        const u3 = T - CUE.werent - 0.1;
        if (u3 > 0) {
          const p = K.spring(u3, 0.55, 14), a = clamp(u3 / 0.12);
          g.save(); g.globalAlpha *= a; g.translate(R[0] + 26, BY + BH / 2); g.scale(lerp(0.7, 1, p), lerp(0.7, 1, p));
          K.text(g, ONE, 0, 14, { size: 80, ls: -1, c: C.white });
          K.text(g, "actual defaults", 2, 58, { size: 22, mono: true, wt: 700, c: C.white });
          g.restore();
        }
        // the blue part's "?" chip, turning into CVA letter by letter
        const uq = T - CUE.defaults;
        if (uq > 0) {
          const s = T < CUE.c ? "?" : T < CUE.v ? "C" : T < CUE.a ? "CV" : "CVA";
          const tl = T < CUE.c ? CUE.defaults : T < CUE.v ? CUE.c : T < CUE.a ? CUE.v : CUE.a;
          const prevS = T < CUE.c ? "?" : T < CUE.v ? "?" : T < CUE.a ? "C" : "CV";
          const wOf = (x) => K.tw(g, x, 74, false, -1) + 48, kw = eo(clamp((T - tl) / 0.14));
          const w = lerp(wOf(prevS), wOf(s), kw), h = 108, cx = L[1] - 30 - w / 2, cy = BY + BH / 2;
          const p = K.spring(uq, 0.5, 15), pop = 1 + 0.08 * Math.exp(-(T - tl) * 10) * Math.sin(Math.min(T - tl, 0.5) * 16);
          g.save(); g.globalAlpha *= clamp(uq / 0.1); g.translate(cx, cy); g.scale(lerp(0.6, 1, p) * pop, lerp(0.6, 1, p) * pop);
          g.save(); g.shadowColor = "rgba(8,22,90,0.35)"; g.shadowBlur = 16; g.shadowOffsetY = 6;
          K.rr(g, -w / 2, -h / 2, w, h, 22); g.fillStyle = C.white; g.fill(); g.restore();
          K.text(g, s, 0, 27, { size: 74, ls: -1, c: C.blue, align: "center" });
          g.restore();
        }
        // the sub-label under the blue part, word by word, on a thin bracket
        const kb = eo(clamp((T - CUE.sub[0] + 0.05) / 0.3));
        if (kb > 0) {
          const y = BY + BH + 16;
          g.save(); g.strokeStyle = C.blue; g.lineWidth = 2.5; g.lineCap = "round"; g.beginPath();
          const xm = (L[0] + L[1]) / 2, hw = (L[1] - L[0]) / 2 * kb;
          g.moveTo(xm - hw, y - 8); g.lineTo(xm - hw, y); g.lineTo(xm + hw, y); g.lineTo(xm + hw, y - 8); g.stroke(); g.restore();
        }
        const words = ["the", "price", "of", "default", "risk,", "going", "up"];
        let px = BX;
        words.forEach((wd, i) => {
          const s = wd + " ", ww = K.tw(g, s, 26, true, 0, 700), u = T - CUE.sub[i] + 0.04;
          if (u > 0) K.text(g, wd, px, 842 + 8 * (1 - eo(clamp(u / 0.18))), { size: 26, mono: true, wt: 700, c: C.blue, a: clamp(u / 0.12) });
          px += ww;
        });
        // the rising spread sparkline (illustrative: a made-up shape, no numbers)
        const ks = clamp((T - CUE.sub[5] + 0.1) / Math.max(0.35, Math.min(0.9, CUE.by - CUE.sub[5] - 0.05)));
        if (ks > 0) {
          const fx = 100, fy = 858, fw = 420, fh = 96, n = 44, a = clamp(ks * 4);
          g.save(); g.globalAlpha *= a;
          K.rr(g, fx, fy, fw, fh, 14); g.fillStyle = "#f7f6f2"; g.fill();
          K.text(g, "credit spread", fx + 14, fy + 24, { size: 17, mono: true, c: C.steelD });
          const lw = K.tw(g, "illustrative", 16, true, 0.5) + 20;
          K.rr(g, fx + fw - 10 - lw, fy + 7, lw, 24, 12); g.strokeStyle = rgba(C.steel, 0.9); g.lineWidth = 1.5; g.stroke();
          K.text(g, "illustrative", fx + fw - 10 - lw / 2, fy + 24, { size: 16, mono: true, ls: 0.5, c: C.steelD, align: "center" });
          const pts = [];
          for (let i = 0; i <= n; i++) {
            const u = i / n, base = 0.12 + 0.72 * Math.pow(u, 1.8), wig = 0.05 * Math.sin(i * 1.7) + 0.06 * (K.rnd(i * 3.3 + 1) - 0.5);
            pts.push([fx + 16 + u * (fw - 32), fy + fh - 10 - (fh - 46) * Math.max(0.02, base + wig * (0.4 + u))]);
          }
          const m = Math.max(2, Math.ceil(n * ks));
          g.beginPath(); g.moveTo(pts[0][0], fy + fh - 6); for (let i = 0; i < m; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(pts[m - 1][0], fy + fh - 6); g.closePath();
          g.fillStyle = rgba(C.blue, 0.12); g.fill();
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < m; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.strokeStyle = C.blue; g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
          const e = pts[m - 1]; g.beginPath(); g.arc(e[0], e[1], 5.5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
          g.restore();
        }
        K.text(g, SRC, 980, 968, { size: 18, mono: true, c: C.steelD, align: "right" });
      }
      // the finished result: the big CVA and the EE hump
      const XS = [0].concat(NUM.t), EE = [0].concat(NUM.ee);
      function preview(T) {
        const u = T - CUE.by;
        K.text(g, "the finished result", 100, 434, { size: 20, mono: true, wt: 700, ls: 1, c: C.steelD });
        const lw = K.tw(g, "simulated", 18, true, 0.5) + 22;
        K.rr(g, 980 - lw, 414, lw, 28, 14); g.strokeStyle = rgba(C.steel, 0.9); g.lineWidth = 1.5; g.stroke();
        K.text(g, "simulated", 980 - lw / 2, 434, { size: 18, mono: true, ls: 0.5, c: C.steelD, align: "center" });
        const p = K.spring(u - 0.05, 0.6, 12);
        g.save(); g.globalAlpha *= clamp((u - 0.05) / 0.15); g.translate(0, 30 * (1 - p));
        K.text(g, K.money(NUM.cva_usd), 94, 556, { size: 124, ls: -3, c: C.ink });
        K.text(g, "CVA of a " + NUM.T + "-year swap", 102, 614, { size: 26, mono: true, c: C.steelD });
        g.restore();
        const Fr = K.frame(110, 660, 860, 226, [0, NUM.T], [0, 2.0]), kd = eio(clamp((u - 0.2) / 1.1));
        K.area(g, Fr, XS, EE, { k: kd, c: C.blue, fa: 0.3, grad: true });
        K.line(g, Fr, XS, EE, { k: kd, c: C.blue, w: 4, head: true });
        g.save(); g.strokeStyle = rgba(C.ink, 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(Fr.x, Fr.y + Fr.h); g.lineTo(Fr.x + Fr.w, Fr.y + Fr.h); g.stroke(); g.restore();
        for (let yv = 0; yv <= NUM.T; yv++) K.text(g, String(yv), Fr.X(yv), Fr.y + Fr.h + 30, { size: 18, mono: true, c: C.steelD, align: "center" });
        K.text(g, "years", Fr.x + Fr.w, Fr.y + Fr.h + 56, { size: 18, mono: true, c: C.steelD, align: "right" });
        const kl = clamp((u - 0.9) / 0.3), pk = NUM.ee.indexOf(Math.max(...NUM.ee));
        if (kl > 0) K.text(g, "expected exposure", Fr.X(NUM.t[pk]) + 26, Fr.Y(NUM.ee[pk]) - 14, { size: 20, mono: true, wt: 700, c: C.blue, a: kl });
        if (kd >= 1) K.dot(g, Fr.X(NUM.t[pk]), Fr.Y(NUM.ee[pk]), { r: 7, c: C.blue, pulse: ((u - 1.3) % 1.3) / 1.3 });
        // on "sixteen lines of Python": a tag pointing down at the code card
        const ks = clamp((T - CUE.sixteen + 0.04) / 0.3);
        if (ks > 0) K.tag(g, "↓ in " + CODE.length + " lines of Python", 980, 520 + 3 * Math.sin(2 * Math.PI * (T - CUE.sixteen) / 1.6), { k: ks, size: 22, h: 44, align: "right" });
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = 1 - eio(clamp((T - (T0 + NEXT + 0.1)) / 0.25));
        if (out <= 0) return;
        g.save(); K.inCard(g);
        const A = K.xfade(T, null, CUE.by, { fo: 0.3 }), B = K.xfade(T, CUE.by + 0.05, null, { fi: 0.35 });
        if (A.a > 0) { g.save(); g.globalAlpha = A.a * out; g.translate(0, A.dy); lesson(T); g.restore(); }
        if (B.a > 0) { g.save(); g.globalAlpha = B.a * out; g.translate(0, B.dy); preview(T); g.restore(); }
        g.restore();
      }
