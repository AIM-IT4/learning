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

class Pipeline {
  constructor(o) {
    this.o = o;
    const hc = navigator.hardwareConcurrency || 4;
    this.nw = clamp(hc - 1, 1, 12);
    const fb = o.w * o.h * 4;
    const budget = (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 160 : 384) * 1048576;
    this.limit = Math.max(4, Math.floor(budget / fb));
    // small chunks keep every thread busy on short clips; longer chunks amortize the re-quantized
    // previous frame each chunk needs for diffing
    this.C = clamp(Math.min(Math.floor(this.limit / (this.nw * 2)), Math.ceil(o.ticks / (this.nw * 4))), 2, 12);
    this.workers = []; this.idle = []; this.queue = []; this.busy = new Map(); this.results = new Map();
    this.cur = null; this.nextPrevP = null; this.chunkId = 0; this.writeId = 0;
    this.ticks = []; this.frames = 0; this.inflight = 0; this.ticksDone = 0; this.framesDone = 0; this.written = 0;
    this.parts = []; this.bytes = 0; this.cum = 0; this.pend = null; this.failed = null; this.waiters = [];
    this.unit = 100 / (o.fps * o.speed);
    this.gct = null; this.palWait = null;
  }
  kick() { const w = this.waiters; this.waiters = []; for (const f of w) f(); }
  nap() { return new Promise((r) => { this.waiters.push(r); setTimeout(r, 40); }); }
  fail(e) { if (!this.failed) this.failed = e; if (this.palWait) this.palWait.rej(e); this.kick(); }
  start() {
    this.url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const o = this.o;
    for (let i = 0; i < this.nw; i++) {
      const w = new Worker(this.url);
      w.onmessage = (e) => this.onMsg(w, e.data);
      w.onerror = (e) => { e.preventDefault?.(); this.fail(new Error('An encoder thread stopped: ' + (e.message || 'unknown error'))); };
      w.postMessage({ type: 'init', W: o.w, H: o.h, BW: o.bw, BH: o.bh, ROT: o.rot, DITHER: o.dither });
      this.workers.push(w); this.idle.push(w);
    }
  }
  buildPalette(bmps) {
    return new Promise((res, rej) => {
      this.palWait = { res, rej };
      const w = this.workers[0];
      this.idle = this.idle.filter((x) => x !== w);
      w.postMessage({ type: 'palette', frames: bmps }, bmps);
    });
  }
  begin() { for (const p of gifHeader(this.o.w, this.o.h, this.gct, this.o.loop)) this.out(p); }
  out(u8) { this.parts.push(u8); this.bytes += u8.byteLength; }
  push(bmp, n) {
    if (this.failed) { bmp.close(); throw this.failed; }
    this.ticks.push(n);
    if (!this.cur) this.cur = { id: this.chunkId++, first: this.frames, frames: [], prevP: this.nextPrevP, prev: null, ready: false };
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
    Promise.all([c.prevP, clone]).then(([prev]) => { c.prev = prev || null; c.ready = true; this.pump(); }, (e) => this.fail(e));
  }
  pump() {
    while (this.idle.length && !this.failed) {
      const i = this.queue.findIndex((c) => c.ready);
      if (i < 0) break;
      const c = this.queue.splice(i, 1)[0], w = this.idle.pop();
      this.busy.set(w, c);
      w.postMessage({ type: 'chunk', id: c.id, prev: c.prev, frames: c.frames }, c.prev ? [c.prev, ...c.frames] : c.frames.slice());
    }
  }
  onMsg(w, m) {
    if (m.type === 'palette') {
      this.idle.push(w);
      this.gct = new Uint8Array(m.pal);
      for (const x of this.workers) x.postMessage({ type: 'setPalette', pal: this.gct, n: m.n });
      const pw = this.palWait; this.palWait = null; pw && pw.res();
      return;
    }
    if (m.type === 'error') { this.fail(new Error('Encoder error: ' + m.message)); return; }
    if (m.type !== 'done') return;
    const c = this.busy.get(w);
    this.busy.delete(w); this.idle.push(w);
    this.results.set(m.id, { first: c.first, outs: m.outs });
    this.inflight -= c.frames.length; this.framesDone += c.frames.length;
    for (let f = c.first; f < c.first + c.frames.length; f++) this.ticksDone += this.ticks[f];
    this.drain(); this.pump(); this.kick();
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
    else if (this.nextPrevP) this.nextPrevP.then((b) => b && b.close(), () => {});
    this.nextPrevP = null;
    if (!this.frames) throw new Error('No frames were decoded in the selected range.');
    while (this.writeId < this.chunkId) { if (this.failed) throw this.failed; await this.nap(); }
    if (this.pend) this.emit();
    this.out(new Uint8Array([0x3B]));
    return new Blob(this.parts, { type: 'image/gif' });
  }
  dispose() {
    for (const w of this.workers) w.terminate();
    const close = (b) => { try { b && b.close(); } catch {} };
    for (const c of this.queue) { c.frames.forEach(close); close(c.prev); }
    if (this.cur) this.cur.frames.forEach(close);
    if (this.nextPrevP) this.nextPrevP.then(close, () => {});
    if (this.url) URL.revokeObjectURL(this.url);
    this.workers = []; this.queue = []; this.kick();
  }
}

