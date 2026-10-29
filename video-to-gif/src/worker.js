'use strict';
// Framepress encoder worker: RGBA frame -> palette (Wu) -> dither -> frame diff -> LZW.
let W = 0, H = 0, BW = 0, BH = 0, ROT = 0, DITHER = 'fs', SHARED = false;
let cv = null, cx = null, idxA = null, idxB = null, E0 = null, E1 = null;
const TR = 255; // palette slot reserved for transparency

// ---------- Wu color quantizer on a 6-bit-per-channel histogram ----------
const QS = 64, SD = QS + 1, SD2 = SD * SD, TOT = SD2 * SD;
const mW = new Float64Array(TOT), mR = new Float64Array(TOT), mG = new Float64Array(TOT), mB = new Float64Array(TOT), m2 = new Float64Array(TOT);
const aW = new Float64Array(SD), aR = new Float64Array(SD), aG = new Float64Array(SD), aB = new Float64Array(SD), a2 = new Float64Array(SD);

function histReset() { mW.fill(0); mR.fill(0); mG.fill(0); mB.fill(0); m2.fill(0); }

function histAdd(px) {
  for (let p = 0, n = px.length; p < n; p += 4) {
    const r = px[p], g = px[p + 1], b = px[p + 2];
    const i = ((r >> 2) + 1) * SD2 + ((g >> 2) + 1) * SD + (b >> 2) + 1;
    mW[i]++; mR[i] += r; mG[i] += g; mB[i] += b; m2[i] += r * r + g * g + b * b;
  }
}

function moments() {
  for (let r = 1; r < SD; r++) {
    aW.fill(0); aR.fill(0); aG.fill(0); aB.fill(0); a2.fill(0);
    for (let g = 1; g < SD; g++) {
      let lW = 0, lR = 0, lG = 0, lB = 0, l2 = 0;
      for (let b = 1; b < SD; b++) {
        const i = r * SD2 + g * SD + b, j = i - SD2;
        lW += mW[i]; lR += mR[i]; lG += mG[i]; lB += mB[i]; l2 += m2[i];
        aW[b] += lW; aR[b] += lR; aG[b] += lG; aB[b] += lB; a2[b] += l2;
        mW[i] = mW[j] + aW[b]; mR[i] = mR[j] + aR[b]; mG[i] = mG[j] + aG[b]; mB[i] = mB[j] + aB[b]; m2[i] = m2[j] + a2[b];
      }
    }
  }
}

function vol(c, m) {
  const r0 = c.r0 * SD2, r1 = c.r1 * SD2, g0 = c.g0 * SD, g1 = c.g1 * SD, b0 = c.b0, b1 = c.b1;
  return m[r1 + g1 + b1] - m[r1 + g1 + b0] - m[r1 + g0 + b1] + m[r1 + g0 + b0]
       - m[r0 + g1 + b1] + m[r0 + g1 + b0] + m[r0 + g0 + b1] - m[r0 + g0 + b0];
}

function bottom(c, d, m) {
  const r0 = c.r0 * SD2, r1 = c.r1 * SD2, g0 = c.g0 * SD, g1 = c.g1 * SD, b0 = c.b0, b1 = c.b1;
  if (d === 0) return -m[r0 + g1 + b1] + m[r0 + g1 + b0] + m[r0 + g0 + b1] - m[r0 + g0 + b0];
  if (d === 1) return -m[r1 + g0 + b1] + m[r1 + g0 + b0] + m[r0 + g0 + b1] - m[r0 + g0 + b0];
  return -m[r1 + g1 + b0] + m[r1 + g0 + b0] + m[r0 + g1 + b0] - m[r0 + g0 + b0];
}

