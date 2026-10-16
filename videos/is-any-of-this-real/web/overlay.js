// 2D typography: word-synced captions, callouts, title cards
'use strict';
const ui = document.getElementById('ui');
ui.width = W; ui.height = H;
const cx = ui.getContext('2d');

const KEYWORDS = new Set(['atoms', 'empty', 'space', 'touched', 'force', 'disappears', 'ripples', 'fields', 'probability', 'seen',
  'color', 'sound', 'paints', 'darkness', 'late', 'stars', 'gone', 'ghosts', 'light', 'surface', 'projection',
  'humans', 'animals', 'pattern', 'borrowing', 'back', 'carbon', 'dying', 'fake', 'seems', 'wonder', 'eyes', 'watching', 'dissolve', 'anything']);
const CAP_FONT = (px) => `italic 300 ${px}px "Cormorant Garamond", "DejaVu Serif", serif`;

// group words into caption chunks (sentences; long ones split at a pause near the middle)
const CHUNKS = (() => {
  const sentences = []; let cur = [];
  WORDS.forEach((w) => { cur.push(w); if (/[.?]$/.test(w.w)) { sentences.push(cur); cur = []; } });
  if (cur.length) sentences.push(cur);
  cx.font = CAP_FONT(50);
  const width = (ws) => cx.measureText(ws.map((w) => w.w).join(' ')).width;
  const out = [];
  for (const s of sentences) {
    if (width(s) < 1150) { out.push(s); continue; }
    let best = -1, bestD = 1e9;
    s.forEach((w, i) => { if (i < s.length - 2 && /[…,]$/.test(w.w)) { const d = Math.abs(width(s.slice(0, i + 1)) - width(s) / 2); if (d < bestD) { bestD = d; best = i; } } });
    if (best < 0) out.push(s); else { out.push(s.slice(0, best + 1)); out.push(s.slice(best + 1)); }
  }
  return out.map((ws, i) => ({ ws, start: ws[0].s - 0.18, end: ws[ws.length - 1].e + 0.9 })).map((c, i, a) => {
    if (i + 1 < a.length) c.end = Math.min(c.end, a[i + 1].start + 0.12);
    c.center = c.ws[0].s >= K.now - 0.05;
    if (c.center) c.end = Math.min(c.end, K.open + 0.12);
    return c;
  });
})();

function drawCaptions(t) {
  for (const c of CHUNKS) {
    if (t < c.start || t > c.end) continue;
    const chunkA = sstep(c.start, c.start + 0.2, t) * (1 - sstep(c.end - 0.28, c.end, t));
    const px = c.center ? 66 : 50;
    cx.font = CAP_FONT(px);
    const space = cx.measureText(' ').width;
    const widths = c.ws.map((w) => cx.measureText(w.w).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (c.ws.length - 1);
    let x = W / 2 - total / 2;
    const y = c.center ? H / 2 + 22 : H - 112;
    c.ws.forEach((w, i) => {
      const a = clamp01((t - w.s + 0.1) / 0.32);
      if (a > 0) {
        const key = KEYWORDS.has(normW(w.w));
        cx.save();
        cx.globalAlpha = chunkA * easeOut(a);
        const blur = (1 - easeOut(a)) * 7;
        cx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
        cx.shadowColor = key ? 'rgba(255,196,120,0.75)' : 'rgba(0,0,0,0.85)';
        cx.shadowBlur = key ? 22 : 14;
        cx.fillStyle = key ? '#F2D29B' : '#ECE6DC';
        cx.fillText(w.w, x, y + (1 - easeOut(a)) * 12);
        cx.restore();
      }
      x += widths[i] + space;
    });
  }
}

function spaced(text, x, y, font, spacing, color, alpha, glow, align) {
  cx.save();
  cx.font = font; cx.letterSpacing = spacing + 'px';
  cx.globalAlpha = alpha; cx.fillStyle = color;
  cx.textAlign = align || 'center';
  if (glow) { cx.shadowColor = glow; cx.shadowBlur = 24; }
  cx.fillText(text, x + (align === 'left' ? 0 : spacing / 2), y);
  cx.restore();
}
function reticle(x, y, r, alpha, color) {
  cx.save(); cx.globalAlpha = alpha; cx.strokeStyle = color || 'rgba(235,240,255,0.9)'; cx.lineWidth = 1.2;
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    cx.beginPath(); cx.moveTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)); cx.lineTo(x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14)); cx.stroke();
  }
  cx.restore();
}
function tag(x, y, text, alpha, color, size) {
  spaced(text, x, y, `400 ${size || 17}px Inter, sans-serif`, 4, color || '#DCE6FF', alpha, null, 'left');
}
const fmtTC = (s) => { const m = Math.floor(s / 60), ss = s - m * 60; return `00:${String(m).padStart(2, '0')}:${ss.toFixed(2).padStart(5, '0')}`; };

