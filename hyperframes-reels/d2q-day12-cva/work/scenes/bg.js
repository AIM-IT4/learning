      // ---- bg: warm paper with a faint grid that drifts up very slowly, soft light behind the cards, a faint brand-blue
      // glow top right and a pale yellow one bottom left; the chart card's frame (white, long soft shadow, 2 px steelL
      // border), which stays put all film long while the lessons change inside it; and, in the bottom band (y > 1690, under
      // Instagram's caption), only decoration: a very faint giant "12".
      const g = document.getElementById("bg-cv").getContext("2d");
      const { C, CC } = K;
      const st = { t: 0 };
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = C.paper; g.fillRect(0, 0, 1080, 1920);
        let rg = g.createRadialGradient(540, 900, 60, 540, 900, 1050);
        rg.addColorStop(0, "rgba(255,255,255,0.6)"); rg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        rg = g.createRadialGradient(1080, 80, 20, 1080, 80, 640); rg.addColorStop(0, "rgba(37,99,235,0.10)"); rg.addColorStop(1, "rgba(37,99,235,0)");
        g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        rg = g.createRadialGradient(0, 1880, 20, 0, 1880, 760); rg.addColorStop(0, "rgba(255,212,59,0.16)"); rg.addColorStop(1, "rgba(255,212,59,0)");
        g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
        const off = (t * 4) % 54;
        g.strokeStyle = "rgba(13,21,38,0.055)"; g.lineWidth = 1.5; g.beginPath();
        for (let x = 18; x < 1080; x += 54) { g.moveTo(x, 0); g.lineTo(x, 1920); }
        for (let y = 12 - off; y < 1974; y += 54) { g.moveTo(0, y); g.lineTo(1080, y); }
        g.stroke();
        // the faint giant day number (decoration only)
        K.text(g, "12", 540, 2010 + 6 * Math.sin(2 * Math.PI * t / 9), { size: 430, align: "center", ls: -22, c: "rgba(13,21,38,0.045)" });
        // the chart card's frame
        K.card(g, CC.x, CC.y, CC.w, CC.h, { r: CC.r, blur: 46, dy: 22, shadow: "rgba(40,32,12,0.2)", stroke: false });
        K.rr(g, CC.x, CC.y, CC.w, CC.h, CC.r); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
      }
