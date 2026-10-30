(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const WORKER_SRC = $('enc-src').textContent;

// ---------- small utils ----------
class Unsupported extends Error {}
const abortError = () => { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const h2 = (n) => n.toString(16).padStart(2, '0');
const p2 = (n) => String(n).padStart(2, '0');

function fmtTC(t) {
  const cs = Math.max(0, Math.round((isFinite(t) ? t : 0) * 100));
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100;
  return (h ? p2(h) + ':' : '') + p2(m) + ':' + p2(s) + '.' + p2(c);
}
function parseTC(str) {
  const parts = String(str).trim().split(':');
  if (!parts.length || parts.length > 3) return NaN;
  let t = 0;
  for (const p of parts) { if (!/^\d*\.?\d*$/.test(p) || p === '' || p === '.') return NaN; t = t * 60 + parseFloat(p); }
  return t;
}
const fmtSec = (t) => t < 60 ? t.toFixed(2) + ' s' : fmtTC(t);
const fmtClock = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + p2(s % 60); };
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(n < 104857600 ? 2 : 1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

// ---------- file reader with a sliding window ----------
class Src {
  constructor(file) { this.f = file; this.size = file.size; this.s = 0; this.e = 0; this.b = new Uint8Array(0); }
  async read(pos, len) {
    if (!(pos >= this.s && pos + len <= this.e)) {
      const end = Math.min(this.size, pos + Math.max(len, 8 << 20));
      this.b = new Uint8Array(await this.f.slice(pos, end).arrayBuffer());
      this.s = pos; this.e = end;
    }
    return this.b.subarray(pos - this.s, pos - this.s + len);
  }
}

// ---------- codec strings ----------
function hevcCodec(prefix, c) {
  const space = c[1] >> 6, tier = (c[1] >> 5) & 1, prof = c[1] & 31;
  let compat = ((c[2] << 24) | (c[3] << 16) | (c[4] << 8) | c[5]) >>> 0, rev = 0;
  for (let i = 0; i < 32; i++) { rev = (rev << 1) | (compat & 1); compat >>>= 1; }
  const cons = [c[6], c[7], c[8], c[9], c[10], c[11]];
  while (cons.length && !cons[cons.length - 1]) cons.pop();
  return `${prefix}.${['', 'A', 'B', 'C'][space]}${prof}.${(rev >>> 0).toString(16).toUpperCase()}.${tier ? 'H' : 'L'}${c[12]}` +
    cons.map((b) => '.' + b.toString(16).toUpperCase()).join('');
}
function av1Codec(c) {
  const bd = (c[2] >> 6) & 1 ? ((c[2] >> 5) & 1 ? 12 : 10) : 8;
  return `av01.${c[1] >> 5}.${p2(c[1] & 31)}${c[2] >> 7 ? 'H' : 'M'}.${p2(bd)}`;
}

// ---------- MP4 / MOV demuxer (reads the sample table from moov) ----------
async function demuxMP4(file) {
  const size = file.size;
  let pos = 0, moov = null;
  while (pos + 8 <= size) {
    const h = new Uint8Array(await file.slice(pos, Math.min(size, pos + 16)).arrayBuffer());
    const dv = new DataView(h.buffer);
    let bs = dv.getUint32(0), hl = 8;
    const type = String.fromCharCode(h[4], h[5], h[6], h[7]);
    if (bs === 1) { if (h.length < 16) break; bs = Number(dv.getBigUint64(8)); hl = 16; }
    else if (bs === 0) bs = size - pos;
    if (bs < hl) throw new Unsupported('This MP4/MOV file looks damaged.');
    if (type === 'moov') { moov = new Uint8Array(await file.slice(pos + hl, pos + bs).arrayBuffer()); break; }
    pos += bs;
  }
  if (!moov) throw new Unsupported('No movie header found (the file may be incomplete).');
  const info = parseMoov(moov);
  if (!info.S) {
    const Sm = info.S = await readFragments(file, info.frag);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < Sm.n; i++) { lo = Math.min(lo, Sm.pts[i]); hi = Math.max(hi, Sm.pts[i]); }
    info.dur = Math.max(0.04, hi + (Sm.n > 1 ? (hi - lo) / (Sm.n - 1) : 1 / 30));
  }
  info.fps = info.S.n / info.dur;
  return info;
}

// fragmented MP4 (screen recorders, DASH downloads): samples live in moof/traf/trun boxes
async function readFragments(file, ctx) {
  const size = file.size, src = new Src(file);
  const off = [], sz = [], pts = [], key = [];
  let pos = 0, nextDts = 0;
  while (pos + 8 <= size) {
    const h = await src.read(pos, Math.min(16, size - pos));
    const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
    let bs = dv.getUint32(0), hl = 8;
    const type = String.fromCharCode(h[4], h[5], h[6], h[7]);
    if (bs === 1) { if (h.length < 16) break; bs = Number(dv.getBigUint64(8)); hl = 16; } else if (bs === 0) bs = size - pos;
    if (bs < hl) break;
    if (type === 'moof' && pos + bs <= size) {
      const u = (await src.read(pos, bs)).slice();
      const d = new DataView(u.buffer);
      const u32 = (p) => d.getUint32(p), i32 = (p) => d.getInt32(p), u64 = (p) => Number(d.getBigUint64(p));
      const kids = (s, e) => {
        const out = [];
        for (let p = s; p + 8 <= e;) {
          const n = u32(p);
          if (n < 8 || p + n > e) break;
          out.push({ t: String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), s: p + 8, e: p + n });
          p += n;
        }
        return out;
      };
      for (const traf of kids(hl, bs)) {
        if (traf.t !== 'traf') continue;
        let mine = false, base = pos, cursor = pos, dDur = ctx.trex.dur, dSize = ctx.trex.size, dFlags = ctx.trex.flags;
        for (const b of kids(traf.s, traf.e)) {
          if (b.t === 'tfhd') {
            const fl = u32(b.s) & 0xFFFFFF;
            let p = b.s + 8;
            mine = u32(b.s + 4) === ctx.trackId;
            if (fl & 1) { base = u64(p); p += 8; }
            if (fl & 2) p += 4;
            if (fl & 8) { dDur = u32(p); p += 4; }
            if (fl & 0x10) { dSize = u32(p); p += 4; }
            if (fl & 0x20) dFlags = u32(p);
            cursor = base;
          } else if (!mine) continue;
          else if (b.t === 'tfdt') nextDts = u[b.s] === 1 ? u64(b.s + 4) : u32(b.s + 4);
          else if (b.t === 'trun') {
            const fl = u32(b.s) & 0xFFFFFF, v = u[b.s], cnt = u32(b.s + 4);
            let p = b.s + 8, first = null;
            if (fl & 1) { cursor = base + i32(p); p += 4; }
            if (fl & 4) { first = u32(p); p += 4; }
            for (let i = 0; i < cnt; i++) {
              let dur = dDur, s = dSize, f = i === 0 && first !== null ? first : dFlags, cto = 0;
              if (fl & 0x100) { dur = u32(p); p += 4; }
              if (fl & 0x200) { s = u32(p); p += 4; }
              if (fl & 0x400) { f = u32(p); p += 4; }
              if (fl & 0x800) { cto = v ? i32(p) : u32(p); p += 4; }
              off.push(cursor); sz.push(s);
              pts.push((nextDts + cto - ctx.mediaStart) / ctx.ts + ctx.emptyDur);
              key.push(f & 0x10000 ? 0 : 1);
              cursor += s; nextDts += dur;
            }
          }
        }
      }
    }
    pos += bs;
  }
  if (!off.length) throw new Unsupported('No video frames found in this fragmented MP4.');
  return { n: off.length, off: Float64Array.from(off), size: Uint32Array.from(sz), pts: Float64Array.from(pts), key: Uint8Array.from(key) };
}

function parseMoov(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const u32 = (p) => dv.getUint32(p), i32 = (p) => dv.getInt32(p), u16 = (p) => dv.getUint16(p);
  const u64 = (p) => Number(dv.getBigUint64(p)), i64 = (p) => Number(dv.getBigInt64(p));
  const fourcc = (p) => String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]);
  const kids = (s, e) => {
    const out = [];
    for (let p = s; p + 8 <= e;) {
      let bs = u32(p), hl = 8;
      const t = fourcc(p + 4);
      if (bs === 1) { bs = u64(p + 8); hl = 16; } else if (bs === 0) bs = e - p;
      if (bs < hl || p + bs > e) break;
      out.push({ t, s: p + hl, e: p + bs });
      p += bs;
    }
    return out;
  };
  const find = (b, t) => b && kids(b.s, b.e).find((k) => k.t === t);
  let movieTS = 1000, frag = false, movieDur = 0;
  const traks = [], trex = {};
  for (const b of kids(0, u.length)) {
    if (b.t === 'mvhd') { movieTS = u[b.s] === 1 ? u32(b.s + 20) : u32(b.s + 12); movieDur = (u[b.s] === 1 ? u64(b.s + 24) : u32(b.s + 16)) / movieTS; }
    else if (b.t === 'trak') traks.push(b);
    else if (b.t === 'mvex') {
      frag = true;
      for (const x of kids(b.s, b.e)) if (x.t === 'trex') trex[u32(x.s + 4)] = { dur: u32(x.s + 12), size: u32(x.s + 16), flags: u32(x.s + 20) };
    }
  }
  for (const tk of traks) {
    const mdia = find(tk, 'mdia'), hdlr = find(mdia, 'hdlr');
    if (!hdlr || fourcc(hdlr.s + 8) !== 'vide') continue;
    const tkhd = find(tk, 'tkhd');
    let rot = 0, tw = 0, th = 0;
    if (tkhd) {
      const m = tkhd.s + (u[tkhd.s] === 1 ? 52 : 40);
      rot = ((Math.round(Math.atan2(i32(m + 4), i32(m)) / (Math.PI / 2)) * 90) % 360 + 360) % 360;
      tw = u32(m + 36) / 65536; th = u32(m + 40) / 65536;
    }
    const mdhd = find(mdia, 'mdhd');
    const ts = u[mdhd.s] === 1 ? u32(mdhd.s + 20) : u32(mdhd.s + 12);
    let mediaStart = 0, emptyDur = 0;
    const elst = find(find(tk, 'edts'), 'elst');
    if (elst) {
      const v = u[elst.s], n = u32(elst.s + 4);
      for (let i = 0, p = elst.s + 8; i < n; i++, p += v === 1 ? 20 : 12) {
        const sd = v === 1 ? u64(p) : u32(p), mt = v === 1 ? i64(p + 8) : i32(p + 4);
        if (mt === -1) emptyDur += sd / movieTS; else { mediaStart = mt; break; }
      }
    }
    const stbl = find(find(mdia, 'minf'), 'stbl');
    if (!stbl) continue;
    const B = {};
    for (const b of kids(stbl.s, stbl.e)) B[b.t] = b;
    const E = B.stsd.s + 8, esz = u32(E), four = fourcc(E + 4);
    const cw = u16(E + 32), ch = u16(E + 34);
    const ent = {};
    for (const b of kids(E + 86, E + esz)) ent[b.t] = b;
    const pay = (b) => u.slice(b.s, b.e);
    let codec = null, desc = null, label = four;
    if (four === 'avc1' || four === 'avc3') {
      label = 'H.264';
      if (ent.avcC) { desc = pay(ent.avcC); codec = 'avc1.' + h2(desc[1]) + h2(desc[2]) + h2(desc[3]); }
    } else if (four === 'hvc1' || four === 'hev1') {
      label = 'HEVC';
      if (ent.hvcC) { desc = pay(ent.hvcC); codec = hevcCodec(four, desc); }
    } else if (four === 'vp09') {
      label = 'VP9';
      const c = ent.vpcC ? pay(ent.vpcC) : null;
      codec = c ? `vp09.${p2(c[4])}.${p2(c[5] || 10)}.${p2(c[6] >> 4 || 8)}` : 'vp09.00.10.08';
    } else if (four === 'vp08') { label = 'VP8'; codec = 'vp8'; }
    else if (four === 'av01') { label = 'AV1'; codec = ent.av1C ? av1Codec(pay(ent.av1C)) : 'av01.0.08M.08'; }
    else label = { mp4v: 'MPEG-4 Part 2', apcn: 'ProRes', apch: 'ProRes', apcs: 'ProRes', apco: 'ProRes', ap4h: 'ProRes', jpeg: 'Motion JPEG', mjpa: 'Motion JPEG', encv: 'Encrypted video', s263: 'H.263' }[four] || four;

    let n = 0, sizes;
    if (B.stsz) {
      const fixed = u32(B.stsz.s + 4);
      n = u32(B.stsz.s + 8); sizes = new Uint32Array(n);
      if (fixed) sizes.fill(fixed); else for (let i = 0; i < n; i++) sizes[i] = u32(B.stsz.s + 12 + i * 4);
    } else if (B.stz2) {
      const fs = u[B.stz2.s + 7], b0 = B.stz2.s + 12;
      n = u32(B.stz2.s + 8); sizes = new Uint32Array(n);
      for (let i = 0; i < n; i++) sizes[i] = fs === 16 ? u16(b0 + 2 * i) : fs === 8 ? u[b0 + i] : (i & 1 ? u[b0 + (i >> 1)] & 15 : u[b0 + (i >> 1)] >> 4);
    }
    if (!n) {
      if (!frag) continue;
      const trackId = tkhd ? u32(tkhd.s + (u[tkhd.s] === 1 ? 20 : 12)) : 1;
      return {
        container: 'MP4', codec, desc: label === 'AV1' ? null : desc, label, cw, ch, w: Math.round(tw) || cw, h: Math.round(th) || ch, rot,
        dur: movieDur || 0.04, fps: 0, S: null,
        frag: { trackId, ts, mediaStart, emptyDur, trex: trex[trackId] || { dur: 0, size: 0, flags: 0 } },
      };
    }
    const co = B.stco || B.co64, big = !B.stco, nc = u32(co.s + 4);
    const off = new Float64Array(n);
    const nsc = u32(B.stsc.s + 4);
    for (let c = 0, si = 0, e = 0; c < nc && si < n; c++) {
      while (e + 1 < nsc && u32(B.stsc.s + 8 + (e + 1) * 12) - 1 <= c) e++;
      const spc = u32(B.stsc.s + 8 + e * 12 + 4);
      let o = big ? u64(co.s + 8 + c * 8) : u32(co.s + 8 + c * 4);
      for (let j = 0; j < spc && si < n; j++) { off[si] = o; o += sizes[si]; si++; }
    }
    const dts = new Float64Array(n);
    let t = 0, k = 0, lastDelta = 0;
    for (let i = 0, ne = u32(B.stts.s + 4); i < ne; i++) {
      const cnt = u32(B.stts.s + 8 + i * 8), d = u32(B.stts.s + 12 + i * 8);
      for (let j = 0; j < cnt && k < n; j++) { dts[k++] = t; t += d; }
      lastDelta = d;
    }
    while (k < n) { dts[k++] = t; t += lastDelta; }
    const pts = new Float64Array(n);
    k = 0;
    if (B.ctts) {
      for (let i = 0, ne = u32(B.ctts.s + 4); i < ne; i++) {
        const cnt = u32(B.ctts.s + 8 + i * 8), o = i32(B.ctts.s + 12 + i * 8);
        for (let j = 0; j < cnt && k < n; j++, k++) pts[k] = dts[k] + o;
      }
    }
    for (; k < n; k++) pts[k] = dts[k];
    let maxPts = -Infinity;
    for (let i = 0; i < n; i++) { pts[i] = (pts[i] - mediaStart) / ts + emptyDur; if (pts[i] > maxPts) maxPts = pts[i]; }
    const key = new Uint8Array(n);
    if (B.stss) {
      for (let i = 0, ne = u32(B.stss.s + 4); i < ne; i++) { const s = u32(B.stss.s + 8 + i * 4) - 1; if (s >= 0 && s < n) key[s] = 1; }
    } else key.fill(1);
    const dur = Math.max(0.04, maxPts + lastDelta / ts);
    return {
      container: four === 'avc1' || four === 'hvc1' ? 'MP4' : 'MP4/MOV', codec, desc: label === 'AV1' ? null : desc, label,
      cw, ch, w: Math.round(tw) || cw, h: Math.round(th) || ch, rot, dur, fps: n / dur,
      S: { n, off, size: sizes, pts, key },
    };
  }
  throw new Unsupported(frag ? 'fragmented' : 'No video track found in this file.');
}

