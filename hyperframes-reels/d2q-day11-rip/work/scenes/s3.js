      const NUM_KEYS = ["spx1987", "crash"];
      // ---- s3, 1987: "On October 19th, 1987, the S&P 500 fell 20.47% in one day."
      // A tear-off calendar page MON 19 OCT 1987 slams in on "On" (with a shake); a red marker ring draws round the 19 on
      // "19th"; a highlighter sweeps the year on "1987". On "the S&P 500" the page tears off the pad and lands in the
      // corner of a big white dashboard card "S&P 500 · daily" (the SaaS look: big number top left) that rises in and
      // draws the real daily candles, 1 Sep - 16 Oct 1987 (spx1987). On "fell" the 19 Oct candle drops 282.70 -> 224.84
      // with a shake; the big number counts 0 -> -20.47% in red across "twenty point four seven percent"; on "in one day"
      // a red IN ONE DAY stamp slams and the days after appear faint, so the one candle stands alone.
      // words (global): 25 On 26 October 27 19th, 28-29 1987, 30 the 31-33 S&P 34-35 500 36 fell 37-41 20.47% 42 in 43 one 44 day.
      const g = document.getElementById("s3-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, ei, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ logo: "assets/logo.png" }, "s3-images", () => draw()); }
      const S = NUM.spx1987, CR = NUM.crash, n = S.date.length, ci = S.crash_index;
      const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const MONL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const ymd = (i) => S.date[i].split("-").map(Number);
      const dateOf = (i) => { const [y, m, d] = ymd(i); return new Date(Date.UTC(y, m - 1, d)); };
      const lab = (i) => { const [, m, d] = ymd(i); return `${d} ${MON[m - 1]}`; };
      const dowS = (i) => DOW[dateOf(i).getUTCDay()].slice(0, 3);
      const [CY_, CM, CD] = ymd(ci);                                   // 1987, 10, 19
      const CAL = { day: String(CD), dow: DOW[dateOf(ci).getUTCDay()], month: MONL[CM - 1], year: String(CY_) };
      const NEXTDAY = { day: String(ymd(ci + 1)[2]), dow: DOW[dateOf(ci + 1).getUTCDay()], month: MONL[ymd(ci + 1)[1] - 1], year: String(ymd(ci + 1)[0]) };
      const TEAR = 0.62;
      const XS = S.date.map((_, i) => i);
      const before = { open: S.open.slice(0, ci), high: S.high.slice(0, ci), low: S.low.slice(0, ci), close: S.close.slice(0, ci) };
      const crash = { open: [S.open[ci]], high: [S.high[ci]], low: [S.low[ci]], close: [S.close[ci]] };
      const after = { open: S.open.slice(ci + 1), high: S.high.slice(ci + 1), low: S.low.slice(ci + 1), close: S.close.slice(ci + 1) };
      // beats
      const tSlam = w(25) - 0.08, tRing = w(27) - 0.03, tHl = w(28) - 0.02, tTear = w(30) - 0.3, tCard = w(30) - 0.16;
      const tC0 = w(31) - 0.08, tC1 = w(34) + 0.28, tCrash = w(36) - 0.05, tCnt0 = w(37) - 0.04, tCnt1 = w(41) + 0.22;
      const tStamp = w(42) - 0.03, tAfter = w(43) - 0.05;
      // the calendar at rest, and the card
      const CALX = 540, CALY = 1066, CALW = 880;
      const CX0 = 40, CY0 = 512, CW = 1000, CH = 1110;
      const Fr = K.frame(170, CY0 + 448, 820, 522, [-0.8, n - 0.2], [200, 340]);
      const PAGE = { cx: 868, cy: CY0 + 232, w: 184, rot: 0.07 };    // where the torn page lands on the card
      const xt = [0, S.date.indexOf("1987-09-15"), S.date.indexOf("1987-10-01"), ci];
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -170, dur: 0.3 }) : K.still;
        pad(t);
        // ---- the card (from "the S&P 500")
        if (t > tCard) {
          const P = K.combine(K.enter(t - tCard, { dy: 260, pitch: 0.5, yaw: 0, rot: 0.03, sc: 0.92, fade: 0.05 }), out);
          const sh = K.shake(t - tCrash - 0.12, 13, 2);
          P.dx += sh[0]; P.dy += sh[1];
          g.save(); K.apply(g, 540, CY0 + CH / 2, P);
          K.card(g, CX0, CY0, CW, CH, { r: 30, blur: 50, dy: 26 });
          // header: an app icon, the title, the range tab
          K.rr(g, CX0 + 34, CY0 + 32, 58, 58, 16); g.fillStyle = C.blue; g.fill();
          g.save(); g.strokeStyle = C.white; g.lineWidth = 6; g.lineCap = "round"; g.lineJoin = "round";
          g.beginPath(); g.moveTo(CX0 + 46, CY0 + 74); g.lineTo(CX0 + 58, CY0 + 58); g.lineTo(CX0 + 68, CY0 + 68); g.lineTo(CX0 + 80, CY0 + 48); g.stroke(); g.restore();
          K.text(g, "S&P 500 · daily", CX0 + 112, CY0 + 76, { size: 42 });
          K.chip(g, MON[ymd(0)[1] - 1] + " – " + MON[ymd(n - 1)[1] - 1] + " " + ymd(n - 1)[0], CX0 + CW - 34, CY0 + 61, { size: 26, mono: true, ls: 1, align: "right", fill: C.mist, shadow: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", h: 50 });
          g.fillStyle = rgba(C.ink, 0.08); g.fillRect(CX0 + 30, CY0 + 118, CW - 60, 2);
          // the big number: the one-day move, counting to -20.47% in red
          K.text(g, "ONE-DAY MOVE · " + dowS(ci) + " " + lab(ci) + " " + CY_, CX0 + 40, CY0 + 172, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
          const q = eio(clamp((t - tCnt0) / (tCnt1 - tCnt0))), v = CR.ret_pct * q;
          const red = t > tCnt0;
          if (red) K.count(g, v, 2, CX0 + 32, CY0 + 312, { size: 136, c: C.red, unit: "%", neg: v < 0 });
          else K.text(g, "—", CX0 + 40, CY0 + 296, { size: 136, c: rgba(C.ink, 0.18) });
          const ks = clamp((t - tCnt0 - 0.1) / 0.3);
          if (ks > 0) K.text(g, "close " + CR.close_prev.toFixed(2) + " → " + CR.close.toFixed(2) + " · " + K.MINUS + CR.points.toFixed(2) + " pts", CX0 + 40, CY0 + 376, { size: 32, mono: true, a: ks, c: rgba(C.ink, 0.75) });
          // the chart
          K.axes(g, Fr, { k: clamp((t - tCard - 0.15) / 0.45), xt, xf: lab, yt: [200, 220, 240, 260, 280, 300, 320, 340], size: 26 });
          const nB = lerp(0, ci, clamp((t - tC0) / (tC1 - tC0)));
          K.candles(g, Fr, before, XS.slice(0, ci), { n: nB, bw: 11 });
          // the last close before the crash
          const kp = clamp((t - tC1 + 0.05) / 0.35);
          if (kp > 0) {
            K.hline(g, Fr, CR.close_prev, { k: kp, c: rgba(C.ink, 0.55), w: 3 });
            K.chip(g, dowS(ci - 1) + " " + lab(ci - 1) + " · " + CR.close_prev.toFixed(2), Fr.x + 14, Fr.Y(CR.close_prev) - 34, { k: kp, size: 26, mono: true, fill: C.white, h: 46 });
          }
          // the crash candle drops on "fell", with an overshoot
          const kc = t - tCrash;
          if (kc > 0) {
            const drop = clamp(kc / 0.22), over = 1 + 0.06 * Math.exp(-(kc - 0.22) * 9) * Math.sin(Math.max(0, kc - 0.22) * 30) * (kc > 0.22 ? 1 : 0);
            const lo = lerp(crash.open[0], crash.low[0], ei(drop)) , cl = lerp(crash.open[0], crash.close[0], ei(drop));
            const d1 = { open: crash.open, high: crash.high, low: [crash.open[0] + (lo - crash.open[0]) * over], close: [crash.open[0] + (cl - crash.open[0]) * over] };
            K.candles(g, Fr, d1, [ci], { n: 1, bw: 12, hl: 0 });
            const kl = clamp((kc - 0.25) / 0.3);
            if (kl > 0) {
              K.hline(g, Fr, CR.close, { k: kl, c: C.red, w: 3 });
              K.chip(g, dowS(ci) + " " + lab(ci) + " · " + CR.close.toFixed(2), Fr.x + 14, Fr.Y(CR.close) + 36, { k: kl, size: 26, mono: true, fill: C.red, col: C.white, h: 46, shadow: "rgba(229,72,77,0.35)", stroke: "rgba(0,0,0,0)" });
              // the drop, measured beside the candle (on its left: the days after come in on its right)
              const x = Fr.X(ci) - 30, y0 = Fr.Y(CR.close_prev), y1 = lerp(y0, Fr.Y(CR.close), eo(kl));
              g.save(); g.strokeStyle = C.red; g.lineWidth = 4; g.lineCap = "round";
              g.beginPath(); g.moveTo(x - 8, y0); g.lineTo(x + 8, y0); g.moveTo(x, y0); g.lineTo(x, y1); g.moveTo(x - 8, y1); g.lineTo(x + 8, y1); g.stroke(); g.restore();
            }
          }
          // the days after, faint: one candle stands alone
          const ka = clamp((t - tAfter) / 0.45);
          if (ka > 0) K.candles(g, Fr, after, XS.slice(ci + 1), { n: lerp(0, n - ci - 1, ka), bw: 11, a: 0.28 });
          // the provenance line
          K.prov(g, "REAL DATA · S&P 500 daily, Sep–Oct 1987", 540, CY0 + CH - 50, { align: "center", a: clamp((t - tCard - 0.3) / 0.3) });
          // the torn calendar page, landed in the card's corner, rides with the card
          if (t >= tTear + TEAR) torn(PAGE.cx, PAGE.cy, PAGE.w / CALW, PAGE.rot);
          // IN ONE DAY
          if (t > tStamp) K.stamp(g, "IN ONE DAY", 438, CY0 + 770, { u: t - tStamp, rot: -0.08, size: 64, col: C.red, ground: C.white, seed: 5, fill: "rgba(255,255,255,0.9)" });
          g.restore();
        }
        // ---- the torn page in flight, over everything
        if (t > tTear && t < tTear + TEAR) {
          const C0 = calPose(t), tear = clamp((t - tTear) / TEAR), q = eio(tear), sw = Math.sin(Math.PI * clamp(tear * 1.25)) * 0.28;
          torn(lerp(C0.cx, PAGE.cx, q), lerp(C0.cy + 44 * CALW / 680, PAGE.cy, q) - 140 * Math.sin(Math.PI * q), lerp(1, PAGE.w / CALW, q), lerp(0, PAGE.rot, q) + sw);
        }
      }
      // the calendar's pose: slams in on "On" (from 1.45x, with a shake), then floats
      function calPose(t) {
        const u = t - tSlam, sl = clamp(u / 0.14), sh = K.shake(u - 0.14, 14, 1);
        return { cx: CALX + sh[0], cy: CALY + sh[1] + K.bob(t, 1, 3), sc: lerp(1.45, 1, ei(sl)), a: sl };
      }
      // the pad: holds the page until the tear, then drops away under the rising card (its next page shows the next
      // trading day)
      function pad(t) {
        if (t <= tSlam) return;
        const P = calPose(t), padA = 1 - clamp((t - tTear - 0.05) / 0.3);
        if (padA <= 0) return;
        g.save(); g.globalAlpha = P.a * padA; g.translate(P.cx, P.cy + 160 * (1 - padA)); g.scale(P.sc, P.sc); g.translate(-CALX, -CALY);
        if (t < tTear) K.calendar(g, CALX, CALY, CALW, Object.assign({ ring: clamp((t - tRing) / 0.4), hl: clamp((t - tHl) / 0.3) }, CAL));
        else K.calendar(g, CALX, CALY, CALW, NEXTDAY);
        g.restore();
      }
      // the torn page (no binding, no pad) centred at cx, cy
      function torn(cx, cy, sc, rot) {
        g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(sc, sc); g.translate(-CALX, -CALY);
        K.calendar(g, CALX, CALY, CALW, Object.assign({ page: true, ring: 1, hl: 1 }, CAL));
        g.restore();
      }