// ---------- engine 1: WebCodecs (hardware decode, frame-exact) ----------
async function runWC(info, src, o, pipe, sig) {
  const Sm = info.S, T = (k) => o.start + k / o.fps;
  const bmo = { resizeWidth: o.bw, resizeHeight: o.bh, resizeQuality: 'high' };
  let k0 = keyBefore(Sm, o.start);
  const last = lastUpTo(Sm, k0, o.end);
  for (let attempt = 0; ; attempt++) {
    let outputs = 0, failed = null, prev = null, nextTick = 0, grabs = 0, chain = Promise.resolve();
    const grab = (frame, cnt) => {
      grabs++;
      const p = createImageBitmap(frame, bmo);
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
  const bmo = { resizeWidth: o.bw, resizeHeight: o.bh, resizeQuality: 'high' };
  const pend = [];
  const grab = (f) => pend.push(createImageBitmap(f, bmo).finally(() => f.close()));
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

async function runVideo(v, o, pipe, sig) {
  const T = (k) => o.start + k / o.fps;
  // draw synchronously so the captured frame is exactly the one the frame callback reported
  const oc = new OffscreenCanvas(o.bw, o.bh), ocx = oc.getContext('2d', { alpha: false });
  ocx.imageSmoothingQuality = 'high';
  let nextTick = 0, emitted = 0, failed = null;
  const grab = (cnt) => {
    try {
      ocx.drawImage(v, 0, 0, o.bw, o.bh);
      pipe.push(oc.transferToImageBitmap(), cnt);
      emitted++;
      pipe.kick();
    } catch (e) { failed = failed || e; }
  };
  v.pause(); v.muted = true; v.loop = false;
  if (typeof v.requestVideoFrameCallback !== 'function') {
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
    bmps.push(await createImageBitmap(v, { resizeWidth: o.bw, resizeHeight: o.bh, resizeQuality: 'high' }));
  }
  return bmps;
}

// ---------- UI ----------
const ui = {};
for (const id of ['video', 'poster', 'tc', 'fname', 'chips', 'file', 'inT', 'outT', 'len', 'rail', 'railIn', 'sel', 'ph', 'hIn', 'hOut',
  'markIn', 'markOut', 'playSel', 'fullRange', 'width', 'fps', 'speed', 'readout', 'go', 'prog', 'pstage', 'bar', 'pstats', 'cancel',
  'engine', 'result', 'gif', 'stats', 'save', 'again', 'saveNote', 'toast', 'drop', 'alert', 'monitor', 'openBtn', 'empty', 'hint']) ui[id] = $(id);

const S = { file: null, url: null, info: null, src: null, engine: null, dur: 0, dw: 0, dh: 0, rot: 0, srcFps: 0, inT: 0, outT: 0,
  busy: false, ctrl: null, videoOK: false, scrubT: 0, blob: null, gifURL: null, loopRange: false, sample: false, loadId: 0 };

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
const PRESETS = {
  share: { width: 480, fps: 15, pal: 'shared', dither: 'bayer' },
  balanced: { width: 640, fps: 20, pal: 'frame', dither: 'fs' },
  max: { width: 1080, fps: 25, pal: 'frame', dither: 'fs' },
};

function fillWidths(keep) {
  ui.width.replaceChildren();
  const add = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label; ui.width.append(o); };
  add(S.dw, `${S.dw} · orig`);
  for (const w of WIDTHS) if (w < S.dw) add(w, String(w));
  setWidth(keep);
}
function setWidth(v) {
  let best = null;
  for (const o of ui.width.options) { const n = +o.value; if (n <= v && (best === null || n > +best.value)) best = o; }
  ui.width.value = (best || ui.width.options[ui.width.options.length - 1]).value;
}

function plan() {
  const fpsSel = +ui.fps.value, speed = +ui.speed.value;
  const fps = Math.min(fpsSel, Math.floor(50 / speed + 1e-9));
  const w = Math.min(+ui.width.value || S.dw, S.dw), h = Math.max(1, Math.round(w * S.dh / S.dw));
  const span = Math.max(0, S.outT - S.inT);
  return { w, h, fps, fpsSel, speed, span, ticks: Math.max(1, Math.round(span * fps)), pal: radio('pal'), dither: radio('dither'), loop: radio('loop') === 'loop' };
}

function markPreset() {
  const p = plan();
  for (const b of document.querySelectorAll('.preset')) {
    const q = PRESETS[b.dataset.preset];
    const wantW = Math.min(q.width, S.dw);
    let wOpt = null;
    for (const o of ui.width.options) { const n = +o.value; if (n <= wantW && (wOpt === null || n > wOpt)) wOpt = n; }
    b.setAttribute('aria-pressed', String(p.w === wOpt && p.fpsSel === q.fps && p.pal === q.pal && p.dither === q.dither && p.speed === 1));
  }
}

function updateReadout() {
  ui.readout.replaceChildren();
  if (!S.dur) return;
  const p = plan();
  const rows = [
    ['Output', `${p.w} × ${p.h} px`],
    ['Frames', `${p.ticks.toLocaleString()} @ ${p.fps} fps`],
    ['Clip', fmtSec(p.span)],
    ['Plays in', fmtSec(p.span / p.speed)],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    ui.readout.append(dt, dd);
  }
  const notes = [];
  if (p.fps < p.fpsSel) notes.push(`GIF timing tops out at 50 fps, so ${p.speed}× speed uses ${p.fps} fps.`);
  const px = p.w * p.h * p.ticks;
  if (px > 6e8) notes.push('Long, large clip: expect a big file. Lower the width or frame rate for a smaller GIF.');
  ui.hint.textContent = notes.join(' ');
  ui.hint.hidden = !notes.length;
  markPreset();
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
async function drawPoster(t) {
  const info = S.info, Sm = info.S, src = new Src(S.file);
  const k = keyBefore(Sm, t);
  let best = null;
  const dec = new VideoDecoder({
    output: (f) => { if (!best || f.timestamp / 1e6 <= t + 1e-6) { best && best.close(); best = f; } else f.close(); },
    error: () => {},
  });
  dec.configure(cfg(info));
  for (let i = k; i < Sm.n && i < k + 900; i++) {
    if (i > k && Sm.key[i] && Sm.pts[i] > t) break;
    dec.decode(await chunkAt(src, Sm, i, i === k));
    if (dec.decodeQueueSize > 16) await new Promise((r) => setTimeout(r, 4));
  }
  await dec.flush();
  dec.close();
  if (!best) return;
  const c = ui.poster, sc = Math.min(1, 1280 / Math.max(S.dw, S.dh));
  c.width = Math.round(S.dw * sc); c.height = Math.round(S.dh * sc);
  const x = c.getContext('2d');
  x.save();
  const rot = S.rot, W = c.width, H = c.height;
  if (rot === 90) { x.translate(W, 0); x.rotate(Math.PI / 2); } else if (rot === 180) { x.translate(W, H); x.rotate(Math.PI); } else if (rot === 270) { x.translate(0, H); x.rotate(-Math.PI / 2); }
  x.drawImage(best, 0, 0, rot % 180 ? H : W, rot % 180 ? W : H);
  x.restore();
  best.close();
}

function loadVideoEl(url) {
  const v = ui.video;
  return new Promise((res) => {
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true; clearTimeout(to);
      v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('error', onErr);
      res({ ok: ok && v.videoWidth > 0, dur: v.duration, w: v.videoWidth, h: v.videoHeight });
    };
    const onErr = () => fin(false);
    const onMeta = async () => {
      if (!isFinite(v.duration)) {
        // recordings without a duration header: seek far ahead once so the browser computes it
        await new Promise((r) => { const tt = setTimeout(r, 3000); v.addEventListener('durationchange', () => { if (isFinite(v.duration)) { clearTimeout(tt); r(); } }); v.currentTime = 1e101; });
        v.currentTime = 0;
      }
      fin(true);
    };
    const to = setTimeout(() => fin(v.readyState >= 1), 8000);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('error', onErr);
    v.src = url;
    v.load();
  });
}

function chip(text, cls) { const s = document.createElement('span'); s.className = 'chip' + (cls ? ' ' + cls : ''); s.textContent = text; return s; }

async function loadFile(file, sample = false) {
  if (S.busy || !file) return;
  const id = ++S.loadId;
  ui.alert.hidden = true; ui.result.hidden = true; ui.empty.hidden = true;
  ui.go.disabled = true;
  S.file = file; S.sample = sample; S.info = null; S.engine = null; S.dur = 0; S.loopRange = false;
  ui.fname.textContent = file.name;
  ui.chips.replaceChildren(chip(sample ? 'Sample clip' : 'Reading…', sample ? 'hl' : ''));
  if (S.url) URL.revokeObjectURL(S.url);
  S.url = URL.createObjectURL(file);
  ui.video.hidden = false; ui.poster.hidden = true;
  const videoP = loadVideoEl(S.url);
  let info = null, err = null, wcOK = false;
  try {
    info = await demux(file, (f) => { if (id === S.loadId) ui.chips.replaceChildren(chip(`Indexing ${Math.round(f * 100)}%`)); });
    wcOK = await wcSupported(info);
  } catch (e) { err = e; }
  // if the fast decoder works, don't hold the page for a preview player that may never load
  const v = wcOK ? await Promise.race([videoP, new Promise((r) => setTimeout(r, 2500)).then(() => ({ ok: false }))]) : await videoP;
  if (id !== S.loadId) return;
  S.videoOK = v.ok;
  if (wcOK) {
    S.engine = 'wc'; S.info = info; S.src = new Src(file);
    S.dur = info.dur; S.rot = info.rot;
    S.dw = info.rot % 180 ? info.h : info.w; S.dh = info.rot % 180 ? info.w : info.h;
    S.srcFps = info.fps;
  } else if (v.ok && isFinite(v.dur) && v.dur > 0) {
    S.engine = 'video'; S.info = info; S.dur = v.dur; S.rot = 0; S.dw = v.w; S.dh = v.h; S.srcFps = info ? info.fps : 0;
  } else {
    ui.chips.replaceChildren(chip('Cannot decode', 'bad'));
    ui.video.removeAttribute('src'); ui.video.load();
    const what = info ? `${info.label} video in ${info.container}` : (err && err.message === 'fragmented' ? 'fragmented MP4' : (file.name.split('.').pop() || 'this').toUpperCase() + ' files');
    showAlert('This browser can’t decode ' + what + '.',
      'Framepress reads MP4, MOV, M4V, 3GP, WebM and MKV with H.264, HEVC, VP8, VP9 or AV1 video (HEVC needs a browser with HEVC support, such as Safari, or Chrome/Edge on a machine with HEVC hardware). Remux or re-encode other files to MP4 first, for example:',
      'ffmpeg -i input.' + ((file.name.split('.').pop() || 'avi').toLowerCase()) + ' -c:v libx264 -crf 16 -preset fast output.mp4');
    S.file = null;
    return;
  }
  if (!S.videoOK) {
    ui.video.hidden = true; ui.poster.hidden = false;
    S.scrubT = 0; previewAt(0);
  }
  ui.playSel.hidden = !S.videoOK;
  ui.monitor.style.setProperty('--ar', `${S.dw} / ${S.dh}`);
  const chips = [];
  if (sample) chips.push(chip('Sample clip', 'hl'));
  chips.push(chip(info ? info.container : (file.name.split('.').pop() || '').toUpperCase()));
  if (info) chips.push(chip(info.label));
  chips.push(chip(`${S.dw}×${S.dh}`));
  if (S.srcFps) chips.push(chip(`${(Math.round(S.srcFps * 100) / 100).toString()} fps`));
  chips.push(chip(fmtTC(S.dur)));
  chips.push(chip(fmtBytes(file.size)));
  if (S.rot) chips.push(chip(`Rotated ${S.rot}°`));
  ui.chips.replaceChildren(...chips);
  const keepW = +ui.width.value || 640;
  fillWidths(S.sample ? 640 : keepW);
  if (S.srcFps && +ui.fps.value > S.srcFps + 0.5) {
    let best = ui.fps.options[0].value;
    for (const o of ui.fps.options) if (+o.value <= S.srcFps + 0.5) best = o.value;
    ui.fps.value = best;
  }
  S.inT = 0; S.outT = S.dur;
  drawTrim(); drawHead(0); updateReadout();
  const threads = clamp((navigator.hardwareConcurrency || 4) - 1, 1, 12);
  const th = `${threads} encoder thread${threads > 1 ? 's' : ''}`;
  ui.engine.textContent = S.engine === 'wc'
    ? `Fast path: WebCodecs ${info.label} decoding, frame-exact, ${th}.`
    : `Compatibility path: the clip plays through once in real time, ${th}. Keep this tab visible while it converts.`;
  ui.go.disabled = false;
}

// ----- convert -----
function setBusy(b) {
  S.busy = b;
  document.body.classList.toggle('busy', b);
  for (const el of document.querySelectorAll('.panel select, .panel input, .preset, #markIn, #markOut, #playSel, #fullRange, #inT, #outT, #file, #hIn, #hOut')) el.disabled = b;
  ui.openBtn.classList.toggle('off', b);
  ui.go.hidden = b; ui.prog.hidden = !b;
  if (S.videoOK) ui.video.controls = !b;
}

function renderProgress(pipe, o, t0, stage) {
  const el = (performance.now() - t0) / 1000;
  const frac = clamp(pipe.ticksDone / o.ticks, 0, 1);
  ui.bar.style.width = (frac * 100).toFixed(1) + '%';
  ui.bar.parentElement.setAttribute('aria-valuenow', Math.round(frac * 100));
  const parts = [`${pipe.framesDone.toLocaleString()} / ~${o.ticks.toLocaleString()} frames`, `${fmtClock(el)} elapsed`];
  if (frac > 0.02 && el > 0.5) {
    parts.push(`${(pipe.ticksDone / o.fps / el).toFixed(1)}× realtime`);
    if (frac < 1) parts.push(`~${fmtClock(el * (1 - frac) / frac)} left`);
  }
  parts.push(fmtBytes(pipe.bytes));
  ui.pstats.replaceChildren(...parts.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
  if (stage) ui.pstage.textContent = stage;
}

async function convert() {
  if (S.busy || !S.engine) return;
  const p = plan();
  const rot = S.engine === 'wc' ? S.rot : 0;
  const o = { start: S.inT, end: S.outT, fps: p.fps, speed: p.speed, ticks: p.ticks, w: p.w, h: p.h, rot,
    bw: rot % 180 ? p.h : p.w, bh: rot % 180 ? p.w : p.h, dither: p.dither, shared: p.pal === 'shared', loop: p.loop };
  ui.alert.hidden = true; ui.result.hidden = true;
  const ctrl = new AbortController();
  S.ctrl = ctrl;
  setBusy(true);
  S.loopRange = false;
  if (S.videoOK) ui.video.pause();
  const pipe = new Pipeline(o);
  ctrl.signal.addEventListener('abort', () => pipe.fail(abortError()));
  const t0 = performance.now();
  let stage = 'Starting encoder threads';
  renderProgress(pipe, o, t0, stage);
  const timer = setInterval(() => renderProgress(pipe, o, t0, stage), 250);
  try {
    pipe.start();
    if (o.shared) {
      stage = 'Sampling colors for the shared palette';
      renderProgress(pipe, o, t0, stage);
      const bmps = S.engine === 'wc' ? await sampleWC(S.info, S.src, o, ctrl.signal) : await sampleVideo(ui.video, o, ctrl.signal);
      await pipe.buildPalette(bmps);
    }
    pipe.begin();
    stage = S.engine === 'wc' ? 'Decoding and encoding' : 'Playing through and encoding';
    if (S.engine === 'wc') await runWC(S.info, S.src, o, pipe, ctrl.signal);
    else await runVideo(ui.video, o, pipe, ctrl.signal);
    stage = 'Writing GIF';
    const blob = await pipe.finish();
    const secs = (performance.now() - t0) / 1000;
    renderProgress(pipe, o, t0, stage);
    showResult(blob, o, pipe, secs);
  } catch (e) {
    if (ctrl.signal.aborted) toast('Conversion cancelled');
    else {
      console.error(e);
      showAlert('Conversion stopped.', (e && e.message) || String(e));
    }
  } finally {
    clearInterval(timer);
    pipe.dispose();
    S.ctrl = null;
    setBusy(false);
    if (S.videoOK) { ui.video.playbackRate = 1; drawHead(ui.video.currentTime); }
  }
}

function showResult(blob, o, pipe, secs) {
  if (S.gifURL) URL.revokeObjectURL(S.gifURL);
  S.blob = blob; S.gifURL = URL.createObjectURL(blob);
  ui.gif.src = S.gifURL;
  ui.gif.width = o.w; ui.gif.height = o.h;
  const rows = [
    ['File size', fmtBytes(blob.size)],
    ['Dimensions', `${o.w} × ${o.h}`],
    ['Frames', pipe.written === o.ticks ? `${o.ticks.toLocaleString()} at ${o.fps} fps` : `${pipe.written.toLocaleString()} (repeats merged) at ${o.fps} fps`],
    ['Duration', fmtSec((o.end - o.start) / o.speed)],
    ['Palette', o.shared ? 'Shared, 255 colors' : 'Per frame, 255 colors'],
    ['Dither', { fs: 'Floyd–Steinberg', bayer: 'Bayer 8×8', none: 'Off' }[o.dither]],
    ['Encode time', `${secs.toFixed(1)} s · ${((o.end - o.start) / secs).toFixed(1)}× realtime`],
  ];
  ui.stats.replaceChildren();
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    ui.stats.append(dt, dd);
  }
  ui.saveNote.textContent = '';
  ui.result.hidden = false;
  ui.result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

const gifName = () => (S.file ? S.file.name.replace(/\.[^.]+$/, '') : 'clip') + '.gif';
ui.save.addEventListener('click', async () => {
  if (!S.blob) return;
  const name = gifName();
  const dl = await dlP;
  if (dl) {
    try { await dl.save({ filename: name, data: S.blob }); toast('Saved ' + name); }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') toast('Save cancelled');
      else if (code === 'rate_limited') toast('A save prompt is already open');
      else ui.saveNote.textContent = 'Saving is unavailable in this view. Right-click the GIF (long-press on a phone) and choose Save image.';
    }
    return;
  }
  const a = document.createElement('a');
  a.href = S.gifURL; a.download = name;
  document.body.append(a); a.click(); a.remove();
  ui.saveNote.textContent = 'If no download starts, right-click the GIF (long-press on a phone) and choose Save image.';
});
ui.again.addEventListener('click', () => { ui.result.hidden = true; ui.go.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
ui.go.addEventListener('click', convert);
ui.cancel.addEventListener('click', () => S.ctrl && S.ctrl.abort());

for (const b of document.querySelectorAll('.preset')) {
  b.addEventListener('click', () => {
    const q = PRESETS[b.dataset.preset];
    setWidth(q.width); ui.fps.value = String(q.fps); ui.speed.value = '1';
    setRadio('pal', q.pal); setRadio('dither', q.dither);
    if (S.srcFps && q.fps > S.srcFps + 0.5) {
      let best = ui.fps.options[0].value;
      for (const o of ui.fps.options) if (+o.value <= S.srcFps + 0.5) best = o.value;
      ui.fps.value = best;
    }
    updateReadout();
  });
}
for (const el of document.querySelectorAll('.panel select, .panel input[type="radio"]')) el.addEventListener('change', updateReadout);

// ----- file input / drag & drop -----
ui.file.addEventListener('change', () => { const f = ui.file.files[0]; ui.file.value = ''; if (f) loadFile(f); });
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
window.addEventListener('dragenter', (e) => { if (!hasFiles(e) || S.busy) return; e.preventDefault(); dragDepth++; ui.drop.hidden = false; });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) ui.drop.hidden = true; });
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; ui.drop.hidden = true;
  const f = e.dataTransfer.files[0];
  if (f && !S.busy) loadFile(f);
});

// ----- boot with the bundled sample -----
(async () => {
  try {
    const b64 = $('sample-b64').textContent.trim();
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    await loadFile(new File([u8], 'sample-mandelbrot.mp4', { type: 'video/mp4' }), true);
    if (!S.engine) { ui.empty.hidden = false; }
  } catch { ui.empty.hidden = false; }
})();

window.__fp = { S, convert, loadFile, plan };
})();
