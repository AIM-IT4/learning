      const NUM_KEYS = ["normal", "crash"];
      const TEX_IDS = ["normal_pdf", "p_tail", "big_bang", "expected"];
      // ---- s5, never: "If returns were normal, like Black-Scholes assumes, a day like that would never happen. Not once
      // since the Big Bang." A big card with a glossy solid bell (the normal, in σ) that rises on "normal"; far off to the
      // left, past an axis break, the crash sits on the flat tail at −16.2σ ("a day like that"); a NEVER stamp slams on
      // "never". Under it an odds panel flips three times: the normal curve (normal_pdf); the odds of a day that bad,
      // the exponent rolling to 10⁻⁵⁹ (p_tail); since the Big Bang: a timeline, 13.8 bn years × 252 = 3.5×10¹² days
      // (big_bang) and the expected count ≈ 4×10⁻⁴⁷ days (expected).
      // words (global): 65 If 66 returns 67 were 68 normal, 69 like 70 Black-Scholes 71 assumes, 72 a 73 day 74 like
      //   75 that 76 would 77 never 78 happen. 79 Not 80 once 81 since 82 the 83 Big 84 Bang.
      const g = document.getElementById("s5-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s5-tex", { ink: { ink: C.ink, acc: C.blue }, red: { ink: C.ink, acc: C.red } }, () => draw()); }
      const N = NUM.normal, Z = -N.z_round;
      const BN = N.days_since_big_bang / 252 / 1e9;                 // 13.8 (bn years)
      const tCard = 0.06, tBell = w(68) - 0.1, tBS = w(70), tCrash = w(73) - 0.06, tNever = w(77) - 0.02;
      const tB = w(76) - 0.06, tC = w(79) + 0.04;                    // the odds panel's flips
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 640;
      const BX = (z) => 618 + z * 92, BY = Y0 + 520, BH = 330;       // the bell: σ -> px, baseline, peak height
      function bellCard(t) {
        const P = K.enter(t - tCard, { dy: 200, pitch: 0.4, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, blur: 46, dy: 24 });
        K.text(g, "IF DAILY RETURNS WERE NORMAL", X0 + 44, Y0 + 62, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        if (t > tBS) K.chip(g, "AS BLACK–SCHOLES ASSUMES", X0 + W0 - 36, Y0 + 54, { k: clamp((t - tBS) / 0.3), size: 26, mono: true, align: "right", fill: C.blue, col: C.white, stroke: "rgba(0,0,0,0)", h: 48, shadow: "rgba(37,99,235,0.3)" });
        // the axis: the flat tail runs left from the bell, with a break, out to the crash
        g.save(); g.strokeStyle = rgba(C.ink, 0.8); g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(BX(-4.4), BY); g.lineTo(BX(4.4), BY); g.moveTo(96, BY); g.lineTo(312, BY); g.moveTo(342, BY); g.lineTo(BX(-4.4), BY); g.stroke();
        g.beginPath(); g.moveTo(306, BY + 16); g.lineTo(318, BY - 16); g.moveTo(336, BY + 16); g.lineTo(348, BY - 16); g.stroke(); g.restore();
        [-4, 0, 4].forEach((z) => K.text(g, z === 0 ? "0" : (z < 0 ? K.MINUS : "+") + Math.abs(z) + "σ", BX(z), BY + 44, { size: 26, mono: true, align: "center", c: rgba(C.ink, 0.7) }));
        // the glossy bell rises on "normal"
        const kb = K.spring(t - tBell, 0.55, 11);
        if (kb > 0.001) {
          const pts = []; for (let z = -4.4; z <= 4.4001; z += 0.1) pts.push([BX(z), BY - BH * kb * Math.exp(-z * z / 2)]);
          g.save(); g.shadowColor = "rgba(30,64,175,0.35)"; g.shadowBlur = 30; g.shadowOffsetY = 16;
          g.beginPath(); g.moveTo(pts[0][0], BY); pts.forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(pts[pts.length - 1][0], BY); g.closePath();
          const gr = g.createLinearGradient(0, BY - BH, 0, BY); gr.addColorStop(0, "#82adff"); gr.addColorStop(0.6, C.blue); gr.addColorStop(1, "#1d47c8");
          g.fillStyle = gr; g.fill(); g.restore();
          // the gloss: a soft white sheen along the left shoulder
          g.save(); g.beginPath(); g.moveTo(pts[0][0], BY); pts.forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(pts[pts.length - 1][0], BY); g.closePath(); g.clip();
          const sh = g.createLinearGradient(BX(-2), BY - BH, BX(0.5), BY - BH * 0.3); sh.addColorStop(0, "rgba(255,255,255,0.55)"); sh.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = sh; g.beginPath(); g.ellipse(BX(-1.1), BY - BH * 0.72, 120, 190, 0.5, 0, Math.PI * 2); g.fill(); g.restore();
          g.save(); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.strokeStyle = C.ink; g.lineWidth = 5; g.lineJoin = "round"; g.stroke(); g.restore();
          K.text(g, "NORMAL", BX(0), BY - BH * kb * 0.42, { size: 34, align: "center", c: C.white, a: clamp((t - tBell - 0.3) / 0.3) });
        }
        // the crash, far out on the flat tail
        const kc = t - tCrash;
        if (kc > 0) {
          K.dot(g, 120, BY, { r: 14, c: C.red, s: back(clamp(kc / 0.25), 2.4), pulse: (kc % 1.1) / 1.1 });
          K.text(g, K.MINUS + Math.abs(Z).toFixed(1) + "σ", 120, BY + 46, { size: 30, mono: true, align: "center", c: C.red, a: clamp(kc / 0.2) });
          K.chip(g, "THE " + NUM.crash.date.split(" ")[2] + " CRASH", 96, BY - 64, { k: clamp((kc - 0.1) / 0.3), size: 26, mono: true, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", h: 46, shadow: "rgba(229,72,77,0.3)" });
        }
        if (t > tNever) K.stamp(g, "NEVER", 236, Y0 + 260, { u: t - tNever, rot: -0.16, size: 74, col: C.red, ground: C.white, seed: 9, fill: "rgba(255,255,255,0.9)" });
        g.restore();
      }
      function oddsPanel(t) {
        const P = K.enter(t - tCard - 0.12, { dy: 220, pitch: 0.4, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: 170, dur: 0.3 })));
        const X = 40, Y = 1176, W = 1000, H = 458;
        // which face: A (the normal curve), B (the odds), C (since the Big Bang), with a flip between them
        const fl = (t0) => clamp((t - t0) / 0.3);
        const fB = fl(tB), fC = fl(tC), face = fC >= 0.5 ? 2 : fB >= 0.5 ? 1 : 0;
        const ph = face === 2 ? fC : face === 1 ? fB : 0, sy = Math.max(0.02, Math.abs(Math.cos(Math.PI * (fC > 0 && fC < 1 ? fC : fB > 0 && fB < 1 ? fB : 0))));
        g.save(); K.apply(g, 540, Y + H / 2, P);
        g.translate(540, Y + H / 2); g.scale(1, sy); g.translate(-540, -(Y + H / 2));
        K.card(g, X, Y, W, H, { r: 30, blur: 46, dy: 24 });
        const lab = (s) => K.text(g, s, X + 44, Y + 62, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
        if (face === 0) {
          lab("THE NORMAL CURVE");
          K.tex(g, "normal_pdf", 540, Y + 250, 74, { align: "center", valign: "middle", k: clamp((t - tBell) / 0.6) });
        } else if (face === 1) {
          lab("ODDS OF A DAY THAT BAD, ON A NORMAL CURVE");
          const n = Math.round(lerp(1, -N.p_exp, eio(clamp((t - tB - 0.15) / 0.45))));
          const base = N.p_mantissa.toFixed(1) + " × 10", bw = K.tw(g, base, 120, false, -2), sw = K.tw(g, K.MINUS + n, 70, false, 0);
          const x0 = 540 - (bw + sw + 8) / 2;
          K.text(g, base, x0, Y + 238, { size: 120, ls: -2, c: C.red });
          K.text(g, K.MINUS + n, x0 + bw + 8, Y + 166, { size: 70, c: C.red });
          K.tex(g, "p_tail", 540, Y + 360, 54, { align: "center", valign: "middle", k: clamp((t - tB - 0.3) / 0.35), variant: "red" });
        } else {
          lab("SINCE THE BIG BANG");
          const kl = eo(clamp((t - tC - 0.15) / 0.5)), lx0 = X + 90, lx1 = X + W - 90, ly = Y + 150;
          g.save(); g.strokeStyle = C.ink; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.moveTo(lx0, ly); g.lineTo(lerp(lx0, lx1, kl), ly); g.stroke(); g.restore();
          // the Big Bang: a small starburst; today: a dot
          g.save(); g.translate(lx0, ly); g.fillStyle = C.yel; g.beginPath();
          for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 14 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          g.closePath(); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke(); g.restore();
          if (kl > 0.95) K.dot(g, lx1, ly, { r: 14, c: C.blue });
          K.text(g, "BIG BANG", lx0, ly + 62, { size: 26, mono: true, align: "center" });
          K.text(g, "TODAY", lx1, ly + 62, { size: 26, mono: true, align: "center", a: clamp(kl * 3 - 2) });
          K.text(g, BN.toFixed(1) + " bn years", 540, ly - 26, { size: 34, align: "center", a: kl });
          K.tex(g, "big_bang", 540, Y + 300, 42, { align: "center", valign: "middle", k: clamp((t - tC - 0.4) / 0.5) });
          K.tex(g, "expected", 540, Y + 392, 52, { align: "center", valign: "middle", k: clamp((t - w(83) + 0.1) / 0.4), variant: "red" });
        }
        if (sy < 0.98) { K.rr(g, X, Y, W, H, 30); g.fillStyle = `rgba(13,21,38,${0.25 * (1 - sy)})`; g.fill(); }
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        oddsPanel(t);
        bellCard(t);
      }