function top(c, d, pos, m) {
  const r0 = c.r0 * SD2, r1 = c.r1 * SD2, g0 = c.g0 * SD, g1 = c.g1 * SD, b0 = c.b0, b1 = c.b1;
  if (d === 0) { const p = pos * SD2; return m[p + g1 + b1] - m[p + g1 + b0] - m[p + g0 + b1] + m[p + g0 + b0]; }
  if (d === 1) { const p = pos * SD; return m[r1 + p + b1] - m[r1 + p + b0] - m[r0 + p + b1] + m[r0 + p + b0]; }
  return m[r1 + g1 + pos] - m[r1 + g0 + pos] - m[r0 + g1 + pos] + m[r0 + g0 + pos];
}

function variance(c) {
  const dr = vol(c, mR), dg = vol(c, mG), db = vol(c, mB), w = vol(c, mW);
  return w > 0 ? vol(c, m2) - (dr * dr + dg * dg + db * db) / w : 0;
}

function maximize(c, d, first, last, wr, wg, wb, ww) {
  const br = bottom(c, d, mR), bg = bottom(c, d, mG), bb = bottom(c, d, mB), bw = bottom(c, d, mW);
  let max = 0, cut = -1;
  for (let i = first; i < last; i++) {
    let hr = br + top(c, d, i, mR), hg = bg + top(c, d, i, mG), hb = bb + top(c, d, i, mB), hw = bw + top(c, d, i, mW);
    if (hw === 0) continue;
    let t = (hr * hr + hg * hg + hb * hb) / hw;
    hr = wr - hr; hg = wg - hg; hb = wb - hb; hw = ww - hw;
    if (hw === 0) continue;
    t += (hr * hr + hg * hg + hb * hb) / hw;
    if (t > max) { max = t; cut = i; }
  }
  return [max, cut];
}

function cutBox(a, b) {
  const wr = vol(a, mR), wg = vol(a, mG), wb = vol(a, mB), ww = vol(a, mW);
  const [xr, cr] = maximize(a, 0, a.r0 + 1, a.r1, wr, wg, wb, ww);
  const [xg, cg] = maximize(a, 1, a.g0 + 1, a.g1, wr, wg, wb, ww);
  const [xb, cb] = maximize(a, 2, a.b0 + 1, a.b1, wr, wg, wb, ww);
  let d;
  if (xr >= xg && xr >= xb) { d = 0; if (cr < 0) return false; }
  else if (xg >= xr && xg >= xb) d = 1;
  else d = 2;
  b.r1 = a.r1; b.g1 = a.g1; b.b1 = a.b1;
  if (d === 0) { b.r0 = a.r1 = cr; b.g0 = a.g0; b.b0 = a.b0; }
  else if (d === 1) { b.g0 = a.g1 = cg; b.r0 = a.r0; b.b0 = a.b0; }
  else { b.b0 = a.b1 = cb; b.r0 = a.r0; b.g0 = a.g0; }
  return true;
}

const cells = (c) => (c.r1 - c.r0) * (c.g1 - c.g0) * (c.b1 - c.b0);

function wuPalette(K) {
  moments();
  const cubes = [{ r0: 0, r1: QS, g0: 0, g1: QS, b0: 0, b1: QS }];
  const vv = new Float64Array(K);
  let next = 0, n = K;
  for (let i = 1; i < K; i++) {
    cubes[i] = { r0: 0, r1: 0, g0: 0, g1: 0, b0: 0, b1: 0 };
    if (cutBox(cubes[next], cubes[i])) {
      vv[next] = cells(cubes[next]) > 1 ? variance(cubes[next]) : 0;
      vv[i] = cells(cubes[i]) > 1 ? variance(cubes[i]) : 0;
    } else { vv[next] = 0; i--; }
    next = 0; let t = vv[0];
    for (let k = 1; k <= i; k++) if (vv[k] > t) { t = vv[k]; next = k; }
    if (t <= 0) { n = i + 1; break; }
  }
  const pal = new Uint8Array(768);
  let c = 0;
  for (let i = 0; i < n; i++) {
    const w = vol(cubes[i], mW);
    if (w <= 0) continue;
    pal[c * 3] = Math.round(vol(cubes[i], mR) / w);
    pal[c * 3 + 1] = Math.round(vol(cubes[i], mG) / w);
    pal[c * 3 + 2] = Math.round(vol(cubes[i], mB) / w);
    c++;
  }
  return { pal, n: Math.max(1, c) };
}

