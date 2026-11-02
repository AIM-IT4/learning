// Desk2Quant environment kit: flat vector office sets in the cast's style (thin ink outlines on near props, softer
// and lighter with distance), built from parts: sky and skyline through metal-framed windows, walls, floor, standing
// desks, monitors and laptops with live screens, plants that sway, mugs that steam, lamps with light cones, shelves,
// a whiteboard, a wall display, and a distant trading floor. Every part returns its group plus an optional upd(t).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f1 = n => (+n).toFixed(1);
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  let UID = 0; const uid = p => (p || 'e') + (++UID);
  const INK = '#1D1A1C';
  const P = {
    skyTop: '#BFE0EA', skyBot: '#F7EEDF', sun: '#FFF4D6', cloud: '#FFFFFF',
    city: ['#D7E4EA', '#BED2DC', '#A5BFCC'], cityLit: '#FFF1C9',
    wall: '#F2EADD', wallShade: '#E7DCCB', wallDark: '#DCCFBA', accent: '#0F5F63', accentDk: '#0B4A4D',
    floor: '#E2D2BA', floorDk: '#D2BFA3', floorRef: '#FFFFFF',
    wood: '#CF9F6F', woodEdge: '#B4875C', woodDk: '#8F6747', metal: '#3A3E45', metalLt: '#5B616B',
    bezel: '#1C1F24', scr: '#14212B', scrLt: '#F8FAFB',
    leaf: ['#2F7A5B', '#3F956E', '#246248', '#5BAE85'], pot: '#F3EFE8', potShade: '#DCD6CC', terracotta: '#D98A63',
    brass: '#D6A54C', lampShade: '#1F3A3D', glow: '#FFE7A8',
    book: ['#0F5F63', '#E5484D', '#FFC93C', '#2B4C7E', '#F08A4B', '#7A5C8E', '#3F956E', '#1D1A1C'],
    teal: '#08A9A2', yel: '#FFC93C', red: '#E5484D', blue: '#3B82C4', paper: '#FFFDF8',
  };

  // ---------------- defs (gradients, blur) ----------------
  function defsOf(svg) { if (!svg.__defs) svg.__defs = mk('defs', {}, svg); return svg.__defs; }
  function linGrad(svg, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
    const id = uid('lg'), g = mk('linearGradient', { id, x1, y1, x2, y2 }, defsOf(svg));
    stops.forEach(([o, c, a]) => mk('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a }, g)); return `url(#${id})`;
  }
  function radGrad(svg, stops, cx = .5, cy = .5, r = .5) {
    const id = uid('rg'), g = mk('radialGradient', { id, cx, cy, r }, defsOf(svg));
    stops.forEach(([o, c, a]) => mk('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a }, g)); return `url(#${id})`;
  }
  function blurF(svg, sd) { const id = uid('bf'), f = mk('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defsOf(svg)); mk('feGaussianBlur', { stdDeviation: sd }, f); return `url(#${id})`; }
  const rootSvg = g => { let n = g; while (n && n.tagName !== 'svg') n = n.parentNode; return n; };

  // ---------------- outdoors ----------------
  function sky(g, x, y, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g);
    mk('rect', { x, y, width: w, height: h, fill: linGrad(svg, [[0, o.top || P.skyTop], [1, o.bot || P.skyBot]]) }, G);
    if (o.sun !== false) mk('circle', { cx: x + w * (o.sunX ?? .72), cy: y + h * (o.sunY ?? .62), r: w * .42, fill: radGrad(svg, [[0, P.sun, .95], [.35, P.sun, .45], [1, P.sun, 0]]) }, G);
    return { g: G };
  }
  // skyline: three depth layers of towers (stepped crowns, antennas), lit window strips, no window grids
  function skyline(g, x0, x1, base, o = {}) {
    const r = rng(o.seed || 7), G = mk('g', {}, g), sc = o.scale || 1, L = [];
    [0, 1, 2].forEach(k => {
      const lg = mk('g', {}, G), col = (o.cols || P.city)[k], hMax = (k === 0 ? 520 : k === 1 ? 400 : 290) * sc, hMin = hMax * .35;
      let x = x0 - r() * 60;
      while (x < x1) {
        const w = (38 + r() * (k === 2 ? 110 : 90)) * sc, h = hMin + r() * (hMax - hMin), top = base - h;
        let d = `M${f1(x)},${f1(base)} V${f1(top)}`;
        const crown = r();
        if (crown < .3) { const s = w * .18; d += ` H${f1(x + s)} V${f1(top - 26 * sc)} H${f1(x + w - s)} V${f1(top)}`; }
        else if (crown < .45) d += ` L${f1(x + w / 2)},${f1(top - w * .35)}`;
        d += ` H${f1(x + w)} V${f1(base)} Z`;
        mk('path', { d, fill: col }, lg);
        if (crown > .82) mk('rect', { x: f1(x + w / 2 - 1.5 * sc), y: f1(top - 60 * sc), width: f1(3 * sc), height: f1(60 * sc), fill: col }, lg);
        if (k > 0) { const n = 1 + Math.floor(r() * 3); for (let j = 0; j < n; j++) { const sx = x + w * (.2 + .6 * r()), sw = Math.max(2, 3.2 * sc), sy = top + 20 * sc + r() * h * .3, sh = h * (.15 + .3 * r());
          mk('rect', { x: f1(sx), y: f1(sy), width: f1(sw), height: f1(sh), fill: k === 2 ? P.cityLit : '#FFFFFF', opacity: k === 2 ? .55 : .35 }, lg); } }
        x += w + (k === 0 ? 4 : 10 + r() * 30) * sc;
      }
      L.push(lg);
    });
    return { g: G, layers: L };
  }
  function clouds(g, x0, x1, y0, y1, n, o = {}) {
    const r = rng(o.seed || 3), G = mk('g', { opacity: o.op ?? .85 }, g), C = [];
    for (let i = 0; i < n; i++) {
      const c = mk('g', {}, G), w = 110 + r() * 160, h = w * .32;
      mk('path', { d: `M${-w / 2},${h / 2} C${-w / 2},${-h * .1} ${-w * .25},${-h * .35} ${-w * .05},${-h * .15} C${w * .05},${-h * .75} ${w * .42},${-h * .55} ${w * .38},${-h * .05} C${w * .55},${-h * .1} ${w * .6},${h * .5} ${w * .45},${h / 2} Z`, fill: P.cloud }, c);
      C.push({ c, x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), v: 6 + r() * 10 });
    }
    return { g: G, upd: t => C.forEach(q => { const span = x1 - x0 + 400, x = x0 - 200 + ((q.x - x0 + 200 + q.v * t) % span); q.c.setAttribute('transform', `translate(${f1(x)},${f1(q.y)})`); }) };
  }
  // ---------------- architecture ----------------
  // metal-framed window: outdoor scene clipped inside, two mullions (three panes), a transom, glass light streaks
  function windowWall(g, x, y, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g), id = uid('cw'), cp = mk('clipPath', { id }, defsOf(svg)); mk('rect', { x, y, width: w, height: h }, cp);
    const out = mk('g', { 'clip-path': `url(#${id})` }, G);
    const S = sky(out, x, y, w, h, o.sky || {}), Cl = clouds(out, x - 100, x + w + 100, y + h * .06, y + h * .32, o.clouds ?? 4, { seed: (o.seed || 1) + 5 });
    const K = skyline(out, x - 40, x + w + 40, y + h * (o.horizon ?? .98), { seed: o.seed || 1, scale: o.cityScale || 1 });
    // haze toward the horizon
    mk('rect', { x, y: y + h * .55, width: w, height: h * .45, fill: linGrad(svg, [[0, '#FFFFFF', 0], [1, '#FFF8EC', .55]]) }, out);
    // glass streaks
    const st = mk('g', { opacity: .16 }, out);
    for (const [u, sw] of [[.12, 60], [.2, 18], [.58, 90], [.7, 26]]) mk('path', { d: `M${f1(x + w * u)},${f1(y + h)} l${f1(h * .55)},${f1(-h)} h${sw} l${f1(-h * .55)},${f1(h)} Z`, fill: '#FFFFFF' }, st);
    const fr = o.frame || '#26292F', fw = o.fw || 12, n = o.panes || 3, lines = mk('g', {}, G);
    for (let i = 1; i < n; i++) mk('rect', { x: f1(x + w * i / n - fw * .35), y, width: f1(fw * .7), height: h, fill: fr }, lines);
    if (o.transom !== false) mk('rect', { x, y: f1(y + h * (o.transomY ?? .78)), width: w, height: f1(fw * .55), fill: fr }, lines);
    mk('rect', { x: x - fw / 2, y: y - fw / 2, width: w + fw, height: h + fw, fill: 'none', stroke: fr, 'stroke-width': fw }, G);
    // sill
    mk('rect', { x: x - fw - 14, y: y + h + fw / 2, width: w + 2 * fw + 28, height: 16, rx: 3, fill: '#F7F2EA', stroke: INK, 'stroke-width': 2 }, G);
    return { g: G, upd: t => { Cl.upd(t); } };
  }
  function wall(g, x, y, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g);
    mk('rect', { x, y, width: w, height: h, fill: o.fill || P.wall }, G);
    // soft light falloff from the windows / ceiling
    mk('rect', { x, y, width: w, height: h, fill: linGrad(svg, [[0, '#FFFFFF', o.top ?? .25], [.6, '#FFFFFF', 0], [1, '#000000', .04]]) }, G);
    if (o.base !== false) { const by = y + h; mk('rect', { x, y: by - 22, width: w, height: 22, fill: o.baseFill || '#E9DFCF' }, G); mk('rect', { x, y: by - 23, width: w, height: 2.5, fill: INK, opacity: .55 }, G); }
    return { g: G };
  }
  function floor(g, x, y, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g);
    mk('rect', { x, y, width: w, height: h, fill: linGrad(svg, [[0, o.far || P.floor], [1, o.near || P.floorDk]]) }, G);
    // window light pooled on the floor
    if (o.pool !== false) mk('path', { d: `M${x + w * .18},${y} L${x + w * .62},${y} L${x + w * .9},${y + h} L${x + w * .1},${y + h} Z`, fill: '#FFFFFF', opacity: .16 }, G);
    return { g: G };
  }
  function rug(g, cx, cy, w, h, col) { const G = mk('g', {}, g); mk('ellipse', { cx, cy, rx: w / 2, ry: h / 2, fill: col || '#2D4B57' }, G); mk('ellipse', { cx, cy, rx: w / 2 - 14, ry: h / 2 - 7, fill: 'none', stroke: '#F2EADD', 'stroke-width': 3, opacity: .55 }, G); return { g: G }; }

  // ---------------- furniture ----------------
  // standing desk: wood top (front edge + highlight), metal T-legs, floor shadow; returns the top's y
  function desk(g, x, y, w, o = {}) {
    const G = mk('g', {}, g), th = o.th || 22, legH = o.legH || 330, fy = y + th + legH;
    mk('ellipse', { cx: x + w / 2, cy: fy + 4, rx: w * .52, ry: 16, fill: '#000', opacity: .1 }, G);
    for (const lx of [x + w * .12, x + w * .88 - 18]) { mk('rect', { x: lx, y: y + th, width: 18, height: legH, fill: P.metal }, G); mk('rect', { x: lx - 34, y: fy - 9, width: 86, height: 10, rx: 5, fill: P.metal }, G); }
    mk('rect', { x: x + w * .12, y: y + th + 30, width: w * .76, height: 14, fill: P.metalLt }, G);
    mk('rect', { x, y, width: w, height: th, rx: 4, fill: o.top || P.wood, stroke: INK, 'stroke-width': 2.2 }, G);
    mk('rect', { x: x + 2, y: y + th * .62, width: w - 4, height: th * .38 - 1, fill: o.edge || P.woodEdge }, G);
    mk('path', { d: `M${x + 10},${y + 5} H${x + w - 10}`, stroke: '#FFFFFF', 'stroke-width': 2.5, opacity: .45, 'stroke-linecap': 'round' }, G);
    return { g: G, top: y, floorY: fy };
  }
  // monitor on a stand; returns the screen group (clipped) with its size for content
  function monitor(g, cx, by, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g), sy = by - (o.neck || 70) - h, x = cx - w / 2;
    mk('path', { d: `M${cx - w * .2},${by} Q${cx},${by - 12} ${cx + w * .2},${by} Z`, fill: P.metal }, G);
    mk('rect', { x: cx - 7, y: sy + h - 4, width: 14, height: (o.neck || 70) + 2, fill: P.metal }, G);
    mk('rect', { x: x - 3, y: sy - 3, width: w + 6, height: h + 6, rx: 9, fill: P.bezel, stroke: INK, 'stroke-width': 2 }, G);
    const id = uid('ms'), cp = mk('clipPath', { id }, defsOf(svg)); mk('rect', { x: x + 6, y: sy + 6, width: w - 12, height: h - 12, rx: 3 }, cp);
    const scr = mk('g', { 'clip-path': `url(#${id})` }, G); mk('rect', { x: x + 6, y: sy + 6, width: w - 12, height: h - 12, fill: o.screen || P.scr }, scr);
    const content = mk('g', { transform: `translate(${x + 6},${sy + 6})` }, scr);
    // screen glare
    mk('path', { d: `M${x + w * .55},${sy + 6} l${w * .18},0 l${-w * .3},${h - 12} l${-w * .18},0 Z`, fill: '#FFFFFF', opacity: .05 }, G);
    return { g: G, content, w: w - 12, h: h - 12, x: x + 6, y: sy + 6 };
  }
  function laptop(g, cx, by, w, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g), h = w * .62, sx = cx - w / 2, sy = by - 8 - h;
    mk('path', { d: `M${cx - w * .58},${by} L${cx + w * .58},${by} L${cx + w * .52},${by - 9} L${cx - w * .52},${by - 9} Z`, fill: '#C7CCD3', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, G);
    mk('rect', { x: sx, y: sy, width: w, height: h, rx: 7, fill: '#2A2E35', stroke: INK, 'stroke-width': 2 }, G);
    const id = uid('ls'), cp = mk('clipPath', { id }, defsOf(svg)); mk('rect', { x: sx + 7, y: sy + 7, width: w - 14, height: h - 14, rx: 2 }, cp);
    const scr = mk('g', { 'clip-path': `url(#${id})` }, G); mk('rect', { x: sx + 7, y: sy + 7, width: w - 14, height: h - 14, fill: o.screen || P.scr }, scr);
    const content = mk('g', { transform: `translate(${sx + 7},${sy + 7})` }, scr);
    // logo-less lid edge highlight
    mk('path', { d: `M${sx + 10},${sy + 3} H${sx + w - 10}`, stroke: '#FFFFFF', 'stroke-width': 1.5, opacity: .25 }, G);
    return { g: G, content, w: w - 14, h: h - 14 };
  }
  function keyboard(g, cx, y, w) { const G = mk('g', {}, g); mk('rect', { x: cx - w / 2, y: y - 12, width: w, height: 12, rx: 3, fill: '#E9ECEF', stroke: INK, 'stroke-width': 1.8 }, G); mk('path', { d: `M${cx - w / 2 + 8},${y - 6} H${cx + w / 2 - 8}`, stroke: '#B9C0C8', 'stroke-width': 3, 'stroke-dasharray': '7 3' }, G); return { g: G }; }
  function mug(g, x, by, s = 1, o = {}) {
    const G = mk('g', { transform: `translate(${x},${by}) scale(${s})` }, g);
    mk('path', { d: 'M17,-36 C30,-36 32,-16 17,-14', fill: 'none', stroke: INK, 'stroke-width': 4.5 }, G);
    mk('path', { d: 'M17,-36 C30,-36 32,-16 17,-14', fill: 'none', stroke: o.col || P.paper, 'stroke-width': 2 }, G);
    mk('path', { d: 'M-17,-46 L17,-46 L15,-4 C15,-1 13,0 10,0 L-10,0 C-13,0 -15,-1 -15,-4 Z', fill: o.col || P.paper, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, G);
    mk('rect', { x: -16, y: -34, width: 32, height: 9, fill: o.band || P.teal }, G);
    const steam = [0, 1, 2].map(i => mk('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }, G));
    return { g: G, upd: t => steam.forEach((e, i) => { const u = ((t * .45 + i / 3) % 1), y0 = -52 - 46 * u, a = Math.sin(Math.PI * u) * .7, sx = (i - 1) * 8 + 5 * Math.sin(t * 2 + i);
      e.setAttribute('d', `M${f1(sx)},${f1(y0 + 18)} c-7,-6 7,-10 0,-18`); e.setAttribute('opacity', f1(a)); e.setAttribute('stroke', i === 1 ? '#FFFFFF' : '#F3EEE6'); }) };
  }
  // potted plant: monstera / snake / round; leaves sway from their base
  function plant(g, x, by, s = 1, kind = 'monstera', seed = 1) {
    const r = rng(seed), G = mk('g', { transform: `translate(${x},${by}) scale(${s})` }, g), leaves = [], K = mk('g', {}, G);
    const potH = kind === 'snake' ? 70 : 84;
    if (kind === 'monstera') {
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * .36 + (r() - .5) * .15, L = 110 + r() * 70, lg = mk('g', {}, K), col = P.leaf[i % 3];
        const tip = { x: Math.cos(a) * L, y: Math.sin(a) * L - potH };
        mk('path', { d: `M0,${-potH + 4} Q${f1(tip.x * .3)},${f1(-potH - L * .45)} ${f1(tip.x * .75)},${f1(tip.y * .82 - potH * .18)}`, fill: 'none', stroke: '#2B5E46', 'stroke-width': 3.2 }, lg);
        const cx = tip.x * .85, cy = tip.y * .9 - potH * .1, ls = 26 + r() * 16, rot = a * 180 / Math.PI + 90;
        const leaf = mk('g', { transform: `translate(${f1(cx)},${f1(cy)}) rotate(${f1(rot)})` }, lg);
        mk('path', { d: `M0,${ls * .9} C${-ls * 1.25},${ls * .6} ${-ls * 1.2},${-ls * 1.1} 0,${-ls * 1.05} C${ls * 1.2},${-ls * 1.1} ${ls * 1.25},${ls * .6} 0,${ls * .9} Z`, fill: col, stroke: INK, 'stroke-width': 1.6 / s }, leaf);
        mk('path', { d: `M0,${ls * .85} L0,${-ls * .95}`, stroke: '#1E4E39', 'stroke-width': 1.4 / s, opacity: .7 }, leaf);
        for (const k of [-1, 1]) for (const v of [-.35, .15, .55]) mk('path', { d: `M${k * ls * .95},${f1(ls * v - ls * .1)} L${k * ls * .32},${f1(ls * v + ls * .05)}`, stroke: '#F2EADD', 'stroke-width': 3.2 / s, 'stroke-linecap': 'round' }, leaf);
        leaves.push({ lg, ph: r() * 6, amp: .8 + r() * 1.2 });
      }
    } else if (kind === 'snake') {
      for (let i = 0; i < 6; i++) {
        const lg = mk('g', {}, K), h = 120 + r() * 90, x0 = (i - 2.5) * 9, lean = (i - 2.5) * 5 + (r() - .5) * 8, w = 13 + r() * 6;
        mk('path', { d: `M${x0 - w / 2},${-potH + 4} C${x0 - w / 2 + lean * .3},${-potH - h * .5} ${x0 + lean - 3},${-potH - h * .85} ${x0 + lean},${-potH - h} C${x0 + lean + 3},${-potH - h * .85} ${x0 + w / 2 + lean * .3},${-potH - h * .5} ${x0 + w / 2},${-potH + 4} Z`, fill: P.leaf[i % 2 ? 0 : 2], stroke: INK, 'stroke-width': 1.5 / s }, lg);
        mk('path', { d: `M${x0 - w * .2},${-potH - h * .2} c3,-6 6,-6 9,0 M${x0 - w * .15 + lean * .3},${-potH - h * .5} c3,-6 6,-6 9,0`, fill: 'none', stroke: '#9FD3B5', 'stroke-width': 1.6, opacity: .7 }, lg);
        leaves.push({ lg, ph: r() * 6, amp: .5 + r() * .6 });
      }
    } else {
      for (let i = 0; i < 16; i++) { const lg = mk('g', {}, K), a = r() * Math.PI * 2, d = r() * 52, cx = Math.cos(a) * d, cy = -potH - 70 + Math.sin(a) * d * .8, rr = 16 + r() * 12;
        mk('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(rr), ry: f1(rr * .7), transform: `rotate(${f1(r() * 180)} ${f1(cx)} ${f1(cy)})`, fill: P.leaf[i % 4], stroke: INK, 'stroke-width': 1.3 / s }, lg); leaves.push({ lg, ph: r() * 6, amp: .4 }); }
      mk('path', { d: `M0,${-potH} L0,${-potH - 40}`, stroke: '#5B4636', 'stroke-width': 5 }, K);
    }
    const pw = kind === 'snake' ? 52 : 62;
    mk('path', { d: `M${-pw},${-potH} L${pw},${-potH} L${pw * .8},0 L${-pw * .8},0 Z`, fill: kind === 'round' ? P.terracotta : P.pot, stroke: INK, 'stroke-width': 2 / s, 'stroke-linejoin': 'round' }, G);
    mk('path', { d: `M${-pw},${-potH} L${pw},${-potH} L${pw * .96},${-potH + 12} L${-pw * .96},${-potH + 12} Z`, fill: kind === 'round' ? '#C77852' : P.potShade, stroke: INK, 'stroke-width': 2 / s }, G);
    mk('ellipse', { cx: 0, cy: 2, rx: pw * 1.05, ry: 9, fill: '#000', opacity: .1 }, G);
    G.insertBefore(G.lastChild, G.firstChild);
    return { g: G, upd: t => leaves.forEach(l => l.lg.setAttribute('transform', `rotate(${f1(l.amp * Math.sin(t * 1.3 + l.ph))} 0 ${-potH})`)) };
  }
  function deskLamp(g, x, by, s = 1, o = {}) {
    const svg = rootSvg(g), G = mk('g', { transform: `translate(${x},${by}) scale(${o.flip ? -s : s},${s})` }, g);
    mk('path', { d: 'M40,-112 L150,40 L-70,40 Z', fill: radGrad(svg, [[0, P.glow, .55], [1, P.glow, 0]], .45, .1, .9), opacity: .7 }, G);
    mk('ellipse', { cx: 0, cy: -4, rx: 30, ry: 7, fill: P.metal, stroke: INK, 'stroke-width': 2 }, G);
    mk('path', { d: 'M0,-6 L-18,-92 L36,-140', fill: 'none', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, G);
    mk('path', { d: 'M0,-6 L-18,-92 L36,-140', fill: 'none', stroke: o.col || P.brass, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, G);
    mk('path', { d: 'M20,-156 L64,-128 L44,-100 C30,-112 14,-128 20,-156 Z', fill: o.shade || P.lampShade, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, G);
    mk('circle', { cx: 46, cy: -110, r: 6, fill: '#FFF6D8' }, G);
    return { g: G };
  }
  function pendant(g, x, y0, len, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g), y = y0 + len, w = o.w || 120;
    mk('path', { d: `M${x - w * 1.6},${y + 900} L${x - w * .42},${y + 18} L${x + w * .42},${y + 18} L${x + w * 1.6},${y + 900} Z`, fill: linGrad(svg, [[0, P.glow, .32], [1, P.glow, 0]]), opacity: o.cone ?? .6 }, G);
    mk('path', { d: `M${x},${y0} V${y - 40}`, stroke: INK, 'stroke-width': 2.5 }, G);
    mk('path', { d: `M${x - w / 2},${y} C${x - w / 2},${y - 50} ${x - 22},${y - 46} ${x - 14},${y - 52} L${x + 14},${y - 52} C${x + 22},${y - 46} ${x + w / 2},${y - 50} ${x + w / 2},${y} Z`, fill: o.col || P.accent, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, G);
    mk('ellipse', { cx: x, cy: y + 1, rx: w * .28, ry: 6, fill: '#FFF6D8' }, G);
    return { g: G };
  }
  function shelf(g, x, y, w, o = {}) {
    const r = rng(o.seed || 9), G = mk('g', {}, g);
    let bx = x + 14;
    const stop = x + w * (o.fill ?? .62);
    while (bx < stop) {
      const bw = 13 + r() * 13, bh = 70 + r() * 46, col = P.book[Math.floor(r() * P.book.length)], lean = r() < .12 && bx < stop - 60;
      const b = mk('g', lean ? { transform: `rotate(-14 ${bx} ${y})` } : {}, G);
      mk('rect', { x: bx, y: y - bh, width: bw, height: bh, fill: col, stroke: INK, 'stroke-width': 1.6 }, b);
      mk('rect', { x: bx + 2.5, y: y - bh + 12, width: bw - 5, height: 4, fill: '#FFFFFF', opacity: .55 }, b);
      bx += bw + (lean ? 16 : 1.5);
    }
    if (o.plant !== false) plant(G, x + w * .82, y, .42, 'round', (o.seed || 9) + 1);
    mk('rect', { x: x - 4, y, width: w + 8, height: 14, rx: 3, fill: P.wood, stroke: INK, 'stroke-width': 2 }, G);
    mk('path', { d: `M${x + 30},${y + 14} l0,22 M${x + w - 30},${y + 14} l0,22`, stroke: P.metal, 'stroke-width': 6 }, G);
    return { g: G };
  }
  function frame(g, x, y, w, h, o = {}) {
    const G = mk('g', {}, g);
    mk('rect', { x, y, width: w, height: h, fill: P.paper, stroke: INK, 'stroke-width': 3 }, G);
    mk('rect', { x: x + 10, y: y + 10, width: w - 20, height: h - 20, fill: o.bg || '#F4EEE3' }, G);
    // a simple abstract chart print
    const pts = []; for (let i = 0; i <= 12; i++) pts.push([x + 18 + i * (w - 36) / 12, y + h - 22 - (h - 50) * (.25 + .6 * (i / 12) * (1 + .25 * Math.sin(i * 1.7)) * .7)]);
    mk('polyline', { points: pts.map(p => p.map(f1).join(',')).join(' '), fill: 'none', stroke: o.col || P.teal, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, G);
    return { g: G };
  }
  function clock(g, x, y, R) {
    const G = mk('g', {}, g);
    mk('circle', { cx: x, cy: y, r: R, fill: P.paper, stroke: INK, 'stroke-width': 4 }, G);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; mk('path', { d: `M${f1(x + Math.cos(a) * R * .78)},${f1(y + Math.sin(a) * R * .78)} L${f1(x + Math.cos(a) * R * .88)},${f1(y + Math.sin(a) * R * .88)}`, stroke: INK, 'stroke-width': i % 3 ? 2 : 4, 'stroke-linecap': 'round' }, G); }
    const hh = mk('path', { stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }, G), mm = mk('path', { stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, G), ss = mk('path', { stroke: P.red, 'stroke-width': 2, 'stroke-linecap': 'round' }, G);
    mk('circle', { cx: x, cy: y, r: 4, fill: INK }, G);
    const hand = (e, a, l) => e.setAttribute('d', `M${x},${y} L${f1(x + Math.sin(a) * l)},${f1(y - Math.cos(a) * l)}`);
    return { g: G, upd: t => { const sec = 9 * 3600 + 41 * 60 + t * 6; hand(hh, sec / 43200 * 2 * Math.PI, R * .45); hand(mm, (sec % 3600) / 3600 * 2 * Math.PI, R * .68); hand(ss, (sec % 60) / 60 * 2 * Math.PI, R * .78); } };
  }
  function sticky(g, x, y, col, rot, lines = 2) { const G = mk('g', { transform: `rotate(${rot} ${x} ${y})` }, g); mk('rect', { x: x - 24, y: y - 24, width: 48, height: 48, fill: col, stroke: INK, 'stroke-width': 1.5 }, G); for (let i = 0; i < lines; i++) mk('path', { d: `M${x - 15},${y - 8 + i * 11} h${22 + (i % 2) * 6}`, stroke: INK, 'stroke-width': 2, opacity: .6, 'stroke-linecap': 'round' }, G); return { g: G }; }
  // whiteboard with a hand-set PDE and a sketched smile
  function whiteboard(g, x, y, w, h, o = {}) {
    const G = mk('g', {}, g);
    mk('rect', { x: x + 8, y: y + 10, width: w, height: h, rx: 6, fill: '#000', opacity: .08 }, G);
    mk('rect', { x, y, width: w, height: h, rx: 6, fill: '#FDFDFB', stroke: '#9AA3AD', 'stroke-width': 7 }, G);
    mk('rect', { x: x + w * .1, y: y + h, width: w * .8, height: 10, rx: 4, fill: '#9AA3AD' }, G);
    const T = (tx, ty, s, fs, col, fw) => { const e = mk('text', { x: tx, y: ty, 'font-family': 'MathSans, Inter, sans-serif', 'font-size': fs, 'font-style': 'italic', 'font-weight': fw || 500, fill: col || '#1F4E8C' }, G); e.textContent = s; return e; };
    (o.lines || [['∂V/∂t + ½σ²S² ∂²V/∂S² + rS ∂V/∂S − rV = 0', 36], ['C = S·N(d₁) − K·e^{−rT}·N(d₂)', 30]]).forEach(([s, fs], i) => T(x + 28, y + 64 + i * 58, s, fs, i ? '#C0392B' : '#1F4E8C'));
    // sketched smile
    const sx = x + w * .62, sy = y + h * .58, sw = w * .3;
    mk('path', { d: `M${sx},${sy + 40} L${sx + sw},${sy + 40} M${sx},${sy + 40} L${sx},${sy - 60}`, stroke: '#333', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, G);
    mk('path', { d: `M${sx + 10},${sy - 40} C${sx + sw * .3},${sy + 26} ${sx + sw * .7},${sy + 26} ${sx + sw - 6},${sy - 30}`, stroke: '#2E7D5B', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, G);
    T(sx + sw * .38, sy + 70, 'K', 22, '#333', 600); T(sx - 26, sy - 46, 'σ', 24, '#333', 600);
    sticky(G, x + w * .12, y + h - 40, '#FFE27A', -6); sticky(G, x + w * .25, y + h - 46, '#A8E0D6', 5, 3);
    return { g: G };
  }
  // big wall display: dark screen in a thin bezel, returns content group and size
  function wallScreen(g, x, y, w, h, o = {}) {
    const svg = rootSvg(g), G = mk('g', {}, g);
    mk('rect', { x: x + 10, y: y + 14, width: w, height: h, rx: 10, fill: '#000', opacity: .12 }, G);
    mk('rect', { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: 12, fill: P.bezel, stroke: INK, 'stroke-width': 2.5 }, G);
    const id = uid('ws'), cp = mk('clipPath', { id }, defsOf(svg)); mk('rect', { x, y, width: w, height: h, rx: 4 }, cp);
    const scr = mk('g', { 'clip-path': `url(#${id})` }, G);
    mk('rect', { x, y, width: w, height: h, fill: o.screen || P.scr }, scr);
    mk('rect', { x, y, width: w, height: h, fill: radGrad(svg, [[0, '#2A4B5E', .65], [1, '#14212B', 0]], .3, .2, .9) }, scr);
    const content = mk('g', { transform: `translate(${x},${y})` }, scr);
    mk('path', { d: `M${x + w * .62},${y} l${w * .14},0 l${-w * .24},${h} l${-w * .14},0 Z`, fill: '#FFFFFF', opacity: .04 }, G);
    return { g: G, content, w, h, x, y };
  }
  // glass partition with a frosted band; whatever is drawn behind it reads as the next room
  function glassWall(g, x, y, w, h, o = {}) {
    const G = mk('g', {}, g);
    mk('rect', { x, y, width: w, height: h, fill: '#EAF3F5', opacity: o.op ?? .55 }, G);
    mk('rect', { x, y: y + h * .42, width: w, height: h * .1, fill: '#FFFFFF', opacity: .7 }, G);
    const n = o.n || 3; for (let i = 0; i <= n; i++) mk('rect', { x: x + w * i / n - 3, y, width: 6, height: h, fill: '#2A2E35' }, G);
    mk('rect', { x, y: y - 6, width: w, height: 8, fill: '#2A2E35' }, G);
    for (const u of [.15, .5, .82]) mk('path', { d: `M${x + w * u},${y + h} l${h * .35},${-h} h22 l${-h * .35},${h} Z`, fill: '#FFFFFF', opacity: .18 }, G);
    return { g: G };
  }
  // distant trading floor: rows of desks (varied widths and gaps) with glowing monitors, seated colleagues, plants and
  // pillars; lighter and smaller with distance
  function farFloor(g, x0, x1, y, o = {}) {
    const r = rng(o.seed || 21), G = mk('g', { opacity: o.op ?? 1 }, g), glows = [];
    [[.55, 0], [.75, 1], [1, 2]].forEach(([sc, k]) => {
      const row = mk('g', {}, G), ry = y + k * 46 * (o.rowGap || 1), col = ['#D9D3C8', '#CFC7BA', '#C2B9AA'][k], ppl = ['#C9BFB0', '#BBB0A0', '#A99D8C'][k];
      let x = x0 + r() * 90;
      while (x < x1) {
        const roll = r();
        if (roll < .1) {                                                         // a potted bush between desks
          const R = (20 + r() * 14) * sc, cx = x + R;
          mk('rect', { x: cx - R * .45, y: ry + 8 * sc, width: R * .9, height: 44 * sc, rx: 3, fill: col }, row);
          mk('ellipse', { cx, cy: ry + 6 * sc - R * .9, rx: R, ry: R * 1.15, fill: ['#A9C6AE', '#98BBA0', '#86AD92'][k] }, row);
          x += 2 * R + (40 + r() * 50) * sc; continue;
        }
        if (roll < .16) { mk('rect', { x, y: ry - 420, width: 30 * sc, height: 472 + 52 * sc, fill: col, opacity: .85 }, row); x += (30 + 70 + r() * 60) * sc; continue; }   // a pillar
        const dw = (96 + r() * 80) * sc, nm = dw > 140 * sc ? 2 + (r() < .3 ? 1 : 0) : 1 + (r() < .5 ? 1 : 0);
        const mw = Math.min(46 * sc, (dw - 20 * sc) / nm - 6 * sc);
        for (let m = 0; m < nm; m++) { const mx = x + 12 * sc + m * (mw + 6 * sc), mh = mw * .66;
          mk('rect', { x: mx, y: ry - mh - 6 * sc, width: mw, height: mh, rx: 2, fill: '#2E3A44', opacity: .85 - .12 * (2 - k) }, row);
          const gl = mk('rect', { x: mx + 3 * sc, y: ry - mh - 3 * sc, width: mw - 6 * sc, height: mh - 6 * sc, fill: ['#3E7C8C', '#5A8F6E', '#6C7FA6'][Math.floor(r() * 3)], opacity: .55 }, row); glows.push({ e: gl, ph: r() * 6 }); }
        if (r() < .55) {                                                          // a colleague at the desk, seen from behind
          const px = x + dw * (.3 + .4 * r()), hr = 8.5 * sc;
          mk('path', { d: `M${f1(px - 17 * sc)},${f1(ry + 2 * sc)} C${f1(px - 17 * sc)},${f1(ry - 26 * sc)} ${f1(px + 17 * sc)},${f1(ry - 26 * sc)} ${f1(px + 17 * sc)},${f1(ry + 2 * sc)} Z`, fill: ppl }, row);
          mk('circle', { cx: f1(px), cy: f1(ry - 26 * sc - hr), r: f1(hr), fill: ppl }, row);
        }
        mk('rect', { x, y: ry, width: dw, height: 6 * sc, fill: col }, row);
        mk('rect', { x: x + 10 * sc, y: ry + 6 * sc, width: 4 * sc, height: 46 * sc, fill: col }, row);
        mk('rect', { x: x + dw - 14 * sc, y: ry + 6 * sc, width: 4 * sc, height: 46 * sc, fill: col }, row);
        x += dw + (24 + r() * 80) * sc;
      }
    });
    return { g: G, upd: t => glows.forEach(q => q.e.setAttribute('opacity', f1(.45 + .2 * Math.sin(t * 1.7 + q.ph)))) };
  }
  // big blurred foreground leaves at a frame edge (depth)
  function foreLeaves(g, x, y, s, flip, o = {}) {
    const svg = rootSvg(g), G = mk('g', { transform: `translate(${x},${y}) scale(${flip ? -s : s},${s})`, filter: blurF(svg, o.blur ?? 5), opacity: o.op ?? .95 }, g), L = [];
    [[0, 0, -20, 1], [40, 60, 15, .85], [-10, 120, -45, .9]].forEach(([dx, dy, rot, k], i) => {
      const lg = mk('g', { transform: `translate(${dx},${dy}) rotate(${rot})` }, G);
      mk('path', { d: `M0,0 C80,-60 220,-50 300,${-10 * k} C220,40 90,50 0,0 Z`, fill: P.leaf[i === 1 ? 0 : 2] }, lg);
      mk('path', { d: 'M0,0 C90,-14 200,-14 290,-8', stroke: '#1C4A36', 'stroke-width': 4, fill: 'none', opacity: .6 }, lg);
      L.push({ lg, dx, dy, rot, ph: i * 1.3 });
    });
    return { g: G, upd: t => L.forEach(l => l.lg.setAttribute('transform', `translate(${l.dx},${l.dy}) rotate(${f1(l.rot + 1.6 * Math.sin(t * 1.1 + l.ph))})`)) };
  }
  function chair(g, x, by, s = 1, o = {}) {
    const G = mk('g', { transform: `translate(${x},${by}) scale(${s})` }, g);
    mk('ellipse', { cx: 0, cy: 0, rx: 70, ry: 10, fill: '#000', opacity: .1 }, G);
    for (const a of [-60, -20, 20, 60]) mk('path', { d: `M0,-30 L${a},-4`, stroke: P.metal, 'stroke-width': 7, 'stroke-linecap': 'round' }, G);
    mk('rect', { x: -6, y: -110, width: 12, height: 82, fill: P.metal }, G);
    mk('rect', { x: -66, y: -136, width: 132, height: 30, rx: 14, fill: o.col || '#2D4B57', stroke: INK, 'stroke-width': 2 }, G);
    mk('rect', { x: -58, y: -330, width: 116, height: 190, rx: 30, fill: o.col || '#2D4B57', stroke: INK, 'stroke-width': 2 }, G);
    mk('path', { d: 'M-40,-300 C-20,-310 20,-310 40,-300', stroke: '#FFFFFF', 'stroke-width': 3, opacity: .3, fill: 'none' }, G);
    return { g: G };
  }

  window.Env = { P, INK, mk, rng, linGrad, radGrad, blurF, sky, skyline, clouds, windowWall, wall, floor, rug, desk, monitor, laptop, keyboard, mug, plant, deskLamp, pendant, shelf, frame, clock, sticky, whiteboard, wallScreen, glassWall, farFloor, foreLeaves, chair };
})();
