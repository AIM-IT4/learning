      // ---- c6, what you get: "You get the notes, executed notebooks, a Python risk library and fourteen regression tests."
      // A file grid deals in at the chapter start (dim) and each file lights on its words: the Notes PDF (the real cover,
      // 141 pages, 19 modules, 64 Q&As) on "notes"; Executed notebooks (+ HTML exports; their cells run) on "executed
      // notebooks"; the Python risk library on "Python risk library", its six modules dealing in (market · curves ·
      // instruments · risk · backtest · frtb); and the regression suite on "fourteen": 14 green checks tick in turn while
      // the counter rolls to 14 / 14.
      // words (global): 91 You 92 get 93 the 94 notes, 95 executed 96 notebooks, 97 a 98 Python 99 risk 100 library 101 and
      //   102 14 103 regression 104 tests.
      const g = document.getElementById("c6-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ cover: "assets/img/cover.jpg" }, "c6-images", () => draw()); }
      const LIB = FACTS.library, NT = FACTS.tests;
      // beats
      const tNotes = w(94) - 0.05, tExec = w(95) - 0.05, tNb = w(96) - 0.04, tPy = w(98) - 0.04, tT0 = w(102) - 0.1, tTests = w(104) - 0.04;
      const tick = (i) => tT0 + 0.04 * i;
      const X = 40, W = 1000, R1 = 300, H1 = 310, R2 = 634, H2 = 300, R3 = 958, H3 = 382;
      const dealt = (t, t0, ph) => K.combine(K.enter(t - t0, { dy: 120, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.92 }), { dx: 0, dy: K.bob(T0 + t, ph, 2.5), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
      const popOf = (t, t0) => 1 + 0.06 * Math.sin(Math.PI * clamp((t - t0) / 0.3)) * (t > t0 && t < t0 + 0.3 ? 1 : 0);
      function tileFrame(x, y, tw_, th, lit) {
        K.card(g, x, y, tw_, th, { r: 30, blur: 40, dy: 20, stroke: lit > 0.5 ? rgba(C.blue, 0.6) : undefined });
        g.save(); K.rr(g, x, y, tw_, th, 30); g.clip(); g.fillStyle = mix("#e3e8ef", C.blue, lit); g.fillRect(x, y, tw_, 10); g.restore();
      }
      function notes(t, P) {
        const x = X, y = R1, tw_ = 484, lit = clamp((t - tNotes) / 0.25), s = popOf(t, tNotes);
        g.save(); K.apply(g, x + tw_ / 2, y + H1 / 2, P); g.translate(x + tw_ / 2, y + H1 / 2); g.scale(s, s); g.translate(-(x + tw_ / 2), -(y + H1 / 2));
        tileFrame(x, y, tw_, H1, lit);
        // the PDF: the real cover over two page edges
        const cx = x + 28, cy = y + 70, cs = 164;
        for (let i = 2; i >= 1; i--) { K.rr(g, cx + 8 * i, cy - 8 * i, cs, cs, 10); g.fillStyle = i === 2 ? "#e6e9ef" : "#f1f3f7"; g.fill(); g.strokeStyle = "rgba(13,21,38,0.1)"; g.lineWidth = 1.5; g.stroke(); }
        g.save(); g.globalAlpha *= 0.45 + 0.55 * lit; K.photo(g, "cover", cx, cy, cs, { r: 10, blur: 16, dy: 8, res: cs }); g.restore();
        K.chip(g, "PDF", cx + cs - 6, cy + cs - 10, { size: 22, mono: true, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 38, padX: 12, shadow: "rgba(0,0,0,0)" });
        const a = 0.4 + 0.6 * lit, tx = x + 226;
        K.text(g, "Notes PDF", tx, y + 112, { size: 42, a });
        K.chip(g, FACTS.pages + " pages", tx, y + 166, { size: 30, fill: lit > 0.5 ? C.red : C.mist, col: lit > 0.5 ? C.white : rgba(C.ink, 0.5), stroke: "rgba(0,0,0,0)", h: 52, padX: 18, shadow: "rgba(0,0,0,0)" });
        K.text(g, FACTS.modules + " MODULES", tx + 2, y + 232, { size: 22, mono: true, ls: 1.5, c: rgba(C.ink, 0.6), a });
        K.text(g, FACTS.qa + " INTERVIEW Q&As", tx + 2, y + 264, { size: 22, mono: true, ls: 1.5, c: rgba(C.ink, 0.6), a, maxW: tw_ - 250 });
        g.restore();
      }
      function notebooks(t, P) {
        const x = X + W - 484, y = R1, tw_ = 484, lit = clamp((t - tExec) / 0.25), s = popOf(t, tExec);
        g.save(); K.apply(g, x + tw_ / 2, y + H1 / 2, P); g.translate(x + tw_ / 2, y + H1 / 2); g.scale(s, s); g.translate(-(x + tw_ / 2), -(y + H1 / 2));
        tileFrame(x, y, tw_, H1, lit);
        // a notebook glyph: a window with three cells that run in turn
        const gx = x + 28, gy = y + 60, gw = 170, gh = 190;
        K.rr(g, gx, gy, gw, gh, 14); g.fillStyle = "#f4f6fa"; g.fill(); g.strokeStyle = rgba(C.ink, 0.14); g.lineWidth = 2; g.stroke();
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(gx, gy + 30, gw, 2);
        [C.red, C.amber, C.green].forEach((c, i) => { g.beginPath(); g.arc(gx + 18 + i * 16, gy + 15, 5, 0, Math.PI * 2); g.fillStyle = c; g.fill(); });
        for (let i = 0; i < 3; i++) {
          const ry = gy + 46 + i * 50, run = clamp((t - (tExec + 0.13 * i)) / 0.12), done = t > tExec + 0.13 * i + 0.12;
          g.fillStyle = done ? C.green : rgba(C.ink, 0.2); g.beginPath(); g.arc(gx + 18, ry + 12, 7, 0, Math.PI * 2); g.fill();
          // the cells keep running in turn (an execution ring cycles through them)
          const cyc = t > tExec + 0.6 ? Math.floor((t - tExec - 0.6) / 0.45) % 3 : -1, cq = ((t - tExec - 0.6) % 0.45) / 0.45;
          if (cyc === i) { g.save(); g.strokeStyle = rgba(C.blue, 0.8 * (1 - cq)); g.lineWidth = 3; g.beginPath(); g.arc(gx + 18, ry + 12, 9 + 8 * cq, 0, Math.PI * 2); g.stroke(); g.restore(); }
          K.rr(g, gx + 34, ry + 2, 120 * (0.55 + 0.45 * ((i * 37) % 10) / 10), 9, 4); g.fillStyle = rgba(C.ink, 0.28); g.fill();
          K.rr(g, gx + 34, ry + 18, 120 * run * (0.4 + 0.5 * ((i * 53) % 10) / 10), 9, 4); g.fillStyle = rgba(C.blue, 0.6); g.fill();
        }
        const a = 0.4 + 0.6 * lit, tx = x + 222;
        K.text(g, "Executed", tx, y + 106, { size: 42, a });
        K.text(g, "notebooks", tx, y + 154, { size: 42, a });
        const kn = clamp((t - tNb) / 0.25);
        K.chip(g, "+ HTML exports", tx, y + 214, { size: 25, fill: kn > 0.5 ? C.blue : C.mist, col: kn > 0.5 ? C.white : rgba(C.ink, 0.5), stroke: "rgba(0,0,0,0)", h: 50, padX: 18, shadow: "rgba(0,0,0,0)" });
        g.restore();
      }
      function library(t, P) {
        const x = X, y = R2, lit = clamp((t - tPy) / 0.25), s = popOf(t, tPy);
        g.save(); K.apply(g, 540, y + H2 / 2, P); g.translate(540, y + H2 / 2); g.scale(s, s); g.translate(-540, -(y + H2 / 2));
        tileFrame(x, y, W, H2, lit);
        // a folder glyph
        const fx = x + 34, fy = y + 66, fw = 156, fh = 120, col = mix("#c0c8d4", C.blue, lit);
        g.beginPath(); g.moveTo(fx, fy + 16); g.lineTo(fx, fy); g.lineTo(fx + 56, fy); g.lineTo(fx + 70, fy + 16); g.closePath(); g.fillStyle = col; g.fill();
        K.rr(g, fx, fy + 14, fw, fh, 14); g.fillStyle = col; g.fill();
        K.text(g, ".py", fx + fw / 2, fy + 92, { size: 40, mono: true, align: "center", c: C.white });
        const a = 0.4 + 0.6 * lit;
        K.text(g, "Python risk library", x + 220, y + 92, { size: 44, a });
        // the six modules, dealt in
        let cx = x + 220, cy = y + 152, row = 0;
        LIB.forEach((m, i) => {
          const cw = K.tw(g, m, 30, true) + 44;
          if (i === 3) { cx = x + 220; cy += 74; row = 1; }
          const k = clamp((t - (tPy + 0.1 + 0.09 * i)) / 0.28);
          if (k <= 0) { K.rr(g, cx, cy - 29, cw, 58, 29); g.setLineDash([8, 8]); g.strokeStyle = rgba(C.ink, 0.15); g.lineWidth = 2.5; g.stroke(); g.setLineDash([]); }
          else K.chip(g, m, cx, cy, { k, size: 30, mono: true, fill: C.ink, col: C.white, stroke: "rgba(0,0,0,0)", h: 58, padX: 22, shadow: "rgba(13,21,38,0.25)" });
          cx += cw + 14;
        });
        g.restore();
      }
      function suite(t, P) {
        const x = X, y = R3, lit = clamp((t - tT0) / 0.25), s = popOf(t, tTests);
        g.save(); K.apply(g, 540, y + H3 / 2, P); g.translate(540, y + H3 / 2); g.scale(s, s); g.translate(-540, -(y + H3 / 2));
        K.card(g, x, y, W, H3, { r: 30, blur: 40, dy: 20, stroke: lit > 0.5 ? rgba(C.green, 0.6) : undefined });
        g.save(); K.rr(g, x, y, W, H3, 30); g.clip(); g.fillStyle = mix("#e3e8ef", C.green, lit); g.fillRect(x, y, W, 10); g.restore();
        K.text(g, "REGRESSION SUITE", x + 40, y + 66, { size: 27, mono: true, ls: 3, c: rgba(C.ink, 0.6) });
        const n = Math.max(0, Math.min(NT, Math.floor((t - tT0) / 0.04) + 1));
        const nn = t < tT0 ? 0 : n;
        K.text(g, nn + " / " + NT, x + 890, y + 82, { size: 66, align: "right", c: nn === NT ? C.greenD : C.ink });     // right edge at x 930
        K.text(g, "TESTS", x + 888, y + 116, { size: 22, mono: true, ls: 3, align: "right", c: rgba(C.ink, 0.5) });
        // the progress bar
        const bx = x + 40, by = y + 104, bw = 600;
        K.rr(g, bx, by, bw, 12, 6); g.fillStyle = "#e9edf2"; g.fill();
        if (nn > 0) { K.rr(g, bx, by, bw * nn / NT, 12, 6); g.fillStyle = C.green; g.fill(); }
        if (nn === NT) {   // a shine runs along the full bar
          const sp = ((t - tTests) % 1.1) / 1.1, sx = bx - 60 + sp * (bw + 120);
          g.save(); K.rr(g, bx, by, bw, 12, 6); g.clip();
          const sg = g.createLinearGradient(sx - 50, 0, sx + 50, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.8)"); sg.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = sg; g.fillRect(sx - 50, by, 100, 12); g.restore();
        }
        // 14 checks, 7 x 2
        const cw = 118, ch = 104, gx = x + 37, gy = y + 150;          // the grid spans x 77-903
        for (let i = 0; i < NT; i++) {
          const cx = gx + (i % 7) * cw + cw / 2, cy = gy + Math.floor(i / 7) * ch + 38, k = clamp((t - tick(i)) / 0.22);
          if (k <= 0) { g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.setLineDash([7, 7]); g.strokeStyle = rgba(C.ink, 0.2); g.lineWidth = 3; g.stroke(); g.setLineDash([]); }
          else K.tickBadge(g, cx, cy, 30, k);
          K.text(g, String(i + 1).padStart(2, "0"), cx, cy + 62, { size: 22, mono: true, align: "center", c: rgba(C.ink, k > 0 ? 0.6 : 0.35) });
        }
        g.restore();
      }
      function draw() {
        const t = st.t;
        K.heroFrame(g);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -60, dur: 0.2, sc: 0.95 }) : K.still;
        suite(t, K.combine(dealt(t, 0.16, 2.6), out));
        library(t, K.combine(dealt(t, 0.12, 1.7), out));
        notebooks(t, K.combine(dealt(t, 0.08, 0.9), out));
        notes(t, K.combine(dealt(t, 0.04, 0.2), out));
        K.floor(g);
      }