// ---------- WebM / Matroska demuxer (indexes every video block) ----------
async function demuxWebM(file, onProg) {
  const size = file.size, WIN = 4 << 20;
  let bs = 0, be = 0, buf = new Uint8Array(0);
  const need = async (p, len) => {
    len = Math.min(len, size - p);
    if (p >= bs && p + len <= be) return;
    const e = Math.min(size, p + Math.max(len, WIN));
    buf = new Uint8Array(await file.slice(p, e).arrayBuffer()); bs = p; be = e;
  };
  const at = (p) => buf[p - bs];
  const vlen = (b) => { for (let i = 0; i < 8; i++) if (b & (0x80 >> i)) return i + 1; return 0; };
  const rid = (p) => {
    const l = vlen(at(p));
    if (!l || l > 4) throw new Unsupported('This WebM/MKV file looks damaged.');
    let v = 0; for (let i = 0; i < l; i++) v = v * 256 + at(p + i);
    return [v, l];
  };
  const rsz = (p) => {
    const l = vlen(at(p));
    if (!l) throw new Unsupported('This WebM/MKV file looks damaged.');
    let v = at(p) & (0xFF >> l), ones = v === (0xFF >> l);
    for (let i = 1; i < l; i++) { const x = at(p + i); v = v * 256 + x; if (x !== 255) ones = false; }
    return [ones ? -1 : v, l];
  };
  const uint = (p, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + at(p + i); return v; };
  const flt = (p, n) => { const d = new DataView(buf.buffer, p - bs, n); return n === 4 ? d.getFloat32(0) : d.getFloat64(0); };
  const str = (p, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = at(p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
  const el = async (p) => { await need(p, 16); const [id, il] = rid(p); const [sz, sl] = rsz(p + il); return { id, sz, d: p + il + sl }; };
  const each = (s, e, cb) => { for (let q = s; q < e;) { const [id, il] = rid(q); const [sz, sl] = rsz(q + il); const d = q + il + sl; if (sz < 0) break; cb(id, d, sz); q = d + sz; } };

  const head = await el(0);
  if (head.id !== 0x1A45DFA3) throw new Unsupported('Not a WebM/MKV file.');
  let p = head.d + head.sz, seg;
  for (;;) {
    if (p + 4 >= size) throw new Unsupported('No Matroska segment found.');
    seg = await el(p);
    if (seg.id === 0x18538067) break;
    if (seg.sz < 0) throw new Unsupported('This WebM/MKV layout is not supported.');
    p = seg.d + seg.sz;
  }
  const segEnd = seg.sz < 0 ? size : Math.min(size, seg.d + seg.sz);
  const TOP = new Set([0x1F43B675, 0x1C53BB6B, 0x1254C367, 0x1043A770, 0x1941A469, 0x114D9B74, 0x1549A966, 0x1654AE6B]);
  let scale = 1e6, durTC = 0, vt = null, lacing = false;
  const offs = [], sizes = [], tss = [], keys = [];

  const block = async (d, sz, tc, k) => {
    await need(d, 16);
    const [tn, tl] = rsz(d);
    if (!vt || tn !== vt.num) return;
    let rel = (at(d + tl) << 8) | at(d + tl + 1);
    if (rel & 0x8000) rel -= 0x10000;
    const fl = at(d + tl + 2);
    if (fl & 0x06) { lacing = true; return; }
    offs.push(d + tl + 3); sizes.push(sz - tl - 3); tss.push((tc + rel) * scale / 1e9);
    keys.push(k < 0 ? (fl & 0x80 ? 1 : 0) : k);
  };
  const cluster = async (c) => {
    const end = c.sz < 0 ? segEnd : Math.min(segEnd, c.d + c.sz);
    let q = c.d, tc = 0;
    while (q + 2 < end) {
      const e = await el(q);
      if (c.sz < 0 && TOP.has(e.id)) return q;
      if (e.sz < 0) return end;
      if (e.id === 0xE7) { await need(e.d, e.sz); tc = uint(e.d, e.sz); }
      else if (e.id === 0xA3) await block(e.d, e.sz, tc, -1);
      else if (e.id === 0xA0) {
        await need(e.d, e.sz);
        let bp = -1, bsz = 0, ref = false;
        each(e.d, e.d + e.sz, (id, d, sz) => { if (id === 0xA1) { bp = d; bsz = sz; } else if (id === 0xFB) ref = true; });
        if (bp >= 0) await block(bp, bsz, tc, ref ? 0 : 1);
      }
      q = e.d + e.sz;
    }
    return end;
  };

  p = seg.d;
  let lastProg = 0;
  while (p + 2 < segEnd) {
    const e = await el(p);
    if (e.id === 0x1549A966 || e.id === 0x1654AE6B) {
      if (e.sz < 0) throw new Unsupported('This WebM/MKV layout is not supported.');
      await need(e.d, e.sz);
      if (e.id === 0x1549A966) {
        each(e.d, e.d + e.sz, (id, d, sz) => { if (id === 0x2AD7B1) scale = uint(d, sz); else if (id === 0x4489) durTC = flt(d, sz); });
      } else {
        each(e.d, e.d + e.sz, (id, d, sz) => {
          if (id !== 0xAE) return;
          const t = { num: 0, type: 0, codec: '', priv: null, w: 0, h: 0, dw: 0, dh: 0, enc: false };
          each(d, d + sz, (i2, d2, s2) => {
            if (i2 === 0xD7) t.num = uint(d2, s2);
            else if (i2 === 0x83) t.type = uint(d2, s2);
            else if (i2 === 0x86) t.codec = str(d2, s2);
            else if (i2 === 0x63A2) t.priv = buf.slice(d2 - bs, d2 - bs + s2);
            else if (i2 === 0x6D80) t.enc = true;
            else if (i2 === 0xE0) each(d2, d2 + s2, (i3, d3, s3) => {
              if (i3 === 0xB0) t.w = uint(d3, s3); else if (i3 === 0xBA) t.h = uint(d3, s3);
              else if (i3 === 0x54B0) t.dw = uint(d3, s3); else if (i3 === 0x54BA) t.dh = uint(d3, s3);
            });
          });
          if (t.type === 1 && !vt) vt = t;
        });
      }
      p = e.d + e.sz;
    } else if (e.id === 0x1F43B675) {
      p = await cluster(e);
      if (onProg && p - lastProg > 16 << 20) { lastProg = p; onProg(p / size); }
    } else {
      if (e.sz < 0) break;
      p = e.d + e.sz;
    }
  }
  if (!vt) throw new Unsupported('No video track found in this file.');
  if (vt.enc) throw new Unsupported('This MKV uses track compression, which is not supported.');
  if (!offs.length) throw new Unsupported(lacing ? 'This MKV stores video with lacing, which is not supported.' : 'No video frames found.');

  let codec = null, desc = null, label = vt.codec;
  if (vt.codec === 'V_VP8') { codec = 'vp8'; label = 'VP8'; }
  else if (vt.codec === 'V_VP9') {
    label = 'VP9';
    let prof = 0, lvl = 10, bd = 0;
    if (vt.priv) for (let i = 0; i + 2 < vt.priv.length; i += 2 + vt.priv[i + 1]) {
      const id = vt.priv[i], v = vt.priv[i + 2];
      if (id === 1) prof = v; else if (id === 2) lvl = v || 10; else if (id === 3) bd = v;
    } else {
      const ki = keys.indexOf(1);
      if (ki >= 0) { await need(offs[ki], 1); const b0 = at(offs[ki]); prof = ((b0 >> 5) & 1) | (((b0 >> 4) & 1) << 1); }
    }
    codec = `vp09.${p2(prof)}.${p2(lvl)}.${p2(bd || (prof >= 2 ? 10 : 8))}`;
  } else if (vt.codec === 'V_AV1') { label = 'AV1'; codec = vt.priv && vt.priv.length >= 4 ? av1Codec(vt.priv) : 'av01.0.08M.08'; }
  else if (vt.codec === 'V_MPEG4/ISO/AVC') { label = 'H.264'; if (vt.priv) { desc = vt.priv; codec = 'avc1.' + h2(desc[1]) + h2(desc[2]) + h2(desc[3]); } }
  else if (vt.codec === 'V_MPEGH/ISO/HEVC') { label = 'HEVC'; if (vt.priv) { desc = vt.priv; codec = hevcCodec('hvc1', desc); } }
  else label = vt.codec.replace(/^V_/, '');

  const n = offs.length;
  const pts = Float64Array.from(tss);
  let maxPts = -Infinity;
  for (let i = 0; i < n; i++) if (pts[i] > maxPts) maxPts = pts[i];
  const span = maxPts - pts[0];
  const avg = n > 1 && span > 0 ? span / (n - 1) : 1 / 30;
  const dur = Math.max(durTC ? durTC * scale / 1e9 : 0, maxPts + avg);
  const w = vt.w, h = vt.dw && vt.dh ? Math.round(vt.w * vt.dh / vt.dw) : vt.h;
  return {
    container: 'MKV', codec, desc, label, cw: vt.w, ch: vt.h, w, h, rot: 0, dur, fps: 1 / avg,
    S: { n, off: Float64Array.from(offs), size: Uint32Array.from(sizes), pts, key: Uint8Array.from(keys) },
  };
}

async function demux(file, onProg) {
  const info = await demuxAny(file, onProg);
  // start the timeline at the first presented frame (files without an edit list often begin a few frames in)
  const P = info.S.pts;
  let lo = Infinity;
  for (let i = 0; i < P.length; i++) if (P[i] < lo) lo = P[i];
  if (lo !== 0 && isFinite(lo)) { for (let i = 0; i < P.length; i++) P[i] -= lo; info.dur = Math.max(0.04, info.dur - lo); }
  return info;
}
async function demuxAny(file, onProg) {
  const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (h[0] === 0x1A && h[1] === 0x45 && h[2] === 0xDF && h[3] === 0xA3) {
    const info = await demuxWebM(file, onProg);
    info.container = /\.webm$/i.test(file.name) ? 'WebM' : 'MKV';
    return info;
  }
  const t = String.fromCharCode(h[4], h[5], h[6], h[7]);
  if (['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot', 'uuid'].includes(t)) {
    const info = await demuxMP4(file);
    info.container = (file.name.match(/\.(mp4|m4v|mov|3gp|3g2)$/i) || [, 'MP4'])[1].toUpperCase();
    return info;
  }
  throw new Unsupported('container');
}

const cfg = (info, hw) => {
  const c = { codec: info.codec };
  if (info.cw && info.ch) { c.codedWidth = info.cw; c.codedHeight = info.ch; }
  if (info.desc) c.description = info.desc;
  if (hw) c.hardwareAcceleration = hw;
  return c;
};
async function wcSupported(info) {
  if (!info.codec || typeof VideoDecoder === 'undefined' || typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
  try { return (await VideoDecoder.isConfigSupported(cfg(info))).supported === true; } catch { return false; }
}
function keyBefore(Sm, t) {
  let k = -1, first = -1;
  for (let i = 0; i < Sm.n; i++) {
    if (!Sm.key[i]) continue;
    if (first < 0) first = i;
    if (Sm.pts[i] <= t + 1e-6) k = i; else if (k >= 0) break;
  }
  return k >= 0 ? k : Math.max(0, first);
}
function lastUpTo(Sm, k0, end) {
  let last = k0;
  for (let i = k0; i < Sm.n; i++) {
    if (i > k0 && Sm.key[i] && Sm.pts[i] > end + 1e-6) break;
    if (Sm.pts[i] <= end + 1e-6) last = i;
  }
  return last;
}
const chunkAt = async (src, Sm, i, forceKey) => new EncodedVideoChunk({
  type: forceKey || Sm.key[i] ? 'key' : 'delta', timestamp: Math.round(Sm.pts[i] * 1e6), data: await src.read(Sm.off[i], Sm.size[i]),
});

// ---------- GIF assembly + worker pool ----------
function gifHeader(w, h, gct, loop) {
  const b = [71, 73, 70, 56, 57, 97, w & 255, w >> 8, h & 255, h >> 8, gct ? 0xF7 : 0x70, 0, 0];
  const out = [new Uint8Array(b)];
  if (gct) out.push(gct);
  if (loop) out.push(new Uint8Array([0x21, 0xFF, 0x0B, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 0x03, 0x01, 0, 0, 0]));
  return out;
}

const closeBmp = (b) => { try { b && b.close(); } catch {} };
const HC = navigator.hardwareConcurrency || 4;
const LOW_MEM = !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
// clips converted at the same time; they share one warm encoder pool
const MAX_JOBS = HC >= 4 && !LOW_MEM ? 2 : 1;

// One set of encoder threads for every conversion: they stay warm between clips, and while one
// clip is decoding or finishing, chunks from another keep the cores busy.
const POOL = {
  n: clamp(HC - 1, 1, 12), workers: [], idle: [], q: [], busy: new Map(), url: null,
  ensure() {
    if (this.workers.length) return;
    this.url = this.url || URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    for (let i = 0; i < this.n; i++) this.spawn();
  },
  spawn() {
    const w = new Worker(this.url);
    w.onmessage = (e) => this.done(w, e.data);
    w.onerror = (e) => { if (e.preventDefault) e.preventDefault(); this.crash(w, e); };
    this.workers.push(w); this.idle.push(w);
  },
  submit(task) { this.q.push(task); this.pump(); },
  pump() {
    while (this.idle.length && this.q.length) {
      const t = this.q.shift();
      if (t.pipe.dead) { t.bitmaps.forEach(closeBmp); continue; }
      const w = this.idle.pop();
      this.busy.set(w, t);
      w.postMessage(t.msg, t.bitmaps);
    }
  },
  done(w, m) {
    const t = this.busy.get(w);
    this.busy.delete(w); this.idle.push(w);
    if (t && !t.pipe.dead) t.onDone(m);
    this.pump();
  },
  crash(w, e) {
    const t = this.busy.get(w);
    this.busy.delete(w);
    this.workers = this.workers.filter((x) => x !== w); this.idle = this.idle.filter((x) => x !== w);
    w.terminate();
    this.spawn();
    if (t) t.pipe.fail(new Error('An encoder thread stopped: ' + ((e && e.message) || 'unknown error')));
    this.pump();
  },
  drop(pipe) {
    this.q = this.q.filter((t) => { if (t.pipe !== pipe) return true; t.bitmaps.forEach(closeBmp); return false; });
  },
};

let pipeSeq = 0;
class Pipeline {
  constructor(o) {
    this.o = o;
    this.id = ++pipeSeq;
    this.nw = POOL.n;
    const fb = o.w * o.h * 4;
    const budget = (LOW_MEM ? 160 : 384) * 1048576 / MAX_JOBS;
    this.limit = Math.max(4, Math.floor(budget / fb));
    // small chunks keep every thread busy on short clips; longer chunks amortize the re-quantized
    // previous frame each chunk needs for diffing
    this.C = clamp(Math.min(Math.floor(this.limit / (this.nw * 2)), Math.ceil(o.ticks / (this.nw * 4))), 2, 12);
    this.cfg = { key: String(this.id), W: o.w, H: o.h, BW: o.bw, BH: o.bh, ROT: o.rot, DITHER: o.dither, pal: null, n: 0 };
    this.queue = []; this.results = new Map();
    this.cur = null; this.nextPrevP = null; this.chunkId = 0; this.writeId = 0;
    this.ticks = []; this.frames = 0; this.inflight = 0; this.ticksDone = 0; this.framesDone = 0; this.written = 0;
    this.parts = []; this.bytes = 0; this.cum = 0; this.pend = null; this.failed = null; this.waiters = []; this.dead = false;
    this.unit = 100 / (o.fps * o.speed);
    this.gct = null; this.palWait = null;
  }
  kick() { const w = this.waiters; this.waiters = []; for (const f of w) f(); }
  nap() { return new Promise((r) => { this.waiters.push(r); setTimeout(r, 40); }); }
  fail(e) { if (!this.failed) this.failed = e; if (this.palWait) { this.palWait.rej(e); this.palWait = null; } this.kick(); }
  start() { POOL.ensure(); }
  buildPalette(bmps) {
    return new Promise((res, rej) => {
      this.palWait = { res, rej };
      POOL.submit({
        pipe: this, bitmaps: bmps, msg: { type: 'palette', cfg: this.cfg, frames: bmps },
        onDone: (m) => {
          if (m.type !== 'palette') { this.fail(new Error('Encoder error: ' + m.message)); return; }
          this.gct = new Uint8Array(m.pal);
          this.cfg = { ...this.cfg, key: this.id + ':shared', pal: this.gct, n: m.n };
          const pw = this.palWait; this.palWait = null; pw && pw.res();
        },
      });
    });
  }
  begin() { for (const p of gifHeader(this.o.w, this.o.h, this.gct, this.o.loop)) this.out(p); }
  out(u8) { this.parts.push(u8); this.bytes += u8.byteLength; }
  push(bmp, n) {
    if (this.failed || this.dead) { bmp.close(); throw this.failed || abortError(); }
    this.ticks.push(n);
    if (!this.cur) this.cur = { id: this.chunkId++, first: this.frames, frames: [], prevP: this.nextPrevP, prev: null };
    this.cur.frames.push(bmp);
    this.frames++; this.inflight++;
    if (this.cur.frames.length >= this.C) this.seal(false);
  }
  addTicks(n) { if (this.ticks.length && n > 0) this.ticks[this.ticks.length - 1] += n; }
  seal(final) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    // the next chunk diffs against this chunk's last frame, so it gets its own copy
    const clone = final ? null : createImageBitmap(c.frames[c.frames.length - 1]);
    this.nextPrevP = clone;
    this.queue.push(c);
    Promise.all([c.prevP, clone]).then(([prev]) => {
      this.queue = this.queue.filter((x) => x !== c);
      if (this.dead) { c.frames.forEach(closeBmp); closeBmp(prev); return; }
      const bitmaps = prev ? [prev, ...c.frames] : c.frames.slice();
      POOL.submit({ pipe: this, bitmaps, msg: { type: 'chunk', cfg: this.cfg, id: c.id, prev: prev || null, frames: c.frames }, onDone: (m) => this.chunkDone(c, m) });
    }, (e) => this.fail(e));
  }
  chunkDone(c, m) {
    if (m.type !== 'done') { this.fail(new Error('Encoder error: ' + m.message)); return; }
    this.results.set(m.id, { first: c.first, outs: m.outs });
    this.inflight -= c.frames.length; this.framesDone += c.frames.length;
    for (let f = c.first; f < c.first + c.frames.length; f++) this.ticksDone += this.ticks[f];
    this.drain(); this.kick();
  }
  drain() {
    while (this.results.has(this.writeId)) {
      const r = this.results.get(this.writeId);
      this.results.delete(this.writeId); this.writeId++;
      r.outs.forEach((o, j) => {
        const f = r.first + j;
        if (!o.data) { if (this.pend) this.pend.fs.push(f); return; }
        if (this.pend) this.emit();
        this.pend = { data: o.data, t: o.t, fs: [f] };
      });
    }
  }
  emit() {
    // a frame identical to the previous one is folded into the previous frame's delay
    const p = this.pend;
    this.pend = null;
    let n = 0;
    for (const f of p.fs) n += this.ticks[f];
    const a = this.cum;
    this.cum += n;
    const d = clamp(Math.round(this.cum * this.unit) - Math.round(a * this.unit), 2, 65535);
    this.out(new Uint8Array([0x21, 0xF9, 4, 4 | p.t, d & 255, d >> 8, p.t ? 255 : 0, 0]));
    this.out(new Uint8Array(p.data));
    this.written++;
  }
  async room(extra = 0) {
    while (this.inflight + extra >= this.limit) { if (this.failed) throw this.failed; await this.nap(); }
  }
  async finish() {
    if (this.cur) this.seal(true);
    else if (this.nextPrevP) this.nextPrevP.then(closeBmp, () => {});
    this.nextPrevP = null;
    if (!this.frames) throw new Error('No frames were decoded in the selected range.');
    while (this.writeId < this.chunkId) { if (this.failed) throw this.failed; await this.nap(); }
    if (this.pend) this.emit();
    this.out(new Uint8Array([0x3B]));
    return new Blob(this.parts, { type: 'image/gif' });
  }
  dispose() {
    this.dead = true;
    POOL.drop(this);
    for (const c of this.queue) c.frames.forEach(closeBmp);
    if (this.cur) this.cur.frames.forEach(closeBmp);
    if (this.nextPrevP) this.nextPrevP.then(closeBmp, () => {});
    this.queue = []; this.cur = null; this.kick();
  }
}

// ---------- crop ----------
// The crop is a normalized rect in the displayed (rotated) picture; decoded frames are unrotated.
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const isFull = (c) => c.x <= 1e-6 && c.y <= 1e-6 && c.w >= 1 - 1e-6 && c.h >= 1 - 1e-6;
function frameCrop(c, rot) {
  if (rot === 90) return { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
  if (rot === 180) return { x: 1 - c.x - c.w, y: 1 - c.y - c.h, w: c.w, h: c.h };
  if (rot === 270) return { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w };
  return c;
}
function srcRect(c, W, H) {
  const x = clamp(Math.round(c.x * W), 0, W - 1), y = clamp(Math.round(c.y * H), 0, H - 1);
  return [x, y, clamp(Math.round(c.w * W), 1, W - x), clamp(Math.round(c.h * H), 1, H - y)];
}
// cropped + resized on the GPU in one step; src is a VideoFrame or the <video> element
function bitmapOf(src, o, W, H) {
  const bmo = { resizeWidth: o.bw, resizeHeight: o.bh, resizeQuality: 'high' };
  return o.fcrop ? createImageBitmap(src, ...srcRect(o.fcrop, W, H), bmo) : createImageBitmap(src, bmo);
}

// ---------- engine 1: WebCodecs (hardware decode, frame-exact) ----------
async function runWC(info, src, o, pipe, sig) {
  const Sm = info.S, T = (k) => o.start + k / o.fps;
  let k0 = keyBefore(Sm, o.start);
  const last = lastUpTo(Sm, k0, o.end);
  for (let attempt = 0; ; attempt++) {
    let outputs = 0, failed = null, prev = null, nextTick = 0, grabs = 0, chain = Promise.resolve();
    const grab = (frame, cnt) => {
      grabs++;
      const p = bitmapOf(frame, o, frame.displayWidth, frame.displayHeight);
      p.then(() => frame.close(), () => frame.close());
      chain = chain.then(async () => { const b = await p; grabs--; pipe.push(b, cnt); pipe.kick(); });
      chain.catch((e) => { failed = failed || e; pipe.kick(); });
    };
    const dec = new VideoDecoder({
      output: (frame) => {
        outputs++;
        const t = frame.timestamp / 1e6;
        if (prev) {
          let c = 0;
          while (nextTick < o.ticks && T(nextTick) < t - 1e-6) { c++; nextTick++; }
          if (c) grab(prev, c); else prev.close();
        }
        prev = frame;
        pipe.kick();
      },
      error: (e) => { failed = failed || e; pipe.kick(); },
    });
    dec.addEventListener && dec.addEventListener('dequeue', () => pipe.kick());
    try {
      dec.configure(cfg(info, attempt ? 'prefer-software' : undefined));
      for (let i = k0; i <= last && nextTick < o.ticks; i++) {
        while (dec.decodeQueueSize > 8 || pipe.inflight + grabs >= pipe.limit) {
          if (sig.aborted) throw abortError();
          if (failed) throw failed;
          if (pipe.failed) throw pipe.failed;
          await pipe.nap();
        }
        if (sig.aborted) throw abortError();
        if (failed) throw failed;
        dec.decode(await chunkAt(src, Sm, i, i === k0));
      }
      await dec.flush();
      if (failed) throw failed;
      if (prev) {
        const c = o.ticks - nextTick;
        if (c > 0) { nextTick = o.ticks; grab(prev, c); } else prev.close();
        prev = null;
      }
      await chain;
      if (failed) throw failed;
      dec.close();
      return;
    } catch (e) {
      try { if (dec.state !== 'closed') dec.close(); } catch {}
      try { prev && prev.close(); } catch {}
      if (sig.aborted) throw abortError();
      // retry once from the very first frame with the software decoder
      if (attempt === 0 && pipe.frames === 0 && outputs === 0) { k0 = keyBefore(Sm, -1); continue; }
      throw e;
    }
  }
}

async function sampleWC(info, src, o, sig, count = 16) {
  const Sm = info.S, ks = [];
  for (let i = 0; i < Sm.n; i++) if (Sm.key[i] && Sm.pts[i] >= o.start - 1e-6 && Sm.pts[i] <= o.end) ks.push(i);
  const k0 = keyBefore(Sm, o.start);
  if (ks[0] !== k0) ks.unshift(k0);
  const picks = ks.length <= count ? ks : Array.from({ length: count }, (_, j) => ks[Math.round(j * (ks.length - 1) / (count - 1))]);
  const pend = [];
  const grab = (f) => pend.push(bitmapOf(f, o, f.displayWidth, f.displayHeight).finally(() => f.close()));
  // keyframes decode on their own, so they are a cheap spread of samples
  let dec = null;
  const mk = () => { const d = new VideoDecoder({ output: grab, error: () => {} }); d.configure(cfg(info)); return d; };
  for (const i of new Set(picks)) {
    if (sig.aborted) throw abortError();
    try {
      if (!dec || dec.state === 'closed') dec = mk();
      dec.decode(await chunkAt(src, Sm, i, true));
      await dec.flush();
    } catch { dec = null; }
  }
  try { dec && dec.state !== 'closed' && dec.close(); } catch {}
  // sparse keyframes (screen and webcam recordings often have one): decode through the range instead
  if (picks.length < 8) {
    const targets = Array.from({ length: count }, (_, j) => o.start + (j + 0.5) * (o.end - o.start) / count);
    let ti = 0, failed = false;
    const seq = new VideoDecoder({
      output: (f) => {
        const t = f.timestamp / 1e6;
        if (ti < targets.length && t >= targets[ti] - 1e-6) { while (ti < targets.length && targets[ti] <= t + 1e-6) ti++; grab(f); }
        else f.close();
      },
      error: () => { failed = true; },
    });
    try {
      seq.configure(cfg(info));
      const last = lastUpTo(Sm, k0, o.end), t0 = performance.now();
      for (let i = k0; i <= last && ti < targets.length && !failed; i++) {
        if (sig.aborted) throw abortError();
        if (performance.now() - t0 > 10000) break;
        while (seq.decodeQueueSize > 16) await new Promise((r) => setTimeout(r, 2));
        seq.decode(await chunkAt(src, Sm, i, i === k0));
      }
      if (!failed) await seq.flush();
    } catch (e) { if (sig.aborted) throw e; }
    try { if (seq.state !== 'closed') seq.close(); } catch {}
  }
  const bmps = [];
  for (const p of pend) { try { bmps.push(await p); } catch {} }
  if (!bmps.length) throw new Error('Could not read frames to build the shared palette. Try the per-frame palette.');
  return bmps;
}

// ---------- engine 2: browser playback (any format the <video> element can play) ----------
function seekVideo(v, t) {
  return new Promise((res) => {
    if (Math.abs(v.currentTime - t) < 1e-3 && v.readyState >= 2) return res();
    const on = () => { v.removeEventListener('seeked', on); res(); };
    v.addEventListener('seeked', on);
    v.currentTime = t;
  });
}

async function runVideo(v, o, pipe, sig, seekOnly = false) {
  const T = (k) => o.start + k / o.fps;
  // draw synchronously so the captured frame is exactly the one the frame callback reported
  const oc = new OffscreenCanvas(o.bw, o.bh), ocx = oc.getContext('2d', { alpha: false });
  ocx.imageSmoothingQuality = 'high';
  let nextTick = 0, emitted = 0, failed = null;
  const grab = (cnt) => {
    try {
      if (o.fcrop) ocx.drawImage(v, ...srcRect(o.fcrop, v.videoWidth, v.videoHeight), 0, 0, o.bw, o.bh);
      else ocx.drawImage(v, 0, 0, o.bw, o.bh);
      pipe.push(oc.transferToImageBitmap(), cnt);
      emitted++;
      pipe.kick();
    } catch (e) { failed = failed || e; }
  };
  v.pause(); v.muted = true; v.loop = false;
  if (seekOnly || typeof v.requestVideoFrameCallback !== 'function') {
    for (let k = 0; k < o.ticks; k++) {
      if (sig.aborted) throw abortError();
      await pipe.room();
      await seekVideo(v, T(k) + 0.004); // land inside the frame, not on its boundary
      grab(1);
      if (failed) throw failed;
    }
    return;
  }
  await seekVideo(v, o.start);
  let dt = 1 / 30, lastT = -1, done = false;
  {
    let c = 0;
    while (nextTick < o.ticks && T(nextTick) <= v.currentTime + dt / 2) { c++; nextTick++; }
    if (c) grab(c);
  }
  v.playbackRate = 1; // faster playback drops frames on busy machines
  try {
    await new Promise((resolve, reject) => {
      const finish = () => {
        if (done) return;
        done = true; v.pause();
        const rem = o.ticks - nextTick;
        nextTick = o.ticks;
        if (rem > 0) { if (emitted) pipe.addTicks(rem); else grab(rem); }
        failed ? reject(failed) : resolve();
      };
      sig.addEventListener('abort', () => { done = true; v.pause(); reject(abortError()); }, { once: true });
      v.addEventListener('ended', finish, { once: true });
      const cb = (now, meta) => {
        if (done) return;
        const t = meta.mediaTime;
        if (lastT >= 0 && t > lastT) dt = clamp(Math.min(dt, t - lastT), 1 / 120, 1 / 10);
        lastT = t;
        let c = 0;
        while (nextTick < o.ticks && T(nextTick) <= t + dt / 2) { c++; nextTick++; }
        if (c) grab(c);
        if (failed) { done = true; v.pause(); return reject(failed); }
        if (nextTick >= o.ticks || t >= o.end - 1e-3) return finish();
        v.requestVideoFrameCallback(cb);
        if (pipe.inflight >= pipe.limit) {
          v.pause();
          pipe.room().then(() => { if (!done) v.play().catch(reject); }, reject);
        }
      };
      v.requestVideoFrameCallback(cb);
      v.play().catch(reject);
    });
  } finally {
    v.playbackRate = 1;
  }
}

async function sampleVideo(v, o, sig, count = 12) {
  v.pause();
  const bmps = [];
  for (let j = 0; j < count; j++) {
    if (sig.aborted) throw abortError();
    await seekVideo(v, o.start + (o.end - o.start) * (j + 0.5) / count);
    bmps.push(await bitmapOf(v, o, v.videoWidth, v.videoHeight));
  }
  return bmps;
}

// ---------- UI ----------
const ui = {};
for (const id of ['video', 'poster', 'tc', 'fname', 'chips', 'file', 'file2', 'inT', 'outT', 'len', 'rail', 'railIn', 'sel', 'ph', 'hIn', 'hOut',
  'markIn', 'markOut', 'playSel', 'fullRange', 'width', 'fps', 'speed', 'readout', 'go', 'goAll', 'applyAll', 'prog', 'pstage', 'bar', 'pstats', 'cancel',
  'engine', 'result', 'resultTitle', 'gif', 'stats', 'save', 'again', 'saveNote', 'toast', 'drop', 'alert', 'monitor', 'openBtn', 'empty', 'hint',
  'cropper', 'cropBox', 'cropBtn', 'cropReset', 'cropAll', 'cropPanel', 'cropSum', 'cX', 'cY', 'cW', 'cH',
  'qList', 'qAdd', 'qCount', 'qSum', 'qAll', 'qZip', 'qCancel']) ui[id] = $(id);

// Every video you add is a clip with its own trim, crop and settings. The editor shows the
// selected clip through S, a mirror of its fields; edits are written back by sync().
const jobs = [];
let jobSeq = 0;
const S = { job: null, file: null, url: null, info: null, engine: null, dur: 0, dw: 0, dh: 0, rot: 0, srcFps: 0, inT: 0, outT: 0,
  videoOK: false, scrubT: 0, loopRange: false, loadId: 0, crop: { ...FULL }, ratioKey: 'free', cropOn: false };
const ACTIVE = new Set(['queued', 'running']);
Object.defineProperty(S, 'busy', { get: () => !!S.job && ACTIVE.has(S.job.status) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dlP = window.claude && typeof window.claude.use === 'function'
  ? Promise.resolve().then(() => window.claude.use('downloads')).catch(() => null) : Promise.resolve(null);

let toastT = 0;
function toast(msg) {
  ui.toast.textContent = msg; ui.toast.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => ui.toast.classList.remove('on'), 3200);
}
function showAlert(title, body, cmd) {
  ui.alert.replaceChildren();
  const h = document.createElement('strong'); h.textContent = title;
  const p = document.createElement('p'); p.textContent = body;
  ui.alert.append(h, p);
  if (cmd) { const c = document.createElement('code'); c.textContent = cmd; ui.alert.append(c); }
  ui.alert.hidden = false;
}

const radio = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const setRadio = (name, v) => { const r = document.querySelector(`input[name="${name}"][value="${v}"]`); if (r) r.checked = true; };

const WIDTHS = [1920, 1440, 1280, 1080, 960, 800, 720, 640, 540, 480, 400, 320, 240];
const FPS_OPTS = [8, 10, 12, 15, 20, 24, 25, 30, 50];
const PRESETS = {
  share: { width: 480, fps: 15, pal: 'shared', dither: 'bayer' },
  balanced: { width: 640, fps: 20, pal: 'frame', dither: 'fs' },
  max: { width: 1080, fps: 25, pal: 'frame', dither: 'fs' },
};
const DEFAULT_SET = { width: 640, worig: false, fps: 20, speed: 1, pal: 'frame', dither: 'fs', loop: true };
const fpsAtMost = (f) => FPS_OPTS.filter((x) => x <= f + 0.5).pop() || FPS_OPTS[0];

// ----- clip plan (pure: works for the editor and for any queued clip) -----
function cropPxOf(J) {
  const c = J.crop, x = Math.round(c.x * J.dw), y = Math.round(c.y * J.dh);
  return { x, y, w: clamp(Math.round(c.w * J.dw), 1, J.dw - x), h: clamp(Math.round(c.h * J.dh), 1, J.dh - y) };
}
function planFor(J) {
  const s = J.set, fps = Math.min(s.fps, Math.floor(50 / s.speed + 1e-9)), cp = cropPxOf(J);
  const w = s.worig ? cp.w : Math.min(s.width, cp.w), h = Math.max(1, Math.round(w * cp.h / cp.w));
  const span = Math.max(0, J.outT - J.inT);
  return { w, h, crop: cp, fps, fpsSel: s.fps, speed: s.speed, span, ticks: Math.max(1, Math.round(span * fps)), pal: s.pal, dither: s.dither, loop: s.loop };
}
function optsFor(J) {
  const p = planFor(J), rot = J.engine === 'wc' ? J.rot : 0, full = isFull(J.crop);
  return { start: J.inT, end: J.outT, fps: p.fps, speed: p.speed, ticks: p.ticks, w: p.w, h: p.h, rot,
    bw: rot % 180 ? p.h : p.w, bh: rot % 180 ? p.w : p.h, dither: p.dither, shared: p.pal === 'shared', loop: p.loop,
    crop: full ? null : p.crop, fcrop: full ? null : frameCrop(J.crop, rot) };
}
const sigOf = (J) => { const p = planFor(J); return JSON.stringify([p.w, p.h, p.fps, p.speed, p.pal, p.dither, p.loop, J.inT, J.outT, p.crop]); };
// a finished clip shows as edited once its settings no longer match the GIF it produced
const restatus = (J) => { if (J.res && !ACTIVE.has(J.status)) J.status = sigOf(J) === J.res.sig ? 'done' : 'idle'; };

function readSet() {
  return { width: +ui.width.value || 640, worig: ui.width.selectedIndex === 0, fps: +ui.fps.value, speed: +ui.speed.value,
    pal: radio('pal'), dither: radio('dither'), loop: radio('loop') === 'loop' };
}
function writeSet(set) {
  ui.fps.value = String(set.fps); ui.speed.value = String(set.speed);
  setRadio('pal', set.pal); setRadio('dither', set.dither); setRadio('loop', set.loop ? 'loop' : 'once');
  fillWidths(set.worig ? Infinity : set.width);
}
const editorJob = () => ({ dw: S.dw, dh: S.dh, crop: S.crop, inT: S.inT, outT: S.outT, set: readSet() });
const plan = () => planFor(editorJob());
const cropPx = () => cropPxOf(S);

function sync() {
  const J = S.job;
  if (!J || !J.engine || ACTIVE.has(J.status)) return;
  J.inT = S.inT; J.outT = S.outT; J.crop = { ...S.crop }; J.ratioKey = S.ratioKey; J.set = readSet();
  restatus(J);
  renderRow(J);
}

function fillWidths(keep) {
  const base = cropPx().w;
  ui.width.replaceChildren();
  const add = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label; ui.width.append(o); };
  add(base, `${base} · orig`);
  for (const w of WIDTHS) if (w < base) add(w, String(w));
  setWidth(keep);
}
// keep the chosen width when the crop changes; "orig" follows the new crop width
const refreshWidths = () => fillWidths(ui.width.selectedIndex === 0 ? Infinity : +ui.width.value);
function setWidth(v) {
  let best = null;
  for (const o of ui.width.options) { const n = +o.value; if (n <= v && (best === null || n > +best.value)) best = o; }
  if (ui.width.options.length) ui.width.value = (best || ui.width.options[ui.width.options.length - 1]).value;
}

function markPreset() {
  const p = plan();
  for (const b of document.querySelectorAll('.preset')) {
    const q = PRESETS[b.dataset.preset];
    const wantW = Math.min(q.width, p.crop.w);
    let wOpt = null;
    for (const o of ui.width.options) { const n = +o.value; if (n <= wantW && (wOpt === null || n > wOpt)) wOpt = n; }
    b.setAttribute('aria-pressed', String(p.w === wOpt && p.fpsSel === q.fps && p.pal === q.pal && p.dither === q.dither && p.speed === 1));
  }
}

// the one hook every edit goes through: refresh the summary and write the edit back to the clip
function updateReadout() {
  ui.readout.replaceChildren();
  ui.hint.hidden = true;
  if (S.dur && S.engine) {
    const p = plan();
    const rows = [['Output', `${p.w} × ${p.h} px`]];
    if (!isFull(S.crop)) rows.push(['Crop', `${p.crop.w} × ${p.crop.h} at ${p.crop.x}, ${p.crop.y}`]);
    rows.push(['Frames', `${p.ticks.toLocaleString()} @ ${p.fps} fps`], ['Clip', fmtSec(p.span)], ['Plays in', fmtSec(p.span / p.speed)]);
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      ui.readout.append(dt, dd);
    }
    const notes = [];
    if (p.fps < p.fpsSel) notes.push(`GIF timing tops out at 50 fps, so ${p.speed}× speed uses ${p.fps} fps.`);
    if (p.w * p.h * p.ticks > 6e8) notes.push('Long, large clip: expect a big file. Lower the width or frame rate for a smaller GIF.');
    ui.hint.textContent = notes.join(' ');
    ui.hint.hidden = !notes.length;
    markPreset();
  }
  sync();
  refreshButtons();
}

// ----- trim rail -----
const minLen = () => Math.min(S.dur, Math.max(0.02, 1 / plan().fps));
function setRange(a, b, which) {
  a = clamp(a, 0, S.dur); b = clamp(b, 0, S.dur);
  const ml = minLen();
  if (b - a < ml) { if (which === 'in') a = Math.max(0, b - ml); else b = Math.min(S.dur, a + ml); if (b - a < ml) { a = Math.max(0, b - ml); } }
  S.inT = a; S.outT = b;
  drawTrim(); updateReadout();
}
function drawTrim() {
  const D = S.dur || 1;
  const a = S.inT / D * 100, b = S.outT / D * 100;
  ui.sel.style.left = a + '%'; ui.sel.style.width = (b - a) + '%';
  ui.hIn.style.left = a + '%'; ui.hOut.style.left = b + '%';
  ui.hIn.setAttribute('aria-valuenow', S.inT.toFixed(2)); ui.hIn.setAttribute('aria-valuetext', fmtTC(S.inT)); ui.hIn.setAttribute('aria-valuemax', S.dur.toFixed(2));
  ui.hOut.setAttribute('aria-valuenow', S.outT.toFixed(2)); ui.hOut.setAttribute('aria-valuetext', fmtTC(S.outT)); ui.hOut.setAttribute('aria-valuemax', S.dur.toFixed(2));
  if (document.activeElement !== ui.inT) ui.inT.value = fmtTC(S.inT);
  if (document.activeElement !== ui.outT) ui.outT.value = fmtTC(S.outT);
  ui.len.textContent = fmtSec(S.outT - S.inT);
}
function drawHead(t) {
  ui.ph.style.left = (S.dur ? clamp(t / S.dur, 0, 1) * 100 : 0) + '%';
  ui.tc.textContent = fmtTC(t);
}
const headTime = () => (S.videoOK ? ui.video.currentTime : S.scrubT);
function seekTo(t) {
  t = clamp(t, 0, S.dur);
  if (S.videoOK) { ui.video.currentTime = Math.min(t, Math.max(0, S.dur - 0.001)); drawHead(t); }
  else { S.scrubT = t; drawHead(t); previewAt(t); }
}
function railTime(ev) {
  const r = ui.railIn.getBoundingClientRect();
  return clamp((ev.clientX - r.left) / r.width, 0, 1) * S.dur;
}
let drag = null;
for (const [el, which] of [[ui.hIn, 'in'], [ui.hOut, 'out']]) {
  el.addEventListener('pointerdown', (e) => {
    if (S.busy || !S.dur) return;
    e.preventDefault(); e.stopPropagation();
    drag = which; el.setPointerCapture(e.pointerId); el.focus();
  });
  el.addEventListener('keydown', (e) => {
    if (S.busy || !S.dur) return;
    const step = e.shiftKey ? 1 : 1 / plan().fps;
    let d = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
    else if (e.key === 'Home') d = -S.dur; else if (e.key === 'End') d = S.dur;
    else return;
    e.preventDefault();
    if (which === 'in') { setRange(S.inT + d, S.outT, 'in'); seekTo(S.inT); } else { setRange(S.inT, S.outT + d, 'out'); seekTo(S.outT); }
  });
}
ui.rail.addEventListener('pointerdown', (e) => {
  if (S.busy || !S.dur || e.target === ui.hIn || e.target === ui.hOut) return;
  drag = 'head'; ui.rail.setPointerCapture(e.pointerId);
  seekTo(railTime(e));
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const t = railTime(e);
  if (drag === 'in') { setRange(t, S.outT, 'in'); if (S.videoOK) seekTo(S.inT); else drawHead(S.inT); }
  else if (drag === 'out') { setRange(S.inT, t, 'out'); if (S.videoOK) seekTo(S.outT); else drawHead(S.outT); }
  else seekTo(t);
});
window.addEventListener('pointerup', () => {
  if (drag && !S.videoOK && drag !== 'head') previewAt(drag === 'in' ? S.inT : S.outT);
  drag = null;
});

for (const [el, which] of [[ui.inT, 'in'], [ui.outT, 'out']]) {
  el.addEventListener('change', () => {
    const t = parseTC(el.value);
    if (isNaN(t)) { drawTrim(); toast('Use a time like 1:23.50 or 83.5'); return; }
    if (which === 'in') setRange(t, S.outT, 'in'); else setRange(S.inT, t, 'out');
    seekTo(which === 'in' ? S.inT : S.outT);
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
}
ui.markIn.addEventListener('click', () => setRange(headTime(), S.outT, 'in'));
ui.markOut.addEventListener('click', () => setRange(S.inT, headTime(), 'out'));
ui.fullRange.addEventListener('click', () => setRange(0, S.dur, 'out'));
ui.playSel.addEventListener('click', () => {
  if (!S.videoOK) return;
  if (S.loopRange && !ui.video.paused) { ui.video.pause(); return; }
  S.loopRange = true;
  ui.video.currentTime = S.inT;
  ui.video.play().catch(() => {});
});
document.addEventListener('keydown', (e) => {
  if (S.busy || !S.dur || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (e.key === 'i' || e.key === 'I') { ui.markIn.click(); e.preventDefault(); }
  else if (e.key === 'o' || e.key === 'O') { ui.markOut.click(); e.preventDefault(); }
});

// ----- monitor -----
let raf = 0;
const tickHead = () => {
  const v = ui.video;
  if (S.loopRange && v.currentTime >= S.outT) v.currentTime = S.inT;
  drawHead(v.currentTime);
  if (!v.paused) raf = requestAnimationFrame(tickHead);
};
ui.video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tickHead); ui.playSel.textContent = S.loopRange ? 'Stop range' : 'Play range'; });
ui.video.addEventListener('pause', () => { cancelAnimationFrame(raf); if (!S.busy) { S.loopRange = false; ui.playSel.textContent = 'Play range'; } drawHead(ui.video.currentTime); });
ui.video.addEventListener('seeked', () => { if (!S.busy) drawHead(ui.video.currentTime); });

let pvBusy = false, pvWant = null;
async function previewAt(t) {
  if (!S.info || S.engine !== 'wc') return;
  pvWant = t;
  if (pvBusy) return;
  pvBusy = true;
  while (pvWant !== null) {
    const tt = pvWant; pvWant = null;
    try { await drawPoster(tt); } catch {}
  }
  pvBusy = false;
}
function drawRotated(x, img, rot, W, H) {
  x.save();
  if (rot === 90) { x.translate(W, 0); x.rotate(Math.PI / 2); }
  else if (rot === 180) { x.translate(W, H); x.rotate(Math.PI); }
  else if (rot === 270) { x.translate(0, H); x.rotate(-Math.PI / 2); }
  x.drawImage(img, 0, 0, rot % 180 ? H : W, rot % 180 ? W : H);
  x.restore();
}
// first frame at or before t, decoded on its own (thumbnails, and the preview when <video> is blocked)
async function frameAt(info, file, t) {
  const Sm = info.S, src = new Src(file), k = keyBefore(Sm, t);
  let best = null;
  const dec = new VideoDecoder({
    output: (f) => { if (!best || f.timestamp / 1e6 <= t + 1e-6) { best && best.close(); best = f; } else f.close(); },
    error: () => {},
  });
  dec.configure(cfg(info));
  for (let i = k; i < Sm.n && i < k + 900; i++) {
    if (i > k && Sm.key[i] && Sm.pts[i] > t) break;
    dec.decode(await chunkAt(src, Sm, i, i === k));
    if (dec.decodeQueueSize > 16) await sleep(4);
  }
  await dec.flush();
  dec.close();
  return best;
}
async function drawPoster(t) {
  const J = S.job, f = await frameAt(S.info, S.file, t);
  if (!f) return;
  if (S.job === J) {
    const c = ui.poster, sc = Math.min(1, 1280 / Math.max(S.dw, S.dh));
    c.width = Math.round(S.dw * sc); c.height = Math.round(S.dh * sc);
    drawRotated(c.getContext('2d'), f, S.rot, c.width, c.height);
  }
  f.close();
}

function loadVideoEl(url) {
  const v = ui.video;
  return new Promise((res) => {
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true; clearTimeout(to);
      v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('error', onErr);
      res({ ok: ok && v.videoWidth > 0 });
    };
    const onErr = () => fin(false);
    const onMeta = () => fin(true);
    const to = setTimeout(() => fin(v.readyState >= 1), 8000);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('error', onErr);
    v.src = url;
    v.load();
  });
}
// a separate element, so reading a new file never disturbs the preview
function probeVideoMeta(url) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata';
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true; clearTimeout(to);
      const r = { ok: ok && v.videoWidth > 0 && isFinite(v.duration) && v.duration > 0, dur: v.duration, w: v.videoWidth, h: v.videoHeight };
      v.removeAttribute('src'); v.load();
      res(r);
    };
    const to = setTimeout(() => fin(v.readyState >= 1), 8000);
    v.addEventListener('loadedmetadata', async () => {
      if (!isFinite(v.duration)) {
        // recordings without a duration header: seek far ahead once so the browser computes it
        await new Promise((r) => { const t = setTimeout(r, 3000); v.addEventListener('durationchange', () => { if (isFinite(v.duration)) { clearTimeout(t); r(); } }); v.currentTime = 1e101; });
      }
      fin(true);
    });
    v.addEventListener('error', () => fin(false));
    v.src = url;
  });
}
// the compatibility engine steps through a clip on its own hidden element
function hiddenVideo(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    v.addEventListener('loadeddata', () => res(v), { once: true });
    v.addEventListener('error', () => { v.remove(); rej(new Error('The browser could not play this file.')); }, { once: true });
    document.body.append(v);
    v.src = url;
  });
}