function drawCallouts(t) {
  // cold-open title
  if (t < K.dissolve) {
    const a = sstep(0.15, 0.7, t) * (1 - sstep(K.look + 0.9, K.anything + 0.3, t));
    if (a > 0) {
      cx.save(); cx.filter = `blur(${((1 - a) * 6).toFixed(1)}px)`;
      spaced('IS ANY OF THIS REAL?', W / 2, H / 2 + 14, '600 46px Cinzel', 18 + t * 6, '#F1EBE0', a, 'rgba(255,255,255,0.35)');
      cx.restore();
    }
  }
  // atom: the nucleus and the emptiness
  if (t > K.every - 0.4 && t < K.go) {
    const L = S1.labels(t), st = S1.state(t);
    const a = sstep(K.every, K.every + 0.5, t) * (1 - sstep(K.never - 0.4, K.never + 0.1, t));
    if (a > 0) {
      reticle(L.nucleus.x, L.nucleus.y, 16, a * 0.85);
      cx.save(); cx.globalAlpha = a * 0.6; cx.strokeStyle = '#DCE6FF'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(L.nucleus.x + 22, L.nucleus.y - 22); cx.lineTo(L.nucleus.x + 120, L.nucleus.y - 120); cx.lineTo(L.nucleus.x + 300, L.nucleus.y - 120); cx.stroke(); cx.restore();
      tag(L.nucleus.x + 128, L.nucleus.y - 132, 'NUCLEUS', a);
      tag(L.nucleus.x + 128, L.nucleus.y - 100, '1/100,000 OF THE ATOM\u2019S WIDTH', a * 0.7, '#9FB4D8', 14);
      const s = '99.9999999999996%';
      const n = Math.floor(s.length * clamp01((t - K.empty + 0.35) / 0.9));
      if (n > 0) {
        const b = a * sstep(K.empty - 0.35, K.empty, t);
        spaced(s.slice(0, n), W / 2, 210, '300 92px "Cormorant Garamond"', 3, '#F4EEE4', b, 'rgba(160,200,255,0.4)');
        spaced('EMPTY SPACE', W / 2, 262, '400 24px Cinzel', 14, '#F2D29B', b * sstep(K.space - 0.2, K.space + 0.3, t));
      }
    }
    const fa = sstep(K.force - 0.1, K.force + 0.4, t) * (1 - sstep(K.go - 0.6, K.go, t));
    if (fa > 0) {
      const C = projectPx([st.C1[0] + Math.min(st.sep, 41) / 2, 0, 0], st.ro, st.ta, 1.5);
      spaced('ELECTROMAGNETIC REPULSION', C.x, C.y - 250, '400 20px Inter', 7, '#FFD2A6', fa * 0.95);
      cx.save(); cx.globalAlpha = fa * 0.5; cx.strokeStyle = '#FFD2A6'; cx.beginPath(); cx.moveTo(C.x, C.y - 225); cx.lineTo(C.x, C.y - 80); cx.stroke(); cx.restore();
    }
  }
  // the wavefunction
  if (t > K.clouds - 0.5 && t < K.color) {
    const L = S2.labels(t).cloud;
    const a = sstep(K.clouds, K.clouds + 0.5, t) * (1 - sstep(K.seen - 0.1, K.seen + 0.15, t));
    spaced('|ψ|²', L.x + 175, L.y - 40, 'italic 400 46px "Cormorant Garamond", "DejaVu Serif"', 2, '#C9C2FF', a);
    tag(L.x + 150, L.y - 5, 'PROBABILITY, NOT POSITION', a * 0.8, '#B7B9F2', 14);
    const o = sstep(K.seen, K.seen + 0.2, t) * (1 - sstep(K.color - 0.4, K.color - 0.1, t));
    tag(L.x + 34, L.y - 30, 'OBSERVED', o, '#FFFFFF', 15);
  }
  // perception
  if (t > K.color - 0.3 && t < K.lookup + 0.2) {
    const wa = sstep(K.color, K.color + 0.4, t) * (1 - sstep(K.sound - 0.4, K.sound, t));
    const nm = ['700 nm', '620 nm', '550 nm', '480 nm', '400 nm'];
    nm.forEach((s, i) => { const uvY = 0.25 - i * 0.125; tag(W / 2 + 0.74 * H, H / 2 - uvY * H + 6, s, wa * 0.85, '#D8D8D8', 16); });
    tag(150, 170, 'NO COLOR. ONLY WAVELENGTH.', wa * 0.8, '#BDBDBD', 15);
    const sa = sstep(K.sound + 0.1, K.sound + 0.5, t) * (1 - sstep(K.brain - 0.5, K.brain, t));
    tag(150, 170, 'NO SOUND. ONLY PRESSURE.', sa * 0.8, '#BDBDBD', 15);
    const ea = sstep(K.shows, K.shows + 0.4, t) * (1 - sstep(K.lookup - 0.3, K.lookup, t));
    if (ea > 0) {
      spaced('REALITY', 150, 168, '500 15px Inter', 5, '#9AA7BF', ea, null, 'left');
      spaced(fmtTC(t), 150, 206, '300 34px Inter', 2, '#F0F0F0', ea, null, 'left');
      spaced('WHAT YOU SEE', 150, 262, '500 15px Inter', 5, '#FFB59A', ea, null, 'left');
      spaced(fmtTC(Math.max(0, t - 0.08)), 150, 300, '300 34px Inter', 2, '#FFB59A', ea, 'rgba(255,120,80,0.5)', 'left');
      spaced('≈ 80 MS BEHIND', 150, 334, '400 14px Inter', 4, '#C98A78', ea * 0.9, null, 'left');
    }
  }
  // dead stars
  if (t > K.some - 0.4 && t < K.edge) {
    const L = S4.labels(t);
    const ages = ['LIGHT · 1,800 YEARS OLD', 'LIGHT · 6,400 YEARS OLD', 'LIGHT · 21,000 YEARS OLD'];
    L.forEach((p, i) => {
      const a = sstep(K.some - 0.2 + i * 0.18, K.some + 0.3 + i * 0.18, t) * (1 - sstep(K.edge - 0.9, K.edge - 0.4, t));
      if (a <= 0) return;
      const dead = t > S4.DEATH[i];
      reticle(p.x, p.y, 26, a * (dead ? 0.55 : 0.85), dead ? 'rgba(160,190,255,0.8)' : undefined);
      tag(p.x + 44, p.y - 10, ages[i], a * 0.85, '#DCE6FF', 14);
      tag(p.x + 44, p.y + 14, dead ? 'SOURCE: GONE' : 'SOURCE: ?', a * (dead ? 0.95 : 0.5), dead ? '#9CC0FF' : '#8A97B3', 13);
    });
  }
  // holographic bound
  if (t > K.written - 0.5 && t < K.humans) {
    const p = S5.labels(t).hole;
    const a = sstep(K.written, K.written + 0.5, t) * (1 - sstep(K.projection - 0.3, K.projection + 0.2, t));
    if (a > 0) {
      spaced('S = kc³A / 4Għ', p.x + 330, p.y - 175, 'italic 400 44px "Cormorant Garamond", "DejaVu Serif"', 2, '#BFF4FF', a, 'rgba(80,220,255,0.5)', 'left');
      tag(p.x + 332, p.y - 135, 'INFORMATION SCALES WITH AREA, NOT VOLUME', a * 0.85, '#9FDDEA', 14);
      cx.save(); cx.globalAlpha = a * 0.5; cx.strokeStyle = '#9FDDEA'; cx.beginPath(); cx.moveTo(p.x + 90, p.y - 60); cx.lineTo(p.x + 320, p.y - 160); cx.stroke(); cx.restore();
    }
  }
  // carbon
  if (t > K.carbon - 0.3 && t < K.stars2 + 0.3) {
    const p = S6.labels(t).chest;
    const a = sstep(K.carbon, K.carbon + 0.4, t) * (1 - sstep(K.dying - 0.3, K.dying + 0.1, t));
    spaced('C', p.x + 210, p.y - 6, '500 54px "Cormorant Garamond"', 0, '#FFE2B8', a, 'rgba(255,190,120,0.6)', 'left');
    tag(p.x + 212, p.y + 22, '6 · CARBON', a * 0.85, '#E9C9A0', 13);
    tag(p.x + 212, p.y + 42, 'MADE IN A STAR', a * 0.7, '#B9A089', 12);
  }
  // final title
  if (t > K.title - 0.1) {
    const a = sstep(K.title, K.title + 0.6, t) * (1 - sstep(K.cut - 0.05, K.cut + 0.15, t));
    const jitter = t > K.cut - 0.25 ? (Math.sin(t * 190) * 9) : 0;
    spaced('WHO IS WATCHING?', W / 2 + jitter, H - 150, '600 64px Cinzel', lerp(40, 22, easeOut((t - K.title) / 2.2)), '#F3ECE2', a, 'rgba(255,215,160,0.45)');
  }
}

function drawOverlay(t) {
  cx.clearRect(0, 0, W, H);
  cx.textBaseline = 'alphabetic';
  cx.textAlign = 'left';
  const fadeEnd = 1 - sstep(K.cut + 0.05, K.cut + 0.35, t);
  cx.globalAlpha = 1;
  cx.save();
  if (fadeEnd < 1) cx.globalAlpha = fadeEnd;
  drawCallouts(t);
  drawCaptions(t);
  cx.restore();
}
