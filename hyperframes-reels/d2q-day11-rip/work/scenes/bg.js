      // ---- bg: warm paper with a faint grid and a soft light behind the hero. The brand-blue colour blocks (s2 the
      // question, s6 "But it did.", s12 the answer) rise from the bottom in 0.2 s and drop away the same way.
      const g = document.getElementById("bg-cv").getContext("2d");
      const { C, clamp, eo } = K;
      const st = { t: 0 };
      const isB = (k) => THEME[k] === "B";
      function ground(blue, y0, y1, t) {
        if (y1 <= y0) return;
        g.save(); g.beginPath(); g.rect(0, y0, 1080, y1 - y0); g.clip();
        g.fillStyle = blue ? C.blue : C.paper; g.fillRect(0, y0, 1080, y1 - y0);
        // the soft light behind the hero
        const rg = g.createRadialGradient(540, 1060, 60, 540, 1060, 900);
        rg.addColorStop(0, blue ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.66)"); rg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = rg; g.fillRect(0, y0, 1080, y1 - y0);
        // the grid drifts up very slowly
        const off = (t * 5) % 54;
        g.strokeStyle = blue ? "rgba(255,255,255,0.09)" : "rgba(13,21,38,0.058)"; g.lineWidth = 1.5; g.beginPath();
        for (let x = 18; x < 1080; x += 54) { g.moveTo(x, y0); g.lineTo(x, y1); }
        for (let y = 12 - off; y < 1974; y += 54) if (y >= y0 - 2 && y <= y1 + 2) { g.moveTo(0, y); g.lineTo(1080, y); }
        g.stroke();
        g.restore();
      }
      function draw() {
        const t = st.t, k = K.beatAt(t, B), u = clamp((t - B[k]) / 0.2), f = eo(u);
        g.setTransform(1, 0, 0, 1, 0, 0);
        const cur = isB(k), prev = k > 0 ? isB(k - 1) : cur;
        if (cur !== prev && u < 1) {               // the new ground rises from the bottom
          const yb = 1920 * (1 - f);
          ground(prev, 0, Math.ceil(yb), t); ground(cur, Math.floor(yb), 1920, t);
        } else ground(cur, 0, 1920, t);
      }