function chip(text, cls) { const s = document.createElement('span'); s.className = 'chip' + (cls ? ' ' + cls : ''); s.textContent = text; return s; }

// ----- crop box -----
const RATIOS = { free: 0, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16, '16:9': 16 / 9, '4:3': 4 / 3 };
const ratio = () => (S.ratioKey === 'orig' ? S.dw / S.dh : RATIOS[S.ratioKey] || 0); // width / height in pixels, 0 = free
const MIN = 16; // smallest crop side, source pixels

// where the picture sits inside the monitor (object-fit: contain)
function contentRect() {
  const mw = ui.monitor.clientWidth, mh = ui.monitor.clientHeight, k = Math.min(mw / S.dw, mh / S.dh);
  return { left: (mw - S.dw * k) / 2, top: (mh - S.dh * k) / 2, width: S.dw * k, height: S.dh * k };
}
function layoutCrop() {
  if (!S.dw) { ui.cropper.hidden = true; return; }
  const r = contentRect(), c = S.crop;
  for (const k of ['left', 'top', 'width', 'height']) ui.cropper.style[k] = r[k] + 'px';
  ui.cropBox.style.left = c.x * 100 + '%'; ui.cropBox.style.top = c.y * 100 + '%';
  ui.cropBox.style.width = c.w * 100 + '%'; ui.cropBox.style.height = c.h * 100 + '%';
  ui.cropper.hidden = !S.cropOn && isFull(c);
  ui.cropper.classList.toggle('edit', S.cropOn);
  ui.cropper.classList.toggle('locked', !!ratio());
  ui.cropBox.tabIndex = S.cropOn ? 0 : -1;
  const cp = cropPx();
  for (const [el, v] of [[ui.cX, cp.x], [ui.cY, cp.y], [ui.cW, cp.w], [ui.cH, cp.h]]) if (document.activeElement !== el) el.value = v;
  ui.cX.max = S.dw - 1; ui.cY.max = S.dh - 1; ui.cW.max = S.dw; ui.cH.max = S.dh;
  ui.cropSum.textContent = isFull(c) ? `Full frame · ${S.dw} × ${S.dh}` : `${cp.w} × ${cp.h} at ${cp.x}, ${cp.y}`;
  ui.cropReset.hidden = isFull(c) && !S.ratioKey.includes(':') && S.ratioKey !== 'orig';
}
function setCrop(x, y, w, h) {
  w = clamp(w, Math.min(1, MIN / S.dw), 1); h = clamp(h, Math.min(1, MIN / S.dh), 1);
  S.crop = { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h };
  layoutCrop(); refreshWidths(); updateReadout();
}
// set a box from a fixed anchor corner (ax, ay) to the pointer (px, py), honoring the ratio lock
function cornerTo(ax, ay, px, py) {
  const W = S.dw, H = S.dh, r = ratio(), sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1;
  let w = Math.abs(px - ax), h = Math.abs(py - ay);
  if (r) {
    const maxW = sx > 0 ? W - ax : ax, maxH = sy > 0 ? H - ay : ay;
    w = Math.max(w, h * r); h = w / r;
    if (w > maxW) { w = maxW; h = w / r; }
    if (h > maxH) { h = maxH; w = h * r; }
    if (w < MIN) { w = MIN; h = w / r; }
    if (h < MIN) { h = MIN; w = h * r; }
  } else { w = Math.max(w, MIN); h = Math.max(h, MIN); }
  setCrop((sx > 0 ? ax : ax - w) / W, (sy > 0 ? ay : ay - h) / H, w / W, h / H);
}
function setRatio(key) {
  S.ratioKey = key;
  for (const b of document.querySelectorAll('.rbtn')) b.setAttribute('aria-pressed', String(b.dataset.r === key));
  const r = ratio();
  if (!r) { layoutCrop(); return; }
  // largest box of that shape, centered where the current crop is
  const c = S.crop, cx = (c.x + c.w / 2) * S.dw, cy = (c.y + c.h / 2) * S.dh;
  const w = Math.min(S.dw, S.dh * r), h = w / r;
  setCrop((cx - w / 2) / S.dw, (cy - h / 2) / S.dh, w / S.dw, h / S.dh);
}
function setCropMode(on) {
  S.cropOn = !!on && !!S.dw && !S.busy;
  ui.cropPanel.hidden = !S.cropOn;
  ui.cropBtn.textContent = S.cropOn ? 'Done' : 'Crop frame';
  ui.cropBtn.setAttribute('aria-expanded', String(S.cropOn));
  if (S.videoOK) { ui.video.controls = !S.cropOn && !S.busy; if (S.cropOn) ui.video.pause(); }
  layoutCrop();
  if (S.cropOn) ui.cropBox.focus({ preventScroll: true });
}