// ---------- palette lookup ----------
// Exact nearest color (weighted RGB) for each 6-bit cell, cached. A cache miss only scans the
// palette entries that can win inside its 16-level coarse cell; those lists are built lazily.
const PR = new Int32Array(256), PG = new Int32Array(256), PB = new Int32Array(256);
const PK = new Int32Array(256), prevPK = new Int32Array(256);
const NC = new Int16Array(1 << 18);
const CL = new Uint8Array(4096 * 256), CN = new Int32Array(4096), CGEN = new Int32Array(4096);
let PN = 0, cgen = 0;

function usePalette(pal, n) {
  PN = n;
  for (let i = 0; i < 256; i++) {
    const r = pal[i * 3], g = pal[i * 3 + 1], b = pal[i * 3 + 2];
    PR[i] = r; PG[i] = g; PB[i] = b;
    PK[i] = i < n ? (r << 16) | (g << 8) | b : -1 - i;
  }
  NC.fill(-1);
  if (++cgen > 0x3FFFFFFF) { CGEN.fill(0); cgen = 1; }
}

const axis = (c, lo, hi) => (c < lo ? lo - c : c > hi ? c - hi : 0);
function buildCell(ci) {
  const r0 = (ci >> 8) << 4, g0 = ((ci >> 4) & 15) << 4, b0 = (ci & 15) << 4;
  let thr = Infinity;
  for (let j = 0; j < PN; j++) {
    const xr = Math.max(Math.abs(PR[j] - r0), Math.abs(PR[j] - r0 - 15));
    const xg = Math.max(Math.abs(PG[j] - g0), Math.abs(PG[j] - g0 - 15));
    const xb = Math.max(Math.abs(PB[j] - b0), Math.abs(PB[j] - b0 - 15));
    const d = 2 * xr * xr + 4 * xg * xg + 3 * xb * xb;
    if (d < thr) thr = d;
  }
  let k = ci << 8;
  for (let j = 0; j < PN; j++) {
    const nr = axis(PR[j], r0, r0 + 15), ng = axis(PG[j], g0, g0 + 15), nb = axis(PB[j], b0, b0 + 15);
    if (2 * nr * nr + 4 * ng * ng + 3 * nb * nb <= thr) CL[k++] = j;
  }
  CN[ci] = k - (ci << 8);
  CGEN[ci] = cgen;
}

function nearest(r, g, b) {
  const key = ((r & 0xFC) << 10) | ((g & 0xFC) << 4) | (b >> 2);
  const c = NC[key];
  if (c >= 0) return c;
  const ci = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
  if (CGEN[ci] !== cgen) buildCell(ci);
  const cr = (r & 0xFC) + 2, cg = (g & 0xFC) + 2, cb = (b & 0xFC) + 2;
  let bd = Infinity, best = 0;
  for (let k = ci << 8, e = k + CN[ci]; k < e; k++) {
    const j = CL[k], dr = PR[j] - cr, dg = PG[j] - cg, db = PB[j] - cb;
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bd) { bd = d; best = j; }
  }
  NC[key] = best;
  return best;
}

// ---------- mapping / dithering ----------
function mapNone(px, idx) {
  for (let i = 0, p = 0, n = W * H; i < n; i++, p += 4) idx[i] = nearest(px[p], px[p + 1], px[p + 2]);
}

const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
const BO = new Int8Array(64).map((_, i) => (BAYER[i] >> 2) - 8);

function mapBayer(px, idx) {
  for (let y = 0, i = 0; y < H; y++) {
    const row = (y & 7) << 3;
    for (let x = 0; x < W; x++, i++) {
      const o = BO[row | (x & 7)], p = i << 2;
      let r = px[p] + o, g = px[p + 1] + o, b = px[p + 2] + o;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      idx[i] = nearest(r, g, b);
    }
  }
}

