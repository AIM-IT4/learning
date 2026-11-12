// test_desi.js - engine test: Naina and Kabir on a rooftop at sunset, painted in watercolour and ink (4 s).
// Same staging as the anime-cel test: she looks at the sunset, he holds out a daisy, she turns and smiles.
(() => {
  const SKIN_N = '#D9A07B', SKIN_K = '#C68B64', HAIR = '#1E1A20', PINK = '#EFA0BA', PINK_DK = '#C9708E', DENIM = '#7EA2C8', DENIM_DK = '#5A7FA6', JEANS = '#2E3A55';
  const P = (cx, cy, pts) => pts.map(([x, y]) => [cx + x, cy + y]);

  function backdrop(t) {
    boilSeed('sky');
    paint(rectPts(-200, -200, W + 400, H + 400), { wash: '#F4B98E', ink: null });
    paint(rectPts(-200, -200, W + 400, 420), { fill: '#8E6FB0', fillOp: 150, bleed: .25, tex: .6, ink: null });
    paint(rectPts(-200, 150, W + 400, 420), { fill: '#E58FA6', fillOp: 130, bleed: .3, tex: .6, ink: null });
    paint(ellPts(560, 640, 420, 260, 30, 6), { fill: '#FFD79A', fillOp: 140, bleed: .3, tex: .5, ink: null });
    glow(560, 600, 340, '#FFC77A', .55);
    boilSeed('sun'); paint(ellPts(560, 600, 62, 62, 24, 1), { wash: '#FFF0C8', ink: null });
    for (let i = 0; i < 3; i++) { boilSeed('cl' + i); const x = [300, 1150, 1650][i], y = [170, 120, 230][i];
      paint(ellPts(x, y, [220, 300, 180][i], [60, 70, 50][i], 26, 8), { fill: '#FCE3D2', fillOp: 160, bleed: .2, tex: .5, ink: null }); }
    boilSeed('city');
    for (let i = 0; i < 16; i++) { const x = -40 + i * 130 + (hash(i) * 40 | 0), h = 80 + hash(i + 9) * 170;
      paint(rectPts(x, 700 - h, 112, h + 40), { wash: mixCol('#8C6F9E', '#C9A2B8', hash(i + 3) * .5), fill: '#6E5A8C', fillOp: 70, bleed: .05, tex: .5, ink: null }); }
    boilSeed('roof');
    paint(rectPts(-100, 735, W + 200, 400), { wash: '#C9B4A8', fill: '#A78F86', fillOp: 90, bleed: .08, tex: .6, ink: PAL.ink, sw: .8 });
    paint(rectPts(-100, 690, W + 200, 52), { wash: '#B79F98', ink: PAL.ink, sw: .9 });
    for (let i = 0; i < 9; i++) { boilSeed('post' + i); paint(rectPts(i * 240 - 20, 520, 16, 200), { wash: '#6E6470', ink: PAL.ink, sw: .6 }); }
    inkLine([[-100, 528], [W + 100, 528]], 1.4, '#6E6470');
  }

  // a face in 3/4 view; dir = +1 faces right, -1 left. o: {blink, smile, shy, bindi}
  function face(cx, cy, h, dir, skin, o) {
    const d = dir;
    paint(P(cx, cy, [[-.42 * d * h, -.48 * h], [.28 * d * h, -.52 * h], [.46 * d * h, -.2 * h], [.5 * d * h, .05 * h], [.43 * d * h, .3 * h], [.22 * d * h, .5 * h], [-.02 * d * h, .55 * h], [-.3 * d * h, .38 * h], [-.46 * d * h, .05 * h]]),
      { wash: skin, fill: mixCol(skin, '#7A3E2A', .4), fillOp: 60, bleed: .06, tex: .5, ink: PAL.ink, sw: .9, curv: .6 });
    paint(ellPts(cx - .38 * d * h, cy + .04 * h, .09 * h, .14 * h, 14), { wash: mixCol(skin, '#7A3E2A', .25), ink: PAL.ink, sw: .6 });     // ear
    const ey = cy - .02 * h;
    for (const [ex, k] of [[cx + .08 * d * h, .8], [cx + .34 * d * h, .55]]) {                                                       // near and far eye
      if (o.blink) { inkLine([[ex - .1 * h * k, ey], [ex, ey + .03 * h], [ex + .1 * h * k, ey]], 1.4, PAL.ink, 'ink', .5); continue; }
      paint(P(ex, ey, [[-.11 * h * k, 0], [0, -.075 * h], [.11 * h * k, 0], [0, .05 * h]]), { wash: '#FBF4EC', ink: null, curv: .5 });
      paint(ellPts(ex + .02 * d * h, ey - .005 * h, .045 * h * k, .05 * h, 12), { wash: '#3B2416', ink: null });
      paint(ellPts(ex + .03 * d * h, ey - .02 * h, .012 * h, .012 * h, 8), { wash: '#FFFFFF', ink: null });
      inkLine([[ex - .12 * h * k, ey + .005 * h], [ex, ey - .085 * h], [ex + .12 * h * k, ey - .01 * h]], 1.8, PAL.ink, 'ink', .6);
    }
    inkLine([[cx - .02 * d * h, cy - .17 * h], [cx + .1 * d * h, cy - .2 * h], [cx + .2 * d * h, cy - .18 * h]], 2.2, HAIR, 'ink', .6);   // brows
    inkLine([[cx + .29 * d * h, cy - .18 * h], [cx + .4 * d * h, cy - .17 * h]], 1.8, HAIR, 'ink', .5);
    inkLine([[cx + .4 * d * h, cy + .02 * h], [cx + .46 * d * h, cy + .16 * h], [cx + .39 * d * h, cy + .19 * h]], .9, mixCol(skin, PAL.ink, .5), 'inkfine', .5);  // nose
    const my = cy + .31 * h, sm = o.smile || 0;
    paint(P(cx + .27 * d * h, my, [[-.09 * h, -.01 * h], [0, (-.025 + .02 * sm) * h], [.08 * h, -.015 * h], [0, (.04 + .02 * sm) * h]]), { wash: o.lip || '#B9555E', ink: null, curv: .5 });
    if (o.shy) { paint(ellPts(cx + .08 * d * h, cy + .16 * h, .1 * h, .05 * h, 12), { fill: '#E8707E', fillOp: 120 * o.shy, bleed: .3, tex: .3, ink: null });
      paint(ellPts(cx + .38 * d * h, cy + .16 * h, .06 * h, .04 * h, 10), { fill: '#E8707E', fillOp: 100 * o.shy, bleed: .3, tex: .3, ink: null }); }
    if (o.bindi) paint(ellPts(cx + .2 * d * h, cy - .24 * h, .022 * h, .022 * h, 8), { wash: '#C2122E', ink: null });
  }

  function naina(x, y, h, t, o) {          // feet at (x, y), head height h, facing right; o: {turn 0..1, blink, smile, shy}
    const sway = wob(t, .5) * .04 * h, hx = x + .05 * h, hy = y - 6.7 * h;
    boilSeed('nHairB'); paint(P(hx, hy, [[-.55 * h, -.3 * h], [.1 * h, -.62 * h], [.45 * h, -.2 * h], [.2 * h, .4 * h], [-.2 * h + sway, 1.8 * h], [-.7 * h + sway * 2, 2.6 * h], [-.75 * h, 1.2 * h]]), { wash: HAIR, ink: PAL.ink, sw: .8, curv: .6 });
    boilSeed('nLegs');
    paint(P(x, y, [[-.55 * h, -2.5 * h], [.45 * h, -2.5 * h], [.38 * h, -.15 * h], [.12 * h, -.15 * h], [0, -1.6 * h], [-.15 * h, -.15 * h], [-.45 * h, -.15 * h]]), { wash: '#F6DCE4', fill: '#D9A9B8', fillOp: 70, bleed: .06, tex: .4, ink: PAL.ink, sw: .8, curv: .3 });
    paint(ellPts(x - .3 * h, y - .08 * h, .24 * h, .09 * h, 12), { wash: '#D6A444', ink: PAL.ink, sw: .7 }); paint(ellPts(x + .28 * h, y - .08 * h, .24 * h, .09 * h, 12), { wash: '#D6A444', ink: PAL.ink, sw: .7 });
    boilSeed('nBody');                                            // kameez to the knee
    paint(P(x, y, [[-.5 * h, -5.55 * h], [.5 * h, -5.55 * h], [.62 * h, -4.3 * h], [.55 * h, -3.6 * h], [.85 * h, -2.3 * h], [-.85 * h, -2.3 * h], [-.55 * h, -3.6 * h], [-.62 * h, -4.3 * h]]), { wash: PINK, fill: PINK_DK, fillOp: 80, bleed: .1, tex: .6, ink: PAL.ink, sw: 1, curv: .3 });
    inkLine([[x - .7 * h, y - 2.42 * h], [x + .7 * h, y - 2.42 * h]], 1.6, '#D6A444', 'ink', .2);
    boilSeed('nNeck'); paint(P(hx, hy, [[-.15 * h, .4 * h], [.18 * h, .4 * h], [.2 * h, 1.15 * h], [-.18 * h, 1.15 * h]]), { wash: mixCol(SKIN_N, '#7A3E2A', .15), ink: PAL.ink, sw: .7 });
    boilSeed('nArms');
    paint(ribbon([[x - .5 * h, y - 5.35 * h], [x - .72 * h, y - 4.2 * h], [x - .7 * h, y - 3.1 * h]], .34 * h, .26 * h), { wash: PINK, fill: PINK_DK, fillOp: 60, bleed: .1, tex: .5, ink: PAL.ink, sw: .8 });
    paint(ellPts(x - .7 * h, y - 2.95 * h, .13 * h, .17 * h, 12), { wash: SKIN_N, ink: PAL.ink, sw: .6 });
    paint(ribbon([[x + .5 * h, y - 5.35 * h], [x + .6 * h, y - 4.2 * h], [x + .45 * h, y - 3.2 * h]], .32 * h, .25 * h), { wash: PINK, fill: PINK_DK, fillOp: 60, bleed: .1, tex: .5, ink: PAL.ink, sw: .8 });
    boilSeed('nHead');
    face(hx, hy, h, lerp(-1, 1, o.turn), SKIN_N, { blink: o.blink, smile: o.smile, shy: o.shy, bindi: 1, lip: '#C2556A' });
    paint(P(hx, hy, [[-.52 * h, -.05 * h], [-.5 * h, -.42 * h], [-.1 * h, -.64 * h], [.4 * h, -.5 * h], [.5 * h, -.25 * h], [.2 * h, -.38 * h], [0, -.44 * h], [-.3 * h, -.3 * h]]), { wash: HAIR, ink: PAL.ink, sw: .8, curv: .6 });
    paint(ellPts(hx + lerp(-.38, .38, o.turn) * h, hy + .2 * h, .035 * h, .06 * h, 10), { wash: '#E3B54B', ink: null });     // jhumka
    boilSeed('nDup');                                             // sheer dupatta over the shoulder, moving in the wind
    paint(ribbon([[x + .45 * h, y - 5.5 * h], [x - .1 * h, y - 4.9 * h], [x - .6 * h + sway, y - 4.0 * h], [x - .95 * h + sway * 3, y - 2.6 * h]], .5 * h, .35 * h), { wash: '#F7B8CB', washOp: 170, ink: PINK_DK, sw: .6 });
  }

  function kabir(x, y, h, t, o) {           // feet at (x, y), facing left; o: {reach 0..1}
    const hx = x - .04 * h, hy = y - 7.0 * h, r = o.reach;
    boilSeed('kLegs');
    paint(ribbon([[x - .25 * h, y - 3.3 * h], [x - .3 * h, y - 1.7 * h], [x - .32 * h, y - .15 * h]], .5 * h, .38 * h), { wash: JEANS, fill: '#1F2840', fillOp: 70, bleed: .05, tex: .5, ink: PAL.ink, sw: .8 });
    paint(ribbon([[x + .25 * h, y - 3.3 * h], [x + .3 * h, y - 1.7 * h], [x + .35 * h, y - .15 * h]], .5 * h, .38 * h), { wash: JEANS, fill: '#1F2840', fillOp: 70, bleed: .05, tex: .5, ink: PAL.ink, sw: .8 });
    paint(ellPts(x - .45 * h, y - .08 * h, .28 * h, .1 * h, 12), { wash: '#5A3E2C', ink: PAL.ink, sw: .7 }); paint(ellPts(x + .25 * h, y - .08 * h, .28 * h, .1 * h, 12), { wash: '#5A3E2C', ink: PAL.ink, sw: .7 });
    boilSeed('kBody');
    paint(P(x, y, [[-.75 * h, -5.7 * h], [.75 * h, -5.7 * h], [.72 * h, -3.1 * h], [-.72 * h, -3.1 * h]]), { wash: DENIM, fill: DENIM_DK, fillOp: 90, bleed: .08, tex: .7, ink: PAL.ink, sw: 1, curv: .2 });
    paint(P(x, y, [[-.25 * h, -5.7 * h], [.2 * h, -5.7 * h], [.12 * h, -3.15 * h], [-.15 * h, -3.15 * h]]), { wash: '#F6F4EE', ink: PAL.ink, sw: .7 });
    boilSeed('kNeck'); paint(P(hx, hy, [[-.18 * h, .4 * h], [.18 * h, .4 * h], [.22 * h, 1.3 * h], [-.22 * h, 1.3 * h]]), { wash: mixCol(SKIN_K, '#5A2E1E', .15), ink: PAL.ink, sw: .7 });
    boilSeed('kArmFar'); paint(ribbon([[x + .7 * h, y - 5.5 * h], [x + .82 * h, y - 4.3 * h], [x + .75 * h, y - 3.2 * h]], .42 * h, .34 * h), { wash: DENIM, fill: DENIM_DK, fillOp: 70, bleed: .08, tex: .6, ink: PAL.ink, sw: .8 });
    boilSeed('kHead');
    face(hx, hy, h, -1, SKIN_K, { smile: .6 + .4 * r, lip: '#8E4A42' });
    paint(P(hx, hy, [[.52 * h, -.02 * h], [.55 * h, -.42 * h], [.15 * h, -.7 * h], [-.3 * h, -.66 * h], [-.55 * h, -.42 * h], [-.48 * h, -.22 * h], [-.3 * h, -.36 * h], [0, -.4 * h], [.3 * h, -.3 * h]]), { wash: HAIR, ink: PAL.ink, sw: .8, curv: .6 });
    boilSeed('kArm');                                             // near arm reaching out with the daisy
    const ex = x - .7 * h - r * .9 * h, ey = y - 4.5 * h - r * .35 * h, hx2 = ex - .6 * h - r * .7 * h, hy2 = ey - .2 * h - r * .25 * h;
    paint(ribbon([[x - .62 * h, y - 5.5 * h], [ex, ey], [hx2, hy2]], .42 * h, .3 * h), { wash: DENIM, fill: DENIM_DK, fillOp: 70, bleed: .08, tex: .6, ink: PAL.ink, sw: .8 });
    paint(ellPts(hx2 - .12 * h, hy2, .17 * h, .14 * h, 12), { wash: SKIN_K, ink: PAL.ink, sw: .6 });
    inkLine([[hx2 - .2 * h, hy2], [hx2 - .3 * h, hy2 - .55 * h]], 1.6, '#4F7A2A', 'ink', .4);
    boilSeed('daisy'); const dx = hx2 - .32 * h, dy = hy2 - .62 * h;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * .6; paint(ellPts(dx + Math.cos(a) * .13 * h, dy + Math.sin(a) * .13 * h, .1 * h, .04 * h, 10, 0, a), { wash: '#FBF8F0', ink: '#9C9488', sw: .3 }); }
    paint(ellPts(dx, dy, .07 * h, .07 * h, 10), { wash: '#F2B928', ink: null });
  }

  function shotA(t, lt, dur) {
    const ta = onTwos(lt);
    camBegin(960 + 30 * ease(seg(lt, 0, dur)), 560, 1.02);
    backdrop(t);
    const turn = ease(seg(ta, 1.6, 2.2)), reach = ease(seg(ta, .6, 1.5));
    naina(720, 1040, 92, t, { turn: lerp(.25, 1, turn), blink: frac(ta / 2.7) < .06, smile: ta > 2.6 ? 1 : .3, shy: ease(seg(ta, 2.4, 3.2)) });
    kabir(1330, 1040, 95, t, { reach });
    camEnd();
    for (let i = 0; i < 14; i++) { boilSeed('pt' + i); const k = frac(hash(i) + t * (.08 + .05 * hash(i + 4))); paint(ellPts(lerp(-50, W + 50, k), 180 + hash(i + 7) * 700 + Math.sin(t * 2 + i) * 30, 9, 4, 8, 0, t * 2 + i), { wash: '#F9C9D6', ink: null }); }
  }
  shots([[0, shotA]]);
})();
