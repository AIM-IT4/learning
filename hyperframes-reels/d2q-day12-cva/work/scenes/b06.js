      // ---- b06, exposure (vo 51.25-64.46): "Exposure keeps only what the client owes us, because that's what we lose if
      // they default. Average it over the paths, and you get the expected exposure. It peaks at about one point seven
      // million, twenty months in." It opens on b05's last picture (the 40 shown swap-value paths, negative parts red,
      // positive parts blue). On "keeps only" the negative parts collapse onto zero (the code types lines 9-10); on
      // "because" a label "lost if they default" points at the positive area; on "Average" the paths dim to ~15 %, the
      // y-axis eases to 0-2.0 ($m) and the bold blue EE curve draws left to right ("expected exposure EE(t)"); on "peaks" a
      // dot lands on the peak with a dashed drop line at 20 months and "$1.74m at 20 months" (the console prints it).
      const g = document.getElementById("b06-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const XS = [0].concat(NUM.t), EE = [0].concat(NUM.ee);
      const PK = NUM.ee.indexOf(Math.max(...NUM.ee)), PT = NUM.t[PK], PV = NUM.ee[PK], MONTHS = Math.round(NUM.ee_peak_t * 12);
      const PEAK = "$" + NUM.ee_peak_m.toFixed(2) + "m at " + MONTHS + " months";
      function chart(T) {
        const c0 = eio(clamp((T - CUE.keeps + 0.02) / 1.0));
        const dim = eio(clamp((T - CUE.average) / 0.5)), q = eio(clamp((T - CUE.average - 0.45) / 0.9));
        const Fr = K.simChart(g, NUM, { m: 1, neg: 1, pos: 1, c0, dim, q });
        // "max(v, 0)" on the zero line as the negatives finish collapsing (line 10 types it)
        const km = clamp((T - CUE.keeps - 1.0) / 0.3) * (1 - clamp((T - CUE.average) / 0.3));
        if (km > 0) K.tag(g, "max(v, 0)", 940, Fr.Y(0) + 34, { k: km, size: 20, h: 38, align: "right", fill: C.ink });
        // a soft blue wash sweeps the positive area while "what we lose if they default" is said
        const kw = clamp((T - CUE.because - 0.45) / 1.6);
        if (kw > 0 && kw < 1) {
          const sx = lerp(Fr.x - 140, Fr.x + Fr.w, eio(kw)), gr = g.createLinearGradient(sx, 0, sx + 140, 0);
          gr.addColorStop(0, rgba(C.blue, 0)); gr.addColorStop(0.5, rgba(C.blue, 0.16)); gr.addColorStop(1, rgba(C.blue, 0));
          g.save(); g.beginPath(); g.rect(Fr.x, Fr.y, Fr.w, Fr.Y(0) - Fr.y); g.clip(); g.fillStyle = gr; g.fillRect(sx, Fr.y, 140, Fr.Y(0) - Fr.y); g.restore();
        }
        // "lost if they default" by the positive area
        const kl = clamp((T - CUE.because + 0.05) / 0.3) * (1 - clamp((T - CUE.average) / 0.3));
        if (kl > 0) {
          const ax = Fr.X(2.6), ay = Fr.Y(4.2), cx = 600, cy = 520;
          g.save(); g.globalAlpha *= clamp(kl * 3); g.strokeStyle = C.blue; g.lineWidth = 2.5; g.lineCap = "round";
          g.beginPath(); g.moveTo(cx + 10, cy + 20); g.lineTo(ax, ay); g.stroke();
          g.beginPath(); g.arc(ax, ay, 5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); g.restore();
          K.tag(g, "lost if they default", cx - 10, cy, { k: kl, size: 24, h: 46 });
        }
        // the expected exposure: area + bold curve, drawn left to right
        const kE = clamp((T - CUE.you + 0.1) / 1.0);
        if (kE > 0) {
          K.area(g, Fr, XS, EE, { k: kE, c: C.blue, fa: 0.22, grad: true });
          K.line(g, Fr, XS, EE, { k: kE, c: C.blue, w: 5, head: true });
        }
        const kx = clamp((T - CUE.expected + 0.05) / 0.3);
        if (kx > 0) {
          const t3 = 2.75, i3 = XS.findIndex((x) => x >= t3);
          K.text(g, "expected exposure EE(t)", Fr.X(XS[i3]) + 14, Fr.Y(EE[i3]) - 26 + 8 * (1 - eo(kx)), { size: 24, mono: true, wt: 700, c: C.blue, a: kx });
        }
        // the peak: a dot, a dashed drop line at 20 months, the label
        const up = T - CUE.peakdot;
        if (up > -0.02) {
          const px = Fr.X(PT), py = Fr.Y(PV), kd = eio(clamp((up - 0.15) / 0.35));
          if (kd > 0) {
            g.save(); g.setLineDash([7, 7]); g.strokeStyle = rgba(C.ink, 0.6); g.lineWidth = 2;
            g.beginPath(); g.moveTo(px, py); g.lineTo(px, lerp(py, Fr.Y(0), kd)); g.stroke(); g.restore();
          }
          const ut = T - CUE.twenty;
          if (ut > 0 && ut < 0.7) { g.save(); g.strokeStyle = rgba(C.blue, 0.7 * (1 - ut / 0.7)); g.lineWidth = 3; g.beginPath(); g.arc(px, Fr.Y(0), 6 + 26 * eo(ut / 0.7), 0, Math.PI * 2); g.stroke(); g.restore(); }
          if (kd > 0.99) { g.beginPath(); g.arc(px, Fr.Y(0), 5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); }
          K.dot(g, px, py, { r: 10, c: C.blue, s: back(clamp(up / 0.3), 2.2), pulse: up > 0.3 ? ((up - 0.3) % 1.4) / 1.4 : 0 });
          const kp = clamp((T - CUE.one + 0.06) / 0.3);
          if (kp > 0) {
            const pop = ut > 0 ? 1 + 0.06 * Math.exp(-ut * 8) * Math.sin(Math.min(ut, 0.5) * 18) : 1;
            g.save(); g.translate(px + 30, py - 38); g.scale(pop, pop); g.translate(-(px + 30), -(py - 38));
            K.tag(g, PEAK, px + 30, py - 38, { k: kp, size: 26, h: 50, padX: 18 }); g.restore();
          }
        }
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, null, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        chart(T);
        g.restore();
      }