// Serpentine Floyd-Steinberg at 7/8 strength (keeps gradients smooth, less crawl between frames)
function mapFS(px, idx) {
  let cur = E0, nxt = E1;
  cur.fill(0); nxt.fill(0);
  const K = 0.875 / 16;
  for (let y = 0; y < H; y++) {
    const ltr = (y & 1) === 0, row = y * W, dx = ltr ? 1 : -1, d3 = dx * 3;
    let x = ltr ? 0 : W - 1;
    for (let c = 0; c < W; c++, x += dx) {
      const i = row + x, p = i << 2, e = (x + 1) * 3;
      let r = px[p] + cur[e], g = px[p + 1] + cur[e + 1], b = px[p + 2] + cur[e + 2];
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      const k = nearest((r + 0.5) | 0, (g + 0.5) | 0, (b + 0.5) | 0);
      idx[i] = k;
      const er = (r - PR[k]) * K, eg = (g - PG[k]) * K, eb = (b - PB[k]) * K;
      const f = e + d3, bk = e - d3;
      cur[f] += er * 7; cur[f + 1] += eg * 7; cur[f + 2] += eb * 7;
      nxt[bk] += er * 3; nxt[bk + 1] += eg * 3; nxt[bk + 2] += eb * 3;
      nxt[e] += er * 5; nxt[e + 1] += eg * 5; nxt[e + 2] += eb * 5;
      nxt[f] += er; nxt[f + 1] += eg; nxt[f + 2] += eb;
    }
    const t = cur; cur = nxt; nxt = t; nxt.fill(0);
  }
}

// ---------- GIF bytes ----------
class Bytes {
  constructor(n) { this.b = new Uint8Array(Math.max(4096, n | 0)); this.n = 0; }
  grow(k) {
    if (this.n + k <= this.b.length) return;
    let m = this.b.length * 2;
    while (m < this.n + k) m *= 2;
    const nb = new Uint8Array(m); nb.set(this.b.subarray(0, this.n)); this.b = nb;
  }
  u8(v) { this.grow(1); this.b[this.n++] = v; }
  u16(v) { this.grow(2); this.b[this.n++] = v & 255; this.b[this.n++] = (v >> 8) & 255; }
  put(a, len) { this.grow(len); this.b.set(a.subarray(0, len), this.n); this.n += len; }
  out() { return this.b.slice(0, this.n).buffer; }
}

// LZW with a direct (prefix,byte) table; entries are tagged with a generation so a reset is O(1)
const HT = new Int32Array(1 << 20);
let gen = 0;

function lzw(out, px, n) {
  out.u8(8);
  const blk = new Uint8Array(255);
  let bl = 0, size = 9, max = 511, next = 258, acc = 0, bits = 0;
  if (++gen > 0x7FFFF) { HT.fill(0); gen = 1; }
  const emit = (code) => {
    acc |= code << bits; bits += size;
    while (bits >= 8) {
      blk[bl++] = acc & 255; acc >>>= 8; bits -= 8;
      if (bl === 255) { out.u8(255); out.put(blk, 255); bl = 0; }
    }
    if (next > max && size < 12) { size++; max = (1 << size) - 1; }
  };
  emit(256);
  let prefix = px[0];
  for (let i = 1; i < n; i++) {
    const k = px[i], key = (prefix << 8) | k, v = HT[key];
    if ((v >>> 12) === gen) { prefix = v & 4095; continue; }
    emit(prefix);
    if (next < 4096) HT[key] = (gen << 12) | next++;
    else {
      emit(256);
      size = 9; max = 511; next = 258;
      if (++gen > 0x7FFFF) { HT.fill(0); gen = 1; }
    }
    prefix = k;
  }
  emit(prefix);
  emit(257);
  if (bits > 0) blk[bl++] = acc & 255;
  if (bl) { out.u8(bl); out.put(blk, bl); }
  out.u8(0);
}

function frameBytes(ix, x, y, w, h, pal) {
  const o = new Bytes(((w * h) >> 1) + 1024);
  o.u8(0x2C); o.u16(x); o.u16(y); o.u16(w); o.u16(h);
  if (pal) { o.u8(0x87); o.put(pal, 768); } else o.u8(0);
  lzw(o, ix, w * h);
  return o.out();
}

