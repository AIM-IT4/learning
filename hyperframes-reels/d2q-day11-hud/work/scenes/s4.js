      const TEX_IDS = ["sigma_day", "z_crash"];
      const NUM_KEYS = ["normal", "crash", "bell", "logpdf"];
      // ---- s4: "At 20% volatility, a typical day moves 1.26%. So that crash was a 16-sigma day." ----
      // The normal density of daily moves (sd 1.26% a day, from sigma = 20% a year) on -6..+6 %. sigma_day types in on
      // "20% volatility" and its 1.26% locks on "1.26%" with the +-1 sigma band; z_crash types in on "So that crash", the
      // x axis zooms out to -22..+6 % (the bell shrinks to a spike), the crash lands on the axis at -20.47 %, a sigma ruler
      // runs left to it in 1-sigma steps with a rolling count, and -16.2 sigma locks on "16-sigma".
      // Continues into s5 (no erase): the chart, the strip and the readout end exactly where s5 begins.
      // words: 0 At 1 20% 2 volatility, 3 a 4 typical 5 day 6 moves 7 1.26%. 8 So 9 that 10 crash 11 was 12 a
      //        13 16-sigma 14 day.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s4-cv").getContext("2d");
      const w = (i) => W[i];
      // ---- the chart that carries across s4 -> s5 -> s6 (this block is identical in all three scenes, so each cut
      //      lands on exactly the frame the scene before it ended on) ----
      const FONT = HUD.FONT, MINUS = QC.MINUS;
      const NM = NUM.normal, CR = NUM.crash, BL = NUM.bell, LP = NUM.logpdf;
      const SD = NM.sd_day_pct, XC = CR.ret_pct, ZC = NM.z_round, ZF = -XC / SD;   // 1.26 % a day; -20.47 %; 16.2; ruler steps
      const CN = LP.crash_normal, CF = LP.crash_fat;                               // log10 density at the crash: normal, fat
      const ST = { x: 40, y: 566, w: 1000, h: 196 }, SY = ST.y + ST.h / 2;         // the formula strip
      const R1 = SY - 56, R2 = SY, R3 = SY + 56;                                   // its three rows (s5, s6)
      const PX = { x: 40, y: 778, w: 1000, h: 688 };                               // the chart panel
      const FX = 150, FY = 926, FW = 850, FH = 424, YB = FY + FH, YMAX = 0.35, LMIN = -70;
      const XL0 = -6, XL1 = 6, XZ0 = LP.x[0];                                      // x range before / after the zoom-out
      const FA = { x: 290, size: 42 }, FB = { x: 785, size: 42 }, DIVX = 537, FR = { x: 540, size: 38 };   // strip formulas
      const TITLE4 = "Daily moves if returns were normal", DATE = CR.date.toUpperCase();
      const SUB = `σ = ${(NM.sigma_annual * 100).toFixed(0)}% a year · daily returns in %`;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      // draw() waits for init() (QC.tex.show throws on an unregistered formula): a safety net only, since compose's tail
      // calls init() before the tween is built
      let READY = false;
      const lin = (lp) => Math.pow(10, lp);
      // a formula's accent part (its \class{acc} groups): x span in em from the formula's left edge
      function accRange(svg) {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const math = doc.querySelector('[data-mml-node="math"]'); if (!math) return [0, 0];
        const kids = Array.from(math.children), isAcc = (el) => /\bacc\b/.test(el.getAttribute("class") || "");
        const tx = (el) => { const m = /translate\(([-\d.]+)/.exec(el.getAttribute("transform") || ""); return m ? +m[1] : 0; };
        const i0 = kids.findIndex(isAcc); if (i0 < 0) return [0, 0];
        let i1 = i0; while (i1 + 1 < kids.length && isAcc(kids[i1 + 1])) i1++;
        const vb = doc.documentElement.getAttribute("viewBox").split(/[\s,]+/).map(Number);
        return [tx(kids[i0]) / 1000, (i1 + 1 < kids.length ? tx(kids[i1 + 1]) : vb[2]) / 1000];
      }
      // the accent part's box in px, from tex.show's bb (up/dn: em above/below the baseline)
      function accBox(id, bb, size, up = 0.8, dn = 0.12) {   // drawn 0.06 em inside on the left, 0.04 em on the right,
        const r = ACCR[id], base = bb[1] + (TEX[id].h - TEX[id].a) * size;   // so its brackets clear the symbols beside it
        return [bb[0] + (r[0] + 0.06) * size, base - up * size, bb[0] + (r[1] - 0.04) * size, base + dn * size];
      }
      // "expected ~ 4 x 10^-47 days" has no accent part: mark the count after the "~" so it can lock orange like the others
      function accAfterApprox(svg) {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const math = doc.querySelector('[data-mml-node="math"]'); if (!math) return svg;
        let on = false;
        for (const el of Array.from(math.children)) {
          if (on && el.getAttribute("data-mml-node") === "mtext") break;
          if (on) el.setAttribute("class", "acc");
          if (el.querySelector('path[data-c="2248"]')) on = true;
        }
        return new XMLSerializer().serializeToString(doc.documentElement);
      }
      const sgn = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "");
      const UP = (s) => s.toUpperCase().replace(/Σ/g, "σ");
      const xfmt = (v) => sgn(v) + Math.abs(v) + "%";
      // the plot frame for a zoom z (0: x -6..6, 1: x -22..6) and a log morph m (0: linear density, 1: log10 density).
      // Curves are passed as log10 density (numbers.json logpdf), so the same arrays draw on either scale.
      function frameAt(z, m) {
        const x0 = lerp(XL0, XZ0, z), x1 = XL1;
        const Ylin = (d) => YB - d / YMAX * FH, Ylog = (lp) => YB - (lp - LMIN) / -LMIN * FH;
        return { x: FX, y: FY, w: FW, h: FH, xr: [x0, x1], yr: [LMIN, 0], z, m, Ylin, Ylog,
          X: (v) => FX + (v - x0) / (x1 - x0) * FW,
          Y: (lp) => (m <= 0 ? Ylin(lin(lp)) : m >= 1 ? Ylog(lp) : lerp(Ylin(lin(lp)), Ylog(lp), m)),
          ix: (px) => x0 + (px - FX) / FW * (x1 - x0) };
      }
      // a curve's log10 density at x, interpolated on the logpdf grid (log space: exact for the normal's parabola)
      function lpAt(ys, x) {
        const xs = LP.x, n = xs.length;
        if (x <= xs[0]) return ys[0];
        if (x >= xs[n - 1]) return ys[n - 1];
        let i = Math.max(0, Math.min(n - 2, Math.floor((x - xs[0]) / (xs[1] - xs[0]))));
        while (i < n - 2 && xs[i + 1] < x) i++;
        while (i > 0 && xs[i] > x) i--;
        return lerp(ys[i], ys[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i]));
      }

      // ---- the strip plate and the panel head (QC.panel's title row, drawn here so the title can roll to a new one) ----
      function strip(k) { QC.panel(g, T, ST.x, ST.y, ST.w, ST.h, { open: k, op: 0.9 }); }
      function panelHead(o) {   // o = { k (open), index, title, sub, tag, frame, roll, a }
        const x = PX.x, y = PX.y, k = o.k ?? 1, ta = (o.a ?? 1) * clamp((k - 0.45) * 2.2);
        if (ta <= 0) return;
        g.save(); g.globalAlpha = ta; g.textBaseline = "alphabetic"; g.textAlign = "left";
        if (o.bar !== false) { g.fillStyle = T.line(1); g.fillRect(x + 24, y + 22, 30 * eo(k), 4); }
        if (o.index) { g.letterSpacing = "0px"; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(o.index, x + 24, y + 54); }
        if (o.title) {   // o.raw: the title is already upper-cased and rolled by the caller
          g.letterSpacing = "2px"; g.font = `600 26px ${FONT.ui}`; g.fillStyle = T.hi(1);
          g.fillText(o.raw ? o.title : HUD.rollText(UP(o.title), o.roll ?? clamp(k * 1.4 - 0.3), o.frame ?? 0, 5), x + 62, y + 54);
        }
        if (o.sub) { g.letterSpacing = "1px"; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(UP(o.sub), x + 24, y + 82); }
        if (o.tag) {
          g.letterSpacing = "1.5px"; g.font = `600 17px ${FONT.ui}`;
          const tw = g.measureText(o.tag).width + 20, bx = x + PX.w - 24 - tw;
          g.strokeStyle = T.line(0.9); g.lineWidth = 1.2; g.strokeRect(bx, y + 32, tw, 28);
          g.fillStyle = T.line(1); g.fillText(o.tag, bx + 10, y + 52);
        }
        g.restore();
      }

      // ---- axes for the zoom and the log morph: x ticks every 2 % (the odd ones fade as the axis zooms out), linear
      //      density ticks that hand over to log ticks (10^0 ... 10^-70) as m goes 0 -> 1 ----
      function axesAt(F, k, o = {}) {
        k = eo(k); if (k <= 0) return;
        const sz = 21, m = F.m, sp2 = 2 / (F.xr[1] - F.xr[0]) * F.w, aOdd = clamp((sp2 - 84) / 26);
        const xt = [];
        for (let v = -22; v <= 6; v += 2) {
          if (v < F.xr[0] - 1e-9 || v > F.xr[1] + 1e-9) continue;
          const a = (v % 4 === 0 ? 1 : aOdd) * clamp((F.X(v) - F.x - 4) / 34);
          if (a > 0.01) xt.push({ v, a, la: o.hideX && o.hideX(v) ? o.hideXa ?? 0 : 1 });
        }
        const yt = [];
        const aLin = 1 - clamp(m * 2.2), aLog = clamp(m * 1.6 - 0.45);
        if (aLin > 0) [0, 0.1, 0.2, 0.3].forEach((d) => yt.push({ y: d === 0 ? YB : lerp(F.Ylin(d), F.Ylog(Math.log10(d)), m), a: aLin, s: d.toFixed(1) }));
        if (aLog > 0) for (let e = 0; e >= LMIN; e -= 10) { const y = F.Y(e); if (y >= F.y - 1 && y <= YB + 1) yt.push({ y, a: aLog, s: QC.pow10(e) }); }
        g.save(); g.textBaseline = "alphabetic";
        g.lineWidth = 1;
        for (const tk of yt) { if (tk.y >= YB - 1) continue; g.strokeStyle = T.dim(0.22 * tk.a); g.beginPath(); g.moveTo(F.x, tk.y); g.lineTo(F.x + F.w * k, tk.y); g.stroke(); }
        for (const tk of xt) { const px = F.X(tk.v); g.strokeStyle = T.dim(0.22 * tk.a); g.beginPath(); g.moveTo(px, YB); g.lineTo(px, YB - F.h * k); g.stroke(); }
        g.strokeStyle = T.hi(0.85); g.lineWidth = 2;
        g.beginPath(); g.moveTo(F.x, YB); g.lineTo(F.x + F.w * k, YB); g.moveTo(F.x, YB); g.lineTo(F.x, YB - F.h * k); g.stroke();
        g.font = `400 ${sz}px ${FONT.mono}`; g.fillStyle = T.hi(0.85);
        g.textAlign = "center";
        xt.forEach((tk, i) => {
          const px = F.X(tk.v), ka = tk.a * clamp((k - i / Math.max(1, xt.length) * 0.6) * 3);
          if (ka <= 0) return;
          g.globalAlpha = ka; g.beginPath(); g.moveTo(px, YB); g.lineTo(px, YB + 8); g.stroke();
          if (tk.la > 0) { g.globalAlpha = ka * tk.la; g.fillText(xfmt(tk.v), px, YB + 12 + sz); }
        });
        g.textAlign = "right";
        yt.forEach((tk, i) => {
          const ka = tk.a * clamp((k - i / Math.max(1, yt.length) * 0.6) * 3);
          if (ka <= 0) return;
          g.globalAlpha = ka; g.beginPath(); g.moveTo(F.x, tk.y); g.lineTo(F.x - 8, tk.y); g.stroke();
          g.fillText(tk.s, F.x - 14, tk.y + sz * 0.36);
        });
        g.letterSpacing = "1.5px"; g.font = `500 ${sz - 2}px ${FONT.mono}`; g.fillStyle = T.line(0.95);
        const ka = clamp(k * 2 - 1);
        g.globalAlpha = ka; g.textAlign = "right"; g.fillText("DAILY MOVE", F.x + F.w, YB + 2 * sz + 26);
        g.textAlign = "left";
        const aL = clamp(1 - m * 3), aG = clamp(m * 3 - 2);
        if (aL > 0) { g.globalAlpha = ka * aL; g.fillText("DENSITY", F.x, F.y - 16); }
        if (aG > 0) { g.globalAlpha = ka * aG; g.fillText("DENSITY · LOG SCALE", F.x, F.y - 16); }
        g.restore();
      }

      // ---- the normal curve (numbers.json logpdf.normal = log10 of bell.normal on -22..6 %) ----
      function bell(F, o = {}) {
        const a = o.a ?? 1; if (a <= 0) return;
        if (o.glow > 0) {   // the highlight follows the bump only, not the flat tail lying on the axis
          const i0 = LP.x.findIndex((v) => v >= -4.5);
          QC.line(g, T, F, LP.x.slice(i0), LP.normal.slice(i0), { x1: o.x1, c: "line", w: 3.4 + 7 * o.glow, a: 0.35 * o.glow * a, glow: false });
        }
        QC.line(g, T, F, LP.x, LP.normal, { x1: o.x1, k: o.head ? 0.5 : 1, head: o.head, c: "line", w: 3.4, a });
      }
      // the +-1 sigma band under the curve (edges interpolated, not snapped to the grid)
      function band(F, k, a = 1) {
        if (k <= 0 || a <= 0) return;
        const x0 = -SD, x1 = lerp(-SD, SD, eo(k));
        g.save(); g.beginPath(); g.rect(F.x, F.y, F.w, F.h); g.clip();
        g.beginPath(); g.moveTo(F.X(x0), YB); g.lineTo(F.X(x0), F.Y(lpAt(LP.normal, x0)));
        for (let i = 0; i < LP.x.length; i++) if (LP.x[i] > x0 && LP.x[i] < x1) g.lineTo(F.X(LP.x[i]), F.Y(LP.normal[i]));
        g.lineTo(F.X(x1), F.Y(lpAt(LP.normal, x1))); g.lineTo(F.X(x1), YB); g.closePath();
        g.fillStyle = T.line(0.17 * a); g.fill();
        g.setLineDash([7, 6]); g.strokeStyle = T.hi(0.6 * a); g.lineWidth = 1.6; g.beginPath();
        g.moveTo(F.X(-SD), YB); g.lineTo(F.X(-SD), F.Y(lpAt(LP.normal, -SD)));
        if (k >= 1) { g.moveTo(F.X(SD), YB); g.lineTo(F.X(SD), F.Y(lpAt(LP.normal, SD))); }
        g.stroke(); g.restore();
      }
      // the sigma ruler: 1-sigma blocks from 0 along the axis to the left, n steps long
      function ruler(F, n, a = 1, lab = 1) {
        if (n <= 0 || a <= 0) return;
        const y0 = YB - 15, h = 9, xe = -SD * n;
        g.save(); g.beginPath(); g.rect(F.x, F.y, F.w, F.h + 2); g.clip();
        for (let i = 0; i < Math.ceil(n); i++) {
          const xa = F.X(-SD * i), xb = F.X(Math.max(xe, -SD * (i + 1)));
          if (i % 2 === 0) { g.fillStyle = T.hi(0.88 * a); g.fillRect(xb, y0, xa - xb, h); }
          else { g.fillStyle = `rgba(255,255,255,${0.95 * a})`; g.fillRect(xb, y0, xa - xb, h); g.strokeStyle = T.hi(0.88 * a); g.lineWidth = 1.2; g.strokeRect(xb + 0.6, y0 + 0.6, xa - xb - 1.2, h - 1.2); }
        }
        // whole-sigma labels every 4 steps, as the head passes them
        g.font = `400 20px ${FONT.mono}`; g.textAlign = "center"; g.textBaseline = "alphabetic";
        for (let s = 4; s <= 12; s += 4) {
          const ks = clamp((n - s) * 2) * lab;
          if (ks <= 0) continue;
          g.fillStyle = T.hi(0.85 * a * ks); g.fillText(s + "σ", F.X(-SD * s), y0 - 9);
        }
        g.restore();
      }
      // the crash on the axis: a pin at -20.47 %, its x label (the -20 % tick gives way to it) and the lock box
      function pin(F, o) {
        if (o.k <= 0) return;
        const a = o.a ?? 1, px = F.X(XC), drop = (1 - eo(o.k)) * 46;
        if (a > 0) QC.dot(g, T, px, YB - drop, { r: 6, c: o.locked ? "acc" : "hi", a: a * clamp(o.k * 3), pulse: o.pulse });
        const la = (o.la ?? 1) * clamp((o.k - 0.35) * 3);
        if (la > 0) QC.text(g, T, MINUS + Math.abs(XC).toFixed(2) + "%", px - 12, YB + 33, { size: 21, mono: true, c: "hi", a: la * 0.95 });
        if (o.lockK > 0 && a > 0) QC.lock(g, T, [px - 14, YB - 12, px + 86, YB + 38], o.lockK, { pad: 6, flash: o.flash, alpha: a });
      }
      // the big readout above the ruler: the count rolls with the ruler, -16.2 sigma locks on "16-sigma"
      function count(o) {
        const a = o.a ?? 1; if (a <= 0 || !o.s) return;
        QC.text(g, T, DATE + " · IN DAILY σ", 244, 1206, { size: 20, wt: 600, ls: 2, c: "hi", a: a * (o.ha ?? 1), roll: o.hroll, frame: o.frame });
        QC.value(g, T, o.s, 238, 1288, { size: 84, roll: o.roll, frame: o.frame, unit: "σ", flash: o.flash, a });
      }
      // the inset magnifier on the left tail at the crash: the y axis zooms in until the normal curve shows (x 10^57)
      const IN = { x: 172, y: 940, w: 410, h: 230 };
      const INF = { x: IN.x + 70, y: IN.y + 62, w: IN.w - 102, h: IN.h - 124, xr: [-21.1, -19.9] };
      const ITOP = Math.log10(3 * lin(CN)), NZ = Math.round(Math.log10(YMAX) - ITOP);   // the crash sits a third up
      function inset(F, o) {   // o = { open, e (zoom 0-1), area (0-1), locked, a, frame, flash, link }
        const a = o.a ?? 1; if (a <= 0 || o.open <= 0) return;
        const px = F.X(XC);
        // the link from the pin up to the inset
        if (o.link > 0) {
          const y0 = YB - 22, y1 = lerp(y0, IN.y + IN.h, eo(o.link));
          g.save(); g.setLineDash([6, 5]); g.strokeStyle = T.hi(0.7 * a); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke(); g.restore();
        }
        QC.panel(g, T, IN.x, IN.y, IN.w, IN.h, { open: o.open, op: 0.97, a });
        const ka = a * clamp((o.open - 0.55) * 2.5);
        if (ka <= 0) return;
        const topL = lerp(Math.log10(YMAX), ITOP, o.e), ex = Math.round(Math.log10(YMAX) - topL);
        const X = (v) => INF.x + (v - INF.xr[0]) / (INF.xr[1] - INF.xr[0]) * INF.w;
        const Y = (lp) => INF.y + INF.h - lin(lp - topL) * INF.h;
        const yb = INF.y + INF.h;
        QC.text(g, T, "LEFT TAIL · Y-ZOOM ×" + QC.pow10(ex), IN.x + 22, IN.y + 36, { size: 19, wt: 600, ls: 1.5, c: "hi", a: ka });
        g.save(); g.globalAlpha = ka;
        // axes and ticks
        g.strokeStyle = T.dim(0.22); g.lineWidth = 1; g.beginPath();
        for (const v of [-21, -20.5, -20]) { g.moveTo(X(v), yb); g.lineTo(X(v), INF.y); }
        g.moveTo(INF.x, INF.y); g.lineTo(INF.x + INF.w, INF.y); g.stroke();
        g.strokeStyle = T.hi(0.85); g.lineWidth = 2; g.beginPath(); g.moveTo(INF.x, yb); g.lineTo(INF.x + INF.w, yb); g.moveTo(INF.x, yb); g.lineTo(INF.x, INF.y); g.stroke();
        g.font = `400 20px ${FONT.mono}`; g.fillStyle = T.hi(0.85); g.textAlign = "center"; g.textBaseline = "alphabetic";
        for (const v of [-21, -20.5, -20]) { g.beginPath(); g.moveTo(X(v), yb); g.lineTo(X(v), yb + 7); g.stroke(); g.fillText(MINUS + Math.abs(v) + "%", X(v), yb + 30); }
        g.textAlign = "right"; g.fillText("0", INF.x - 10, yb + 7);
        // the curve and the tail area left of the crash, clipped to the inset plot
        g.beginPath(); g.rect(INF.x, INF.y - 2, INF.w, INF.h + 2); g.clip();
        const pts = [];
        for (let v = INF.xr[0]; v <= INF.xr[1] + 1e-9; v += 0.004) pts.push([X(v), Math.max(INF.y - 40, Y(lpAt(LP.normal, v)))]);
        if (o.area > 0) {
          const xe = lerp(INF.xr[0], XC, eo(o.area));
          g.beginPath(); g.moveTo(X(INF.xr[0]), yb);
          for (let v = INF.xr[0]; v < xe; v += 0.004) g.lineTo(X(v), Y(lpAt(LP.normal, v)));
          g.lineTo(X(xe), Y(lpAt(LP.normal, xe))); g.lineTo(X(xe), yb); g.closePath();
          g.fillStyle = o.locked ? T.acc(0.32) : T.line(0.22); g.fill();
        }
        g.lineJoin = "round"; g.lineCap = "round";
        g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.strokeStyle = T.line(0.16); g.lineWidth = 10; g.stroke();
        g.strokeStyle = T.line(0.95); g.lineWidth = 3; g.stroke();
        g.restore();
        // the crash, on the curve
        const cx = X(XC), cy = Y(CN), kc = clamp((o.e - 0.75) * 4);
        g.save(); g.globalAlpha = ka; g.setLineDash([5, 5]); g.strokeStyle = T.hi(0.6); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx, yb); g.lineTo(cx, Math.max(INF.y, cy)); g.stroke(); g.restore();
        if (kc > 0) QC.dot(g, T, cx, cy, { r: 5.5, c: o.locked ? "acc" : "hi", a: ka * kc });
      }

      // ---- the s4 chart. Defaults = as s4 leaves it (s5 and s6 open on exactly this); s4 passes its animated values ----
      function chart4(F, o = {}) {
        axesAt(F, o.axK ?? 1, { hideX: (v) => v === -20, hideXa: o.hideXa ?? 0 });
        band(F, o.bandK ?? 1, o.bandA ?? 1);
        if (o.under) o.under();
        bell(F, { x1: o.bellX1 ?? XL1, head: o.bellHead ?? false, glow: o.glow ?? 0, a: o.bellA ?? 1 });
        ruler(F, o.rulerN ?? ZF, o.rulerA ?? 1);
        pin(F, { k: o.pinK ?? 1, locked: o.locked ?? true, lockK: o.lockK ?? 1, flash: o.flash ?? false, pulse: o.pulse ?? 0,
          a: o.pinA ?? 1, la: o.pinLA ?? 1 });
        if ((o.countA ?? 1) > 0) count({ s: o.countS ?? MINUS + ZC.toFixed(1), roll: o.countRoll ?? 1, frame: o.frame,
          flash: o.countFlash ?? false, a: o.countA ?? 1, hroll: o.hroll ?? 1 });
      }
      // ---- the s4 strip: sigma_day | z_crash. Defaults = as s4 leaves it; sweep = x of an erase line moving right ----
      function strip4(o = {}) {
        const sx = o.sweep ?? -1, c = o.clip ?? [QC.STAGE.x0, QC.STAGE.x1], clip = [Math.max(c[0], sx), c[1]];
        const s1 = QC.tex.show("sigma_day", { x: FA.x, y: SY, size: FA.size, align: "center", valign: "middle",
          a: o.a1 ?? 1, k: o.k1 ?? 1, lock: o.lock1 ?? true, clip });
        const b1 = accBox("sigma_day", s1.bb, FA.size);
        if ((o.kl1 ?? 1) > 0 && sx < b1[0] - 6) QC.lock(g, T, b1, o.kl1 ?? 1, { pad: 4, flash: o.fl1 ?? false });
        const kd = o.kDiv ?? 1;
        if (kd > 0 && sx < DIVX) { g.save(); g.strokeStyle = T.dim(0.55 * kd); g.lineWidth = 1.5; g.beginPath(); g.moveTo(DIVX, SY - 44 * eo(kd)); g.lineTo(DIVX, SY + 44 * eo(kd)); g.stroke(); g.restore(); }
        const s2 = QC.tex.show("z_crash", { x: FB.x, y: SY, size: FB.size, align: "center", valign: "middle",
          a: o.a2 ?? 1, k: o.k2 ?? 1, lock: o.lock2 ?? true, clip });
        const b2 = accBox("z_crash", s2.bb, FB.size);
        if ((o.kl2 ?? 1) > 0 && sx < b2[0] - 6) QC.lock(g, T, b2, o.kl2 ?? 1, { pad: 4, flash: o.fl2 ?? false });
      }
      // ---- the s5 strip: p_tail over big_bang over expected. Defaults = as s5 leaves it (s6 opens on it) ----
      function strip5(o = {}) {
        const sx = o.sweep ?? -1, c = o.clip ?? [QC.STAGE.x0, QC.STAGE.x1], clip = [Math.max(c[0], sx), c[1]], dx = o.dx ?? 0;
        if ((o.pA ?? 1) > 0) {
          const p = QC.tex.show("p_tail", { x: FR.x + dx, y: o.pY ?? R1, size: FR.size, align: "center", valign: "middle",
            a: o.pA ?? 1, k: o.pK ?? 1, lock: o.pLock ?? true, clip });
          const b = accBox("p_tail", p.bb, FR.size, 0.95, 0.12);
          const pa = o.pLA ?? 0;   // p_tail's lock is released as it moves up for the Big Bang lines
          if ((o.pLK ?? 1) > 0 && pa > 0 && sx < b[0] - 6) QC.lock(g, T, b, o.pLK ?? 1, { pad: 4, flash: o.pFl ?? false, alpha: pa });
        }
        if ((o.bA ?? 1) > 0) QC.tex.show("big_bang", { x: FR.x - dx, y: R2, size: FR.size, align: "center", valign: "middle",
          a: o.bA ?? 1, k: o.bK ?? 1, clip });
        if ((o.eA ?? 1) > 0) {
          const e = QC.tex.show("expected", { x: FR.x + dx, y: R3, size: FR.size, align: "center", valign: "middle",
            a: o.eA ?? 1, k: o.eK ?? 1, lock: o.eLock ?? true, clip });
          const b = accBox("expected", e.bb, FR.size, 0.95, 0.12);
          if ((o.eLK ?? 1) > 0 && sx < b[0] - 6) QC.lock(g, T, b, o.eLK ?? 1, { pad: 4, flash: o.eFl ?? false });
        }
      }
      // a short scan line across the strip, for an erase sweep at x
      function stripScan(x) {
        if (x <= ST.x + 1 || x >= ST.x + ST.w - 1) return;
        g.save();
        const gr = g.createLinearGradient(x - 50, 0, x + 4, 0); gr.addColorStop(0, T.line(0)); gr.addColorStop(1, T.line(0.14));
        g.fillStyle = gr; g.fillRect(x - 50, ST.y, 54, ST.h);
        g.strokeStyle = T.line(0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x, ST.y); g.lineTo(x, ST.y + ST.h); g.stroke();
        g.restore();
      }
      // the panel's index and title alone (panelHead draws them the same way), so a new title can roll over the old one
      function panelLabel(index, title, a = 1) {
        if (a <= 0) return;
        g.save(); g.globalAlpha = a; g.textBaseline = "alphabetic"; g.textAlign = "left";
        if (index) { g.letterSpacing = "0px"; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(index, PX.x + 24, PX.y + 54); }
        if (title) { g.letterSpacing = "2px"; g.font = `600 26px ${FONT.ui}`; g.fillStyle = T.hi(1); g.fillText(title, PX.x + 62, PX.y + 54); }
        g.restore();
      }
      // the s5 title as s5 leaves it (s6 opens on it)
      const TITLE5A = "The normal curve", TITLE5B = " · what Black–Scholes assumes";
      // ---- s4 timeline ----
      const tF1 = w(1) - 0.05, tB0 = w(3) - 0.35, tB1 = w(6) + 0.2, tSD = w(7), tF2 = w(8);
      const tZ0 = w(8) + 0.12, tZ1 = w(10) + 0.2, tPin = w(10) + 0.04, tR0 = w(10) + 0.14, tR1 = w(13) - 0.02, tLock = w(13);
      const ACCR = {};
      const st = { t: 0 };
      function init() {
        for (const id of TEX_IDS) ACCR[id] = accRange(TEX[id].svg);
        QC.tex.init(document.querySelector('[data-composition-id="s4"]'), TEX, T);
        READY = true;
      }
      function draw() {
        if (!READY) return;
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = QC.STAGE.x0;          // no erase: s5 carries the chart on
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the strip: sigma_day on "20% volatility" (1.26% locks on "1.26%"), z_crash on "So that crash" ----
        strip(clamp(t / 0.45));
        strip4({ clip,
          a1: clamp((t - tF1) / 0.15), k1: clamp((t - tF1) / 0.6), lock1: t >= tSD, kl1: clamp((t - (tSD - 0.2)) / 0.3), fl1: hit(t, tSD + 0.1),
          kDiv: clamp((t - tF2) / 0.3),
          a2: clamp((t - tF2) / 0.15), k2: clamp((t - tF2) / 0.55), lock2: t >= tLock, kl2: clamp((t - (tLock - 0.2)) / 0.3), fl2: hit(t, tLock + 0.1) });
        // ---- the chart ----
        const kP = clamp((t - 0.1) / 0.45);
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: kP });
        panelHead({ k: kP, index: "04", title: TITLE4, sub: SUB, tag: "MODEL", frame: f });
        const z = eio((t - tZ0) / (tZ1 - tZ0)), F = frameAt(z, 0);
        const kPin = clamp((t - tPin) / 0.25), kB = clamp((t - tB0) / (tB1 - tB0));
        const kR = clamp((t - tR0) / (tR1 - tR0)), nR = ZF * (1 - (1 - kR) * (1 - kR)), final = t >= tLock - 0.1;
        // the +-1 sigma band on "1.26%", with its label inside it (gone before the axis zooms out)
        const aLab = clamp((t - (tSD - 0.1)) / 0.25) * (1 - clamp((t - tZ0) / 0.2));
        const under = () => {
          if (aLab <= 0) return;
          const cx = F.X(0);
          QC.text(g, T, "±1σ", cx, 1188, { size: 26, wt: 600, align: "center", c: "hi", a: aLab });
          QC.value(g, T, SD.toFixed(2), cx - 4, 1262, { size: 56, align: "center", unit: "%", roll: clamp((t - (tSD - 0.25)) / 0.35), frame: f, flash: hit(t, tSD + 0.1), a: aLab });
        };
        chart4(F, { axK: clamp((t - 0.25) / 0.5), hideXa: 1 - clamp(kPin * 4),
          bandK: clamp((t - (tSD - 0.12)) / 0.3), under,
          bellX1: lerp(XL0, XL1, eio(kB)), bellHead: kB > 0 && kB < 1, bellA: kB > 0 ? 1 : 0,
          rulerN: nR,
          pinK: kPin, locked: t >= tLock + 0.1, lockK: clamp((t - (tLock - 0.2)) / 0.3), flash: hit(t, tLock + 0.1),
          pulse: clamp((t - w(14)) / 0.6) < 1 ? clamp((t - w(14)) / 0.6) : 0,
          countA: kR > 0 ? clamp(kR * 6) : 0, countS: final ? undefined : MINUS + Math.min(Math.floor(ZF), Math.ceil(nR)),
          countRoll: final ? clamp((t - (tLock - 0.1)) / 0.2) : 0.999, countFlash: hit(t, tLock + 0.1), hroll: clamp(kR * 2), frame: f });
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
