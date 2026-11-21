      // ---- c3, project 1: "Project one: VaR and expected shortfall for a rates and FX desk, backtested over 4,919 days of
      // real data. Kupiec, Christoffersen, traffic lights."
      // A: a PROJECT 1 card: two tiles light on their words (VaR: the quantile line; ES: the tail beyond it; small
      //    illustrative drawings, labelled), then the desk row: RATES and FX pop on their words.
      // B: on "backtested" a dashboard card rises: "Walk-forward backtest · real rates & FX data". The big number rolls to
      //    4,919 across the spoken number, DAYS lands on "days", a red REAL DATA stamp slams on "real data"; a walk-forward
      //    strip runs: the window slides along the history while the count rolls.
      // C: on "Kupiec" the proof rises over the strip: the real backtesting page (page-4: the Basel traffic light) in a PDF
      //    viewer, scrolled to the chart; three test chips tick on their words (Kupiec ✓, Christoffersen ✓, Traffic light
      //    with green / yellow / red dots). On "traffic lights" a red frame rings the page's traffic-light chart.
      // words (global): 30 Project 31 one. 32 VaR 33 and 34 expected 35 shortfall 36 for 37 a 38 rates 39 and 40 FX 41 desk,
      //   42 backtested 43 over 44 4,919 45 days 46 of 47 real 48 data. 49 Kupiec, 50 Christoffersen, 51 traffic 52 lights.
      const g = document.getElementById("c3-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ p4: "assets/img/page-4.jpg" }, "c3-images", () => draw()); }
      const DAYS = FACTS.p1_days, TESTS = FACTS.p1_tests;
      // beats
      const tA = 0.04, tVaR = w(32) - 0.05, tES = w(34) - 0.05, tRates = w(38) - 0.04, tFX = w(40) - 0.04, tDesk = w(41) - 0.04;
      const tOne = w(31) - 0.04, tShort = w(35) - 0.04, tFor = w(36) - 0.05;
      const tB = w(42) - 0.22, tN0 = w(44) - 0.02, tN1 = WE[44] - T0 - 0.05, tDays = w(45) - 0.04, tReal = w(47) - 0.03;
      const tC = w(49) - 0.36, tT = [w(49) - 0.03, w(50) - 0.03, w(51) - 0.03], tRing = w(51) + 0.1;
      const X = 40, W = 1000, Y = 300, H = 1040;
      const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      // a number with tabular digits (commas narrow), left-aligned at x, baseline y
      function bigNum(s, x, y, size, col) {
        g.save(); K.font(g, size, false, -4); g.fillStyle = col; g.textAlign = "center";
        const dw = g.measureText("0").width, cw = g.measureText(",").width;
        let px = x; for (const ch of s) { const ww = /[0-9]/.test(ch) ? dw : cw; g.fillText(ch, px + ww / 2, y); px += ww; }
        g.restore(); return px - x;
      }
      // ---- A: the project card
      function tile(x, y, tw_, th, on, kind) {
        const lit = clamp(on);
        g.save();
        if (lit > 0) { g.shadowColor = kind === "es" ? "rgba(224,49,49,0.32)" : "rgba(37,99,235,0.3)"; g.shadowBlur = 30 * lit; g.shadowOffsetY = 12 * lit; }
        K.rr(g, x, y, tw_, th, 26); g.fillStyle = mix(C.mist, C.white, lit); g.fill(); g.restore();
        K.rr(g, x, y, tw_, th, 26); g.strokeStyle = lit > 0 ? rgba(kind === "es" ? C.red : C.blue, 0.9 * lit) : rgba(C.ink, 0.1); g.lineWidth = 4; g.stroke();
        const a = 0.3 + 0.7 * lit;
        K.text(g, kind === "es" ? "ES" : "VaR", x + 34, y + 128, { size: 112, ls: -3, c: kind === "es" ? C.red : C.ink, a });
        K.text(g, kind === "es" ? "EXPECTED SHORTFALL" : "VALUE-AT-RISK", x + 38, y + 176, { size: 25, mono: true, ls: 2, c: rgba(C.ink, 0.6), a });
        K.text(g, "ILLUSTRATIVE", x + tw_ - 26, y + 46, { size: 20, mono: true, ls: 2, align: "right", c: rgba(C.ink, 0.42), a });
        const Fr = K.frame(x + 34, y + 214, tw_ - 68, th - 268, [-7.14, 4.42], [0, 1]);
        g.save(); g.globalAlpha *= a;
        K.pnlHist(g, Fr, { bw: 0.68, grow: 1, line: kind === "var" ? lit : 1, tail: kind === "es" ? lit : 0, es: kind === "es" ? clamp((st.t - tShort) / 0.45) : 0, lab: false, wave: st.t });
        g.restore();
      }
      function deskChip(x, y, cw, ch, on, kind, pulse) {
        const lit = clamp(on), s = 1 + 0.07 * Math.sin(Math.PI * clamp(pulse || 0)) * (pulse > 0 && pulse < 1 ? 1 : 0);
        g.save(); g.translate(x + cw / 2, y + ch / 2); g.scale(s, s); g.translate(-(x + cw / 2), -(y + ch / 2));
        g.save(); if (lit > 0) { g.shadowColor = "rgba(37,99,235,0.35)"; g.shadowBlur = 26 * lit; g.shadowOffsetY = 10 * lit; }
        K.rr(g, x, y, cw, ch, 26); g.fillStyle = mix(C.mist, C.blue, lit); g.fill(); g.restore();
        const col = mix("#9aa6b8", C.white, lit);
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
        const gx = x + 54, gy = y + ch / 2;
        if (kind === "rates") {   // a curve glyph
          g.beginPath(); g.moveTo(gx - 10, gy + 40); g.bezierCurveTo(gx + 20, gy - 6, gx + 50, gy - 28, gx + 100, gy - 38); g.stroke();
          [[gx - 10, gy + 40], [gx + 30, gy - 2], [gx + 100, gy - 38]].forEach(([px, py]) => { g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill(); });
        } else {                  // an exchange glyph: two arrows
          g.beginPath(); g.moveTo(gx - 6, gy - 20); g.lineTo(gx + 96, gy - 20); g.moveTo(gx + 76, gy - 40); g.lineTo(gx + 96, gy - 20); g.lineTo(gx + 76, gy); g.stroke();
          g.beginPath(); g.moveTo(gx + 96, gy + 26); g.lineTo(gx - 6, gy + 26); g.moveTo(gx + 14, gy + 6); g.lineTo(gx - 6, gy + 26); g.lineTo(gx + 14, gy + 46); g.stroke();
        }
        g.restore();
        K.text(g, kind === "rates" ? "RATES" : "FX", x + 184, y + ch / 2 + 27, { size: 76, ls: -1, c: col });
        g.restore();
      }
      function projectCard(t, P) {
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X, Y, W, H, { r: 32, blur: 50, dy: 26 });
        K.chip(g, "PROJECT 1", X + 36, Y + 66, { size: 32, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(224,49,49,0.35)", h: 60, padX: 24 });
        K.text(g, "OF " + FACTS.projects + " REAL-DATA PROJECTS", X + 268, Y + 76, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        // one of three: the first dot lights on "one"
        for (let i = 0; i < FACTS.projects; i++) {
          const cx = X + W - 116 + i * 38, on = i === 0 ? clamp((t - tOne) / 0.25) : 0, s = 1 + 0.5 * Math.sin(Math.PI * on) * (on < 1 ? 1 : 0);
          g.beginPath(); g.arc(cx, Y + 66, 11 * s, 0, Math.PI * 2); g.fillStyle = on > 0.5 ? C.red : "#dfe4eb"; g.fill();
        }
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 124, W - 60, 2);
        tile(X + 36, Y + 152, 446, 452, clamp((t - tVaR) / 0.25), "var");
        tile(X + 518, Y + 152, 446, 452, clamp((t - tES) / 0.25), "es");
        const kfor = clamp((t - tFor) / 0.3);
        K.text(g, "THE DESK", X + 40 + 30 * (1 - eo(kfor)), Y + 652, { size: 26, mono: true, ls: 3, c: rgba(C.ink, 0.25 + 0.3 * kfor) });
        if (kfor > 0) { g.save(); g.strokeStyle = rgba(C.blue, 0.6); g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(X + 190, Y + 643); g.lineTo(X + 190 + 750 * eo(kfor), Y + 643); g.stroke(); g.restore(); }
        const pd = (t - tDesk) / 0.35;
        deskChip(X + 36, Y + 690, 446, 300, clamp((t - tRates) / 0.25), "rates", Math.max(clamp((t - tRates) / 0.4) < 1 ? clamp((t - tRates) / 0.4) : 0, pd));
        deskChip(X + 518, Y + 690, 446, 300, clamp((t - tFX) / 0.25), "fx", Math.max(clamp((t - tFX) / 0.4) < 1 ? clamp((t - tFX) / 0.4) : 0, pd - 0.15));
        g.restore();
      }
      // ---- B: the backtest dashboard
      function strip(t, x, y, sw) {
        const f = eio(clamp((t - tN0) / (tN1 + 0.35 - tN0)));
        const th = 76, win = 0.24;
        K.rr(g, x, y, sw, th, th / 2); g.fillStyle = C.mist; g.fill();
        // the days already tested: fine ticks
        const wx0 = x + 12 + (sw - 24) * (1 - win - 0.05) * f, ww = (sw - 24) * win, tx1 = wx0 + ww;
        g.save(); K.rr(g, x, y, sw, th, th / 2); g.clip();
        g.fillStyle = rgba(C.green, 0.16); g.fillRect(x, y, tx1 - x, th);
        g.strokeStyle = rgba(C.green, 0.75); g.lineWidth = 3;
        g.beginPath(); for (let px = x + 18; px < tx1 - 2; px += 11) { g.moveTo(px, y + th - 22); g.lineTo(px, y + th - 10); } g.stroke();
        g.restore();
        // the window, and the next day it forecasts
        g.save(); g.shadowColor = "rgba(37,99,235,0.35)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
        K.rr(g, wx0, y + 8, ww, th - 16, (th - 16) / 2); g.fillStyle = C.blue; g.fill(); g.restore();
        K.text(g, "WINDOW", wx0 + ww / 2, y + th / 2 + 9, { size: 25, mono: true, ls: 2, align: "center", c: C.white });
        const nx = tx1 + 14;
        g.beginPath(); g.arc(nx, y + th / 2, 12, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
        K.text(g, "NEXT DAY", nx, y - 18, { size: 24, mono: true, ls: 1, align: "center", c: C.red });
        K.text(g, "DAY 1", x + 8, y + th + 40, { size: 25, mono: true, ls: 1, c: rgba(C.ink, 0.55) });
        K.text(g, "DAY " + comma(DAYS), x + sw - 8, y + th + 40, { size: 25, mono: true, ls: 1, align: "right", c: rgba(C.ink, 0.55) });
        return f;
      }
      function dash(t, P) {
        const kp = eio(clamp((t - tC) / 0.42)), Hd = lerp(H, 478, kp), low = 1 - clamp(kp * 2.6);
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X, Y, W, Hd, { r: 32, blur: 50, dy: 26 });
        K.rr(g, X + 34, Y + 34, 66, 66, 18); g.fillStyle = C.blue; g.fill();
        g.save(); g.strokeStyle = C.white; g.lineWidth = 6; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(X + 48, Y + 82); g.lineTo(X + 62, Y + 82); g.lineTo(X + 62, Y + 68); g.lineTo(X + 76, Y + 68); g.lineTo(X + 76, Y + 54); g.lineTo(X + 88, Y + 54); g.stroke(); g.restore();
        K.text(g, "Walk-forward backtest", X + 122, Y + 68, { size: 44 });
        K.text(g, "real rates & FX data", X + 124, Y + 104, { size: 27, mono: true, ls: 1, c: rgba(C.ink, 0.6) });
        K.chip(g, "PROJECT 1", X + W - 34, Y + 66, { size: 26, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(224,49,49,0.3)", h: 50, padX: 18 });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 134, W - 60, 2);
        K.text(g, "DAYS BACKTESTED", X + 44, Y + 200, { size: 26, mono: true, ls: 3, c: rgba(C.ink, 0.55) });
        // the big number rolls across the spoken "four thousand nine hundred and nineteen"
        const q = eio(clamp((t - tN0) / (tN1 - tN0))), v = Math.round(DAYS * q);
        const pop = 1 + 0.06 * Math.sin(Math.PI * clamp((t - tN1) / 0.25));
        g.save(); g.translate(X + 44, Y + 330); g.scale(pop, pop); g.translate(-(X + 44), -(Y + 330));
        const nw = bigNum(comma(v), X + 40, Y + 420, 236, C.ink);
        g.restore();
        const kd = clamp((t - tDays) / 0.25);
        if (kd > 0) K.text(g, "DAYS", X + 40 + Math.max(nw, 600) + 26, Y + 420 - 12 * (1 - eo(kd)), { size: 76, ls: 0, c: C.red, a: kd });
        g.save(); g.beginPath(); g.rect(X, Y, W, Hd - 4); g.clip(); g.globalAlpha *= low;
        // the walk-forward strip
        if (low > 0) strip(t, X + 60, Y + 560, W - 120);
        // the three steps of a walk-forward test, lit in turn as the window moves
        const steps = ["FIT ON THE WINDOW", "FORECAST VaR", "TEST NEXT DAY"], sy = Y + 790;
        const sw = [300, 240, 244], gap = 26;              // ends at x ~930
        let sx = X + 44; const cyc = Math.floor(((t - tN0) * 3.2) % 3);
        steps.forEach((s, i) => {
          const on = t > tN0 && t < tC + 0.4 && cyc === i;
          K.rr(g, sx, sy, sw[i], 72, 36); g.fillStyle = on ? C.ink : C.mist; g.fill();
          g.beginPath(); g.arc(sx + 36, sy + 36, 20, 0, Math.PI * 2); g.fillStyle = on ? C.white : rgba(C.ink, 0.12); g.fill();
          K.text(g, String(i + 1), sx + 36, sy + 45, { size: 24, align: "center", c: on ? C.ink : rgba(C.ink, 0.6) });
          K.text(g, s, sx + 66, sy + 45, { size: 23, mono: true, ls: 1, c: on ? C.white : rgba(C.ink, 0.7), maxW: sw[i] - 80 });
          if (i < 2) { g.save(); g.strokeStyle = rgba(C.ink, 0.35); g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(sx + sw[i] + 9, sy + 36); g.lineTo(sx + sw[i] + gap - 9, sy + 36); g.stroke(); g.restore(); }
          sx += sw[i] + gap;
        });
        K.prov(g, "REAL DATA · RATES & FX", X + W / 2, Y + 960, { align: "center", col: C.blue, size: 25 });
        g.restore();
        // REAL DATA
        if (t > tReal) K.stamp(g, "REAL DATA", X + W - 184, Y + 184, { u: t - tReal, rot: -0.1, size: 44, col: C.red, ground: C.white, seed: 4, fill: "rgba(255,255,255,0.92)" });
        g.restore();
      }
      // ---- C: the proof (page 4 in a PDF viewer) and the three tests
      function testChip(i, x, y, cw, ch, t, P) {
        const u = t - tT[i], t0 = Math.min(tT[i] - 0.18, tC + 0.12 + 0.1 * i);
        if (t < t0) return;
        const Pi = K.combine(K.enter(t - t0, { dx: 320, dy: 0, yaw: -0.35, pitch: 0, rot: 0.03, sc: 0.9 }), P);
        g.save(); K.apply(g, x + cw / 2, y + ch / 2, Pi);
        const lit = clamp(u / 0.2), s = 1 + 0.07 * Math.sin(Math.PI * clamp(u / 0.3)) * (u > 0 && u < 0.3 ? 1 : 0);
        g.translate(x + cw / 2, y + ch / 2); g.scale(s, s); g.translate(-(x + cw / 2), -(y + ch / 2));
        K.card(g, x, y, cw, ch, { r: 28, blur: 34, dy: 16, stroke: lit > 0.5 ? rgba(C.green, 0.6) : undefined });
        if (i < 2) {
          if (lit <= 0) { g.beginPath(); g.arc(x + 54, y + ch / 2, 29, 0, Math.PI * 2); g.strokeStyle = rgba(C.ink, 0.18); g.lineWidth = 4; g.stroke(); }
          K.tickBadge(g, x + 54, y + ch / 2, 29, clamp(u / 0.3));
          K.text(g, TESTS[i], x + 98, y + ch / 2 + 4, { size: 36, c: lit > 0 ? C.ink : rgba(C.ink, 0.45), maxW: cw - 112 });
          K.text(g, "RUN IN THE LAB", x + 100, y + ch / 2 + 40, { size: 21, mono: true, ls: 2, c: lit > 0 ? C.greenD : rgba(C.ink, 0.4) });
        } else {
          const cols = [C.green, C.amber, C.red];
          for (let j = 0; j < 3; j++) {
            const on = clamp((u - 0.14 * j) / 0.15);
            const cx = x + 28 + j * 31, cy = y + ch / 2 - 2;
            g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fillStyle = on > 0 ? cols[j] : rgba(C.ink, 0.12); g.fill();
            if (on > 0 && on < 1) { g.strokeStyle = rgba(cols[j], 0.6 * (1 - on)); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 12 + 10 * on, 0, Math.PI * 2); g.stroke(); }
          }
          K.text(g, TESTS[2], x + 120, y + ch / 2 + 4, { size: 36, c: lit > 0 ? C.ink : rgba(C.ink, 0.45), maxW: cw - 134 });
          K.text(g, "BASEL ZONES", x + 122, y + ch / 2 + 40, { size: 21, mono: true, ls: 2, c: rgba(C.ink, lit > 0 ? 0.6 : 0.4) });
        }
        g.restore();
      }
      function proof(t, P) {
        const u = t - tC; if (u <= 0) return;
        const Pp = K.combine(K.enter(u, { dx: -340, dy: 30, pitch: 0.1, yaw: 0.35, rot: -0.03, sc: 0.9 }), P);
        const px = X, py = 794, pw = 516, ph = 546;
        g.save(); K.apply(g, px + pw / 2, py + ph / 2, Pp);
        const sy = lerp(0.05, 0.33, eio(clamp((u - 0.3) / 1.9)));
        const ring = clamp((t - tRing) / 0.35);
        K.pdfView(g, "p4", px, py, pw, ph, { title: FACTS.pdf_name, page: FACTS.page_backtest, sy, after: (gg, x0, y0, w0, h0) => {
          if (ring <= 0) return;
          const s = w0 / 909;   // page-4 is 909 px wide: its traffic-light chart sits at x 70-835, y 548-902
          gg.save(); gg.strokeStyle = C.red; gg.lineWidth = 5; gg.setLineDash([]);
          K.rr(gg, x0 + 62 * s, y0 + 540 * s, 782 * s * eo(ring), 370 * s, 14); gg.stroke(); gg.restore();
        } });
        g.restore();
        testChip(0, 574, 794, 366, 176, t, P);           // x 574-940 (clear of the right-hand buttons)
        testChip(1, 574, 979, 366, 176, t, P);
        testChip(2, 574, 1164, 366, 176, t, P);
      }
      function draw() {
        const t = st.t;
        K.heroFrame(g);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -60, dur: 0.2, sc: 0.95 }) : K.still;
        const bob = { dx: 0, dy: K.bob(t, 0.4, 3), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 };
        if (t < tB + 0.4) projectCard(t, K.combine(K.combine(K.enter(t - tA, { dy: 150, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.92 }), bob),
          t > tB ? K.leave(t - tB, { dy: -200, dur: 0.32 }) : K.still));
        if (t > tB) dash(t, K.combine(K.combine(K.enter(t - tB, { dy: 160, pitch: 0.45, yaw: 0, rot: 0.03, sc: 0.92 }), bob), out));
        proof(t, out);
        K.floor(g);
      }
