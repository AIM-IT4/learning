      // ---- c5, project 3: "Project three: FRTB. Standardised versus internal models for five desks, all the way to the
      // capital number."
      // Three cards deal in at the chapter start (the frame is never empty) and fill on their words: a PROJECT 3 card with
      // two big columns, SA and IMA ("vs" between them): SA lights on "Standardised" and its component chips SBM · DRC ·
      // RRAO deal in; IMA lights on "internal models" with PLA · IMCC · SES. A "5 DESKS" strip: the counter rolls to 5 and
      // five neutral desk icons pop on "five desks". Bottom: the notes' real PLA-zones figure (c_pla_plane.png) as proof,
      // and a "→ CAPITAL" card that lights on "capital" (SA vs IMA, compared; no capital numbers are quoted).
      // words (global): 74 Project 75 three: 76 FRTB. 77 Standardised 78 versus 79 internal 80 models 81 for 82 five 83 desks,
      //   84 all 85 the 86 way 87 to 88 the 89 capital 90 number.
      const g = document.getElementById("c5-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ pla: "assets/img/c_pla_plane.png" }, "c5-images", () => draw()); }
      const PARTS = FACTS.p3_parts, ND = FACTS.p3_desks;
      // beats
      const tCard = 0.12, tStrip = 0.22, tRow = 0.34, tFRTB = w(76) - 0.05, tSA = w(77) - 0.04, tIMA = w(79) - 0.04;
      const tN0 = w(82) - 0.04, tN1 = w(83) + 0.1, tDesks = w(83) - 0.04, tCap = w(89) - 0.05, tNum = w(90) - 0.02;
      const X = 40, W = 1000, Y = 300, H = 560, YS = 880, HS = 150, YB = 1050, HB = 290;
      function column(t, x, y, cw, ch, on, big, sub, parts, t0) {
        const lit = clamp(on);
        g.save();
        if (lit > 0) { g.shadowColor = rgba(C.blue, 0.3 * lit); g.shadowBlur = 30 * lit; g.shadowOffsetY = 12 * lit; }
        K.rr(g, x, y, cw, ch, 26); g.fillStyle = mix(C.mist, C.white, lit); g.fill(); g.restore();
        K.rr(g, x, y, cw, ch, 26); g.strokeStyle = lit > 0 ? rgba(C.blue, 0.85 * lit) : rgba(C.ink, 0.1); g.lineWidth = 4; g.stroke();
        const a = 0.32 + 0.68 * lit, pop = 1 + 0.1 * Math.sin(Math.PI * clamp(on / 0.6)) * (on > 0 && on < 0.6 ? 1 : 0);
        g.save(); g.translate(x + cw / 2, y + 120); g.scale(pop, pop); g.translate(-(x + cw / 2), -(y + 120));
        K.text(g, big, x + cw / 2, y + 160, { size: 132, ls: -4, align: "center", c: C.ink, a });
        g.restore();
        K.text(g, sub, x + cw / 2, y + 212, { size: 26, mono: true, ls: 3, align: "center", c: rgba(C.ink, 0.6), a });
        // the component chips, dealt in one by one
        const cy = y + 296, gw = 14;
        const ws = parts.map((s) => K.tw(g, s, 32) + 40), tot = ws.reduce((p, q) => p + q, 0) + gw * (parts.length - 1);
        let cx = x + (cw - tot) / 2;
        parts.forEach((s, i) => {
          const k = clamp((t - (t0 + 0.12 + 0.12 * i)) / 0.3);
          if (k <= 0) { K.rr(g, cx, cy - 30, ws[i], 60, 30); g.setLineDash([8, 8]); g.strokeStyle = rgba(C.ink, 0.15); g.lineWidth = 2.5; g.stroke(); g.setLineDash([]); }
          else K.chip(g, s, cx + ws[i] / 2, cy, { k, size: 32, align: "center", fill: C.blue, col: C.white, stroke: "rgba(0,0,0,0)", h: 60, padX: 20, shadow: "rgba(37,99,235,0.3)" });
          cx += ws[i] + gw;
        });
      }
      function card(t, P) {
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X, Y, W, H, { r: 32, blur: 50, dy: 26 });
        const kf = 1 + 0.08 * Math.sin(Math.PI * clamp((t - tFRTB) / 0.3)) * (t > tFRTB && t < tFRTB + 0.3 ? 1 : 0);
        g.save(); g.translate(X + 150, Y + 64); g.scale(kf, kf); g.translate(-(X + 150), -(Y + 64));
        K.chip(g, "PROJECT 3", X + 36, Y + 64, { size: 32, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(224,49,49,0.35)", h: 60, padX: 24 });
        g.restore();
        K.text(g, "FRTB · STANDARDISED vs INTERNAL MODELS", X + 268, Y + 74, { size: 24, mono: true, ls: 2, c: rgba(C.ink, 0.6), maxW: W - 300 });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 122, W - 60, 2);
        const cw = 448, ch = 378;
        column(t, X + 36, Y + 150, cw, ch, (t - tSA) / 0.25, "SA", "STANDARDISED", PARTS.slice(0, 3), tSA);
        column(t, X + W - 36 - cw, Y + 150, cw, ch, (t - tIMA) / 0.25, "IMA", "INTERNAL MODELS", PARTS.slice(3), tIMA);
        // vs
        const kv = clamp((t - tSA - 0.3) / 0.3);
        g.save(); g.shadowColor = "rgba(13,21,38,0.3)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
        g.beginPath(); g.arc(540, Y + 150 + ch / 2, 40, 0, Math.PI * 2); g.fillStyle = mix("#c3cad6", C.ink, kv); g.fill(); g.restore();
        K.text(g, "vs", 540, Y + 150 + ch / 2 + 11, { size: 32, align: "center", c: C.white });
        g.restore();
      }
      function desk(x, y, s, col) {   // a neutral desk icon: a monitor on a stand over a desk top
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 5; g.lineJoin = "round"; g.lineCap = "round";
        K.rr(g, x - s * 0.42, y - s * 0.46, s * 0.84, s * 0.52, 6); g.stroke();
        g.beginPath(); g.moveTo(x, y + 0.06 * s); g.lineTo(x, y + 0.2 * s); g.moveTo(x - s * 0.5, y + 0.22 * s); g.lineTo(x + s * 0.5, y + 0.22 * s); g.stroke();
        g.restore();
      }
      function strip(t, P) {
        g.save(); K.apply(g, 540, YS + HS / 2, P);
        K.card(g, X, YS, W, HS, { r: 30, blur: 40, dy: 20 });
        const q = eio(clamp((t - tN0) / (tN1 - tN0))), v = ND * q, kd = clamp((t - tDesks) / 0.25);
        if (t < tN0) K.text(g, "–", X + 50, YS + 112, { size: 112, c: "#c0c8d4" });
        else K.odometer(g, v, 1, X + 46, YS + 116, 112, C.ink, 1);
        K.text(g, "DESKS", X + 128, YS + 88, { size: 52, c: mix("#a3acba", C.red, kd) });
        K.text(g, "SA vs IMA FOR EACH", X + 130, YS + 122, { size: 22, mono: true, ls: 2, c: rgba(C.ink, 0.5 + 0.2 * kd) });
        for (let i = 0; i < ND; i++) {
          const k = clamp((t - (tN0 + 0.08 * i)) / 0.25), cx = X + 470 + i * 106, cy = YS + HS / 2;
          g.save(); g.translate(cx, cy); const s = k > 0 ? back(k, 2.6) : 1; g.scale(s, s);
          g.beginPath(); g.arc(0, 0, 42, 0, Math.PI * 2); g.fillStyle = k > 0 ? C.blueL : "#eef1f5"; g.fill();
          desk(0, 4, 56, k > 0 ? C.blue : "#c0c8d4");
          g.restore();
        }
        g.restore();
      }
      function bottom(t, P) {
        // the figure card: the notes' real PLA-zones figure
        g.save(); K.apply(g, 40 + 290, YB + HB / 2, P);
        K.card(g, 40, YB, 580, HB, { r: 28, blur: 40, dy: 20 });
        K.text(g, "FROM THE NOTES", 66, YB + 38, { size: 22, mono: true, ls: 3, c: rgba(C.ink, 0.55) });
        if (K.ok("pla")) { const fw = 430, fh = fw * 617 / 1165; g.drawImage(K.pic("pla", fw), 40 + (580 - fw) / 2, YB + 52, fw, fh); }
        g.restore();
        // → CAPITAL
        const kc = clamp((t - tCap) / 0.25), x = 644, cw = 396;
        const pop = 1 + 0.08 * Math.sin(Math.PI * clamp((t - tCap) / 0.35)) * (t > tCap && t < tCap + 0.35 ? 1 : 0);
        g.save(); K.apply(g, x + cw / 2, YB + HB / 2, P); g.translate(x + cw / 2, YB + HB / 2); g.scale(pop, pop); g.translate(-(x + cw / 2), -(YB + HB / 2));
        K.card(g, x, YB, cw, HB, { r: 28, blur: 40, dy: 20, fill: kc > 0.5 ? C.red : C.white, shadow: kc > 0.5 ? "rgba(170,20,20,0.4)" : undefined });
        const col = kc > 0.5 ? C.white : "#a3acba";
        const ax = x + 46 + 30 * eo(kc);
        g.save(); g.strokeStyle = col; g.lineWidth = 12; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(ax, YB + 112); g.lineTo(ax + 84, YB + 112); g.moveTo(ax + 56, YB + 82); g.lineTo(ax + 88, YB + 112); g.lineTo(ax + 56, YB + 142); g.stroke(); g.restore();
        K.text(g, "CAPITAL", x + 34, YB + 222, { size: 64, ls: 1, c: col });
        K.text(g, "SA vs IMA, COMPARED", x + 36, YB + 258, { size: 21, mono: true, ls: 2, c: kc > 0.5 ? "rgba(255,255,255,0.85)" : "#b3bcc9" });
        if (t > tNum) { const q = clamp((t - tNum) / 0.5); g.save(); g.strokeStyle = rgba(C.white, 0.7 * (1 - q)); g.lineWidth = 4; K.rr(g, x - 12 * q, YB - 12 * q, cw + 24 * q, HB + 24 * q, 28 + 12 * q); g.stroke(); g.restore(); }
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -150, dur: 0.24 }) : K.still;
        const bob = (ph) => ({ dx: 0, dy: K.bob(T0 + t, ph, 3), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
        bottom(t, K.combine(K.combine(K.enter(t - tRow, { dy: 110, pitch: 0.35, yaw: 0, rot: 0.02, sc: 0.92 }), bob(2.4)), out));
        strip(t, K.combine(K.combine(K.enter(t - tStrip, { dy: 120, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.92 }), bob(1.3)), out));
        card(t, K.combine(K.combine(K.enter(t - tCard, { dy: 150, pitch: 0.45, yaw: 0, rot: 0.02, sc: 0.92 }), bob(0.3)), out));
      }
