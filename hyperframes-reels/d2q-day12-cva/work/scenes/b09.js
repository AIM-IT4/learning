      // ---- b09, the answer (vo 89.96-95.70): "C V A: about sixty-five thousand dollars, or one point four basis points a year
      // on the swap rate." "CVA" spells out letter by letter; the big $64,563 lands (D2QSans ~150 px) and a yellow
      // highlighter sweeps under it on "sixty-five thousand"; "≈ $65k on a $100m 5-year swap" under it; on "one point four"
      // a chip "≈ 1.4 bp a year on the swap rate" and a small steel "(6.5 bp of notional upfront)". The code card shows
      // lines 13-16 active, the rest at ~40 %, and the console prints cva() again (code layer).
      const g = document.getElementById("b09-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const BIG = K.money(NUM.cva_usd), K65 = "$" + Math.round(NUM.cva_usd / 1000) + "k";
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        // "CVA" letter by letter
        const s3 = T < CUE.v ? "C" : T < CUE.a ? "CV" : "CVA";
        K.text(g, s3, 540, 486, { size: 30, mono: true, wt: 700, ls: 8, c: C.blue, align: "center", a: clamp((T - CUE.c + 0.05) / 0.12) });
        // the big number: lands with a spring; the highlighter sweeps under it on "sixty-five thousand"
        const u = T - (T0 + 0.1), y = 660;
        if (u > 0) {
          const p = K.spring(u, 0.5, 13), sc = lerp(1.25, 1, p), w = K.tw(g, BIG, 150, false, -4);
          K.highlight(g, 540 - w / 2 - 14, y - 58, w + 28, 54, clamp((T - CUE.sixtyfive + 0.05) / 0.55), C.yel);
          g.save(); g.globalAlpha *= clamp(u / 0.1); g.translate(540, y - 50); g.scale(sc, sc); g.translate(-540, -(y - 50));
          K.text(g, BIG, 540, y, { size: 150, ls: -4, c: C.ink, align: "center" });
          // a soft shine across the digits near the end of the line
          const sh = clamp((T - CUE.year) / 0.7);
          if (sh > 0 && sh < 1) {
            g.save(); g.globalCompositeOperation = "source-atop";
            const sx = lerp(540 - w / 2 - 120, 540 + w / 2 + 40, eio(sh)), gr = g.createLinearGradient(sx, 0, sx + 120, 0);
            gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = gr; g.fillRect(sx, y - 130, 120, 150); g.restore();
          }
          g.restore();
        }
        const ks = clamp((T - CUE.thousand + 0.05) / 0.3);
        if (ks > 0) K.text(g, "≈ " + K65 + " on a $" + NUM.N + "m " + NUM.T + "-year swap", 540, 722 + 8 * (1 - eo(ks)), { size: 28, mono: true, c: C.steelD, align: "center", a: ks });
        const kc = clamp((T - CUE.one + 0.04) / 0.3);
        if (kc > 0) {
          const pulse = T > CUE.rate ? 1 + 0.04 * Math.sin(Math.min(T - CUE.rate, 0.5) * 2 * Math.PI) * Math.exp(-(T - CUE.rate) * 3) : 1;
          g.save(); g.translate(540, 806); g.scale(pulse, pulse); g.translate(-540, -806);
          K.tag(g, "≈ " + NUM.running_bp.toFixed(1) + " bp a year on the swap rate", 540, 806, { k: kc, size: 28, h: 58, padX: 22, align: "center" });
          g.restore();
        }
        const kn = clamp((T - CUE.points + 0.05) / 0.3);
        if (kn > 0) K.text(g, "(" + NUM.cva_bp.toFixed(1) + " bp of notional upfront)", 540, 878, { size: 22, mono: true, c: C.steel, align: "center", a: kn });
        g.restore();
      }
