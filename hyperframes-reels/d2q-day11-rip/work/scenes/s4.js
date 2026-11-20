      const NUM_KEYS = ["normal", "crash"];
      const TEX_IDS = ["sigma_day", "z_crash"];
      // ---- s4, 16σ: "At 20% volatility, a typical day moves 1.26%. So that crash was a 16-sigma day."
      // A formula card types σ_day = 20%/√252 = 1.26% (sigma_day). Under it a glossy measuring tape slides out of its
      // case, ticked in σ: on "a typical day" the band ±1σ (= ±1.26%) fills. On "So that crash" the card flips to
      // z = −20.47%/1.26% = −16.2 (z_crash); on "16-sigma" the tape whips out to −16.2σ, a red pin lands there, and the
      // big marker box under it rolls from 1σ to 16σ (turning red).
      // words (global): 45 At 46-47 20% 48 volatility, 49 a 50 typical 51 day 52 moves 53-57 1.26%. 58 So 59 that 60 crash
      //   61 was 62 a 63 16-sigma 64 day.
      const g = document.getElementById("s4-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, ei, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s4-tex", { ink: { ink: C.ink, acc: C.blue }, red: { ink: C.ink, acc: C.red } }, () => draw()); }
      const N = NUM.normal, CR = NUM.crash, Z = -N.z_round, SD = N.sd_day_pct, ZI = Math.round(N.z);   // −16.2, 1.26, 16
      const tCard = 0.06, tF1 = w(46) - 0.04, tTape = 0.55, tBand = w(50) - 0.04, tBandL = w(53) + 0.05, tFlip = w(58) - 0.02;
      const tF2 = tFlip + 0.3, tWhip = w(63) - 0.08, tPin = tWhip + 0.36, tRoll0 = w(63) - 0.02, tRoll1 = w(63) + 0.62;
      // the tape: zero at x0, ppσ px per σ (before the whip, then after)
      const A = { x0: 556, pp: 118 }, Bw = { x0: 832, pp: (832 - 96) / -Z };
      const TY0 = 1040, TH0 = 86;                      // the tape's strip
      const CASE = { x: 852, y: 968, w: 188, h: 230 };
      function tapeState(t) {
        const u = clamp((t - tWhip) / 0.42), q = u < 1 ? eio(u) : 1;
        const ov = u >= 1 ? 0.035 * Math.exp(-(t - tWhip - 0.42) * 7) * Math.sin((t - tWhip - 0.42) * 26) : 0;
        return { x0: lerp(A.x0, Bw.x0, q), pp: lerp(A.pp, Bw.pp, q) * (1 + ov) };
      }
      function formulaCard(t) {
        const P = K.enter(t - tCard, { dy: 200, pitch: 0.4, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        // the flip (about the horizontal axis) from σ_day to the crash's z
        const fu = clamp((t - tFlip) / 0.32), sy = Math.abs(Math.cos(Math.PI * fu)), back2 = fu >= 0.5;
        const X = 40, Y = 506, W = 1000, H = 318;
        g.save(); K.apply(g, 540, Y + H / 2, P);
        g.translate(540, Y + H / 2); g.scale(1, Math.max(0.02, sy)); g.translate(-540, -(Y + H / 2));
        K.card(g, X, Y, W, H, { r: 30, blur: 46, dy: 24 });
        if (sy < 0.98) { K.rr(g, X, Y, W, H, 30); g.fillStyle = `rgba(13,21,38,${0.25 * (1 - sy)})`; g.fill(); }
        if (!back2) {
          K.text(g, "A TYPICAL DAY AT " + Math.round(100 * N.sigma_annual) + "% VOLATILITY", X + 44, Y + 62, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
          K.tex(g, "sigma_day", 540, Y + 196, 66, { align: "center", valign: "middle", k: clamp((t - tF1) / 0.6), variant: t > w(53) ? "ink" : "ink" });
          if (t > w(53) - 0.05) {   // the result locks: a highlighter under 1.26%
            const sz = K.texSize("sigma_day", 66), u = clamp((t - w(53) + 0.05) / 0.25);
            K.highlight(g, 540 + sz.w / 2 - 184, Y + 196 - 46, 190, 92, u);
            K.tex(g, "sigma_day", 540, Y + 196, 66, { align: "center", valign: "middle" });
          }
        } else {
          K.text(g, "THE CRASH, IN TYPICAL DAYS", X + 44, Y + 62, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
          K.tex(g, "z_crash", 540, Y + 190, 70, { align: "center", valign: "middle", k: clamp((t - tF2) / 0.55), variant: "red" });
        }
        g.restore();
      }
      function tape(t) {
        const kIn = clamp((t - tTape) / 0.4);
        if (kIn <= 0) return;
        const out = t > NEXT ? K.leave(t - NEXT, { dy: 160, dur: 0.3 }) : K.still;
        const S = tapeState(t), X = (z) => S.x0 + z * S.pp;
        const pull = eio(kIn), left = lerp(CASE.x, 40, pull);       // the tape slides out of its case to the left
        g.save(); K.apply(g, 540, 1300, out);
        // the strip
        g.save(); g.beginPath(); g.rect(left, TY0 - 60, CASE.x + 20 - left, 260); g.clip();
        g.save(); g.shadowColor = "rgba(40,32,12,0.25)"; g.shadowBlur = 18; g.shadowOffsetY = 10;
        const gr = g.createLinearGradient(0, TY0, 0, TY0 + TH0); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(0.5, C.yel); gr.addColorStop(1, "#e8b90f");
        g.fillStyle = gr; g.fillRect(left - 30, TY0, CASE.x + 40 - left, TH0); g.restore();
        g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(left - 30, TY0 + 6, CASE.x + 40 - left, 4);
        // the ±1σ band: fills out from zero on "a typical day"
        const kb = eo(clamp((t - tBand) / 0.55));
        if (kb > 0) {
          g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(X(-kb), TY0, X(kb) - X(-kb), TH0);
          g.fillStyle = C.blue; g.fillRect(X(-kb), TY0 - 16, X(kb) - X(-kb), 10);
          g.fillRect(X(-kb) - 3, TY0 - 26, 6, 30); g.fillRect(X(kb) - 3, TY0 - 26, 6, 30);
        }
        // ticks every half σ, labels every 1, 2 or 4 σ as the scale allows
        const step = S.pp >= 90 ? 1 : S.pp >= 55 ? 2 : 4;
        g.strokeStyle = C.ink; g.lineCap = "butt";
        for (let z = 2; z >= -18; z -= 0.5) {
          const x = X(z); if (x < left - 10 || x > CASE.x + 10) continue;
          const major = Math.abs(z - Math.round(z)) < 1e-6;
          g.lineWidth = major ? 4 : 2.5; g.beginPath(); g.moveTo(x, TY0); g.lineTo(x, TY0 + (major ? 34 : 20)); g.stroke();
          if (major && Math.round(z) % step === 0 && !(t > tPin && Math.abs(z - Z) < 1.5)) K.text(g, (z < 0 ? K.MINUS : z > 0 ? "+" : "") + Math.abs(Math.round(z)) + (z === 0 ? "" : "σ"), x, TY0 + 72, { size: 26, mono: true, align: "center" });
        }
        g.restore();
        // the band's label
        const kl = clamp((t - tBandL) / 0.3) * (1 - clamp((t - tWhip) / 0.15));
        if (kl > 0) K.chip(g, "TYPICAL DAY ±" + SD.toFixed(2) + "% = ±1σ", (X(-1) + X(1)) / 2, TY0 - 64, { k: Math.min(1, kl * 3), a: kl, size: 28, align: "center", fill: C.blue, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(37,99,235,0.35)" });
        // the case (glossy brand blue), over the strip's end
        g.save(); g.shadowColor = "rgba(30,64,175,0.4)"; g.shadowBlur = 30; g.shadowOffsetY = 16;
        const cg = g.createLinearGradient(CASE.x, CASE.y, CASE.x + CASE.w, CASE.y + CASE.h); cg.addColorStop(0, "#5b8cff"); cg.addColorStop(0.55, C.blue); cg.addColorStop(1, "#1736a8");
        K.rr(g, CASE.x, CASE.y, CASE.w, CASE.h, 44); g.fillStyle = cg; g.fill(); g.restore();
        g.beginPath(); g.arc(CASE.x + CASE.w / 2 + 8, CASE.y + CASE.h / 2, 62, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 8; g.stroke();
        K.text(g, "σ", CASE.x + CASE.w / 2 + 8, CASE.y + CASE.h / 2 + 22, { size: 64, align: "center", c: C.white });
        g.save(); g.globalAlpha = 0.35; g.beginPath(); g.ellipse(CASE.x + 60, CASE.y + 44, 46, 18, -0.4, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill(); g.restore();
        K.rr(g, CASE.x - 8, TY0 - 8, 22, TH0 + 16, 6); g.fillStyle = "#14287a"; g.fill();
        // the crash pin at −16.2σ
        const kp = t - tPin;
        if (kp > 0) {
          const x = X(Z), drop = back(clamp(kp / 0.3), 2.2), y0 = TY0 - 120 * (1 - drop);
          const sh = K.shake(kp - 0.25, 7, 3);
          g.save(); g.translate(sh[0], sh[1]);
          g.strokeStyle = C.red; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y0 + TH0); g.lineTo(x, y0 - 30); g.stroke();
          g.beginPath(); g.arc(x, y0 - 40, 18, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
          g.restore();
          K.chip(g, CR.date.split(" ").slice(0, 2).join(" ").toUpperCase() + " " + CR.date.split(" ")[2] + " · " + K.MINUS + Math.abs(CR.ret_pct).toFixed(2) + "% · " + K.MINUS + Math.abs(Z).toFixed(1) + "σ", x - 12, TY0 - 110, { k: clamp((kp - 0.15) / 0.3), size: 28, mono: true, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(229,72,77,0.35)" });
        }
        g.restore();
      }
      // the big marker box: 1σ = 1.26% (yellow), rolling to 16σ (red) on "16-sigma"
      function marker(t) {
        const k = clamp((t - tTape - 0.25) / 0.3);
        if (k <= 0) return;
        const out = t > NEXT ? K.leave(t - NEXT, { dy: 160, dur: 0.3 }) : K.still;
        const r = clamp((t - tRoll0) / (tRoll1 - tRoll0)), n = r <= 0 ? 1 : Math.max(1, Math.round(lerp(1, ZI, eio(r))));
        const red = r > 0;
        const s1 = n + "σ", s2 = red ? "" : t < tBandL ? " = ?" : " = " + SD.toFixed(2) + "%";
        const fs = 150, W1 = K.tw(g, s1, fs, false, -2), W2 = s2 ? K.tw(g, s2, 84, false, -1) : 0;
        const bw = W1 + W2 + 80, cy = 1392, sc = lerp(0.6, 1, back(k, 2.2)) * (1 + (red && r < 1 ? 0.04 * Math.sin(r * 30) : 0));
        g.save(); K.apply(g, 540, cy, out); g.translate(540, cy); g.scale(sc, sc); g.translate(-540, -cy);
        g.globalAlpha *= clamp(k * 3);
        g.save(); g.shadowColor = red ? "rgba(229,72,77,0.35)" : "rgba(52,40,14,0.22)"; g.shadowBlur = 26; g.shadowOffsetY = 12;
        K.rr(g, 540 - bw / 2, cy - 104, bw, 196, 22); g.fillStyle = red ? C.red : C.yel; g.fill(); g.restore();
        K.text(g, s1, 540 - bw / 2 + 40, cy + 52, { size: fs, ls: -2, c: red ? C.white : C.ink });
        if (s2) K.text(g, s2, 540 - bw / 2 + 40 + W1, cy + 40, { size: 84, ls: -1, c: C.ink });
        g.restore();
        if (k > 0) K.text(g, red ? "THE " + CR.date.split(" ")[2] + " CRASH: A " + ZI + "-SIGMA DAY" : "ONE TYPICAL DAY = 1σ", 540, 1576, { size: 30, mono: true, ls: 3, align: "center", c: rgba(C.ink, 0.66), a: clamp(k * 2) * (out.a ?? 1) });
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        tape(t);
        formulaCard(t);
        marker(t);
      }
