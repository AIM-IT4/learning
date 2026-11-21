      // ---- hud: the brand pill top-centre (the real logo + "Desk2Quant · MARKET RISK · MAKING QUANT EASY"); under it, the
      // chapter tag right-aligned ("● BACKTEST · 03/07") with desk2quant.com on the left, and a thin full-width progress
      // line in seven segments that fills chapter by chapter; then the chapter title (bold 66 px, one keyword in the accent
      // red), which stays for its chapter and changes with it. On the brand-blue block the ink turns white and the title's
      // keyword sits in a red pill. Each chapter's tag and title land on its first word (the chapter starts 0.16 s before it).
      const g = document.getElementById("hud-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      function init() { K.load({ logo: "assets/logo.png" }, "hud-images", () => draw()); }
      const N = CH.length, LY = 234, TY = 194, TB = 330, TFS = 66;
      function pill(bl) {
        const cy = 132, h = 62, lgS = 42;
        const s1 = "Desk2Quant", s2 = "MARKET RISK", s3 = "MAKING QUANT EASY";
        const w1 = K.tw(g, s1, 29, false, 0), w2 = K.tw(g, s2, 26, false, 1), w3 = K.tw(g, s3, 24, true, 2.5);
        const w = 22 + lgS + 14 + w1 + 36 + w2 + 36 + w3 + 28, x = 540 - w / 2;
        K.card(g, x, cy - h / 2, w, h, { r: h / 2, shadow: bl > 0.5 ? "rgba(8,22,90,0.4)" : "rgba(52,40,14,0.16)", blur: 22, dy: 6 });
        const lg = K.pic("logo", lgS);
        if (lg) g.drawImage(lg, x + 22, cy - lgS / 2, lgS, lgS);
        let tx = x + 22 + lgS + 14;
        K.text(g, s1, tx, cy + 10, { size: 29 }); tx += w1 + 18;
        g.beginPath(); g.arc(tx, cy, 5, 0, Math.PI * 2); g.fillStyle = rgba(C.ink, 0.3); g.fill(); tx += 18;
        K.text(g, s2, tx, cy + 10, { size: 26, ls: 1, c: C.red }); tx += w2 + 18;
        g.beginPath(); g.arc(tx, cy, 5, 0, Math.PI * 2); g.fillStyle = rgba(C.ink, 0.3); g.fill(); tx += 18;
        K.text(g, s3, tx, cy + 8, { size: 24, mono: true, ls: 2.5, c: rgba(C.ink, 0.62) });
      }
      // the chapter tag: a white chip at the right; its text slides up to the next chapter's
      function tag(t, k, bl) {
        const lab = (j) => CH[j].tag + " · " + String(j + 1).padStart(2, "0") + "/" + String(N).padStart(2, "0");
        const u = k > 0 ? clamp((t - B[k]) / 0.22) : 1, q = eio(u);
        const wOf = (j) => K.tw(g, lab(j), 25, true, 2) + 72;
        const w = k > 0 ? lerp(wOf(k - 1), wOf(k), q) : wOf(k), h = 46, x = 1040 - w;
        K.card(g, x, TY - h / 2, w, h, { r: h / 2, shadow: bl > 0.5 ? "rgba(8,22,90,0.35)" : "rgba(52,40,14,0.14)", blur: 16, dy: 5 });
        const ph = ((t - B[k]) % 1.6) / 1.6;
        g.save(); g.strokeStyle = rgba(C.red, 0.55 * (1 - ph)); g.lineWidth = 3; g.beginPath(); g.arc(x + 26, TY, 7 + 6 * eo(ph), 0, Math.PI * 2); g.stroke(); g.restore();
        g.beginPath(); g.arc(x + 26, TY, 7, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
        g.save(); K.rr(g, x + 44, TY - h / 2 + 2, w - 50, h - 4, 10); g.clip();
        if (u < 1) K.text(g, lab(k - 1), x + 50, TY + 9 - 40 * q, { size: 25, mono: true, ls: 2, c: rgba(C.ink, 0.8 * (1 - q)) });
        K.text(g, lab(k), x + 50, TY + 9 + 40 * (1 - q), { size: 25, mono: true, ls: 2, c: rgba(C.ink, 0.8) });
        g.restore();
        K.text(g, "desk2quant.com", 42, TY + 9, { size: 25, mono: true, ls: 2, c: bl > 0.5 ? "rgba(255,255,255,0.8)" : rgba(C.ink, 0.5) });
      }
      // the progress line: seven segments, the current one filling over its chapter
      function line(t, k, bl) {
        const gap = 10, x0 = 40, x1 = 1040, sw = (x1 - x0 - gap * (N - 1)) / N;
        for (let j = 0; j < N; j++) {
          const a = x0 + j * (sw + gap), end = j < N - 1 ? B[j + 1] : DUR - 1.4;
          const f = j < k ? 1 : j > k ? 0 : clamp((t - B[j]) / (end - B[j]));
          g.save(); g.lineCap = "round"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(a + 3, LY); g.lineTo(a + sw - 3, LY); g.strokeStyle = bl > 0.5 ? "rgba(255,255,255,0.28)" : rgba(C.ink, 0.1); g.stroke();
          if (f > 0) { g.beginPath(); g.moveTo(a + 3, LY); g.lineTo(a + 3 + (sw - 6) * f, LY); g.strokeStyle = bl > 0.5 ? C.white : C.red; g.stroke(); }
          g.restore();
        }
      }
      // the chapter title: tokens centred; the keyword in red (a red pill with white type on the blue block)
      function titleLayout(j) {
        const sp = K.tw(g, " ", TFS, false, -1);
        const ws = CH[j].title.map(([s]) => K.tw(g, s, TFS, false, -1));
        const pad = THEME[j] === "B" ? 18 : 0;
        const W = ws.reduce((p, q) => p + q, 0) + sp * (ws.length - 1) + CH[j].title.filter(([, key]) => key).length * 2 * pad;
        let x = 540 - W / 2; const out = [];
        CH[j].title.forEach(([s, key], i) => { if (key) x += pad; out.push({ s, key, x, w: ws[i] }); x += ws[i] + (key ? pad : 0) + sp; });
        return out;
      }
      function title(t, k, bl) {
        const ink = mix(C.ink, C.white, bl);
        // the outgoing title lifts away
        if (k > 0 && t - B[k] < 0.13) {
          const q = eio(clamp((t - B[k]) / 0.12));
          titleLayout(k - 1).forEach((c) => K.text(g, c.s, c.x, TB - 34 * q, { size: TFS, ls: -1, c: c.key && THEME[k - 1] !== "B" ? C.red : mix(C.ink, C.white, THEME[k - 1] === "B" ? 1 : 0), a: 1 - q }));
        }
        const t0 = k === 0 ? -9 : B[k] + 0.06;
        titleLayout(k).forEach((c, i) => {
          const u = t - (t0 + 0.05 * i); if (u <= 0) return;
          const p = K.spring(u, 0.55, 15), dy = 40 * (1 - p), a = clamp(u / 0.12);
          const sc = c.key ? 1 + 0.16 * Math.exp(-u * 7) * Math.sin(Math.min(u, 0.6) * 11) * (u > 0 ? 1 : 0) : 1;
          g.save(); g.globalAlpha *= a; g.translate(c.x + c.w / 2, TB - TFS * 0.36 + dy); g.scale(sc, sc); g.translate(-(c.x + c.w / 2), -(TB - TFS * 0.36));
          if (c.key && THEME[k] === "B") {
            g.save(); g.shadowColor = "rgba(120,10,10,0.35)"; g.shadowBlur = 16; g.shadowOffsetY = 6;
            K.rr(g, c.x - 16, TB - TFS * 0.84, c.w + 32, TFS * 1.08, 18); g.fillStyle = C.red; g.fill(); g.restore();
            K.text(g, c.s, c.x, TB, { size: TFS, ls: -1, c: C.white });
          } else K.text(g, c.s, c.x, TB, { size: TFS, ls: -1, c: c.key ? C.red : ink });
          g.restore();
        });
      }
      function draw() {
        const t = st.t, k = K.beatAt(t, B), bl = K.blueAt(t, B, THEME);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        pill(bl);
        tag(t, k, bl);
        line(t, k, bl);
        title(t, k, bl);
      }