let cd = null;
ui.cropper.addEventListener('pointerdown', (e) => {
  if (!S.cropOn) return;
  e.preventDefault();
  const rect = ui.cropper.getBoundingClientRect(), kx = S.dw / rect.width, ky = S.dh / rect.height;
  const c = S.crop, X0 = c.x * S.dw, Y0 = c.y * S.dh, X1 = X0 + c.w * S.dw, Y1 = Y0 + c.h * S.dh;
  const px = (e.clientX - rect.left) * kx, py = (e.clientY - rect.top) * ky;
  // a full-frame box can't move, so a drag inside it draws a new box instead
  const h = e.target.dataset.h || (ui.cropBox.contains(e.target) && !isFull(c) ? 'move' : 'new');
  cd = { h, rect, kx, ky, X0, Y0, X1, Y1, px, py, ax: px, ay: py };
  if (h.length === 2) { cd.ax = h.includes('w') ? X1 : X0; cd.ay = h.includes('n') ? Y1 : Y0; }
  try { ui.cropper.setPointerCapture(e.pointerId); } catch {}
});
ui.cropper.addEventListener('pointermove', (e) => {
  if (!cd) return;
  const W = S.dw, H = S.dh;
  const px = clamp((e.clientX - cd.rect.left) * cd.kx, 0, W), py = clamp((e.clientY - cd.rect.top) * cd.ky, 0, H);
  if (cd.h === 'move') {
    setCrop((cd.X0 + px - cd.px) / W, (cd.Y0 + py - cd.py) / H, (cd.X1 - cd.X0) / W, (cd.Y1 - cd.Y0) / H);
  } else if (cd.h === 'new') {
    if (Math.hypot((px - cd.px) / cd.kx, (py - cd.py) / cd.ky) > 6) cornerTo(cd.ax, cd.ay, px, py);
  } else if (cd.h.length === 2) {
    cornerTo(cd.ax, cd.ay, px, py);
  } else {
    let { X0, Y0, X1, Y1 } = cd;
    if (cd.h === 'w') X0 = Math.min(px, X1 - MIN); else if (cd.h === 'e') X1 = Math.max(px, X0 + MIN);
    else if (cd.h === 'n') Y0 = Math.min(py, Y1 - MIN); else Y1 = Math.max(py, Y0 + MIN);
    setCrop(X0 / W, Y0 / H, (X1 - X0) / W, (Y1 - Y0) / H);
  }
});
for (const ev of ['pointerup', 'pointercancel']) ui.cropper.addEventListener(ev, () => { cd = null; });
ui.cropBox.addEventListener('keydown', (e) => {
  if (!S.cropOn) return;
  const st = e.shiftKey ? 10 : 1, k = e.key;
  const dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
  if (!dx && !dy) return;
  e.preventDefault();
  const c = S.crop;
  setCrop(c.x + dx / S.dw, c.y + dy / S.dh, c.w, c.h);
});
for (const el of [ui.cX, ui.cY, ui.cW, ui.cH]) {
  el.addEventListener('change', () => {
    let x = +ui.cX.value, y = +ui.cY.value, w = +ui.cW.value, h = +ui.cH.value;
    if (![x, y, w, h].every(isFinite)) { layoutCrop(); return; }
    const r = ratio();
    if (r) {
      if (el === ui.cH) w = h * r; else h = w / r;
      if (w > S.dw) { w = S.dw; h = w / r; }
      if (h > S.dh) { h = S.dh; w = h * r; }
    }
    setCrop(x / S.dw, y / S.dh, w / S.dw, h / S.dh);
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
}
for (const b of document.querySelectorAll('.rbtn')) b.addEventListener('click', () => setRatio(b.dataset.r));
ui.cropBtn.addEventListener('click', () => setCropMode(!S.cropOn));
ui.cropReset.addEventListener('click', () => { setRatio('free'); setCrop(0, 0, 1, 1); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.cropOn) setCropMode(false); });
if (typeof ResizeObserver === 'function') new ResizeObserver(() => layoutCrop()).observe(ui.monitor);
else window.addEventListener('resize', layoutCrop);

// ----- clips -----
const extOf = (n) => (n.split('.').pop() || '').toLowerCase();
function newJob(file, set, extra = {}) {
  const J = { id: ++jobSeq, file, name: file.name, url: URL.createObjectURL(file), info: null, engine: null, dur: 0, dw: 0, dh: 0, rot: 0, srcFps: 0,
    inT: 0, outT: 0, crop: { ...FULL }, ratioKey: 'free', set: { ...set }, status: 'probing', stage: '', videoOK: undefined,
    res: null, card: null, thumb: null, thumbKey: '', ...extra };
  jobs.push(J);
  return J;
}

async function probe(J) {
  J.status = 'probing'; J.stage = 'Reading…'; renderRow(J);
  let info = null, err = null, wcOK = false;
  try {
    info = await demux(J.file, (f) => { J.stage = `Indexing ${Math.round(f * 100)}%`; renderRow(J); });
    wcOK = await wcSupported(info);
  } catch (e) { err = e; }
  J.info = info;
  if (wcOK) {
    Object.assign(J, { engine: 'wc', dur: info.dur, rot: info.rot, srcFps: info.fps,
      dw: info.rot % 180 ? info.h : info.w, dh: info.rot % 180 ? info.w : info.h });
  } else {
    const m = await probeVideoMeta(J.url);
    if (!m.ok) {
      const what = info ? `${info.label} video in ${info.container}` : (extOf(J.name) || 'this').toUpperCase() + ' files';
      J.status = 'unsupported';
      J.err = { title: 'This browser can’t decode ' + what + '.', cmd: `ffmpeg -i input.${extOf(J.name) || 'avi'} -c:v libx264 -crf 16 -preset fast output.mp4` };
      renderRow(J);
      return;
    }
    Object.assign(J, { engine: 'video', dur: m.dur, rot: 0, dw: m.w, dh: m.h, srcFps: info ? info.fps : 0, videoOK: true });
  }
  J.inT = 0; J.outT = J.dur;
  if (J.srcFps && J.set.fps > J.srcFps + 0.5) J.set.fps = fpsAtMost(J.srcFps);
  J.status = 'idle';
  renderRow(J);
  makeThumb(J).then(() => renderRow(J), () => {});
}

async function makeThumb(J) {
  const c = document.createElement('canvas');
  c.width = 240; c.height = Math.max(1, Math.round(240 * J.dh / J.dw));
  const x = c.getContext('2d');
  if (J.engine === 'wc') {
    const f = await frameAt(J.info, J.file, J.inT);
    if (!f) return;
    drawRotated(x, f, J.rot, c.width, c.height);
    f.close();
  } else {
    const v = await hiddenVideo(J.url);
    try { await seekVideo(v, Math.min(0.1, J.dur / 2)); x.drawImage(v, 0, 0, c.width, c.height); }
    finally { v.removeAttribute('src'); v.load(); v.remove(); }
  }
  J.thumb = c; J.thumbKey = '';
}

function addTile() {
  return ui.qAdd;
}
// scroll the strip sideways only, never the page
function revealCard(J) {
  const li = J.card, q = ui.qList;
  if (!li || !q.clientWidth) return;
  if (li.offsetLeft < q.scrollLeft) q.scrollLeft = li.offsetLeft - 8;
  else if (li.offsetLeft + li.offsetWidth > q.scrollLeft + q.clientWidth) q.scrollLeft = li.offsetLeft + li.offsetWidth - q.clientWidth + 8;
}
function renderQueue() {
  ui.qList.replaceChildren(...jobs.map((J) => { if (!J.card) J.card = buildCard(J); renderRow(J); return J.card; }), addTile());
  refreshButtons();
}
function buildCard(J) {
  const li = document.createElement('li');
  li.className = 'clip';
  li.innerHTML = '<button class="clip-pick" type="button"><canvas class="clip-thumb" width="16" height="9"></canvas>'
    + '<span class="clip-badge"></span><span class="clip-bar"><i></i></span></button>'
    + '<div class="clip-body"><span class="clip-name"></span><span class="clip-meta"></span></div>'
    + '<div class="clip-actions"><button class="btn xs" type="button" data-a="save">Save</button>'
    + '<button class="btn xs" type="button" data-a="stop">Cancel</button>'
    + '<button class="btn xs" type="button" data-a="dup">Duplicate</button>'
    + '<button class="btn xs" type="button" data-a="del">Remove</button></div>';
  li.querySelector('.clip-pick').addEventListener('click', () => { if (J.status !== 'probing') select(J); });
  li.querySelector('.clip-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'save' && J.res) saveBlob(gifName(J), J.res.blob);
    else if (a === 'stop') cancelJob(J);
    else if (a === 'dup') duplicate(J);
    else if (a === 'del') removeJob(J);
  });
  return li;
}
const jobFrac = (J) => (J.pipe && J.opts ? clamp(J.pipe.ticksDone / J.opts.ticks, 0, 1) : 0);
function statusText(J) {
  switch (J.status) {
    case 'probing': return J.stage || 'Reading…';
    case 'unsupported': return 'Can’t decode';
    case 'queued': return 'Waiting';
    case 'running': return `Converting ${Math.round(jobFrac(J) * 100)}%`;
    case 'done': return 'Done · ' + fmtBytes(J.res.size);
    case 'error': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return J.res ? 'Edited' : 'Ready';
  }
}
function renderRow(J) {
  const li = J.card;
  if (!li) return;
  li.classList.toggle('on', J === S.job);
  li.dataset.status = J.status;
  const pick = li.querySelector('.clip-pick');
  pick.setAttribute('aria-current', J === S.job ? 'true' : 'false');
  pick.setAttribute('aria-label', `Edit ${J.name}`);
  li.querySelector('.clip-name').textContent = J.name;
  li.querySelector('.clip-name').title = J.name;
  let meta = '';
  if (J.engine) {
    const p = planFor(J);
    meta = `${fmtTC(J.inT)}–${fmtTC(J.outT)} · ${p.w}×${p.h}${isFull(J.crop) ? '' : ' · cropped'}`;
  } else if (J.status === 'unsupported') meta = 'Format not supported here';
  li.querySelector('.clip-meta').textContent = meta;
  li.querySelector('.clip-badge').textContent = statusText(J);
  li.querySelector('.clip-bar i').style.width = (jobFrac(J) * 100).toFixed(1) + '%';
  const show = (a, on) => { li.querySelector(`[data-a="${a}"]`).hidden = !on; };
  show('save', !!J.res); show('stop', ACTIVE.has(J.status)); show('dup', !!J.engine);
  // the thumbnail shows the clip's crop
  const key = J.thumb ? JSON.stringify(J.crop) : '';
  if (J.thumb && key !== J.thumbKey) {
    J.thumbKey = key;
    const t = J.thumb, cv = li.querySelector('.clip-thumb');
    const sx = J.crop.x * t.width, sy = J.crop.y * t.height, sw = Math.max(1, J.crop.w * t.width), sh = Math.max(1, J.crop.h * t.height);
    const k = Math.min(240 / sw, 135 / sh);
    cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
    cv.getContext('2d').drawImage(t, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  }
}

function renderChips(J) {
  const chips = [];
  if (J.sample) chips.push(chip('Sample clip', 'hl'));
  if (J.status === 'unsupported') chips.push(chip('Cannot decode', 'bad'));
  else {
    chips.push(chip(J.info ? J.info.container : extOf(J.name).toUpperCase()));
    if (J.info) chips.push(chip(J.info.label));
    chips.push(chip(`${J.dw}×${J.dh}`));
    if (J.srcFps) chips.push(chip(`${Math.round(J.srcFps * 100) / 100} fps`));
    chips.push(chip(fmtTC(J.dur)));
    chips.push(chip(fmtBytes(J.file.size)));
    if (J.rot) chips.push(chip(`Rotated ${J.rot}°`));
  }
  ui.chips.replaceChildren(...chips);
}

async function select(J) {
  if (!J) { clearEditor(); return; }
  if (S.job === J) return;
  sync();
  setCropMode(false);
  S.job = J;
  for (const k of ['file', 'url', 'info', 'engine', 'dur', 'dw', 'dh', 'rot', 'srcFps', 'inT', 'outT', 'ratioKey']) S[k] = J[k];
  S.crop = { ...J.crop }; S.loopRange = false; S.scrubT = J.inT;
  S.videoOK = J.videoOK !== false;
  ui.alert.hidden = true; ui.empty.hidden = true;
  ui.fname.textContent = J.name;
  renderChips(J);
  for (const K of jobs) renderRow(K);
  revealCard(J);
  ui.video.pause();
  if (J.status === 'unsupported') {
    S.engine = null; S.dur = 0; S.dw = 0;
    ui.video.removeAttribute('src'); ui.video.load(); ui.video.hidden = true; ui.poster.hidden = true; ui.empty.hidden = false;
    showAlert(J.err.title, 'Framepress reads MP4, MOV, M4V, 3GP, WebM and MKV with H.264, HEVC, VP8, VP9 or AV1 video (HEVC needs a browser with HEVC support, such as Safari, or Chrome/Edge on a machine with HEVC hardware). Re-encode other files to MP4 first, for example:', J.err.cmd);
    ui.engine.textContent = '';
    drawTrim(); layoutCrop(); updateReadout(); applyLock(); renderResult();
    return;
  }
  ui.monitor.style.setProperty('--ar', `${J.dw} / ${J.dh}`);
  for (const b of document.querySelectorAll('.rbtn')) b.setAttribute('aria-pressed', String(b.dataset.r === S.ratioKey));
  writeSet(J.set);
  drawTrim(); drawHead(J.inT); layoutCrop(); updateReadout();
  const th = `${POOL.n} encoder thread${POOL.n > 1 ? 's' : ''}`;
  ui.engine.textContent = J.engine === 'wc'
    ? `Fast path: WebCodecs ${J.info.label} decoding, frame-exact, ${th}.`
    : `Compatibility path: steps through the clip frame by frame (slower), ${th}.`;
  applyLock(); renderResult();
  if (J.status === 'error' && J.err) showAlert('Conversion stopped.', J.err);
  // preview player; falls back to decoded stills when the page may not play video
  const id = ++S.loadId;
  ui.video.hidden = false; ui.poster.hidden = true;
  if (J.videoOK === false) { showPoster(); return; }
  const lv = loadVideoEl(J.url);
  const v = J.engine === 'wc' ? await Promise.race([lv, sleep(2500).then(() => ({ ok: false }))]) : await lv;
  if (id !== S.loadId) return;
  J.videoOK = S.videoOK = v.ok;
  if (!v.ok) { showPoster(); return; }
  ui.video.currentTime = Math.min(S.inT, Math.max(0, S.dur - 0.001));
  ui.playSel.hidden = false;
  ui.video.controls = !S.cropOn;
}
function showPoster() {
  S.videoOK = false;
  ui.video.removeAttribute('src'); ui.video.load();
  ui.video.hidden = true; ui.poster.hidden = false; ui.playSel.hidden = true;
  previewAt(S.inT);
}
function clearEditor() {
  sync(); setCropMode(false);
  Object.assign(S, { job: null, file: null, url: null, info: null, engine: null, dur: 0, dw: 0, dh: 0, rot: 0, inT: 0, outT: 0, crop: { ...FULL } });
  ++S.loadId;
  ui.video.pause(); ui.video.removeAttribute('src'); ui.video.load();
  ui.video.hidden = true; ui.poster.hidden = true; ui.empty.hidden = false; ui.alert.hidden = true;
  ui.fname.textContent = 'No video yet'; ui.chips.replaceChildren(); ui.engine.textContent = '';
  drawTrim(); drawHead(0); layoutCrop(); updateReadout(); applyLock(); renderResult();
}

async function addFiles(list) {
  const files = Array.from(list || []).filter(Boolean);
  if (!files.length) return;
  sync();
  const set = { ...(S.job && S.job.engine ? S.job.set : DEFAULT_SET) };
  // the bundled sample steps aside once you bring your own videos
  for (const J of jobs.slice()) if (J.sample && !J.res && !ACTIVE.has(J.status)) removeJob(J);
  const added = files.map((f) => newJob(f, set));
  renderQueue();
  let shown = false;
  for (const J of added) {
    await probe(J);
    if (!shown && J.status !== 'unsupported') { shown = true; select(J); }
  }
  if (!shown) select(added[0]);
  if (added.length > 1) toast(`Added ${added.length} videos`);
  refreshButtons();
}
function duplicate(J) {
  if (!J.engine) return;
  if (J === S.job) sync();
  const n = jobs.filter((K) => K.file === J.file).length + 1, ext = J.file.name.match(/\.[^.]+$/);
  const K = newJob(J.file, J.set, {
    info: J.info, engine: J.engine, dur: J.dur, dw: J.dw, dh: J.dh, rot: J.rot, srcFps: J.srcFps, inT: J.inT, outT: J.outT,
    crop: { ...J.crop }, ratioKey: J.ratioKey, status: 'idle', videoOK: J.videoOK, thumb: J.thumb, sample: J.sample,
    name: J.file.name.replace(/\.[^.]+$/, '') + ` (${n})` + (ext ? ext[0] : ''),
  });
  jobs.splice(jobs.indexOf(K), 1);
  jobs.splice(jobs.indexOf(J) + 1, 0, K);
  if (!K.thumb) makeThumb(K).then(() => renderRow(K), () => {});
  renderQueue();
  select(K);
  toast('Copy added. Give it a different crop or range.');
}
function removeJob(J) {
  const i = jobs.indexOf(J);
  if (i < 0) return;
  cancelJob(J);
  jobs.splice(i, 1);
  if (J.card) J.card.remove();
  if (S.job === J) select(jobs[Math.min(i, jobs.length - 1)] || null);
  URL.revokeObjectURL(J.url);
  if (J.res) URL.revokeObjectURL(J.res.url);
  refreshButtons();
}
function cancelJob(J) {
  if (J.status === 'queued') { J.status = 'cancelled'; restatusAfterStop(J); }
  else if (J.status === 'running' && J.ctrl) J.ctrl.abort();
}
function restatusAfterStop(J) {
  if (J.res && sigOf(J) === J.res.sig) J.status = 'done';
  renderRow(J);
  if (J === S.job) { applyLock(); renderResult(); }
  refreshButtons();
}

// ----- conversion queue -----
let running = 0;
function queue(J, scroll) {
  if (!J || !J.engine || ACTIVE.has(J.status)) return;
  if (J === S.job) sync();
  J.status = 'queued'; J.scroll = !!scroll;
  renderRow(J);
  if (J === S.job) { ui.alert.hidden = true; applyLock(); }
  schedule();
  tickTimer();
}
function schedule() {
  while (running < MAX_JOBS) {
    const J = jobs.find((K) => K.status === 'queued');
    if (!J) break;
    running++;
    runJob(J).finally(() => { running--; schedule(); refreshButtons(); });
  }
  refreshButtons();
}
async function runJob(J) {
  const o = optsFor(J), ctrl = new AbortController(), pipe = new Pipeline(o), sig = ctrl.signal;
  Object.assign(J, { status: 'running', opts: o, ctrl, pipe, stage: 'Starting', t0: performance.now(), runSig: sigOf(J) });
  sig.addEventListener('abort', () => pipe.fail(abortError()));
  renderRow(J);
  if (J === S.job) applyLock();
  let v = null;
  try {
    pipe.start();
    const src = new Src(J.file);
    if (J.engine === 'video') v = await hiddenVideo(J.url);
    if (o.shared) {
      J.stage = 'Sampling colors for the shared palette';
      const bmps = J.engine === 'wc' ? await sampleWC(J.info, src, o, sig) : await sampleVideo(v, o, sig);
      await pipe.buildPalette(bmps);
    }
    pipe.begin();
    J.stage = J.engine === 'wc' ? 'Decoding and encoding' : 'Stepping through frames and encoding';
    if (J.engine === 'wc') await runWC(J.info, src, o, pipe, sig);
    else await runVideo(v, o, pipe, sig, true);
    J.stage = 'Writing GIF';
    const blob = await pipe.finish();
    if (J.res) URL.revokeObjectURL(J.res.url);
    J.res = { blob, url: URL.createObjectURL(blob), size: blob.size, o, written: pipe.written, secs: (performance.now() - J.t0) / 1000, sig: J.runSig };
    J.status = 'done'; J.err = null;
  } catch (e) {
    J.status = sig.aborted ? 'cancelled' : 'error';
    J.err = sig.aborted ? null : (e && e.message) || String(e);
    if (!sig.aborted) console.error(e);
  } finally {
    pipe.dispose();
    if (v) { v.removeAttribute('src'); v.load(); v.remove(); }
    J.pipe = null; J.ctrl = null;
    if (J.status === 'cancelled') restatusAfterStop(J);
    renderRow(J);
    if (J === S.job) {
      applyLock(); renderResult();
      if (J.status === 'error') showAlert('Conversion stopped.', J.err);
      if (J.status === 'done' && J.scroll) ui.result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } else if (J.status === 'done' && !J.removed) toast(`${J.name} is ready`);
  }
}

let timer = 0;
function tickTimer() {
  if (timer) return;
  timer = setInterval(() => {
    let any = false;
    for (const J of jobs) if (ACTIVE.has(J.status)) { any = true; renderRow(J); }
    if (S.busy) renderProgress(S.job);
    if (!any) { clearInterval(timer); timer = 0; }
  }, 250);
}

function applyLock() {
  const J = S.job, b = S.busy, none = !J || !J.engine;
  document.body.classList.toggle('busy', b);
  for (const el of document.querySelectorAll('.panel select, .panel input, .preset, #markIn, #markOut, #playSel, #fullRange, #inT, #outT, #hIn, #hOut, #cropBtn, #cropReset, #cropAll, #applyAll')) el.disabled = b || none;
  if (b) setCropMode(false);
  ui.go.hidden = b; ui.prog.hidden = !b;
  ui.go.disabled = none;
  if (S.videoOK) ui.video.controls = !S.cropOn;
  if (b) renderProgress(J);
  refreshButtons();
}
function refreshButtons() {
  const ready = jobs.filter((J) => J.engine && (J.status === 'idle' || J.status === 'error' || J.status === 'cancelled'));
  const active = jobs.filter((J) => ACTIVE.has(J.status)), done = jobs.filter((J) => J.res);
  const many = jobs.length > 1;
  ui.qCount.textContent = String(jobs.length);
  const parts = [];
  if (done.length) parts.push(`${done.length} done`);
  const run = active.filter((J) => J.status === 'running').length, wait = active.length - run;
  if (run) parts.push(`${run} converting`);
  if (wait) parts.push(`${wait} waiting`);
  ui.qSum.textContent = parts.join(' · ');
  ui.qAll.hidden = !many; ui.qAll.disabled = !ready.length;
  ui.qAll.textContent = ready.length ? `Convert all (${ready.length})` : 'Convert all';
  ui.goAll.hidden = !many || !ready.length; ui.goAll.textContent = `Convert all clips (${ready.length})`;
  ui.qZip.hidden = done.length < 2;
  ui.qCancel.hidden = !active.length;
  ui.applyAll.hidden = !many; ui.cropAll.hidden = !many;
  ui.go.textContent = S.job && S.job.status === 'done' ? 'Convert again' : 'Convert to GIF';
}

function renderProgress(J) {
  if (!J) return;
  if (J.status === 'queued' || !J.pipe) {
    ui.pstage.textContent = J.status === 'queued' ? 'Waiting for a free slot' : 'Starting';
    ui.bar.style.width = '0%';
    ui.pstats.replaceChildren();
    return;
  }
  const pipe = J.pipe, o = J.opts, el = (performance.now() - J.t0) / 1000, frac = jobFrac(J);
  ui.pstage.textContent = J.stage;
  ui.bar.style.width = (frac * 100).toFixed(1) + '%';
  ui.bar.parentElement.setAttribute('aria-valuenow', Math.round(frac * 100));
  const parts = [`${pipe.framesDone.toLocaleString()} / ~${o.ticks.toLocaleString()} frames`, `${fmtClock(el)} elapsed`];
  if (frac > 0.02 && el > 0.5) {
    parts.push(`${(pipe.ticksDone / o.fps / el).toFixed(1)}× realtime`);
    if (frac < 1) parts.push(`~${fmtClock(el * (1 - frac) / frac)} left`);
  }
  parts.push(fmtBytes(pipe.bytes));
  ui.pstats.replaceChildren(...parts.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
}

function renderResult() {
  const J = S.job, r = J && J.res;
  if (!r) { ui.result.hidden = true; return; }
  const o = r.o;
  ui.gif.src = r.url; ui.gif.width = o.w; ui.gif.height = o.h;
  ui.resultTitle.textContent = J.status === 'done' ? 'GIF ready' : 'Last GIF (settings changed since)';
  const rows = [
    ['File size', fmtBytes(r.size)],
    ['Dimensions', `${o.w} × ${o.h}`],
    ['Frames', r.written === o.ticks ? `${o.ticks.toLocaleString()} at ${o.fps} fps` : `${r.written.toLocaleString()} (repeats merged) at ${o.fps} fps`],
    ['Duration', fmtSec((o.end - o.start) / o.speed)],
    ...(o.crop ? [['Crop', `${o.crop.w} × ${o.crop.h} at ${o.crop.x}, ${o.crop.y}`]] : []),
    ['Palette', o.shared ? 'Shared, 255 colors' : 'Per frame, 255 colors'],
    ['Dither', { fs: 'Floyd–Steinberg', bayer: 'Bayer 8×8', none: 'Off' }[o.dither]],
    ['Encode time', `${r.secs.toFixed(1)} s · ${((o.end - o.start) / r.secs).toFixed(1)}× realtime`],
  ];
  ui.stats.replaceChildren();
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    ui.stats.append(dt, dd);
  }
  ui.saveNote.textContent = '';
  ui.result.hidden = false;
}

// ----- saving -----
const gifName = (J) => J.name.replace(/\.[^.]+$/, '') + '.gif';
async function saveBlob(name, blob) {
  const dl = await dlP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); toast('Saved ' + name); }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') toast('Save cancelled');
      else if (code === 'rate_limited') toast('A save prompt is already open');
      else if (code === 'extension_not_enabled' || code === 'rejected_extension') toast('This view can’t save .' + extOf(name) + ' files. Save the GIFs one by one.');
      else ui.saveNote.textContent = 'Saving is unavailable in this view. Right-click the GIF (long-press on a phone) and choose Save image.';
    }
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// .zip without compression (GIF is already compressed)
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(u8) { let c = -1; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    parts.push(h.buffer, name, data);
    central.push(c.buffer, name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
}
async function saveAll() {
  const done = jobs.filter((J) => J.res), used = new Set();
  const files = done.map((J) => {
    let n = gifName(J), i = 2;
    while (used.has(n)) n = gifName(J).replace(/\.gif$/, `-${i++}.gif`);
    used.add(n);
    return { name: n, blob: J.res.blob };
  });
  toast('Packing ' + files.length + ' GIFs…');
  await saveBlob('framepress-gifs.zip', await makeZip(files));
}

// ----- buttons -----
ui.save.addEventListener('click', () => { if (S.job && S.job.res) saveBlob(gifName(S.job), S.job.res.blob); });
ui.again.addEventListener('click', () => { ui.go.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); });
ui.go.addEventListener('click', () => queue(S.job, true));
const convertAll = () => { sync(); for (const J of jobs) if (J.engine && (J.status === 'idle' || J.status === 'error' || J.status === 'cancelled')) queue(J, false); };
ui.goAll.addEventListener('click', convertAll);
ui.qAll.addEventListener('click', convertAll);
ui.qZip.addEventListener('click', saveAll);
ui.qCancel.addEventListener('click', () => { for (const J of jobs) cancelJob(J); });
ui.cancel.addEventListener('click', () => S.job && cancelJob(S.job));
ui.applyAll.addEventListener('click', () => {
  sync();
  const set = S.job.set;
  let n = 0;
  for (const J of jobs) {
    if (J === S.job || !J.engine || ACTIVE.has(J.status)) continue;
    J.set = { ...set };
    if (J.srcFps && J.set.fps > J.srcFps + 0.5) J.set.fps = fpsAtMost(J.srcFps);
    restatus(J); renderRow(J); n++;
  }
  toast(`Settings applied to ${n} other clip${n === 1 ? '' : 's'}`);
  refreshButtons();
});
ui.cropAll.addEventListener('click', () => {
  sync();
  const c = S.job.crop, key = S.job.ratioKey;
  let n = 0;
  for (const J of jobs) {
    if (J === S.job || !J.engine || ACTIVE.has(J.status)) continue;
    // same region relative to each video; a locked ratio is re-fitted to that video's size
    let { x, y, w, h } = c;
    const r = key === 'orig' ? J.dw / J.dh : RATIOS[key] || 0;
    if (r) {
      let pw = w * J.dw, ph = pw / r;
      if (ph > J.dh) { ph = J.dh; pw = ph * r; }
      if (pw > J.dw) { pw = J.dw; ph = pw / r; }
      const cx = (x + w / 2) * J.dw, cy = (y + h / 2) * J.dh;
      w = pw / J.dw; h = ph / J.dh; x = (cx - pw / 2) / J.dw; y = (cy - ph / 2) / J.dh;
    }
    w = clamp(w, 0, 1); h = clamp(h, 0, 1);
    J.crop = { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h }; J.ratioKey = key;
    restatus(J); renderRow(J); n++;
  }
  toast(`Crop applied to ${n} other clip${n === 1 ? '' : 's'}`);
  refreshButtons();
});

