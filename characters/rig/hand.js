// Articulated hand for the cast: a palm, four fingers and a thumb posed in 3D, projected, and drawn the way the
// reference illustrations draw hands: flat skin, no outline around the silhouette, thin ink lines only where one part
// lies over another (finger over finger, thumb over palm, fingers curled across the palm). Poses are numbers, so any
// pose blends smoothly into any other, and a held prop (cup, phone) sits between the palm and the fingers around it.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const f2 = n => (Math.round(n * 100) / 100).toString();
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  let UID = 0, Hand_basis;

  // ---- skeleton, in drawing units: wrist at the origin, +x toward the fingers, -y the thumb side, +z the back of the hand
  const PALM = [[0, -8.2], [9, -10.4], [20, -11.4], [29.6, -11.0], [31.4, -5.6], [31.6, .4], [30.4, 6], [28, 10.4], [16, 10.4], [6, 9.4], [0, 8.2]];
  const THICK = x => lerp(4.4, 3.4, clamp(x / 30, 0, 1));            // half-thickness of the palm
  const FING = [   // knuckle (MCP) position, phalanx lengths, radius at base and tip, share of the spread
    { m: [29.4, -7.9], l: [11.8, 7.8, 6.4], r: [3.45, 2.75], sp: -1 },
    { m: [30.8, -2.6], l: [13.0, 8.6, 7.0], r: [3.55, 2.85], sp: -.2 },
    { m: [29.8, 2.75], l: [12.2, 8.1, 6.6], r: [3.4, 2.7], sp: .5 },
    { m: [27.4, 7.7], l: [9.6, 6.2, 5.6], r: [3.0, 2.35], sp: 1.2 },
  ];
  const THUMB = { b: [5.2, -6.4, -2.4], l: [12.4, 9.0, 7.6], r: [4.4, 3.5, 3.15] };

  // ---- poses: c finger curls (0 straight, 1 fist), s spread, ta/to thumb abduction/opposition (rad), tc thumb curl,
  // fx wrist flexion (+ toward the palm), dv wrist deviation (+ toward the little finger), ph roll about the forearm,
  // pz depth of a held prop (parts nearer the camera than pz are drawn in front of it), cut pocket line
  const POSES = {
    relaxed: { c: [.22, .3, .38, .46], s: 0, ta: .2, to: .34, tc: .38, fx: .14, dv: .04, ph: .55 },
    hang: { c: [.28, .36, .44, .52], s: 0, ta: .18, to: .38, tc: .42, fx: .2, dv: .06, ph: .55 },
    open: { c: [-.04, -.05, -.04, -.02], s: .95, ta: .95, to: .18, tc: .02, fx: -.08 },
    wave: { c: [.02, 0, .02, .06], s: .62, ta: .78, to: .22, tc: .06, fx: -.18 },
    scratch: { c: [.42, .46, .5, .55], s: .45, ta: .55, to: .5, tc: .3, fx: .05 },
    point: { c: [-.03, .92, .97, 1], s: 0, ta: .3, to: .6, tc: 1.05, ph: .35 },
    fist: { c: [.96, .97, .98, .98], s: 0, ta: .3, to: .6, tc: 1.05 },
    grip: { c: [.6, .64, .68, .72], s: .04, ta: .5, to: .78, tc: .32 },
    cup: { c: [.7, .74, .77, .8], s: 0, ta: .5, to: .45, tc: .3, prop: [29, 0, -10] },
    phone: { c: [.56, .6, .64, .7], s: .02, ta: .5, to: .6, tc: .2, fx: .1, prop: [25, 0, -6] },
    think: { c: [.18, .82, .9, .94], s: .05, ta: .3, to: .6, tc: .9, fx: -.35 },
    pocket: { c: [.32, .36, .4, .44], s: 0, ta: .3, to: .4, tc: .2, fx: .1, ph: .3, cut: { x: 15, a: .3 } },
    carry: { c: [.5, .52, .55, .6], s: .05, ta: .15, to: .25, tc: .1, fx: -.25 },
    strap: { c: [.66, .7, .74, .78], s: .03, ta: .4, to: .85, tc: .45, fx: .1 },
    // counting and sign gestures
    two: { c: [-.03, -.02, .95, 1], s: .55, ta: .3, to: .62, tc: 1.05, ph: .35 },
    three: { c: [-.03, -.02, -.01, 1], s: .5, ta: .32, to: .66, tc: 1.1, ph: .35 },
    four: { c: [-.03, -.02, -.01, -.02], s: .55, ta: .35, to: .72, tc: 1.15, ph: .35 },
    thumbsup: { c: [.97, .98, .98, .98], s: 0, ta: 1.25, to: -.12, tc: 0, fx: 0, ph: 0 },
    ok: { c: [.62, .06, .1, .16], s: .45, ta: .45, to: 1.2, tc: .7, fx: -.1 },
    present: { c: [.02, .03, .05, .08], s: .3, ta: .7, to: .2, tc: .05, fx: -.25 },
  };
  POSES.hold = POSES.grip;
  const KEYS = ['s', 'ta', 'to', 'tc', 'fx', 'dv', 'ph'];
  // blend two poses (names or objects); u in [0, 1]
  function blend(a, b, u) {
    const A = resolve(a), B = resolve(b);
    const o = { c: A.c.map((v, i) => lerp(v, B.c[i], u)) };
    for (const k of KEYS) o[k] = lerp(A[k] || 0, B[k] || 0, u);
    o.cut = u < .5 ? A.cut : B.cut; o.prop = u < .5 ? A.prop : B.prop; o.wrap = u < .5 ? A.wrap : B.wrap;
    return o;
  }
  function resolve(h) { return !h ? POSES.relaxed : typeof h === 'string' ? (POSES[h] || POSES.relaxed) : h.c ? h : blend(h.a, h.b, h.u); }

  // ---- 3D -> 2D ----
  // hand-local -> camera: wrist flexion (about y) and deviation (about z), then the hand's basis in camera space
  // (B.ex along the forearm, B.ey away from the thumb, B.ez out of the back of the hand; x right, y down, z toward the viewer)
  function makeXf(fx, dv, B) {
    const cf = Math.cos(fx), sf = Math.sin(fx), cd = Math.cos(dv), sd = Math.sin(dv), { ex, ey, ez } = B;
    return ([x, y, z]) => {
      const x1 = x * cf + z * sf, z1 = -x * sf + z * cf;
      const x2 = x1 * cd - y * sd, y2 = x1 * sd + y * cd;
      return [x2 * ex[0] + y2 * ey[0] + z1 * ez[0], x2 * ex[1] + y2 * ey[1] + z1 * ez[1], x2 * ex[2] + y2 * ey[2] + z1 * ez[2]];
    };
  }
  // the basis for a hand from its forearm direction (2D, in the image plane) and roll: T is where the thumb points
  Hand_basis = function (dx, dy, T, right, dz) {
    const ex = [dx, dy, dz || 0], l = Math.hypot(dx, dy, dz || 0) || 1; ex[0] /= l; ex[1] /= l; ex[2] /= l;
    let t = T.slice(); const d = t[0] * ex[0] + t[1] * ex[1] + t[2] * ex[2]; t = t.map((v, i) => v - d * ex[i]); const n = Math.hypot(...t) || 1; t = t.map(v => v / n);
    const ey = t.map(v => -v), c = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    return { ex, ey, ez: right ? c : c.map(v => -v) };
  };
  function finger(F, c, s, wrap) {
    const a0 = F.sp * s * .16, ca = Math.cos(a0), sa = Math.sin(a0), th = [c * 1.48, c * 1.72, c * 1.12];
    let a = 0, p = [F.m[0], F.m[1], 0]; const out = [[p[0] - 3.4 * ca, p[1] - 3.4 * sa, 0], p];
    for (let k = 0; k < 3; k++) {
      if (wrap) {            // bend just enough that the phalanx ends on the cylinder (finger hugging the cup)
        const R = (wrap.rf || wrap.r) + F.r[0] * .9; let b = a;
        for (; b < a + 2.6; b += .02) { const ex = p[0] + F.l[k] * Math.cos(b) - wrap.cx, ez = p[2] - F.l[k] * Math.sin(b) - wrap.cz; if (Math.hypot(ex, ez) <= R) break; }
        a = Math.max(b, a + .05);
      } else a += th[k];
      const d = [ca * Math.cos(a), sa * Math.cos(a), -Math.sin(a)]; p = [p[0] + F.l[k] * d[0], p[1] + F.l[k] * d[1], p[2] + F.l[k] * d[2]]; out.push(p);
    }
    return out;                                                         // [inside the palm, MCP, PIP, DIP, tip]
  }
  function thumb(ta, to, tc) {
    const d0 = [Math.cos(ta) * Math.cos(to), -Math.sin(ta) * Math.cos(to), -Math.sin(to)];
    let q = [.1, .8, -.6]; const dq = q[0] * d0[0] + q[1] * d0[1] + q[2] * d0[2];
    q = q.map((v, i) => v - dq * d0[i]); const nq = Math.hypot(...q); q = q.map(v => v / nq);
    const th = [0, tc * .75, tc * 1.0];
    let a = 0, p = THUMB.b.slice(); const out = [[p[0] - 4, p[1] + 1.5, p[2] + 1], p];
    for (let k = 0; k < 3; k++) { a += th[k]; const d = d0.map((v, i) => v * Math.cos(a) + q[i] * Math.sin(a)); p = p.map((v, i) => v + THUMB.l[k] * d[i]); out.push(p); }
    return out;                                                         // [inside the palm, CMC, MCP, IP, tip]
  }
  function hull(pts) {       // convex hull (monotone chain) of 2D points
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function thin(pts, m) {    // drop hull points closer than m to the previous one (keeps the curve calm)
    const out = []; for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > m) out.push(p); else if (p.d) q.d = true; }
    if (out.length > 3) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < m) out.pop(); }
    return out;
  }
  function smoothD(pts, k = .9) {          // closed Catmull-Rom curve through the points
    const n = pts.length; let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f2(p1[0] + (p2[0] - p0[0]) * k / 6)},${f2(p1[1] + (p2[1] - p0[1]) * k / 6)} ${f2(p2[0] - (p3[0] - p1[0]) * k / 6)},${f2(p2[1] - (p3[1] - p1[1]) * k / 6)} ${f2(p2[0])},${f2(p2[1])}`;
    }
    return d + 'Z';
  }
  const lineAttr = (el, a, b, w) => { el.setAttribute('x1', f2(a[0])); el.setAttribute('y1', f2(a[1])); el.setAttribute('x2', f2(b[0])); el.setAttribute('y2', f2(b[1])); el.setAttribute('stroke-width', f2(Math.max(0, w))); };

  // ---- the drawn hand ----
  // back/front: groups drawn behind and in front of a held prop (same transform). opts: skin, ink, lw (line width),
  // ol (silhouette outline, 0 = none), sc (size), thumbOut (pocket: the thumb stays outside)
  class Hand {
    constructor(back, front, opts) {
      const o = this.o = Object.assign({ skin: '#E8906F', ink: '#1D1819', lw: 1.25, ol: 0, sc: 1, thumbOut: 0 }, opts);
      this.id = 'hd' + (++UID);
      this.gb = mk('g', {}, back); this.gf = mk('g', {}, front);
      const defs = mk('defs', {}, this.gb);
      const m = mk('mask', { id: this.id + 'm', maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 400, height: 400 }, defs);
      mk('rect', { x: -200, y: -200, width: 400, height: 400, fill: '#000' }, m);
      this.mg = mk('g', { fill: '#fff', stroke: '#fff', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, m);
      const cp = mk('clipPath', { id: this.id + 'c', clipPathUnits: 'userSpaceOnUse' }, defs);
      this.cutPoly = mk('path', { d: 'M-200,-200H200V200H-200Z' }, cp);
      if (o.ol) { const st = { stroke: o.ink, fill: o.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }; this.olB = mk('g', st, this.gb); this.olF = mk('g', st, this.gf); }
      const mask = `url(#${this.id}m)`;
      // a digit has a back half and a front half, so segments can sit on either side of a held prop
      const half = () => { const g = mk('g', {}), ink = mk('g', { stroke: o.ink, 'stroke-linecap': 'round', mask }, g), skin = mk('g', { stroke: o.skin, 'stroke-linecap': 'round' }, g);
        return { g, segs: [0, 1, 2, 3].map(() => ({ ink: mk('line', {}, ink), skin: mk('line', {}, skin) })) }; };
      const digit = (kind, k) => ({ kind, k, h: [half(), half()], m: [0, 1, 2, 3].map(() => mk('line', {}, this.mg)) });
      this.wrist = digit('wrist'); this.fingers = FING.map((F, k) => digit('finger', k)); this.thumbD = digit('thumb');
      const pg = mk('g', {});
      this.palm = { kind: 'palm', g: pg, ink: mk('path', { fill: 'none', stroke: o.ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', mask }, pg), skin: mk('path', { fill: o.skin, stroke: o.skin, 'stroke-width': 3, 'stroke-linejoin': 'round' }, pg), m: mk('path', {}, this.mg) };
      this.pocketLine = mk('path', { fill: 'none', stroke: o.ink, 'stroke-width': o.lw * 1.15, 'stroke-linecap': 'round', mask }, this.gf);
      this.order = '';
    }
    // a hand-local 3D point under the current pose, projected (for placing a held prop)
    local(p) { return this.X ? this.X(p).map(v => v * this.o.sc) : [0, 0, 0]; }
    // the hand plane's two axes on screen (for a prop held flat in the palm)
    axes() { const a = this.X([1, 0, 0]), b = this.X([0, 1, 0]); return [a[0], a[1], b[0], b[1]].map(v => v * this.o.sc); }
    // pose: name, blend {a, b, u}, or pose object; view: roll of the hand about the forearm in radians
    // (0 back of the hand toward the camera, -PI/2 thumb edge toward it, PI palm toward it)
    render(pose, B) {
      const o = this.o, P = resolve(pose), sc = o.sc, lw = o.lw, ins = .45;
      const X0 = makeXf(P.fx || 0, P.dv || 0, B); this.X = X0;
      const S = p => { const q = X0(p); return [q[0] * sc, q[1] * sc, q[2] * sc]; };
      const pzProp = P.prop ? S(P.prop)[2] : 1e9, avgC = (P.c[0] + P.c[1] + P.c[2] + P.c[3]) / 4;
      const items = [];      // {g, z} in draw order once sorted
      // palm (with the web of the thumb, so the thumb grows out of the hand instead of out of the wrist)
      const rim = []; for (const [x, y] of PALM) { const t = THICK(x); const a = S([x, y, t]), b = S([x, y, -t]); a.d = b.d = x > 26; rim.push(a, b); }
      const pz = rim.reduce((a, p) => a + p[2], 0) / rim.length;
      const tp = thumb(P.ta, P.to, P.tc).map(S), web = [];
      for (const u of [0, .3, .6]) { const c = [lerp(tp[1][0], tp[2][0], u), lerp(tp[1][1], tp[2][1], u)], r = 3.2 * sc; for (let k = 0; k < 8; k++) web.push([c[0] + r * Math.cos(k * Math.PI / 4), c[1] + r * Math.sin(k * Math.PI / 4)]); }
      let poly = thin(hull(rim.map(p => Object.assign([p[0], p[1]], { d: p.d })).concat(web)), 1.8 * sc);
      { const E = this.palm, d = smoothD(poly), n = poly.length;
        E.skin.setAttribute('d', d); E.m.setAttribute('d', d); E.m.setAttribute('stroke-width', f2(3 - 2 * ins));
        let id = ''; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if (a.d && b.d) id += `M${f2(a[0])},${f2(a[1])}L${f2(b[0])},${f2(b[1])}`; }
        E.ink.setAttribute('d', id); E.ink.setAttribute('stroke-width', f2(2 * lw + 3)); E.ink.setAttribute('opacity', f2(clamp((avgC - .45) / .3, 0, 1)));
        items.push({ g: E.g, z: pz, front: pz > pzProp, key: 'p' }); }
      // digits
      const draw = (D, caps, zSort, key, noInkFirst) => {
        const segFront = caps.map(c => (c[0][2] + c[1][2]) / 2 > pzProp);
        caps.forEach((c, s) => {
          const [a, b, r] = c, f = segFront[s] ? 1 : 0;
          for (const hf of [0, 1]) {
            const sg = D.h[hf].segs[s];
            if (hf !== f) { sg.ink.setAttribute('stroke-width', 0); sg.skin.setAttribute('stroke-width', 0); continue; }
            const ia = noInkFirst && s === 0 ? null : noInkFirst && s === 1 ? [lerp(a[0], b[0], .45), lerp(a[1], b[1], .45)] : a;
            if (ia) lineAttr(sg.ink, ia, b, 2 * r + 2 * lw); else sg.ink.setAttribute('stroke-width', 0);
            lineAttr(sg.skin, a, b, 2 * r);
          }
          lineAttr(D.m[s], a, b, 2 * r - 2 * ins);
        });
        for (let s = caps.length; s < 4; s++) { for (const hf of [0, 1]) { D.h[hf].segs[s].ink.setAttribute('stroke-width', 0); D.h[hf].segs[s].skin.setAttribute('stroke-width', 0); } D.m[s].setAttribute('stroke-width', 0); }
        items.push({ g: D.h[0].g, z: zSort, front: false, key: key + 'b' }, { g: D.h[1].g, z: zSort, front: true, key: key + 'f' });
      };
      { const w0 = S([-7, 0, 0]), w1 = S([5, 0, 0]); draw(this.wrist, [[w0, w1, 6.2 * sc]], -1e6, 'w', true); }
      FING.forEach((F, k) => {
        const pts = finger(F, P.c[k], P.s, P.wrap).map(S), R = F.r.map(r => r * sc), caps = [];
        for (let s = 0; s < 4; s++) caps.push([pts[s], pts[s + 1], lerp(R[0], R[1], Math.max(0, s - 1) / 3)]);
        let zz = (pts[2][2] + pts[3][2] + pts[4][2]) / 3;
        if (Math.abs(zz - pz) < 2.2 * sc) zz = pz + .5 + .01 * k;     // straight fingers lie in the palm plane: keep them in front of it
        draw(this.fingers[k], caps, zz, 'f' + k, true);
      });
      { const R = THUMB.r.map(r => r * sc), caps = [[tp[0], tp[1], R[0] * .95], [tp[1], tp[2], R[0]], [tp[2], tp[3], lerp(R[0], R[1], .6)], [tp[3], tp[4], R[2]]];
        draw(this.thumbD, caps, (tp[2][2] + tp[3][2] + tp[4][2]) / 3, 't', true); }
      this.tips = [this.fingers[0], this.fingers[1], this.thumbD].map(D => { const el = D.m[3]; return [+el.getAttribute('x2'), +el.getAttribute('y2')]; });   // index, middle, thumb tips (for the frame audit)
      items.sort((a, b) => a.z - b.z);
      const key = items.map(it => it.key + (it.front ? 1 : 0)).join(',');
      if (key !== this.order) {
        for (const it of items) (it.front ? this.gf : this.gb).appendChild(it.g);
        this.gf.appendChild(this.pocketLine); this.order = key;
      }
      // silhouette outline (characters whose skin is outlined)
      if (o.ol) {
        const lists = [[], []];
        lists[pz > pzProp ? 1 : 0].push({ d: smoothD(poly), w: 3 + 2 * o.ol });
        const addCaps = (D) => D.m.forEach((el, s) => { const w = +el.getAttribute('stroke-width'); if (w > 0) { const f = D.h[1].segs[s].skin.getAttribute('stroke-width') > 0 ? 1 : 0; lists[f].push({ d: `M${el.getAttribute('x1')},${el.getAttribute('y1')}L${el.getAttribute('x2')},${el.getAttribute('y2')}`, w: w + 2 * ins + 2 * o.ol }); } });
        [this.wrist, ...this.fingers, this.thumbD].forEach(addCaps);
        [this.olB, this.olF].forEach((G, f) => { const L = lists[f]; while (G.childNodes.length < L.length) mk('path', {}, G); [...G.childNodes].forEach((el, i) => { const it = L[i]; el.setAttribute('d', it ? it.d : ''); el.setAttribute('stroke-width', it ? f2(it.w) : 0); }); });
      }
      // pocket: past the cut line the hand is inside the trousers; the line itself is the pocket's edge
      const cut = P.cut && Object.assign({}, P.cut, o.cutX ? { x: o.cutX } : {}), all = [this.palm.g, ...[this.wrist, ...this.fingers, this.thumbD].flatMap(D => [D.h[0].g, D.h[1].g])];
      if (cut) {
        // the cut line through the hand plane, projected; keep the wrist side of it
        const ta = Math.tan(cut.a || 0), q0 = S([cut.x - 40 * ta, -40, 0]), q1 = S([cut.x + 40 * ta, 40, 0]), w = S([-10, 0, 0]);
        const dx = q1[0] - q0[0], dy = q1[1] - q0[1], nl = Math.hypot(dx, dy) || 1, ux = dx / nl, uy = dy / nl;
        let nx = -uy, ny = ux; if ((w[0] - q0[0]) * nx + (w[1] - q0[1]) * ny < 0) { nx = -nx; ny = -ny; }
        const far = 300, A0 = [q0[0] - ux * far, q0[1] - uy * far], A1 = [q1[0] + ux * far, q1[1] + uy * far];
        this.cutPoly.setAttribute('d', `M${f2(A0[0])},${f2(A0[1])}L${f2(A1[0])},${f2(A1[1])}L${f2(A1[0] + nx * far)},${f2(A1[1] + ny * far)}L${f2(A0[0] + nx * far)},${f2(A0[1] + ny * far)}Z`);
        const tOut = o.thumbOut ? [this.thumbD.h[0].g, this.thumbD.h[1].g] : [];
        all.forEach(g => { if (tOut.includes(g)) g.removeAttribute('clip-path'); else g.setAttribute('clip-path', `url(#${this.id}c)`); });
        if (this.olB) [this.olB, this.olF].forEach(G => G.setAttribute('clip-path', `url(#${this.id}c)`));
        this.pocketLine.setAttribute('d', `M${f2(q0[0])},${f2(q0[1])}L${f2(q1[0])},${f2(q1[1])}`);
      } else if (this.cutOn) {
        all.forEach(g => g.removeAttribute('clip-path')); this.pocketLine.setAttribute('d', '');
        if (this.olB) [this.olB, this.olF].forEach(G => G.removeAttribute('clip-path'));
      }
      this.cutOn = !!cut;
      return this;
    }
  }
  Hand.POSES = POSES; Hand.blend = blend; Hand.resolve = resolve; Hand.basis = Hand_basis;
  window.Hand = Hand;
})();
