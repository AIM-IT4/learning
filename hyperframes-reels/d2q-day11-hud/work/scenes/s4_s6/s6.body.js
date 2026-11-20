      // ---- s6 timeline ----
      const tC0 = w(0), tFall = w(2) - 0.16, tHit = w(2), tT6 = w(3), tM0 = w(3) + 0.02, tM1 = w(5) + 0.06;
      const tFat0 = w(6), tFat1 = w(6) + 0.55, tRise0 = w(6) + 0.04, tRise1 = w(6) + 0.38;
      const tSw = w(7) - 0.06, tFR = w(7) + 0.04, tRL = w(10);
      const DF = (/(\d+)\s*degrees/.exec(BL.fat_note) || [])[1];
      const TITLE6 = "Normal vs fat tails · log scale";
      const SUB6 = `log10 density · fat tails: Student-t, ${DF} df, same ${SD.toFixed(2)}% sd`;
      const LG = { x: 684, y: 1112, w: 318, h: 190 };
      const TAGX = FX + 66, TAGY = 1020;              // the crash callout: two tags, the first one's bottom at TAGY - 4
      const ACCR = {};
      const st = { t: 0 };
      function init() {
        TEX.expected.svg = accAfterApprox(TEX.expected.svg);
        for (const id of TEX_IDS) ACCR[id] = accRange(TEX[id].svg);
        QC.tex.init(document.querySelector('[data-composition-id="s6"]'), TEX, T);
        READY = true;
      }
      // the panel's sub line alone (as panelHead draws it), so it can hand over to the log-scale one
      function subLine(s, a) {
        if (a <= 0) return;
        g.save(); g.globalAlpha = a; g.textBaseline = "alphabetic"; g.textAlign = "left";
        g.letterSpacing = "1px"; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(s, PX.x + 24, PX.y + 82);
        g.restore();
      }
      // legend + table: which curve is which, and the days below -4 sigma a year under each (illustrative for fat tails)
      function legend(o) {
        if (o.open <= 0) return;
        QC.panel(g, T, LG.x, LG.y, LG.w, LG.h, { open: o.open, op: 0.95 });
        const ka = clamp((o.open - 0.5) * 2); if (ka <= 0) return;
        const x = LG.x + 20, xr = LG.x + LG.w - 20;
        if (o.head > 0) QC.text(g, T, "DAYS BELOW " + MINUS + "4σ · PER YEAR", x, LG.y + 38, { size: 18, wt: 600, ls: 1.5, c: "hi", a: ka * clamp(o.head * 3), roll: o.head, frame: o.frame });
        const row = (y, c, name, v, kv) => {
          g.save(); g.globalAlpha = ka; g.strokeStyle = T[c](0.95); g.lineWidth = c === "hi" ? 3.6 : 3.2; g.lineCap = "round";
          g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 30, y - 8); g.stroke(); g.restore();
          QC.text(g, T, name, x + 44, y, { size: 24, wt: 600, ls: 1, c, a: ka });
          if (kv > 0) QC.text(g, T, v, xr, y, { size: 26, mono: true, c: "hi", align: "right", a: ka * clamp(kv * 3), roll: kv, frame: o.frame, seed: y });
        };
        row(LG.y + 92, "line", "NORMAL", BL.per_year_normal.toFixed(3), o.v1);
        row(LG.y + 140, "hi", "FAT TAILS", BL.per_year_fat.toFixed(2), o.v2);
        QC.text(g, T, "ILLUSTRATIVE", x + 44, LG.y + 168, { size: 18, mono: true, ls: 1.5, c: "dim", a: ka });
      }
      function draw() {
        if (!READY) return;
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xOut = t > DUR - 0.4 ? QC.scanOut(t, DUR, 0.4) : QC.STAGE.x0;   // carried on from s5; scan-erase at the end
        QC.clipStage(g, QC.STAGE.x1, xOut);
        const clip = [xOut, QC.STAGE.x1];
        const glitch = hit(t, tHit), jit = glitch ? [-18, 22, -12][f % 3] : 0;
        // ---- the strip: s5's three lines hold through "did." (jolted by the glitch), sweep away on "crashes";
        //      fat_ratio types in and ~97 locks on "more" ----
        strip(1);
        const sx = lerp(ST.x - 2, ST.x + ST.w + 2, eio((t - tSw) / 0.3));
        if (sx < ST.x + ST.w) strip5({ sweep: sx, clip, dx: jit });
        stripScan(sx);
        const kFR = clamp((t - tFR) / 0.5);
        if (t >= tFR) {
          const r = QC.tex.show("fat_ratio", { x: FR.x, y: R2, size: 42, align: "center", valign: "middle", a: clamp((t - tFR) / 0.12),
            k: kFR, lock: t >= tRL, clip });
          if (t >= tRL - 0.2) QC.lock(g, T, accBox("fat_ratio", r.bb, 42), clamp((t - (tRL - 0.2)) / 0.3), { pad: 6, flash: hit(t, tRL + 0.1) });
        }
        // ---- the chart: the title and sub hand over to the log-scale chart on "Real returns" ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: 1 });
        panelHead({ k: 1, tag: "MODEL" });
        const kT = clamp((t - tT6) / 0.42), aOld = 1 - clamp((t - (tT6 - 0.06)) / 0.1);
        subLine(UP(SUB), aOld);
        panelLabel("05", UP(TITLE5A) + UP(TITLE5B), aOld);
        if (kT > 0) {
          panelLabel(HUD.rollText("06", kT, f, 3), HUD.rollText(UP(TITLE6), kT, f, 5));
          subLine(HUD.rollText(UP(SUB6), kT, f, 7), clamp(kT * 3));
        }
        const m = eio((t - tM0) / (tM1 - tM0)), F = frameAt(1, m);
        const kF = clamp((t - tHit) / 0.12), kRise = eio((t - tRise0) / (tRise1 - tRise0));
        // s4's chart: the readout, the ruler and the pin's lock go on the slam; the band goes as the scale turns log
        chart4(F, { bandA: 1 - clamp((t - tM0) / 0.3), rulerA: 1 - kF, pinA: 1 - kF, countA: 1 - kF });
        // s5's inset closes on "But"
        const kc = 1 - eio((t - tC0) / 0.26);
        inset(F, { open: kc, link: kc, e: 1, area: 1, locked: true, frame: f });
        const px = F.X(XC);
        // -4 sigma, the threshold in fat_ratio and the table
        const kV = clamp((t - (w(7) + 0.02)) / 0.3);
        if (kV > 0) {
          const xv = F.X(-4 * SD), yTop = F.Y(lpAt(LP.fat, -4 * SD)) + 10;
          g.save(); g.setLineDash([7, 6]); g.strokeStyle = T.hi(0.6 * kV); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(xv, YB); g.lineTo(xv, lerp(YB, yTop, eo(kV))); g.stroke(); g.restore();
          QC.text(g, T, MINUS + "4σ", xv - 8, YB - 14, { size: 21, mono: true, c: "hi", align: "right", a: kV });
        }
        // the fat-tailed curve (illustrative) draws on top on "fat tails"
        const kFat = clamp((t - tFat0) / (tFat1 - tFat0));
        if (kFat > 0) QC.line(g, T, F, LP.x, LP.fat, { x1: lerp(XZ0, XL1, eio(kFat)), k: kFat < 1 ? 0.5 : 1, head: kFat < 1, c: "hi", w: 3.6 });
        // where the normal curve puts the crash (~10^-58), and the dot rising onto the fat-tailed curve (~10^-5)
        if (kRise > 0) {
          const yN = F.Y(CN), yD = F.Y(lerp(CN, CF, kRise));
          g.save(); g.setLineDash([5, 5]); g.strokeStyle = T.acc(0.75); g.lineWidth = 2;
          g.beginPath(); g.moveTo(px, yN); g.lineTo(px, yD); g.stroke(); g.setLineDash([]);
          g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.arc(px, yN, 8, 0, 2 * Math.PI); g.fill();
          g.strokeStyle = T.line(0.95); g.lineWidth = 2.4; g.beginPath(); g.arc(px, yN, 6.5, 0, 2 * Math.PI); g.stroke();
          g.restore();
          QC.text(g, T, "≈ " + QC.pow10(Math.round(CN)), px + 18, yN + 8, { size: 22, mono: true, c: "line", a: clamp((kRise - 0.3) * 2) });
        }
        // "did.": the real crash slams onto the axis
        if (t >= tFall) {
          const kf = clamp((t - tFall) / (tHit - tFall)), y = t < tHit ? lerp(FY + 30, YB, kf * kf) : F.Y(lerp(CN, CF, kRise));
          if (t < tHit) {
            const gr = g.createLinearGradient(0, y - 120, 0, y);
            gr.addColorStop(0, T.acc(0)); gr.addColorStop(1, T.acc(0.6));
            g.save(); g.strokeStyle = gr; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(px, Math.max(FY, y - 120)); g.lineTo(px, y); g.stroke(); g.restore();
          }
          // its callout sits in the wedge between the two curves' final places (no curve ever crosses it), joined to the
          // dot by a leader that follows it down the axis, along the morph and up onto the fat-tailed curve
          const kl = clamp((t - (tHit + 0.1)) / 0.2), ta = clamp((t - (tHit + 0.22)) / 0.12);
          if (kl > 0) {
            const ax = TAGX - 4, ay = TAGY - 2, d = Math.hypot(ax - px, ay - y), ux = (ax - px) / d, uy = (ay - y) / d;
            const x0 = px + ux * 13, y0 = y + uy * 13, e = eo(kl);
            g.save(); g.strokeStyle = T.acc(0.9); g.lineWidth = 1.8;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(lerp(x0, ax, e), lerp(y0, ay, e)); g.stroke(); g.restore();
          }
          if (ta > 0) {
            QC.tag(g, T, DATE, TAGX, TAGY - 4, { c: "acc", size: 20, a: ta });
            QC.tag(g, T, "IT HAPPENED", TAGX, TAGY + 31, { c: "acc", size: 20, a: ta });
          }
          const pu = clamp((t - tHit) / 0.45);
          QC.dot(g, T, px, y, { r: 9, c: "acc", pulse: pu > 0 && pu < 1 ? pu : 0, s: t < tHit + 0.08 && t >= tHit ? 1.5 : 1 });
        }
        // the legend and the per-year table
        legend({ open: clamp((t - (tFat0 + 0.25)) / 0.3), head: clamp((t - tSw) / 0.35), v1: clamp((t - w(8)) / 0.3),
          v2: clamp((t - w(9)) / 0.3), frame: f });
        g.restore();
        QC.scanLine(g, T, xOut);
        if (glitch) HUD.glitch(g, 1080, 1920, 1, 17 + f);   // the film's one glitch: three frames on "did."
        QC.tex.end();
      }