for (const b of document.querySelectorAll('.preset')) {
  b.addEventListener('click', () => {
    const q = PRESETS[b.dataset.preset];
    setWidth(q.width); ui.fps.value = String(S.srcFps && q.fps > S.srcFps + 0.5 ? fpsAtMost(S.srcFps) : q.fps); ui.speed.value = '1';
    setRadio('pal', q.pal); setRadio('dither', q.dither);
    updateReadout();
  });
}
for (const el of document.querySelectorAll('.panel select, .panel input[type="radio"]')) el.addEventListener('change', updateReadout);

// ----- file input / drag & drop -----
for (const inp of [ui.file, ui.file2]) inp.addEventListener('change', () => { const fs = Array.from(inp.files); inp.value = ''; addFiles(fs); });
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; ui.drop.hidden = false; });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) ui.drop.hidden = true; });
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; ui.drop.hidden = true;
  addFiles(e.dataTransfer.files);
});

// ----- boot with the bundled sample -----
(async () => {
  renderQueue(); clearEditor();
  try {
    const b64 = $('sample-b64').textContent.trim();
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const J = newJob(new File([u8], 'sample-mandelbrot.mp4', { type: 'video/mp4' }), DEFAULT_SET, { sample: true });
    renderQueue();
    await probe(J);
    if (!S.job) await select(J);
  } catch (e) { console.error(e); }
})();

window.__fp = { S, jobs, select, addFiles, queue, plan, setCrop, setRatio, setCropMode, blob: () => S.job && S.job.res && S.job.res.blob };
})();
