      // ---- hud: the brand pill at the top (logo mark + "Desk2Quant · DAY 11/30 · MAKING QUANT EASY") and the 5-step
      // progress strip at the bottom (QUESTION · 1987 · FAT TAILS · SIMULATION · ANSWER: the active step brand blue with a
      // pulse, done steps ticked, the track filling towards the next step), with a small desk2quant.com under it.
      const g = document.getElementById("hud-cv").getContext("2d");
      const { C, clamp, lerp, eo, back, mix, rgba } = K;
      const st = { t: 0 };
      function init() { K.load({ logo: "assets/logo.png" }, "hud-images", () => draw()); }
      // when each step starts: the start of its first beat
      const T_STEP = STEPS.map((_, i) => B[STEP.indexOf(i)]);
      const NX = (i) => 140 + i * 200, NY = 1716, SY = 1672, SH = 138;
      function pill(bl) {
        const cy = 80, h = 62, lgS = 42;
        const s1 = "Desk2Quant", s2 = "DAY 11/30", s3 = "MAKING QUANT EASY";
        const w1 = K.tw(g, s1, 29, false, 0), w2 = K.tw(g, s2, 27, false, 1), w3 = K.tw(g, s3, 24, true, 2.5);
        const w = 22 + lgS + 14 + w1 + 36 + w2 + 36 + w3 + 28, x = 540 - w / 2;
        K.card(g, x, cy - h / 2, w, h, { r: h / 2, shadow: bl > 0.5 ? "rgba(8,22,90,0.4)" : "rgba(52,40,14,0.16)", blur: 22, dy: 6 });
        const lg = K.pic("logo", lgS);
        if (lg) g.drawImage(lg, x + 22, cy - lgS / 2, lgS, lgS);
        let tx = x + 22 + lgS + 14;
        K.text(g, s1, tx, cy + 10, { size: 29 }); tx += w1 + 18;
        g.beginPath(); g.arc(tx, cy, 5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); tx += 18;
        K.text(g, s2, tx, cy + 10, { size: 27, ls: 1, c: C.blue }); tx += w2 + 18;
        g.beginPath(); g.arc(tx, cy, 5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); tx += 18;
        K.text(g, s3, tx, cy + 8, { size: 24, mono: true, ls: 2.5, c: rgba(C.ink, 0.62) });
      }
      function strip(t, bl) {
        const s = STEP[K.beatAt(t, B)];
        K.card(g, 40, SY, 1000, SH, { r: 30, shadow: bl > 0.5 ? "rgba(8,22,90,0.4)" : "rgba(52,40,14,0.16)", blur: 30, dy: 12 });
        // the track, and its fill: done steps, then the active step's progress towards the next one
        g.save(); g.lineCap = "round";
        g.beginPath(); g.moveTo(NX(0), NY); g.lineTo(NX(4), NY); g.strokeStyle = rgba(C.ink, 0.1); g.lineWidth = 8; g.stroke();
        const span = s < 4 ? (T_STEP[s + 1] - T_STEP[s]) : (DUR - T_STEP[4]);
        const fr = clamp((t - T_STEP[s]) / span), xf = s < 4 ? lerp(NX(s), NX(s + 1) - 34, fr) : NX(4);
        if (xf > NX(0)) { g.beginPath(); g.moveTo(NX(0), NY); g.lineTo(xf, NY); g.strokeStyle = C.blue; g.lineWidth = 8; g.stroke(); }
        g.restore();
        for (let i = 0; i < 5; i++) {
          const x = NX(i), on = clamp((t - T_STEP[i]) / 0.3), done = i < s, act = i === s;
          if (done) {
            const q = back(clamp((t - T_STEP[i + 1]) / 0.3), 2.6), r = 22 + 4 * (1 - q) * 0;
            g.beginPath(); g.arc(x, NY, 23, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
            g.save(); g.translate(x, NY); g.scale(q, q); K.check(g, 0, 0, 24, C.white, 4.2); g.restore();
          } else if (act) {
            const q = i === 0 ? 1 : back(on, 2.4), r = 25 * q;
            const ph = ((t - T_STEP[i]) % 1.4) / 1.4;
            g.save(); g.strokeStyle = rgba(C.blue, 0.5 * (1 - ph)); g.lineWidth = 4; g.beginPath(); g.arc(x, NY, 26 + 18 * eo(ph), 0, Math.PI * 2); g.stroke(); g.restore();
            g.save(); g.shadowColor = "rgba(37,99,235,0.45)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
            g.beginPath(); g.arc(x, NY, r, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill(); g.restore();
            if (q > 0.5) K.text(g, String(i + 1), x, NY + 9, { size: 26, align: "center", c: C.white });
          } else {
            g.beginPath(); g.arc(x, NY, 21, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
            g.strokeStyle = rgba(C.ink, 0.22); g.lineWidth = 3.5; g.stroke();
            K.text(g, String(i + 1), x, NY + 9, { size: 25, mono: true, align: "center", c: rgba(C.ink, 0.42) });
          }
          const col = act ? C.blue : done ? rgba(C.ink, 0.82) : rgba(C.ink, 0.36);
          K.text(g, STEPS[i], x, SY + SH - 26, { size: 27, align: "center", c: col, ls: 0.5 });
        }
        K.text(g, "desk2quant.com", 540, 1852, { size: 27, mono: true, ls: 2, align: "center", c: bl > 0.5 ? "rgba(255,255,255,0.85)" : rgba(C.ink, 0.55) });
      }
      function draw() {
        const t = st.t, bl = K.blueAt(t, B, THEME);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        pill(bl);
        strip(t, bl);
      }
