// test_desi.js - engine test: Naina and Kabir (an Indian couple, 1992) on a rooftop at sunset, 6 s.
//   A 0.0-3.6  knees-up two-shot: she looks at the sunset; he walks in with a daisy, stops and holds it out; she turns
//   B 3.6-6.0  [slash wipe] her close-up: surprised -> shy blush behind a smile, petals
(() => {
  // ---------------------------------------------------------------- the two designs: recoloured rigs + Indian details
  const clone = o => JSON.parse(JSON.stringify(o));
  const N = Object.assign(clone(DESIGNS.hina), {
    name: 'naina', line: '#3a1f1c', lineSoft: '#7a4a3c',
    skin: { b: '#dba27c', s: '#b9805d', h: '#f3c6a5' }, blush: '#d9606e', mouthIn: '#7a2a30', tongue: '#c86a70',
    hair: { b: '#221c22', s: '#0e0b10', h: '#463c48', spec: '#8a8096', line: '#0c090c' },
    iris: { top: '#1a0e08', mid: '#5b3a22', bot: '#b0824f', pupil: '#0b0604' }, browCol: '#1c1414',
    cardigan: { b: '#f2a3bd', s: '#d77e9c', h: '#ffd2e0' }, collar: { b: '#f7bccd', s: '#dc93ab' }, ribbon: { b: '#e9b44c', s: '#b98629' },
    skirt: { b: '#ee98b4', s: '#cc7493', h: '#ffc6d8' }, sock: { b: '#f7dfe6', s: '#dbb8c3' }, shoe: { b: '#d6a444', s: '#a87a2a', h: '#f2cf7a' },
    hairStyle: 'naina', hairLen: 1.6,
  });
  const K = Object.assign(clone(DESIGNS.ren), {
    name: 'kabir', line: '#2a1914', lineSoft: '#6a4a3e',
    skin: { b: '#c98f69', s: '#a46e4f', h: '#e6b490' }, blush: '#d06a6e', mouthIn: '#6e2a2c', tongue: '#c06a6a',
    hair: { b: '#1f1a1e', s: '#0c0a0d', h: '#423a44', spec: '#7a7286', line: '#0a080a' },
    iris: { top: '#170c07', mid: '#553520', bot: '#a07448', pupil: '#0a0503' }, browCol: '#161012',
    blazer: { b: '#86a8cc', s: '#6283aa', h: '#b4cde6' }, shirt: { b: '#f7f6f2', s: '#d8d6cf' }, tie: { b: '#f7f6f2', s: '#d8d6cf' },
    pants: { b: '#2f3a52', s: '#222a3d', h: '#46557a' }, shoe: { b: '#6b4a34', s: '#4a3020', h: '#8e6a4e' }, shoeAcc: '#6b4a34',
    hairStyle: 'kabir',
  });
  DESIGNS.naina = N; DESIGNS.kabir = K;
  HAIR.naina = clone(HAIR.hina); HAIR.naina.front = HAIR.naina.front.filter(l => !l.ahoge);   // no anime antenna lock
  HAIR.naina.back.forEach(l => { l.p[l.p.length - 1][1] += .25; });                           // a little longer
  HAIR.kabir = clone(HAIR.ren);
  const naina = (x, y, u, o) => drawChar(N, x, y, u, o), kabir = (x, y, u, o) => drawChar(K, x, y, u, o);

  // bindi on the forehead and a sheer dupatta over one shoulder (drawn in camera space after the character)
  function bindi(head, u, turn) { const x = head[0] + Math.sin(turn * Math.PI / 2) * .45 * u * .55, y = head[1] - .1 * u; G.fillStyle = '#c41230'; G.beginPath(); G.arc(x, y, .028 * u, 0, TAU); G.fill(); }
  function dupatta(head, u, t, side = -1) {
    const sx = head[0] + side * .32 * u, sy = head[1] + .95 * u, w = Math.sin(t * 2.1) * .06 * u;
    G.save(); G.globalAlpha = .78;
    const p = new Path2D();
    p.moveTo(sx - .25 * u, sy - .05 * u); p.quadraticCurveTo(head[0], sy + .25 * u, head[0] - side * .38 * u, sy + .1 * u);
    p.lineTo(head[0] - side * .3 * u, sy + .32 * u); p.quadraticCurveTo(head[0] + side * .1 * u, sy + .55 * u, sx + side * .05 * u, sy + .35 * u);
    p.quadraticCurveTo(sx + side * .3 * u + w, sy + 1.6 * u, sx + side * .55 * u + w * 2, sy + 2.9 * u);
    p.lineTo(sx + side * .2 * u + w * 2, sy + 2.95 * u); p.quadraticCurveTo(sx + side * .05 * u + w, sy + 1.4 * u, sx - .25 * u, sy - .05 * u); p.closePath();
    G.fillStyle = tone('#f7b3c8'); G.fill(p); G.strokeStyle = tone('#c9708e'); G.lineWidth = 2.5; G.stroke(p);
    G.restore();
  }

  // ---------------------------------------------------------------- A: two-shot
  const U = 200, kX = tt => lerp(2350, 1290, ease(seg(tt, .2, 2.0)));
  function shotA(t, lt, dur) {
    setTOD('evening');
    const ta = onTwos(lt), cam = { x: 980 + 40 * ease(seg(lt, 0, dur)), y: 700, zoom: 1.0 };
    SET.rooftop(cam, t, { sun: [700, 620] });
    const x = kX(ta), walking = ta < 2.0, offer = ease(seg(ta, 2.1, 2.5)), turnN = ease(seg(ta, 2.5, 2.9));
    const ko = { t: ta, turn: -.6, face: offer > 0 ? 'smile' : 'neutral', look: [-.6, 0], blink: autoBlink(ta, 5),
      sway: [follow(ta, tt => kX(tt) / U, 5, 12, 1.2), 0], prop: { hand: 'L', draw: PROPS.flower, rot: -40, s: 1.2 } };
    if (walking) Object.assign(ko, walkPose(x / (2.6 * U)), { armL: [30, 70, 'hold'] });
    else Object.assign(ko, { armL: [lerp(30, 70, offer), lerp(70, 25, offer), 'hold', 0, .85], armR: [-6, 14, 'relax'] });
    const fN = faceAt(ta, [[0, 'smile'], [2.6, 'surprised'], [3.1, 'embarrassed']]);
    const nTurn = lerp(-.25, .55, turnN);
    const ni = naina(740, 1560, U, { t: ta, turn: nTurn, face: fN.face, blink: fN.blink ?? autoBlink(ta, 2), sq: fN.sq, look: [lerp(-.6, .7, turnN), -.1],
      armL: [6, 30, 'relax'], armR: [-4, 18, 'relax'], sway: [.03 * Math.sin(t * 1.6), 0], blush: ta > 3.0 ? .8 : undefined });
    dupatta(ni.head, U, t, -1); bindi(ni.head, U, nTurn);
    kabir(x, 1560, U * 1.03, ko);
    camEnd();
    petals(t, { n: 18, size: 16, wind: 70, seed: 'A' });
    if (lt < .35) flash(1 - lt / .35, '#fff4e8');
    if (lt > dur - .35) slashWipe(seg(lt, dur - .35, dur) * .5);
  }
  // ---------------------------------------------------------------- B: her close-up
  function shotB(t, lt, dur) {
    setTOD('evening');
    const ta = onTwos(lt), cam = { x: 820, y: 420, zoom: 1.7 + .08 * ease(seg(lt, 0, dur)) };
    SET.rooftop(cam, t, { sun: [700, 620] });
    camEnd();
    blurBand(0, H, { blur: 6, n: 0 });
    G.save(); G.fillStyle = 'rgba(255,214,200,.18)'; G.fillRect(0, 0, W, H); G.restore();
    const f = faceAt(ta, [[0, 'surprised'], [.7, 'embarrassed'], [1.5, 'smile']]);
    const head = [960, 500];
    bust(N, head[0], head[1], 560, { t: ta, turn: .22, face: f.face, sq: f.sq, blink: f.blink ?? autoBlink(ta, 7), look: f.face === 'smile' ? [.3, .1] : [.5, .3],
      sway: [.02 * Math.sin(t * 1.3), 0], blush: f.face === 'surprised' ? .3 : .85 });
    bindi(head, 560, .22);
    if (f.face === 'smile') sparkles(t, 960, 420, 520, 8, 'nB', .7);
    petals(t, { n: 14, size: 34, wind: 60, seed: 'B', speed: 1.2 });
    if (lt < .35) slashWipe(.5 + seg(lt, 0, .35) * .5);
  }
  shots([[0, shotA], [3.6, shotB]]);
})();
