// QCHART: the quant chart kit for the light HUD scenes (panels, axes, curves, candles, bars, markers, rolling values,
// target locks and typeset LaTeX formulas). Needs HOLOHUD above it. Pure functions of what you pass in: call them from
// draw() every frame. Colours are theme keys ('line' blue, 'hi' navy, 'dim' pale blue, 'acc' orange) or CSS strings.
const QC = (function () {
  const { HUD } = HOLOHUD, FONT = HUD.FONT;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const C = (T, c, a) => (typeof c === 'function' ? c(a) : (T[c] && typeof T[c] === 'function') ? T[c](a) : c);
  const MINUS = '−';
  const fmt = (v, d = 2) => (v < 0 ? MINUS : '') + Math.abs(v).toFixed(d);
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const pow10 = (e) => '10' + String(e).split('').map((ch) => SUP[ch] || ch).join('');

  // ---- a plot frame: data -> px. xr, yr: data ranges; for a log axis pass log10 values and format ticks with pow10 ----
  function frame(x, y, w, h, xr, yr) {
    return { x, y, w, h, xr, yr,
      X: (v) => x + (v - xr[0]) / (xr[1] - xr[0]) * w,
      Y: (v) => y + h - (v - yr[0]) / (yr[1] - yr[0]) * h,
      ix: (px) => xr[0] + (px - x) / w * (xr[1] - xr[0]) };
  }

  // ---- panel: white plate + corner brackets, opening from its centre; title row (index tick, title, sub, tag) ----
  function panel(g, T, x, y, w, h, o = {}) {
    const a = o.a ?? 1, k = o.open ?? 1;
    if (a <= 0 || k <= 0) return;
    const ow = w * (0.5 + 0.5 * eo(k));
    HUD.plate(g, T, x + (w - ow) / 2, y, ow, h, clamp(k * 1.5) * a, { op: o.op ?? 0.82 });
    if (!o.title) return;
    const ta = a * clamp((k - 0.45) * 2.2);
    if (ta <= 0) return;
    g.save(); g.globalAlpha = ta; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = T.line(1); g.fillRect(x + 24, y + 22, 30 * eo(k), 4);
    let tx = x + 24;
    if (o.index) { g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(o.index, tx, y + 54); tx += 38; }
    g.letterSpacing = '2px'; g.font = `600 ${o.ts ?? 26}px ${FONT.ui}`; g.fillStyle = T.hi(1);
    g.fillText(HUD.rollText(o.title.toUpperCase().replace(/Σ/g, 'σ').replace(/Λ/g, 'λ'), clamp(k * 1.4 - 0.3), o.frame ?? 0, 5), tx, y + 54);
    if (o.sub) { g.letterSpacing = '1px'; g.font = `400 19px ${FONT.mono}`; g.fillStyle = T.dim(1); g.fillText(o.sub.toUpperCase().replace(/Σ/g, 'σ').replace(/Λ/g, 'λ'), x + 24, y + 82); }
    if (o.tag) {
      g.letterSpacing = '1.5px'; g.font = `600 17px ${FONT.ui}`;
      const tw = g.measureText(o.tag).width + 20, bx = x + w - 24 - tw;
      g.strokeStyle = C(T, o.tagC || 'line', 0.9); g.lineWidth = 1.2; g.strokeRect(bx, y + 32, tw, 28);
      g.fillStyle = C(T, o.tagC || 'line', 1); g.fillText(o.tag, bx + 10, y + 52);
    }
    g.restore();
  }

  // ---- a tick label; "10⁻⁵⁹"-style labels (QC.pow10) are drawn as the base plus a raised, smaller exponent in the
  //      same face, so no superscript glyph falls back to another font ----
  const SUPR = { '\u207b': MINUS, '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9' };
  function tick(g, s, x, y, align, sz) {
    const m = /^(.*?)([\u207b\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)$/.exec(s);
    if (!m) { g.textAlign = align; g.fillText(s, x, y); return; }
    const base = m[1], ex = m[2].split('').map((c) => SUPR[c]).join('');
    const f0 = g.font, fe = f0.replace(/(\d+(?:\.\d+)?)px/, (_, n) => Math.round(n * 0.68) + 'px');
    const wb = g.measureText(base).width; g.font = fe; const we = g.measureText(ex).width; g.font = f0;
    const tw = wb + 2 + we, x0 = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    g.textAlign = 'left'; g.fillText(base, x0, y);
    g.font = fe; g.fillText(ex, x0 + wb + 2, y - sz * 0.42); g.font = f0;
  }

  // ---- axes: o = { xt, yt (tick values), xf, yf (tick formats), xl, yl (axis titles), grid, k (draw-in 0-1), a,
  //      xAt (data y of the x axis; default yr[0]), yAt (data x of the y axis; default xr[0]), size (tick px) } ----
  function axes(g, T, F, o = {}) {
    const a = o.a ?? 1, k = eo(o.k ?? 1);
    if (a <= 0 || k <= 0) return;
    const xAt = F.Y(o.xAt ?? F.yr[0]), yAt = F.X(o.yAt ?? F.xr[0]), sz = o.size ?? 21;
    g.save(); g.textBaseline = 'alphabetic';
    if (o.grid !== false) {
      g.strokeStyle = T.dim(0.22 * a); g.lineWidth = 1;
      g.beginPath();
      (o.yt || []).forEach((v) => { const py = F.Y(v); g.moveTo(F.x, py); g.lineTo(F.x + F.w * k, py); });
      (o.xt || []).forEach((v) => { const px = F.X(v); g.moveTo(px, F.y + F.h); g.lineTo(px, F.y + F.h - F.h * k); });
      g.stroke();
    }
    g.strokeStyle = T.hi(0.85 * a); g.lineWidth = 2;
    g.beginPath(); g.moveTo(F.x, xAt); g.lineTo(F.x + F.w * k, xAt);
    if (!o.noY) { g.moveTo(yAt, F.y + F.h); g.lineTo(yAt, F.y + F.h - F.h * k); }
    g.stroke();
    g.font = `400 ${sz}px ${FONT.mono}`; g.fillStyle = T.hi(0.85 * a);
    g.textAlign = 'center';
    (o.xt || []).forEach((v, i) => {
      const px = F.X(v), ka = clamp((k - i / Math.max(1, o.xt.length) * 0.6) * 3);
      if (ka <= 0) return;
      g.globalAlpha = ka; g.beginPath(); g.moveTo(px, xAt); g.lineTo(px, xAt + 8); g.stroke();
      tick(g, o.xf ? o.xf(v) : String(v), px, xAt + 12 + sz, 'center', sz);
    });
    g.globalAlpha = 1;
    if (!o.noY) {
      g.textAlign = 'right';
      (o.yt || []).forEach((v, i) => {
        const py = F.Y(v), ka = clamp((k - i / Math.max(1, o.yt.length) * 0.6) * 3);
        if (ka <= 0) return;
        g.globalAlpha = ka; g.beginPath(); g.moveTo(yAt, py); g.lineTo(yAt - 8, py); g.stroke();
        tick(g, o.yf ? o.yf(v) : String(v), yAt - 14, py + sz * 0.36, 'right', sz);
      });
    }
    g.globalAlpha = a * clamp(k * 2 - 1);
    g.letterSpacing = '1.5px'; g.font = `500 ${sz - 2}px ${FONT.mono}`; g.fillStyle = T.line(0.95);
    if (o.xl) { g.textAlign = 'right'; g.fillText(o.xl.toUpperCase().replace(/Σ/g, 'σ').replace(/Λ/g, 'λ'), F.x + F.w, xAt + 2 * sz + 26); }
    if (o.yl) { g.textAlign = 'left'; g.fillText(o.yl.toUpperCase().replace(/Σ/g, 'σ').replace(/Λ/g, 'λ'), yAt - (o.ylDx ?? 0), F.y - 16); }
    g.restore();
  }

  // ---- a curve. o = { c, w, a, k (0-1 of the x range drawn, left to right) or x1 (data x drawn up to), dash, glow,
  //      head (a dot + short scan line at the drawing front), clipY (keep inside the frame vertically) } ----
  function line(g, T, F, xs, ys, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return null;
    const xEnd = o.x1 ?? lerp(xs[0], xs[xs.length - 1], clamp(o.k ?? 1));
    g.save();
    if (o.clipY !== false) { g.beginPath(); g.rect(F.x - 4, F.y - 4, F.w + 8, F.h + 8); g.clip(); }
    const pts = []; let last = null;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] > xEnd) {
        if (i > 0) { const f = (xEnd - xs[i - 1]) / (xs[i] - xs[i - 1]); last = [xEnd, lerp(ys[i - 1], ys[i], f)]; pts.push([F.X(last[0]), F.Y(last[1])]); }
        break;
      }
      pts.push([F.X(xs[i]), F.Y(ys[i])]); last = [xs[i], ys[i]];
    }
    if (pts.length < 2) { g.restore(); return null; }
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (o.glow !== false) { path(); g.strokeStyle = C(T, o.c || 'line', 0.16 * a); g.lineWidth = (o.w ?? 3) + 8; g.stroke(); }
    path(); g.setLineDash(o.dash || []); g.strokeStyle = C(T, o.c || 'line', 0.95 * a); g.lineWidth = o.w ?? 3; g.stroke();
    g.setLineDash([]);
    const end = pts[pts.length - 1];
    if (o.head && (o.k ?? 1) < 1) {
      g.fillStyle = C(T, o.c || 'line', a); g.beginPath(); g.arc(end[0], end[1], 6, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = T.line(0.35 * a); g.lineWidth = 1.5; g.beginPath(); g.moveTo(end[0], F.y); g.lineTo(end[0], F.y + F.h); g.stroke();
    }
    g.restore();
    return { end, last };
  }

  // ---- filled area between a curve and a base level (data y). o = { base, c, a, k, x0, x1 (data x span) } ----
  function area(g, T, F, xs, ys, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const base = o.base ?? F.yr[0], x0 = o.x0 ?? xs[0];
    const x1 = Math.min(o.x1 ?? xs[xs.length - 1], lerp(xs[0], xs[xs.length - 1], clamp(o.k ?? 1)));
    if (x1 <= x0) return;
    g.save(); g.beginPath(); g.rect(F.x, F.y, F.w, F.h); g.clip();
    g.beginPath(); g.moveTo(F.X(x0), F.Y(base)); let started = false;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < x0) continue; if (xs[i] > x1) break;
      g.lineTo(F.X(xs[i]), F.Y(ys[i])); started = true;
    }
    if (!started) { g.restore(); return; }
    g.lineTo(F.X(x1), F.Y(base)); g.closePath();
    g.fillStyle = C(T, o.c || 'line', (o.fa ?? 0.16) * a); g.fill();
    g.restore();
  }

  // ---- bars (a histogram): xs = bar centres (data), ys = heights; o = { bw (data width), base, c, a, k (grow),
  //      stroke, fa (fill alpha), hl: [indices drawn in the accent] } ----
  function bars(g, T, F, xs, ys, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const base = o.base ?? F.yr[0], bw = o.bw ?? (xs[1] - xs[0]) * 0.8;
    g.save();
    for (let i = 0; i < xs.length; i++) {
      const ki = eo(clamp((o.k ?? 1) * 1.6 - i / xs.length * 0.6));
      if (ki <= 0) continue;
      const hv = lerp(base, ys[i], ki), x0 = F.X(xs[i] - bw / 2), x1 = F.X(xs[i] + bw / 2), y0 = F.Y(base), y1 = F.Y(hv);
      if (Math.abs(y1 - y0) < 0.75) continue;
      const hl = (o.hl || []).includes(i), c = hl ? 'acc' : (o.c || 'line');
      g.fillStyle = C(T, c, (o.fa ?? 0.22) * a); g.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
      g.strokeStyle = C(T, c, 0.9 * a); g.lineWidth = o.stroke ?? 1.6; g.strokeRect(x0 + 0.5, Math.min(y0, y1) + 0.5, x1 - x0 - 1, Math.abs(y1 - y0) - 1);
    }
    g.restore();
  }

  // ---- candles: d = { open, high, low, close } arrays, xs = data x per candle; o = { n (how many shown, may be
  //      fractional: the last one grows), bw (px), hl (index in the accent), a } ----
  function candles(g, T, F, d, xs, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const n = o.n ?? xs.length, bw = o.bw ?? 10;
    g.save();
    for (let i = 0; i < Math.min(xs.length, Math.ceil(n)); i++) {
      const grow = clamp(n - i);
      const op = d.open[i], cl = lerp(op, d.close[i], eo(grow)), hi = lerp(op, d.high[i], eo(grow)), lo = lerp(op, d.low[i], eo(grow));
      const up = d.close[i] >= op, hl = o.hl === i, cx = F.X(xs[i]);
      const col = hl ? T.acc(a) : up ? T.line(0.95 * a) : T.hi(0.9 * a);
      g.strokeStyle = col; g.lineWidth = hl ? 2.4 : 1.6;
      g.beginPath(); g.moveTo(cx, F.Y(hi)); g.lineTo(cx, F.Y(lo)); g.stroke();
      const y0 = F.Y(Math.max(op, cl)), y1 = F.Y(Math.min(op, cl)), hh = Math.max(2, y1 - y0);
      if (up && !hl) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(cx - bw / 2, y0, bw, hh); g.strokeRect(cx - bw / 2 + 0.5, y0 + 0.5, bw - 1, hh - 1); }
      else { g.fillStyle = col; g.fillRect(cx - bw / 2, y0, bw, hh); }
    }
    g.restore();
  }

  // ---- reference lines: o = { c, a, dash, w, label, at ('start'|'end'), size } ----
  function hline(g, T, F, v, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const py = F.Y(v), k = clamp(o.k ?? 1);
    g.save(); g.setLineDash(o.dash ?? [10, 8]); g.strokeStyle = C(T, o.c || 'hi', 0.75 * a); g.lineWidth = o.w ?? 2;
    g.beginPath(); g.moveTo(F.x, py); g.lineTo(F.x + F.w * k, py); g.stroke(); g.setLineDash([]);
    if (o.label && k > 0.6) { g.globalAlpha = clamp((k - 0.6) * 2.5); tag(g, T, o.label, o.at === 'start' ? F.x + 10 : F.x + F.w - 10, py - 10, { c: o.c || 'hi', align: o.at === 'start' ? 'left' : 'right', a, size: o.size }); }
    g.restore();
  }
  function vline(g, T, F, v, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const px = F.X(v), k = clamp(o.k ?? 1);
    g.save(); g.setLineDash(o.dash ?? [10, 8]); g.strokeStyle = C(T, o.c || 'hi', 0.75 * a); g.lineWidth = o.w ?? 2;
    g.beginPath(); g.moveTo(px, F.y + F.h); g.lineTo(px, F.y + F.h - F.h * k); g.stroke(); g.setLineDash([]);
    if (o.label && k > 0.6) { g.globalAlpha = clamp((k - 0.6) * 2.5); tag(g, T, o.label, px + (o.dx ?? 0), (o.y ?? F.y) - 6, { c: o.c || 'hi', align: o.align || 'center', a, size: o.size }); }
    g.restore();
  }

  // ---- a marker dot with a ring; o = { r, c, a, pulse (0-1 expanding ring) } ----
  function dot(g, T, x, y, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    const r = (o.r ?? 7) * (o.s ?? 1);
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(x, y, r + 3, 0, 2 * Math.PI); g.fill();
    g.fillStyle = C(T, o.c || 'line', a); g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = C(T, o.c || 'line', 0.55 * a); g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r + 7, 0, 2 * Math.PI); g.stroke();
    if (o.pulse > 0 && o.pulse < 1) { g.strokeStyle = C(T, o.c || 'line', 0.8 * a * (1 - o.pulse)); g.beginPath(); g.arc(x, y, r + 7 + 34 * o.pulse, 0, 2 * Math.PI); g.stroke(); }
    g.restore();
  }

  // ---- text: o = { size, wt, c, a, align, mono, ls, roll (0-1), frame, seed, base ('alphabetic'|'middle') } ----
  function text(g, T, s, x, y, o = {}) {
    const a = o.a ?? 1; if (a <= 0 || !s) return 0;
    g.save(); g.globalAlpha = 1; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    g.letterSpacing = (o.ls ?? 0) + 'px';
    g.font = `${o.wt ?? 500} ${o.size ?? 28}px ${o.mono ? FONT.mono : FONT.ui}`;
    if (o.maxW) HUD.fitFont(g, s, o.wt ?? 500, o.size ?? 28, o.mono ? FONT.mono : FONT.ui, o.maxW, 12);
    g.fillStyle = C(T, o.c || 'hi', a);
    const str = o.roll !== undefined ? HUD.rollText(s, o.roll, o.frame ?? 0, o.seed ?? 0) : s;
    g.fillText(str, x, y);
    const w = g.measureText(s).width;
    g.restore();
    return w;
  }

  // ---- a value that rolls in and locks in the accent: o = { size, a, roll, frame, unit, flash, c (before lock) } ----
  function value(g, T, s, x, y, o = {}) {
    const a = o.a ?? 1, roll = o.roll ?? 1; if (a <= 0 || roll <= 0) return { w: 0 };
    const size = o.size ?? 72, locked = roll >= 1;
    g.save(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `${o.wt ?? 400} ${size}px ${FONT.ui}`;
    const adv = g.measureText('0').width * 1.02;
    const total = (() => { let w = 0; for (const ch of s) w += (ch === '.' || ch === ',' || ch === ' ') ? g.measureText(ch).width * 1.1 : adv; return w; })();
    let x0 = o.align === 'right' ? x - total : o.align === 'center' ? x - total / 2 : x;
    g.fillStyle = locked ? (o.flash ? T.hi(a) : C(T, o.lc || 'acc', a)) : C(T, o.c || 'line', 0.85 * a);
    const vw = HUD.monoText(g, HUD.rollText(s, roll, o.frame ?? 0, o.seed ?? 11), x0, y, adv);
    if (o.unit) {
      g.font = `500 ${Math.round(size * 0.36)}px ${FONT.ui}`; g.fillStyle = locked ? C(T, o.lc || 'acc', 0.9 * a) : T.line(0.6 * a);
      g.fillText(o.unit, x0 + vw + 8, y);
    }
    g.restore();
    return { w: vw, x0, bb: [x0, y - size * 0.78, x0 + vw, y + size * 0.06] };
  }

  // ---- a small filled tag: o = { c ('line'|'acc'|'hi'), a, align, size } ----
  function tag(g, T, s, x, y, o = {}) {
    const a = o.a ?? 1; if (a <= 0) return;
    g.save(); g.letterSpacing = '1px'; g.font = `600 ${o.size ?? 19}px ${FONT.ui}`; g.textBaseline = 'alphabetic';
    const w = g.measureText(s).width + 18, h = (o.size ?? 19) + 11;
    const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    g.fillStyle = C(T, o.c || 'line', 0.95 * a); g.fillRect(x0, y - h, w, h);
    g.fillStyle = `rgba(255,255,255,${a})`; g.textAlign = 'left'; g.fillText(s, x0 + 9, y - 8);
    g.restore();
    return [x0, y - h, x0 + w, y];
  }

  // ---- target lock (HUD.targetBox) and leader, re-exported ----
  const lock = (g, T, bb, k, o = {}) => HUD.targetBox(g, T, bb, k, o);
  const leader = (g, T, a, b, c, k, o = {}) => HUD.leader(g, T, a, b, c, k, o);

  // ---- scene life: the scan-in (a vertical scan line reveals the stage left to right) and the scan-erase at the
  //      end. Use: const sx = QC.scanIn(t) ... QC.clipStage(g, sx) ... draw ... g.restore(); QC.scanLine(g, T, sx). ----
  const STAGE = { x0: 30, x1: 1050, y0: 552, y1: 1478 };
  const scanIn = (t, t0 = 0, dur = 0.6) => lerp(STAGE.x0, STAGE.x1, eio((t - t0) / dur));
  const scanOut = (t, t1, dur = 0.4) => lerp(STAGE.x0, STAGE.x1, eio((t - (t1 - dur)) / dur));
  function clipStage(g, xIn = STAGE.x1, xOut = STAGE.x0) {   // keep [xOut, xIn] of the stage; call g.restore() after
    g.save(); g.beginPath(); g.rect(xOut, 0, Math.max(0, xIn - xOut), 1920); g.clip();
  }
  function scanLine(g, T, x, a = 1) {
    if (x <= STAGE.x0 + 1 || x >= STAGE.x1 - 1 || a <= 0) return;
    g.save();
    const gr = g.createLinearGradient(x - 60, 0, x + 6, 0);
    gr.addColorStop(0, T.line(0)); gr.addColorStop(1, T.line(0.16 * a));
    g.fillStyle = gr; g.fillRect(x - 60, STAGE.y0, 66, STAGE.y1 - STAGE.y0);
    g.strokeStyle = T.line(0.9 * a); g.lineWidth = 2; g.beginPath(); g.moveTo(x, STAGE.y0); g.lineTo(x, STAGE.y1); g.stroke();
    g.restore();
  }

  // ---- LaTeX formulas: inline SVG (typeset by MathJax at build time) in a DOM layer over the canvas ----
  // init once with the scene's TEX map; each frame: tex.begin(); tex.show(id, {...}); ... tex.end();
  const tex = (function () {
    let layer = null, nodes = {}, shown = {}, MAP = {}, ACC = '', LINE = '';
    function init(root, map, T) {
      MAP = map; ACC = T.acc(1); LINE = T.line(1); layer = document.createElement('div');
      layer.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;';
      const st = document.createElement('style');
      st.textContent = `.qtex{position:absolute;left:0;top:0;transform-origin:0 0;color:${T.hi(1)};will-change:clip-path,opacity}
        .qtex svg{display:block;width:100%;height:100%;overflow:visible}
        .qtex .acc{color:var(--acc)} .qtex .blu{color:${T.line(1)}}`;
      layer.appendChild(st);
      for (const id in map) {
        const d = document.createElement('div'); d.className = 'qtex'; d.innerHTML = map[id].svg; d.style.display = 'none';
        layer.appendChild(d); nodes[id] = d;
      }
      root.appendChild(layer);
    }
    function begin() { shown = {}; }
    // o = { x, y, size (em px), align ('left'|'center'|'right'), valign ('base'|'middle'|'top'), k (reveal 0-1, left to
    //       right), cut (0-1 erased from the left), a, lock (true: the \class{acc} parts turn orange), clip [x0, x1] px }
    function show(id, o = {}) {
      const f = MAP[id], d = nodes[id]; if (!f || !d) throw new Error('no formula ' + id);
      const em = o.size ?? 56, w = f.w * em, h = f.h * em;
      let x = o.x ?? 540, y = o.y ?? 0;
      if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
      const top = o.valign === 'top' ? y : o.valign === 'middle' ? y - h / 2 : y - (f.h - f.a) * em;
      const k = clamp(o.k ?? 1), cut = clamp(o.cut ?? 0);
      let L = cut * w, R = (1 - k) * w;
      if (o.clip) { L = Math.max(L, o.clip[0] - x); R = Math.max(R, x + w - o.clip[1]); }
      const a = o.a ?? 1;
      if (a <= 0 || L + R >= w) return { bb: [x, top, x + w, top + h], w, h };
      d.style.display = 'block'; d.style.width = w + 'px'; d.style.height = h + 'px';
      d.style.transform = `translate(${x}px, ${top}px)`; d.style.opacity = a;
      d.style.clipPath = `inset(-20px ${R}px -20px ${L}px)`;
      d.style.setProperty('--acc', o.lock ? ACC : LINE);
      shown[id] = 1;
      return { bb: [x, top, x + w, top + h], w, h };
    }
    function end() { for (const id in nodes) if (!shown[id]) nodes[id].style.display = 'none'; }
    return { init, begin, show, end };
  })();

  return { frame, panel, axes, line, area, bars, candles, hline, vline, dot, text, value, tag, lock, leader,
    STAGE, scanIn, scanOut, clipStage, scanLine, tex, fmt, pow10, MINUS, clamp, lerp, eo, eio };
})();
// QCHART END
