      // ---- bg: warm paper with a faint grid, soft light behind the hero, a faint accent-red glow top right and a pale
      // yellow one bottom left; the brand-blue colour block (c7, the offer) rises from the bottom in 0.2 s. The bottom ~17%
      // (under the subtitle, where Instagram's caption and buttons sit) carries only soft decoration: the grid and a faint
      // giant chapter number that rises in with each chapter.
      const g = document.getElementById("bg-cv").getContext("2d");
      const { C, clamp, eo, eio } = K;
      const st = { t: 0 };
      const isB = (k) => THEME[k] === "B";
      function ground(blue, y0, y1, t) {
        if (y1 <= y0) return;
        g.save(); g.beginPath(); g.rect(0, y0, 1080, y1 - y0); g.clip();
        g.fillStyle = blue ? C.blue : C.paper; g.fillRect(0, 0, 1080, 1920);
        let rg = g.createRadialGradient(540, 920, 60, 540, 920, 1000);
        rg.addColorStop(0, blue ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.62)"); rg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        if (!blue) {
          rg = g.createRadialGradient(1080, 90, 20, 1080, 90, 640); rg.addColorStop(0, "rgba(224,49,49,0.11)"); rg.addColorStop(1, "rgba(224,49,49,0)");
          g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
          rg = g.createRadialGradient(0, 1860, 20, 0, 1860, 760); rg.addColorStop(0, "rgba(255,212,59,0.17)"); rg.addColorStop(1, "rgba(255,212,59,0)");
          g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        } else {
          rg = g.createRadialGradient(1080, 90, 20, 1080, 90, 700); rg.addColorStop(0, "rgba(120,170,255,0.35)"); rg.addColorStop(1, "rgba(120,170,255,0)");
          g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        }
        // the grid drifts up very slowly
        const off = (t * 5) % 54;
        g.strokeStyle = blue ? "rgba(255,255,255,0.09)" : "rgba(13,21,38,0.058)"; g.lineWidth = 1.5; g.beginPath();
        for (let x = 18; x < 1080; x += 54) { g.moveTo(x, y0); g.lineTo(x, y1); }
        for (let y = 12 - off; y < 1974; y += 54) if (y >= y0 - 2 && y <= y1 + 2) { g.moveTo(0, y); g.lineTo(1080, y); }
        g.stroke();
        g.restore();
      }
      // the giant chapter number in the bottom zone: rises in with its chapter, the old one sinks away
      function bigNum(t) {
        const k = K.beatAt(t, B);
        for (const j of [k - 1, k]) {
          if (j < 0) continue;
          let dy = 0, a = 1;
          if (j === k) { const q = j === 0 ? 1 : eo(clamp((t - B[j]) / 0.55)); dy = 150 * (1 - q); a = q; }
          else { const q = eio(clamp((t - B[k]) / 0.35)); dy = 130 * q; a = 1 - q; }
          if (a <= 0) continue;
          g.save(); g.globalAlpha = a;
          K.text(g, String(j + 1).padStart(2, "0"), 540, 2072 + dy, { size: 560, align: "center", ls: -26, c: isB(k) ? "rgba(255,255,255,0.10)" : "rgba(13,21,38,0.05)" });
          g.restore();
        }
      }
      function draw() {
        const t = st.t, k = K.beatAt(t, B), u = clamp((t - B[k]) / 0.2), f = eo(u);
        g.setTransform(1, 0, 0, 1, 0, 0);
        const cur = isB(k), prev = k > 0 ? isB(k - 1) : cur;
        if (cur !== prev && u < 1) {               // the new ground rises from the bottom
          const yb = 1920 * (1 - f);
          ground(prev, 0, Math.ceil(yb), t); ground(cur, Math.floor(yb), 1920, t);
        } else ground(cur, 0, 1920, t);
        bigNum(t);
      }