// ---------- frames ----------
function pixels(bmp) {
  cx.save();
  if (ROT === 90) { cx.translate(W, 0); cx.rotate(Math.PI / 2); }
  else if (ROT === 180) { cx.translate(W, H); cx.rotate(Math.PI); }
  else if (ROT === 270) { cx.translate(0, H); cx.rotate(-Math.PI / 2); }
  cx.drawImage(bmp, 0, 0, BW, BH);
  cx.restore();
  bmp.close();
  return cx.getImageData(0, 0, W, H).data;
}

function quantizeInto(px, idx) {
  let pal = null;
  if (!SHARED) {
    histReset(); histAdd(px);
    const q = wuPalette(255);
    pal = q.pal; usePalette(pal, q.n);
  }
  if (DITHER === 'fs') mapFS(px, idx);
  else if (DITHER === 'bayer') mapBayer(px, idx);
  else mapNone(px, idx);
  return pal;
}

// Only pixels whose displayed color changes are drawn; the rest become transparent so the
// previous frame shows through (disposal = keep). Output stays pixel-exact.
function diffFrame(cur, prev, pal) {
  let minX = W, maxX = -1, minY = -1, maxY = -1, changed = 0;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) {
      if (PK[cur[o + x]] !== prevPK[prev[o + x]]) { if (lo < 0) lo = x; hi = x; changed++; }
    }
    if (lo >= 0) {
      if (minY < 0) minY = y;
      maxY = y;
      if (lo < minX) minX = lo;
      if (hi > maxX) maxX = hi;
    }
  }
  if (maxX < 0) return { data: null, t: 0 };
  const w = maxX - minX + 1, h = maxY - minY + 1, area = w * h;
  const useT = changed < area * 0.85;
  const out = new Uint8Array(area);
  let k = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let i = y * W + minX, e = i + w; i < e; i++) {
      const c = cur[i];
      out[k++] = useT && PK[c] === prevPK[prev[i]] ? TR : c;
    }
  }
  return { data: frameBytes(out, minX, minY, w, h, pal), t: useT ? 1 : 0 };
}

function encodeChunk(m) {
  const outs = [], tr = [];
  let havePrev = false;
  if (m.prev) { quantizeInto(pixels(m.prev), idxA); prevPK.set(PK); havePrev = true; }
  for (const bmp of m.frames) {
    const pal = quantizeInto(pixels(bmp), idxB);
    const r = havePrev ? diffFrame(idxB, idxA, pal) : { data: frameBytes(idxB, 0, 0, W, H, pal), t: 0 };
    outs.push(r);
    if (r.data) tr.push(r.data);
    const t = idxA; idxA = idxB; idxB = t;
    prevPK.set(PK);
    havePrev = true;
  }
  return { outs, tr };
}

self.onmessage = (ev) => {
  const m = ev.data;
  try {
    if (m.type === 'init') {
      W = m.W; H = m.H; BW = m.BW; BH = m.BH; ROT = m.ROT; DITHER = m.DITHER;
      cv = new OffscreenCanvas(W, H);
      cx = cv.getContext('2d', { willReadFrequently: true, alpha: false });
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      idxA = new Uint8Array(W * H); idxB = new Uint8Array(W * H);
      E0 = new Float32Array((W + 2) * 3); E1 = new Float32Array((W + 2) * 3);
    } else if (m.type === 'palette') {
      histReset();
      for (const b of m.frames) histAdd(pixels(b));
      const q = wuPalette(255);
      self.postMessage({ type: 'palette', pal: q.pal, n: q.n }, [q.pal.buffer]);
    } else if (m.type === 'setPalette') {
      usePalette(m.pal, m.n); SHARED = true;
    } else if (m.type === 'chunk') {
      const r = encodeChunk(m);
      self.postMessage({ type: 'done', id: m.id, outs: r.outs }, r.tr);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: (err && err.message) || String(err) });
  }
};
