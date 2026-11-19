/* Ganit core in plain JavaScript: tokenizer, model and tools. Runs in browsers and in Node.
 * A port of prepare.py's tokenizer, model.py's GPT (with KV cache), calc.py, qltools.py and
 * solve.generate. The quant tools are closed-form or tree implementations of the same formulas
 * QuantLib uses, checked against the Python versions by web/test_core.js.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------------ tokenizer (byte-level BPE)
  function bytesToUnicode() {
    const bs = [];
    for (let i = 33; i <= 126; i++) bs.push(i);
    for (let i = 161; i <= 172; i++) bs.push(i);
    for (let i = 174; i <= 255; i++) bs.push(i);
    const cs = bs.slice();
    let n = 0;
    for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
    const enc = new Array(256), dec = {};
    bs.forEach((b, i) => { const ch = String.fromCodePoint(cs[i]); enc[b] = ch; dec[ch] = b; });
    return [enc, dec];
  }
  const GPT2 = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
  const SPLIT = / ?<<| ?>>| ?=/g;

  class Tokenizer {
    constructor(json) {
      this.vocab = json.model.vocab;
      this.idToToken = [];
      for (const [t, id] of Object.entries(this.vocab)) this.idToToken[id] = t;
      this.special = {};
      for (const a of json.added_tokens) { this.special[a.id] = a.content; this.vocab[a.content] = a.id; this.idToToken[a.id] = a.content; }
      this.ranks = new Map();
      json.model.merges.forEach((m, i) => { const pair = Array.isArray(m) ? m : m.split(" "); this.ranks.set(pair[0] + "\u0001" + pair[1], i); });
      [this.byteEnc, this.byteDec] = bytesToUnicode();
      this.cache = new Map();
      this.utf8 = new TextEncoder();
    }
    pieces(text) {                                   // the three pre-tokenizers, in order
      let parts = [];
      let last = 0;
      for (const m of text.matchAll(SPLIT)) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        parts.push(m[0]);
        last = m.index + m[0].length;
      }
      if (last < text.length) parts.push(text.slice(last));
      const digits = [];
      for (const p of parts) {
        let buf = "";
        for (const ch of p) {
          if (/\p{N}/u.test(ch)) { if (buf) digits.push(buf); digits.push(ch); buf = ""; } else buf += ch;
        }
        if (buf) digits.push(buf);
      }
      const out = [];
      for (const p of digits) for (const m of p.matchAll(GPT2)) out.push(m[0]);
      return out;
    }
    bpe(word) {
      if (this.cache.has(word)) return this.cache.get(word);
      let syms = Array.from(word);
      while (syms.length > 1) {
        let best = -1, bestRank = Infinity;
        for (let i = 0; i < syms.length - 1; i++) {
          const r = this.ranks.get(syms[i] + "\u0001" + syms[i + 1]);
          if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
        }
        if (best < 0) break;
        const a = syms[best], b = syms[best + 1], merged = [];
        for (let i = 0; i < syms.length; i++) {
          if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) { merged.push(a + b); i++; } else merged.push(syms[i]);
        }
        syms = merged;
      }
      const ids = syms.map((s) => this.vocab[s]);
      this.cache.set(word, ids);
      return ids;
    }
    encode(text) {                                   // special tokens first, as Hugging Face tokenizers do
      if (!this.specialRe) {
        const names = Object.values(this.special).sort((a, b) => b.length - a.length);
        this.specialRe = new RegExp("(" + names.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")");
      }
      const ids = [];
      for (const part of text.split(this.specialRe)) {
        if (!part) continue;
        if (this.vocab[part] !== undefined && Object.values(this.special).includes(part)) ids.push(this.vocab[part]);
        else for (const id of this.encodePlain(part)) ids.push(id);
      }
      return ids;
    }
    encodePlain(text) {
      const ids = [];
      for (const p of this.pieces(text)) {
        let mapped = "";
        for (const b of this.utf8.encode(p)) mapped += this.byteEnc[b];
        for (const id of this.bpe(mapped)) ids.push(id);
      }
      return ids;
    }
    decode(ids) {
      let out = "", bytes = [];
      const flush = () => { if (bytes.length) { out += new TextDecoder().decode(new Uint8Array(bytes)); bytes = []; } };
      for (const id of ids) {
        if (this.special[id] !== undefined) { flush(); out += this.special[id]; continue; }
        for (const ch of this.idToToken[id]) bytes.push(this.byteDec[ch]);
      }
      flush();
      return out;
    }
  }

  // ------------------------------------------------------------------ model (our GPT)
  function halfToFloat(h) {
    const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  }

  class GPT {
    constructor(manifest, halfBuffer) {          // halfBuffer: Uint16Array of all weights (fp16)
      const c = manifest.config;
      this.cfg = c;
      this.d = c.d_model; this.L = c.n_layer; this.H = c.n_head; this.hd = c.d_model / c.n_head; this.ffn = c.ffn_hidden; this.V = c.vocab_size;
      const table = new Float32Array(65536);
      for (let i = 0; i < 65536; i++) table[i] = halfToFloat(i);
      this.w = {};
      for (const t of manifest.tensors) {
        const a = new Float32Array(t.size);
        for (let i = 0; i < t.size; i++) a[i] = table[halfBuffer[t.offset + i]];
        this.w[t.name] = a;
      }
      const half = this.hd / 2;
      this.inv = new Float64Array(half);
      for (let i = 0; i < half; i++) this.inv[i] = 1 / Math.pow(c.rope_base, (2 * i) / this.hd);
      this.x = new Float32Array(this.d); this.h = new Float32Array(this.d); this.qkv = new Float32Array(3 * this.d);
      this.att = new Float32Array(this.d); this.o = new Float32Array(this.d); this.gu = new Float32Array(2 * this.ffn);
      this.act = new Float32Array(this.ffn); this.scores = new Float32Array(c.max_seq); this.logits = new Float32Array(this.V);
    }
    newCache() {
      const n = this.cfg.max_seq * this.d;
      return Array.from({ length: this.L }, () => ({ k: new Float32Array(n), v: new Float32Array(n) }));
    }
    static matvec(out, W, x, rows, cols) {
      for (let r = 0; r < rows; r++) {
        let s = 0;
        const base = r * cols;
        for (let c = 0; c < cols; c++) s += W[base + c] * x[c];
        out[r] = s;
      }
    }
    static rmsnorm(out, x, w) {
      let ss = 0;
      for (let i = 0; i < x.length; i++) ss += x[i] * x[i];
      const k = 1 / Math.sqrt(ss / x.length + 1e-6);
      for (let i = 0; i < x.length; i++) out[i] = x[i] * k * w[i];
    }
    rope(vec, offset, pos) {
      const half = this.hd / 2;
      for (let i = 0; i < half; i++) {
        const ang = pos * this.inv[i], c = Math.cos(ang), s = Math.sin(ang);
        const a = vec[offset + i], b = vec[offset + i + half];
        vec[offset + i] = a * c - b * s;
        vec[offset + i + half] = a * s + b * c;
      }
    }
    forward(token, pos, cache) {
      const { d, H, hd, ffn, w } = this;
      const x = this.x;
      x.set(w["tok.weight"].subarray(token * d, (token + 1) * d));
      const scale = 1 / Math.sqrt(hd);
      for (let l = 0; l < this.L; l++) {
        const p = `blocks.${l}.`;
        GPT.rmsnorm(this.h, x, w[p + "norm1.weight"]);
        GPT.matvec(this.qkv, w[p + "attn.qkv.weight"], this.h, 3 * d, d);
        for (let hh = 0; hh < H; hh++) { this.rope(this.qkv, hh * hd, pos); this.rope(this.qkv, d + hh * hd, pos); }
        const K = cache[l].k, Vc = cache[l].v;
        K.set(this.qkv.subarray(d, 2 * d), pos * d);
        Vc.set(this.qkv.subarray(2 * d, 3 * d), pos * d);
        for (let hh = 0; hh < H; hh++) {
          const qo = hh * hd;
          let mx = -Infinity;
          for (let t = 0; t <= pos; t++) {
            let s = 0;
            const ko = t * d + qo;
            for (let i = 0; i < hd; i++) s += this.qkv[qo + i] * K[ko + i];
            s *= scale;
            this.scores[t] = s;
            if (s > mx) mx = s;
          }
          let sum = 0;
          for (let t = 0; t <= pos; t++) { const e = Math.exp(this.scores[t] - mx); this.scores[t] = e; sum += e; }
          for (let i = 0; i < hd; i++) this.att[qo + i] = 0;
          for (let t = 0; t <= pos; t++) {
            const pw = this.scores[t] / sum, vo = t * d + qo;
            for (let i = 0; i < hd; i++) this.att[qo + i] += pw * Vc[vo + i];
          }
        }
        GPT.matvec(this.o, w[p + "attn.out.weight"], this.att, d, d);
        for (let i = 0; i < d; i++) x[i] += this.o[i];
        GPT.rmsnorm(this.h, x, w[p + "norm2.weight"]);
        GPT.matvec(this.gu, w[p + "mlp.gate_up.weight"], this.h, 2 * ffn, d);
        for (let i = 0; i < ffn; i++) { const g = this.gu[i]; this.act[i] = (g / (1 + Math.exp(-g))) * this.gu[ffn + i]; }
        GPT.matvec(this.o, w[p + "mlp.down.weight"], this.act, d, ffn);
        for (let i = 0; i < d; i++) x[i] += this.o[i];
      }
      GPT.rmsnorm(this.h, x, w["norm.weight"]);
      GPT.matvec(this.logits, w["tok.weight"], this.h, this.V, d);
      return this.logits;
    }
  }

  // ------------------------------------------------------------------ maths helpers
  const SQRT2PI = Math.sqrt(2 * Math.PI);
  function erfc(z) {                               // accurate to ~1e-14
    if (z < 0) return 2 - erfc(-z);
    if (z < 3) {                                   // Taylor series of erf
      let sum = z, term = z, n = 0;
      while (Math.abs(term) > 1e-17 * Math.abs(sum)) { n++; term *= -z * z / n; sum += term / (2 * n + 1); if (n > 200) break; }
      return 1 - (2 / Math.sqrt(Math.PI)) * sum;
    }
    let f = z, C = z, D = 0, i = 0;                 // continued fraction (modified Lentz)
    const tiny = 1e-300;
    do {
      i++;
      const a = i / 2;
      D = z + a * D; if (Math.abs(D) < tiny) D = tiny; D = 1 / D;
      C = z + a / C; if (Math.abs(C) < tiny) C = tiny;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    } while (i < 500);
    return Math.exp(-z * z) / Math.sqrt(Math.PI) / f;
  }
  const N = (x) => 0.5 * erfc(-x / Math.SQRT2);
  const pdf = (x) => Math.exp(-0.5 * x * x) / SQRT2PI;
  function invN(p) {                               // Acklam, then two Halley steps
    if (!(p > 0 && p < 1)) throw new Error("invN needs a probability strictly between 0 and 1");
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    let x;
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    for (let k = 0; k < 2; k++) { const e = N(x) - p, u = e * SQRT2PI * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
    return x;
  }

  // ------------------------------------------------------------------ calculator (calc.py)
  function fmt(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9) { const r = Math.round(v); return String(r === 0 ? 0 : r); }
    let t = v.toFixed(Math.abs(v) >= 10 ? 2 : 4).replace(/0+$/, "").replace(/\.$/, "");
    return t === "-0" || t === "" ? "0" : t;
  }
  const FUNCS = {
    ln: [1, 1, (x) => { if (x <= 0) throw new Error("ln needs a positive number"); return Math.log(x); }],
    exp: [1, 1, Math.exp],
    sqrt: [1, 1, (x) => { if (x < 0) throw new Error("sqrt needs a number that is not negative"); return Math.sqrt(x); }],
    abs: [1, 1, Math.abs], N: [1, 1, N], invN: [1, 1, invN],
    max: [2, 8, (...a) => Math.max(...a)], min: [2, 8, (...a) => Math.min(...a)],
  };
  function evaluate(expr) {
    const src = expr.replace(/\*\*/g, "^");
    let i = 0;
    const peek = () => { while (src[i] === " ") i++; return src[i]; };
    const fail = () => { throw new Error("only numbers, + - * / ^ ( ), pi and ln exp sqrt abs max min N invN are allowed"); };
    function atom() {
      const ch = peek();
      if (ch === "(") { i++; const v = sum(); if (peek() !== ")") fail(); i++; return v; }
      const num = /^(\d+\.?\d*(e[+-]?\d+)?|\.\d+(e[+-]?\d+)?)/i.exec(src.slice(i));
      if (num) { i += num[0].length; return parseFloat(num[0]); }
      const name = /^[A-Za-z_]\w*/.exec(src.slice(i));
      if (name) {
        i += name[0].length;
        if (name[0] === "pi") return Math.PI;
        const f = FUNCS[name[0]];
        if (!f || peek() !== "(") fail();
        i++;
        const args = [];
        if (peek() !== ")") { args.push(sum()); while (peek() === ",") { i++; args.push(sum()); } }
        if (peek() !== ")") fail();
        i++;
        if (args.length < f[0] || args.length > f[1]) throw new Error(`${name[0]} takes ${f[0]} to ${f[1]} arguments`);
        return f[2](...args);
      }
      fail();
    }
    function power() {
      const base = atom();
      if (peek() === "^") {
        i++;
        const e = unary();
        if (Math.abs(e) > 64 || Math.abs(base) > 1e9) throw new Error("power too large");
        return Math.pow(base, e);
      }
      return base;
    }
    function unary() {
      const ch = peek();
      if (ch === "-") { i++; return -unary(); }
      if (ch === "+") { i++; return unary(); }
      return power();
    }
    function prod() {
      let v = unary();
      for (;;) {
        const ch = peek();
        if (ch === "*") { i++; v *= unary(); }
        else if (ch === "/") { i++; const d = unary(); if (d === 0) throw new Error("division by zero"); v /= d; }
        else return v;
      }
    }
    function sum() {
      let v = prod();
      for (;;) {
        const ch = peek();
        if (ch === "+") { i++; v += prod(); } else if (ch === "-") { i++; v -= prod(); } else return v;
      }
    }
    const v = sum();
    if (peek() !== undefined) fail();
    if (!isFinite(v)) throw new Error("result is not a finite number");
    return v;
  }

  // ------------------------------------------------------------------ QuantLib tools (qltools.py)
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };
  const COMP = { annual: ["c", 1], semiannual: ["c", 2], quarterly: ["c", 4], monthly: ["c", 12], continuous: ["cont", 1], simple: ["s", 1] };
  const comp = (n) => { need(COMP[n], "unknown compounding"); return COMP[n]; };
  function growth(rate, t, name) { const [k, f] = comp(name); return k === "cont" ? Math.exp(rate * t) : k === "s" ? 1 + rate * t : Math.pow(1 + rate / f, f * t); }
  function impliedRate(g, t, name) { const [k, f] = comp(name); return k === "cont" ? Math.log(g) / t : k === "s" ? (g - 1) / t : (Math.pow(g, 1 / (f * t)) - 1) * f; }
  function black(kind, F, K, T, disc, vol) {
    need(kind === "call" || kind === "put", "kind must be call or put");
    const sd = vol * Math.sqrt(T), d1 = (Math.log(F / K) + 0.5 * sd * sd) / sd, d2 = d1 - sd;
    const w = kind === "call" ? 1 : -1;
    const alpha = w * N(w * d1), beta = w * N(w * d2);
    return { value: disc * (F * alpha - K * beta), alpha, beta, d1, d2, disc, F, sd };
  }
  function bs(kind, S, K, T, r, vol, q) {
    need(S > 0 && K > 0 && T > 0 && vol > 0, "S, K, T and vol must be positive");
    return black(kind, S * Math.exp((r - q) * T), K, T, Math.exp(-r * T), vol);
  }
  function maturityT(T) { need(T > 0, "T must be positive"); const m = T * 12; return Math.abs(m - Math.round(m)) < 1e-9 ? Math.round(m) / 12 : Math.max(1, Math.round(T * 365)) / 365; }
  function bondFlows(face, coupon, years, freq) {
    need([1, 2, 4, 12].includes(freq), "freq must be 1, 2, 4 or 12 payments a year");
    const months = years * 12;
    need(face > 0 && months > 0 && Math.abs(months - Math.round(months)) < 1e-9, "years must be whole months");
    need(Math.round(months) % (12 / freq) === 0, "years must be a whole number of coupon periods");
    const n = Math.round(years * freq), flows = [];
    for (let i = 1; i <= n; i++) flows.push([i / freq, face * coupon / freq + (i === n ? face : 0)]);
    return flows;
  }
  function bondPV(flows, y, f) { let p = 0; for (const [t, c] of flows) p += c * Math.pow(1 + y / f, -f * t); return p; }
  function vasP(a, b, sigma, r, T) { const B = (1 - Math.exp(-a * T)) / a; return Math.exp((b - sigma * sigma / (2 * a * a)) * (B - T) - sigma * sigma * B * B / (4 * a)) * Math.exp(-B * r); }
  function annuity(T, freq, rate, c) {
    const n = T * freq;
    need(Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) > 0, "T must be a whole number of payment periods");
    let s = 0, last = 0;
    for (let i = 1; i <= Math.round(n); i++) { last = 1 / growth(rate, i / freq, c); s += last; }
    return [s / freq, last];
  }
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const TOOLS = {
    european_option: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => bs(k, S, K, T, r, v, q).value],
    delta: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => Math.exp(-q * T) * bs(k, S, K, T, r, v, q).alpha],
    gamma: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => { const b = bs(k, S, K, T, r, v, q); return Math.exp(-q * T) * pdf(b.d1) / (S * v * Math.sqrt(T)); }],
    vega: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => { const b = bs(k, S, K, T, r, v, q); return S * Math.exp(-q * T) * pdf(b.d1) * Math.sqrt(T) / 100; }],
    theta: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => {
      const b = bs(k, S, K, T, r, v, q), delta = Math.exp(-q * T) * b.alpha, gamma = Math.exp(-q * T) * pdf(b.d1) / (S * v * Math.sqrt(T));
      return (r * b.value - (r - q) * S * delta - 0.5 * v * v * S * S * gamma) / 365; }],
    rho: [["kind", "S", "K", "T", "r", "vol", "q"], { q: 0 }, (k, S, K, T, r, v, q) => { const b = bs(k, S, K, T, r, v, q); return T * b.disc * K * b.beta / 100; }],
    implied_vol: [["kind", "price", "S", "K", "T", "r", "q"], { q: 0 }, (k, price, S, K, T, r, q) => {
      need(price > 0 && S > 0 && K > 0 && T > 0, "price, S, K and T must be positive");
      let lo = 1e-6, hi = 5;
      const f = (v) => bs(k, S, K, T, r, v, q).value - price;
      need(f(lo) < 0 && f(hi) > 0, "no volatility gives that price");
      for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
      return (lo + hi) / 2; }],
    black76_option: [["kind", "F", "K", "T", "r", "vol"], {}, (k, F, K, T, r, v) => { need(F > 0 && K > 0 && T > 0 && v > 0, "F, K, T and vol must be positive"); return black(k, F, K, T, Math.exp(-r * T), v).value; }],
    fx_option: [["kind", "S", "K", "T", "rd", "rf", "vol"], {}, (k, S, K, T, rd, rf, v) => bs(k, S, K, T, rd, v, rf).value],
    american_option: [["kind", "S", "K", "T", "r", "vol", "q", "steps"], { q: 0, steps: 500 }, (kind, S, K, T, r, vol, q, steps) => {
      need(S > 0 && K > 0 && vol > 0 && steps >= 10 && steps <= 5000, "S, K, vol must be positive; steps 10 to 5000");
      need(kind === "call" || kind === "put", "kind must be call or put");
      const Te = maturityT(T), n = Math.round(steps), dt = Te / n, dx = vol * Math.sqrt(dt);
      const pu = 0.5 + 0.5 * ((r - q - 0.5 * vol * vol) * dt) / dx, pd = 1 - pu, disc = Math.exp(-r * dt);
      const w = kind === "call" ? 1 : -1, vals = new Float64Array(n + 1);
      for (let j = 0; j <= n; j++) vals[j] = Math.max(w * (S * Math.exp((2 * j - n) * dx) - K), 0);
      for (let i = n - 1; i >= 0; i--) for (let j = 0; j <= i; j++) {
        const cont = disc * (pu * vals[j + 1] + pd * vals[j]);
        vals[j] = Math.max(cont, w * (S * Math.exp((2 * j - i) * dx) - K));
      }
      return vals[0]; }],
    convert_rate: [["rate", "source", "target"], {}, (rate, s, t) => impliedRate(growth(rate, 1, s), 1, t)],
    discount_factor: [["rate", "T", "comp"], { comp: "continuous" }, (rate, T, c) => { need(T >= 0, "T must not be negative"); return 1 / growth(rate, T, c); }],
    forward_rate: [["r1", "T1", "r2", "T2", "comp"], { comp: "continuous" }, (r1, T1, r2, T2, c) => { need(T1 >= 0 && T1 < T2, "need 0 <= T1 < T2"); return impliedRate(growth(r2, T2, c) / growth(r1, T1, c), T2 - T1, c); }],
    year_fraction: [["start", "end", "basis"], { basis: "act365" }, (a, b, basis) => {
      const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
      const days = (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000;
      if (basis === "act365") return days / 365;
      if (basis === "act360") return days / 360;
      need(basis === "thirty360", "basis must be act365, act360 or thirty360");
      let dd1 = d1, dd2 = d2;
      if (dd1 === 31) dd1 = 30;
      if (dd2 === 31 && dd1 >= 30) dd2 = 30;
      return (360 * (y2 - y1) + 30 * (m2 - m1) + (dd2 - dd1)) / 360; }],
    bond_price: [["face", "coupon", "years", "freq", "ytm"], {}, (face, c, y, f, ytm) => bondPV(bondFlows(face, c, y, f), ytm, f)],
    bond_ytm: [["face", "coupon", "years", "freq", "price"], {}, (face, c, y, f, price) => {
      const fl = bondFlows(face, c, y, f);
      let lo = -0.99 * f, hi = 5;
      for (let it = 0; it < 300; it++) { const mid = (lo + hi) / 2; if (bondPV(fl, mid, f) > price) lo = mid; else hi = mid; }
      return (lo + hi) / 2; }],
    bond_duration: [["face", "coupon", "years", "freq", "ytm", "kind"], { kind: "modified" }, (face, c, y, f, ytm, kind) => {
      need(kind === "modified" || kind === "macaulay", "kind must be modified or macaulay");
      const fl = bondFlows(face, c, y, f), P = bondPV(fl, ytm, f);
      let s = 0; for (const [t, cf] of fl) s += t * cf * Math.pow(1 + ytm / f, -f * t);
      return kind === "macaulay" ? s / P : s / P / (1 + ytm / f); }],
    bond_convexity: [["face", "coupon", "years", "freq", "ytm"], {}, (face, c, y, f, ytm) => {
      const fl = bondFlows(face, c, y, f), P = bondPV(fl, ytm, f);
      let s = 0; for (const [t, cf] of fl) s += cf * Math.pow(1 + ytm / f, -f * t) * t * (f * t + 1) / (f * Math.pow(1 + ytm / f, 2));
      return s / P; }],
    zero_bond_price: [["face", "T", "ytm", "comp"], { comp: "annual" }, (face, T, ytm, c) => face / growth(ytm, T, c)],
    vasicek_zcb: [["a", "b", "sigma", "r", "T", "face"], { face: 100 }, (a, b, s, r, T, face) => { need(a > 0 && s > 0 && T > 0, "a, sigma and T must be positive"); return face * vasP(a, b, s, r, T); }],
    cir_zcb: [["a", "b", "sigma", "r", "T", "face"], { face: 100 }, (a, b, s, r, T, face) => {
      need(a > 0 && b > 0 && s > 0 && r >= 0 && T > 0, "a, b, sigma, T positive and r not negative");
      const h = Math.sqrt(a * a + 2 * s * s), den = (h + a) * (Math.exp(h * T) - 1) + 2 * h;
      const A = Math.pow(2 * h * Math.exp((a + h) * T / 2) / den, 2 * a * b / (s * s)), B = 2 * (Math.exp(h * T) - 1) / den;
      return face * A * Math.exp(-B * r); }],
    simulate_quantile: [["model", "a", "b", "sigma", "r0", "t", "T", "q", "paths", "face", "seed"], { paths: 100000, face: 100, seed: 7 }, (model, a, b, s, r0, t, T, q, paths, face, seed) => {
      need(model === "vasicek", "only the vasicek model can be simulated so far");
      need(t > 0 && t < T && q > 0 && q < 1 && paths >= 1000 && paths <= 200000, "need 0 < t < T, 0 < q < 1, 1000 to 200000 paths");
      const rnd = mulberry(seed * 7919 + 1), e = Math.exp(-a * t), sd = s * Math.sqrt((1 - Math.exp(-2 * a * t)) / (2 * a));
      const prices = new Float64Array(paths);
      for (let i = 0; i < paths; i++) {
        const z = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
        prices[i] = face * vasP(a, b, s, r0 * e + b * (1 - e) + sd * z, T - t);
      }
      prices.sort();
      return prices[Math.floor(q * paths)]; }],
    swap_par_rate: [["T", "freq", "rate", "comp"], { comp: "continuous" }, (T, f, rate, c) => { const [an, last] = annuity(T, f, rate, c); return (1 - last) / an; }],
    swap_value: [["notional", "fixed", "T", "freq", "rate", "side", "comp"], { side: "payer", comp: "continuous" }, (nt, fixed, T, f, rate, side, c) => {
      need(side === "payer" || side === "receiver", "side must be payer or receiver");
      const [an, last] = annuity(T, f, rate, c), v = nt * ((1 - last) - fixed * an);
      return side === "payer" ? v : -v; }],
    swap_dv01: [["notional", "T", "freq", "rate", "comp"], { comp: "continuous" }, (nt, T, f, rate, c) => nt * annuity(T, f, rate, c)[0] * 1e-4],
    var_normal: [["value", "vol", "conf", "days"], { days: 1 }, (val, vol, conf, days) => { need(conf > 0.5 && conf < 1 && vol > 0 && days > 0, "need 0.5 < conf < 1, vol > 0, days > 0"); return val * vol * Math.sqrt(days) * invN(conf); }],
    es_normal: [["value", "vol", "conf", "days"], { days: 1 }, (val, vol, conf, days) => { need(conf > 0.5 && conf < 1 && vol > 0 && days > 0, "need 0.5 < conf < 1, vol > 0, days > 0"); return val * vol * Math.sqrt(days) * pdf(invN(conf)) / (1 - conf); }],
    var_historical: [["returns", "conf", "value"], { value: 1 }, (rets, conf, val) => {
      need(Array.isArray(rets) && rets.length >= 5, "returns must be a list of at least 5 numbers");
      need(conf > 0.5 && conf < 1, "need 0.5 < conf < 1");
      const losses = rets.map((x) => -x).sort((x, y) => y - x);
      const k = Math.max(1, Math.ceil((1 - conf) * losses.length - 1e-9));
      return val * losses[k - 1]; }],
  };
  const WORDS = new Set(["call", "put", "modified", "macaulay", "vasicek", "payer", "receiver", "annual", "semiannual", "quarterly",
    "monthly", "continuous", "simple", "act365", "act360", "thirty360"]);

  function qlCall(expr) {
    const m = /^QL\.(\w+)\((.*)\)$/s.exec(expr.trim());
    need(m, "expected QL.tool_name(...)");
    const tool = TOOLS[m[1]];
    need(tool, "unknown QuantLib tool: " + m[1]);
    const src = m[2];
    let i = 0;
    const ws = () => { while (src[i] === " ") i++; };
    function value() {
      ws();
      if (src[i] === "[") {
        i++; const list = [];
        ws();
        if (src[i] !== "]") for (;;) { const v = value(); need(typeof v === "number", "lists may only hold numbers"); list.push(v); ws(); if (src[i] === ",") { i++; continue; } break; }
        ws(); need(src[i] === "]", "unclosed list"); i++; return list;
      }
      if (src[i] === "'" || src[i] === '"') { const q = src[i]; const j = src.indexOf(q, i + 1); need(j > i, "unclosed string"); const s = src.slice(i + 1, j); i = j + 1; return s; }
      const num = /^-?(\d+\.?\d*(e[+-]?\d+)?|\.\d+)/i.exec(src.slice(i));
      if (num) { i += num[0].length; return parseFloat(num[0]); }
      const w = /^[A-Za-z_]\w*/.exec(src.slice(i));
      need(w && WORDS.has(w[0]), "arguments must be numbers, lists of numbers, dates or words such as call and put");
      i += w[0].length; return w[0];
    }
    const [params, defaults, fn] = tool, args = {}, pos = [];
    ws();
    while (i < src.length) {
      ws();
      const kw = /^([A-Za-z_]\w*)\s*=/.exec(src.slice(i));
      if (kw && !WORDS.has(kw[1])) { i += kw[0].length; args[kw[1]] = value(); }
      else pos.push(value());
      ws();
      if (src[i] === ",") { i++; continue; }
      need(i >= src.length, "could not read the arguments");
    }
    const call = params.map((p, k) => {
      if (k < pos.length) return pos[k];
      if (p in args) return args[p];
      need(p in defaults, `wrong arguments for ${m[1]}: missing ${p}`);
      return defaults[p];
    });
    for (const k of Object.keys(args)) need(params.includes(k), `wrong arguments for ${m[1]}: unknown ${k}`);
    const v = fn(...call);
    need(isFinite(v), "result is not a finite number");
    return v;
  }

  // ------------------------------------------------------------------ tool calls while writing (tools.py)
  function pendingCall(text) {
    if (!text.endsWith("=")) return null;
    const start = text.lastIndexOf("<<"), end = text.lastIndexOf(">>");
    if (start === -1 || start < end) return null;
    const expr = text.slice(start + 2, -1);
    if (!expr || expr.includes("\n") || (expr.match(/\(/g) || []).length !== (expr.match(/\)/g) || []).length) return null;
    return expr;
  }
  function runTool(expr) {
    expr = expr.trim();
    const v = expr.startsWith("QL.") ? qlCall(expr) : evaluate(expr);
    const r = fmt(v);
    return `${r}>>${r}`;
  }

  // ------------------------------------------------------------------ generation (solve.generate)
  const ANSWER = /####\s*(-?[\d,]*\.?\d+)/, ANSWER_LINE = /####\s*-?[\d,]*\.?\d+\s*\n/;
  function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }
  async function* generate(model, tok, question, opts = {}) {
    const maxNew = opts.maxNew || 900, yieldEvery = opts.yieldEvery || 0;
    const ids = tok.encode(`Q: ${question}\nA:`), eos = tok.vocab["<|eos|>"];
    const cache = model.newCache();
    if (ids.length >= model.cfg.max_seq) { yield { type: "end", text: "", answer: null, calls: [], error: "question too long" }; return; }
    let logits;
    for (let i = 0; i < ids.length; i++) { logits = model.forward(ids[i], i, cache); if (yieldEvery && i % yieldEvery === 0) await null; }
    let pos = ids.length, out = [], forced = [], calls = [], error = null, shown = "";
    while (out.length < maxNew && pos < model.cfg.max_seq) {
      const fromTool = forced.length > 0;
      let nxt;
      if (fromTool) nxt = forced.shift(); else { nxt = argmax(logits); if (nxt === eos) break; }
      out.push(nxt);
      logits = model.forward(nxt, pos, cache);
      pos++;
      const text = tok.decode(out);
      if (fromTool) { if (!forced.length) shown = text; continue; }
      const delta = text.startsWith(shown) ? text.slice(shown.length) : text;
      if (delta) { yield { type: "text", text: delta }; shown = text; }
      if (text.includes("\nQ:") || ANSWER_LINE.test(text)) break;
      const expr = pendingCall(text);
      if (expr !== null) {
        let result;
        try { result = runTool(expr); } catch (e) { error = `bad tool call <<${expr}=: ${String(e.message).slice(0, 120)}`; break; }
        calls.push(expr);
        forced = tok.encode(result);
        yield { type: "tool", expr, result };
      }
    }
    const text = tok.decode(out).split("\nQ:")[0], m = ANSWER.exec(text);
    yield { type: "end", text, answer: m ? m[1].replace(/,/g, "") : null, calls, error };
  }

  // ---------- grounding: did Ganit read the question? ----------
  // The inputs Ganit says it was given (its "Known:" line, or the first step of an everyday-maths
  // answer) must appear in the question: as written, as a percentage or basis points turned into
  // a decimal, or as a common constant. Inputs from nowhere mean it answered a different question.
  const CONSTANTS = [0, 0.5, 1, 2, 3, 4, 7, 9.8, 9.81, 12, 24, 52, 60, 100, 252, 360, 365, 1000, 3600];
  function numbersIn(s) {
    const out = [];
    for (const m of s.matchAll(/[A-Za-z_]?\d[\d,]*(?:\.\d+)?/g)) {
      if (/^[A-Za-z_]/.test(m[0])) continue;               // part of a name such as d1
      const v = parseFloat(m[0].replace(/,/g, ""));
      if (isFinite(v)) out.push(v);
    }
    return out;
  }
  function givens(text) {
    const known = text.match(/^Known:(.*)$/m);
    if (known) return known[1];
    const work = text.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim();
    const first = work.split("\n")[0];
    return first.includes("<<") ? first.slice(0, first.indexOf("<<")) : first;
  }
  function unexplained(question, text) {
    const known = [...CONSTANTS];
    for (const v of numbersIn(question)) known.push(v, v / 100, v / 10000);
    const ok = (x) => known.some((k) => Math.abs(x - k) <= Math.max(1e-9, 5e-4 * Math.abs(k)));
    return [...new Set(numbersIn(givens(text)).filter((x) => !ok(x)))];
  }

  const api = { Tokenizer, GPT, evaluate, fmt, qlCall, runTool, pendingCall, generate, N, invN, TOOLS, unexplained };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Ganit = api;
})(typeof self !== "undefined" ? self : this);
