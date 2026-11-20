      // ---- c2, the pack: "This is the Market Risk Quant Notes and Lab. 141 pages, 19 modules, 64 interview answers."
      // The reveal: c2 carries c1's picture on (K.hook) for half a second: the lock opens, the blur clears and the answer
      // reads (the real cover thumbnail, "Market Risk Quant Notes & Lab · 141 pages"); then the cover springs out of the
      // answer bubble into the hero, big, with a soft shadow, while the chat and the histogram lift away and fade. Three counter
      // chips wait under it and roll on their numbers (141 PAGES, 19 MODULES, 64 INTERVIEW Q&As); on "modules" the real
      // contents page (page-2) slides in behind the cover as proof, and on "answers" a red frame rings its "Interview
      // drill: 64 questions" row.
      // words (global): 14 This 15 is 16 the 17 Market 18 Risk 19 Quant 20 Notes 21 and 22 Lab. 23 141 24 pages, 25 19
      //   26 modules, 27 64 28 interview 29 answers.
      const g = document.getElementById("c2-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ cover: "assets/img/cover.jpg", p2: "assets/img/page-2.jpg" }, "c2-images", () => draw()); }
      const HB = K.hookBeats(WA);
      // beats
      const tOpen = 0.02, tClear = 0.12, tOut = 0.56, tFly = 0.6, FLY = 0.55, tGlint = w(22) - 0.1, tChips = 0.66;
      const tPage = w(26) - 0.06, tRing = w(29) - 0.04, tTagN = w(20) - 0.04, tTagL = w(22) - 0.04;
      const CNT = [
        { v: FACTS.pages, lab: "PAGES", t0: w(23) - 0.02, t1: WE[23] - T0 - 0.06, tl: w(24) - 0.03, icon: "page" },
        { v: FACTS.modules, lab: "MODULES", t0: w(25) - 0.02, t1: WE[25] - T0 - 0.02, tl: w(26) - 0.03, icon: "grid" },
        { v: FACTS.qa, lab: "INTERVIEW Q&As", t0: w(27) - 0.02, t1: WE[27] - T0, tl: w(28) - 0.03, icon: "chat" },
      ];
      // the cover's rest poses: big and centred, then (with the contents page) smaller on the right
      const CA = { x: 540, y: 648, s: 650 }, CB = { x: 752, y: 640, s: 548 };
      function coverRect(t) {
        const th = K.HK.thumb, bobY = K.bob(T0 + t, 0.2, 3);
        const from = { x: th.x + th.s / 2, y: th.y + th.s / 2 + bobY, s: th.s };
        const u = t - tFly; if (u <= 0) return null;
        const p = K.spring(u, 0.55, 11), q = eio(clamp((t - tPage) / 0.5));
        const to = { x: lerp(CA.x, CB.x, q), y: lerp(CA.y, CB.y, q) + K.bob(T0 + t, 2.2, 4), s: lerp(CA.s, CB.s, q) };
        const arc = -40 * Math.sin(Math.PI * clamp(u / FLY));
        return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) + arc, s: lerp(from.s, to.s, p),
          rot: lerp(0.0, -0.028, clamp(p)) + 0.05 * Math.sin(Math.PI * clamp(u / FLY)) + 0.012 * Math.sin((T0 + t) * 1.7) * clamp(u - 0.6),
          sh: clamp(u / 0.4) };
      }
      function drawCover(t, R, out) {
        g.save(); K.apply(g, R.x, R.y, out);
        g.translate(R.x, R.y); g.rotate(R.rot);
        const s = R.s, x = -s / 2, y = -s / 2, cv = K.pic("cover", 660);
        g.save(); g.shadowColor = `rgba(40,32,12,${0.32 * R.sh})`; g.shadowBlur = 60 * R.sh; g.shadowOffsetY = 34 * R.sh;
        K.rr(g, x, y, s, s, 22); g.fillStyle = C.white; g.fill(); g.restore();
        if (cv) { g.save(); K.rr(g, x, y, s, s, 22); g.clip(); g.drawImage(cv, x, y, s, s);
          // a glint across the cover on "Lab"
          const gp = (t - tGlint) / 0.6;
          if (gp > 0 && gp < 1) { const gx = lerp(x - s * 0.4, x + s * 1.4, gp);
            const gr = g.createLinearGradient(gx - 90, y, gx + 90, y + s * 0.3); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = gr; g.fillRect(x, y, s, s); }
          g.restore(); }
        K.rr(g, x, y, s, s, 22); g.strokeStyle = "rgba(13,21,38,0.16)"; g.lineWidth = 2; g.stroke();
        // the tags (facts: the notes PDF; 3 real-data projects in the lab)
        const k1 = clamp((t - tTagN) / 0.3), k2 = clamp((t - tTagL) / 0.3);
        // (they straddle the cover's bottom edge, clear of its title)
        if (k1 > 0) K.chip(g, "NOTES · PDF", x - 14, y + s + 2, { k: k1, size: 26, mono: true, fill: C.ink, col: C.white, stroke: "rgba(0,0,0,0)", h: 50, padX: 18, rot: -0.03, shadow: "rgba(13,21,38,0.3)" });
        if (k2 > 0) K.chip(g, "LAB · " + FACTS.projects + " PROJECTS", x + s + 14, y + s + 2, { k: k2, size: 26, mono: true, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 50, padX: 18, rot: 0.03, shadow: "rgba(224,49,49,0.35)" });
        g.restore();
      }
      function page(t, out) {
        const u = t - tPage; if (u <= 0) return;
        const P = K.combine(K.enter(u, { dx: -420, dy: 40, yaw: 0.4, pitch: 0.05, rot: -0.08, sc: 0.9 }), out);
        const pw = 560, x = 40, y = 300, s = pw / 909;
        g.save(); K.apply(g, x + pw / 2, y + 400, P); g.translate(x + pw / 2, y + 400); g.rotate(-0.035); g.translate(-(x + pw / 2), -(y + 400));
        const ph = K.photo(g, "p2", x, y, pw, { r: 10, blur: 44, dy: 22, res: pw });
        // "18 Interview drill · 64 questions with desk-grade answers": a red frame on "answers"
        const kr = clamp((t - tRing) / 0.35);
        if (kr > 0 && ph) {
          g.save(); g.strokeStyle = C.red; g.lineWidth = 5; g.lineCap = "round";
          K.rr(g, x + 58 * s, y + 838 * s, 430 * s * eo(kr), 40 * s, 10); g.stroke(); g.restore();
          K.chip(g, FACTS.qa + " Q&As", x + 488 * s + 8, y + 858 * s, { k: kr, size: 22, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 40, padX: 12, shadow: "rgba(224,49,49,0.35)" });
        }
        K.chip(g, "CONTENTS · " + FACTS.page_contents, x + 22, y + 26, { k: clamp(u / 0.4), size: 24, mono: true, fill: C.ink, col: C.white, stroke: "rgba(0,0,0,0)", h: 44, padX: 16 });
        g.restore();
      }
      function icon(kind, x, y, col) {
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
        if (kind === "page") { K.rr(g, x - 14, y - 18, 28, 36, 4); g.stroke(); g.beginPath(); g.moveTo(x - 7, y - 6); g.lineTo(x + 7, y - 6); g.moveTo(x - 7, y + 2); g.lineTo(x + 7, y + 2); g.moveTo(x - 7, y + 10); g.lineTo(x + 3, y + 10); g.stroke(); }
        else if (kind === "grid") { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { K.rr(g, x - 16 + i * 18, y - 16 + j * 18, 14, 14, 3); g.fill(); } }
        else { K.rr(g, x - 18, y - 15, 36, 24, 7); g.stroke(); g.beginPath(); g.moveTo(x - 8, y + 9); g.lineTo(x - 12, y + 18); g.lineTo(x + 2, y + 9); g.stroke(); }
        g.restore();
      }
      function chips(t, out) {
        const Y = 1104, H = 226, cw = 316, gap = 26;
        CNT.forEach((c, i) => {
          const x = 40 + i * (cw + gap), u = t - (tChips + 0.07 * i); if (u <= 0) return;
          const P = K.combine(K.combine(K.enter(u, { dy: 120, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.9 }), { dx: 0, dy: K.bob(T0 + t, i * 1.7, 2.5), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 }), out);
          const on = clamp((t - c.t0) / 0.2), pop = 1 + 0.08 * Math.sin(Math.PI * clamp((t - c.t1) / 0.28)) * (t > c.t1 ? 1 : 0);
          g.save(); K.apply(g, x + cw / 2, Y + H / 2, P);
          g.translate(x + cw / 2, Y + H / 2); g.scale(pop, pop); g.translate(-(x + cw / 2), -(Y + H / 2));
          K.card(g, x, Y, cw, H, { r: 28, blur: 34, dy: 16, stroke: on > 0.5 ? rgba(C.red, 0.55) : undefined });
          g.save(); K.rr(g, x, Y, cw, H, 28); g.clip(); g.fillStyle = mix("#dfe4eb", C.red, on); g.fillRect(x, Y, cw, 10); g.restore();
          const v = c.v * eio(clamp((t - c.t0) / (c.t1 - c.t0)));
          if (t < c.t0) K.text(g, "–", x + 34, Y + 134, { size: 112, c: "#c3cad6" });
          else K.odometer(g, v, String(c.v).length, x + 30, Y + 140, 112, C.ink, 1);
          icon(c.icon, x + cw - 44, Y + 52, on > 0.5 ? C.red : "#b3bcc9");
          const kl = clamp((t - c.tl) / 0.25);
          K.text(g, c.lab, x + 32, Y + 192, { size: 25, mono: true, ls: 2, c: mix("#9aa4b2", C.ink, kl), maxW: cw - 60 });
          g.restore();
        });
      }
      function draw() {
        const t = st.t, T = T0 + t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -60, dur: 0.2, sc: 0.95 }) : K.still;
        // the hook, carried over from c1: the lock opens, the blur clears, then the cards drop away
        if (t < tOut + 0.5) {
          const bob = (ph) => ({ dx: 0, dy: K.bob(T, ph, 3), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
          // they lift away and fade (upward, so they never pass over the subtitle)
          const lift = (d, dy) => (t > tOut + d ? K.leave(t - tOut - d, { dy, dur: 0.3, pitch: 0.2, sc: 0.92, rot: -0.02 }) : K.still);
          K.hook(g, T, Object.assign({}, HB, { P: K.combine(bob(0.2), lift(0.04, -70)), PH: K.combine(bob(1.2), lift(-0.04, -50)),
            PP: K.combine(bob(0.2), lift(-0.1, -40)),
            blur: 11 * (1 - eio(clamp((t - tClear) / 0.32))), lockOpen: eo(clamp((t - tOpen) / 0.26)),
            lockA: 1 - clamp((t - 0.22) / 0.14), thumbA: t < tFly ? 1 : 0, pillA: 1 - clamp((t - 0.3) / 0.16) }));
        }
        page(t, out);
        chips(t, out);
        const R = coverRect(t);
        if (R) drawCover(t, R, out);
        K.floor(g);
      }
