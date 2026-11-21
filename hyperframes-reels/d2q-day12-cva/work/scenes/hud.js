      // ---- hud: the frame around the lesson, complete from frame 1 and never jumping. Top: the brand pill (the real logo +
      // DESK2QUANT) centred at y 132; the tag row at y 194 (MAKING QUANT EASY · DAY 12/30 left, desk2quant.com right); the
      // 30-day strip (days 1-11 ink, 12 brand blue with a soft pulse, 13-30 outlined); the title "CVA in 16 lines" ("CVA" in
      // brand blue) and its subtitle. Between the cards: the section row (where we are, left, in brand blue with a bullet;
      // the agenda simulate › exposure › default › CVA right: done steps ink, the current one blue and underlined, the rest
      // steel). Bottom: the disclaimer footer.
      const g = document.getElementById("hud-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, mix, rgba } = K;
      const st = { t: 0 };
      function init() { K.load({ logo: "assets/logo.png" }, "hud-images", () => draw()); }
      const STEPS = ["simulate", "exposure", "default", "CVA"];
      function pill() {
        const cy = 132, h = 62, lgS = 42, s1 = "DESK2QUANT", w1 = K.tw(g, s1, 28, false, 3);
        const w = 22 + lgS + 16 + w1 + 30, x = 540 - w / 2;
        K.card(g, x, cy - h / 2, w, h, { r: h / 2, shadow: "rgba(52,40,14,0.16)", blur: 22, dy: 6 });
        const lg = K.pic("logo", lgS);
        if (lg) g.drawImage(lg, x + 22, cy - lgS / 2, lgS, lgS);
        K.text(g, s1, x + 22 + lgS + 16, cy + 10, { size: 28, ls: 3 });
      }
      function tagRow() {
        K.text(g, "MAKING QUANT EASY · DAY 12/30", 60, 202, { size: 24, mono: true, wt: 700, c: C.ink });
        K.text(g, "desk2quant.com", 1020, 202, { size: 24, mono: true, c: C.steelD, align: "right" });
      }
      function title() {
        const a = "CVA", b = " in " + CODE.length + " lines", wa = K.tw(g, a, 62, false, -1), wb = K.tw(g, b, 62, false, -1), x = 540 - (wa + wb) / 2;
        K.text(g, a, x, 326, { size: 62, ls: -1, c: C.blue });
        K.text(g, b, x + wa, 326, { size: 62, ls: -1, c: C.ink });
        K.text(g, "What a client's default costs the bank", 540, 362, { size: 24, mono: true, c: C.steelD, align: "center" });
      }
      // ---- the section row (y 1000-1044)
      const secAt = (t) => { let k = 0; for (let i = 0; i < SECT.length; i++) if (t >= SECT[i][0]) k = i; return k; };
      function label(s, cy, a) {
        if (a <= 0) return;
        g.save(); g.globalAlpha *= a;
        g.beginPath(); g.arc(70, cy, 7, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
        K.text(g, s, 88, cy + 10, { size: 28, mono: true, wt: 700, c: C.blue });
        g.restore();
      }
      const stepCol = (i, cur, done) => (i === cur ? C.blue : i < done ? C.ink : C.steel);
      function section(t) {
        const k = secAt(t), [t0, lab, cur, done] = SECT[k], P = k > 0 ? SECT[k - 1] : SECT[k];
        const u = k > 0 ? clamp((t - t0) / 0.3) : 1, q = eio(u), cy = 1022;
        g.save(); g.beginPath(); g.rect(40, 994, 600, 56); g.clip();
        if (P[1] !== lab && u < 1) { const q1 = clamp(q * 2), q2 = clamp(q * 2 - 1); label(P[1], cy - 24 * q1, 1 - q1); label(lab, cy + 24 * (1 - q2), q2); }
        else label(lab, cy, 1);
        g.restore();
        // the agenda, right-aligned at x 1020
        const sz = 22, sep = " › ", wSep = K.tw(g, sep, sz, true), ws = STEPS.map((s) => K.tw(g, s, sz, true, 0, 700));
        let x = 1020 - (ws.reduce((p, v) => p + v, 0) + wSep * (STEPS.length - 1));
        STEPS.forEach((s, i) => {
          const c0 = stepCol(i, P[2], P[3]), c1 = stepCol(i, cur, done), col = mix(c0, c1, q);
          K.text(g, s, x, cy + 8, { size: sz, mono: true, wt: 700, c: col });
          const ul0 = i === P[2] ? 1 : 0, ul1 = i === cur ? 1 : 0, ul = lerp(ul0, ul1, q);
          if (ul > 0.01) { g.save(); g.fillStyle = C.blue; g.fillRect(x, cy + 15, ws[i] * ul, 3); g.restore(); }
          x += ws[i];
          if (i < STEPS.length - 1) { K.text(g, sep, x, cy + 8, { size: sz, mono: true, c: C.steel }); x += wSep; }
        });
      }
      function footer() {
        K.text(g, "simulated rates · illustrative inputs · education only · not financial advice", 540, 1668,
          { size: 19, mono: true, ls: -0.6, c: C.steelD, align: "center" });
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        pill();
        tagRow();
        K.strip(g, 60, 1020, 222, 18, 12, 1, t, { gap: 6, r: 5, glow: 10, ringR: 7 });
        title();
        section(t);
        footer();
      }
