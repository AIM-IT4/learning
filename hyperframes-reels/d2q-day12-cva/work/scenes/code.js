      // ---- code: the light code editor under the chart card (x 60-1020, y 1056-1630). A title bar (three muted dots, the
      // file name, "python"), 16 numbered rows (numbers always visible) and an output console strip under a dashed divider.
      // The rows hold work/cva_reel.py exactly (CODE, inlined by tools/compose.py), each pre-placed at its final line number
      // and typed when the narration reaches it (SCHED, from tools/timing.py). Light syntax theme in brand colours:
      // keywords blueD bold, function names after def ink bold, numbers greenD, comments steel, the rest ink. A brand-blue
      // block caret types along and blinks when idle. Active lines get a blueL row tint and a 4 px brand-blue bar at the left
      // edge; in walk-through moments the other lines drop to ~40 %; token underlines are 3 px brand blue. In the hook the
      // finished file shows at 35 % from frame 1 and brightens top to bottom on "sixteen"; at ~vo 13.3 it erases upward.
      const g = document.getElementById("code-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba, KC } = K;
      const st = { t: 0 };
      const FS = 21, LH = 29, X0 = 142, NX = 116, CON_Y = 1609, COMMENT = "#8592a6";
      const ROW0 = KC.y + KC.bar + 8;                       // the top of row 1
      const rowTop = (i) => ROW0 + (i - 1) * LH, rowBase = (i) => rowTop(i) + 22;
      const KW = new Set(["import", "as", "def", "return"]);
      // each line as coloured tokens [{ s, c, wt, a, b }] (a, b: its columns)
      function lex(line) {
        const out = [], hash = line.indexOf("#"), code = hash >= 0 ? line.slice(0, hash) : line;
        const re = /([A-Za-z_][A-Za-z0-9_]*)|(\d[\d_]*(?:\.\d+)?)|(\s+)|(.)/g;
        let m, afterDef = false;
        while ((m = re.exec(code))) {
          const s = m[0], a = m.index; let c = C.ink, wt = 400;
          if (m[1]) { if (KW.has(s)) { c = C.blueD; wt = 700; } else if (afterDef) wt = 700; afterDef = s === "def"; }
          else if (m[2]) { c = C.greenD; afterDef = false; }
          else if (!m[3]) afterDef = false;
          out.push({ s, c, wt, a, b: a + s.length });
        }
        if (hash >= 0) out.push({ s: line.slice(hash), c: COMMENT, wt: 400, a: hash, b: line.length });
        return out;
      }
      const LEX = CODE.map(lex);
      const TY = {}; SCHED.type.forEach(([l, a, b]) => (TY[l] = [a, b]));
      const IND = CODE.map((s) => s.match(/^ */)[0].length);
      const eraseAt = (i) => SCHED.erase + (16 - i) * 0.03;      // line 16 first, upward, 30 ms apart
      // how many characters of line i show at film time T
      function typed(i, T) {
        const L = CODE[i - 1].length;
        if (T < eraseAt(i)) return L;
        if (T < eraseAt(i) + 0.12) return Math.round(L * (1 - (T - eraseAt(i)) / 0.12));
        const [a, b] = TY[i];
        if (T < a) return 0;
        if (T >= b) return L;
        return IND[i - 1] + Math.floor((L - IND[i - 1]) * (T - a) / (b - a));
      }
      // the active rows at T, and the entry before (for the 0.25 s change)
      function activeAt(T) {
        let k = -1; SCHED.active.forEach((e, i) => { if (T >= e[0]) k = i; });
        const none = [0, [], 0], cur = k >= 0 ? SCHED.active[k] : none, prev = k >= 1 ? SCHED.active[k - 1] : none;
        return { t0: cur[0], lines: cur[1], dim: cur[2], plines: prev[1], pdim: prev[2], u: k >= 0 ? eo(clamp((T - cur[0]) / 0.25)) : 1 };
      }
      function lineAlpha(i, T, A) {
        if (T < SCHED.erase) return lerp(SCHED.preview, 1, eo(clamp((T - SCHED.brighten - (i - 1) * 0.03) / 0.18)));
        const tgt = (dim, act) => (dim && !act ? 0.4 : 1);
        return lerp(tgt(A.pdim, A.plines.includes(i)), tgt(A.dim, A.lines.includes(i)), A.u);
      }
      function drawLine(i, n, a, CW) {
        if (n <= 0 || a <= 0) return;
        const y = rowBase(i);
        for (const tk of LEX[i - 1]) {
          if (tk.a >= n) break;
          const s = n >= tk.b ? tk.s : tk.s.slice(0, n - tk.a);
          if (!s.trim()) continue;
          K.text(g, s, X0 + tk.a * CW, y, { size: FS, mono: true, wt: tk.wt, c: tk.c, a });
        }
      }
      function caret(T, CW) {
        let line = 16, col = CODE[15].length, solid = false;
        if (T >= SCHED.erase && T < eraseAt(1) + 0.12) {
          for (let i = 16; i >= 1; i--) if (T >= eraseAt(i)) { line = i; col = typed(i, T); }
          solid = true;
        } else if (T >= SCHED.erase) {
          let cur = null, last = null;
          for (const [l, a, b] of SCHED.type) { if (T >= a && T < b) cur = l; if (T >= b && (!last || b > last[1])) last = [l, b]; }
          if (cur) { line = cur; col = typed(cur, T); solid = true; }
          else if (last) { line = last[0]; col = CODE[last[0] - 1].length; }
          else { line = 1; col = 0; }
        }
        if (!solid && Math.floor(T / 0.53) % 2 === 1) return;
        g.fillStyle = rgba(C.blue, 0.9); g.fillRect(X0 + col * CW + 1, rowTop(line) + 4, CW - 1, LH - 8);
      }
      // the console strip: ">>> command" types in ~0.3 s, the result appears as if run
      function consoleLine(T) {
        let s = null, t0 = 0; for (const [a, v] of SCHED.con) if (T >= a) { s = v; t0 = a; }
        const sz = 20, cw = K.tw(g, "0", sz, true), x = 90;
        K.text(g, ">>>", x, CON_Y, { size: sz, mono: true, c: C.steel });
        if (!s) return;
        const body = s.slice(4); let cmd = body, res = "", com = "";
        const ai = body.indexOf("  →  ");
        if (ai >= 0) { cmd = body.slice(0, ai); res = body.slice(ai); } else res = body.slice(cmd.length);
        const hi = (ai >= 0 ? res : body).indexOf("   #");
        if (ai >= 0) { if (hi >= 0) { com = res.slice(hi); res = res.slice(0, hi); } }
        else if (hi >= 0) { cmd = body.slice(0, hi); com = body.slice(hi); res = ""; }
        const u = T - t0, nc = Math.min(cmd.length, Math.floor(cmd.length * clamp(u / 0.3)));
        let px = x + 4 * cw;
        K.text(g, cmd.slice(0, nc), px, CON_Y, { size: sz, mono: true, c: C.ink }); px += cmd.length * cw;
        const kr = clamp((u - 0.42) / 0.12);
        if (kr > 0) {
          if (res) {
            const arrow = res.indexOf("→"), val = res.slice(arrow + 1);
            K.text(g, res.slice(0, arrow + 1), px, CON_Y, { size: sz, mono: true, c: C.steel, a: kr });
            K.text(g, val, px + (arrow + 1) * cw, CON_Y, { size: sz, mono: true, wt: 700, c: C.greenD, a: kr }); px += res.length * cw;
          }
          if (com) K.text(g, com, px, CON_Y, { size: sz, mono: true, c: COMMENT, a: kr });
        }
        if (u < 0.42) { g.fillStyle = rgba(C.blue, 0.9); g.fillRect(x + (4 + nc) * cw + 1, CON_Y - 17, cw - 1, 22); }
      }
      function badge(T) {
        for (const [a, b] of SCHED.badge) {
          if (T < a || T > b + 0.25) continue;
          const k = clamp((T - a) / 0.3), out = clamp((T - b) / 0.2), s = CODE.length + " lines", sz = 16;
          const w = K.tw(g, s, sz, true, 0.5, 700) + 26, h = 26, x = 316, y = KC.y + KC.bar / 2;
          g.save(); g.globalAlpha *= clamp(k * 3) * (1 - out);
          const sc = lerp(0.5, 1, back(k, 2.4)); g.translate(x + w / 2, y); g.scale(sc, sc); g.translate(-(x + w / 2), -y);
          K.rr(g, x, y - h / 2, w, h, h / 2); g.fillStyle = C.blue; g.fill();
          K.text(g, s, x + 13, y + 6, { size: sz, mono: true, wt: 700, ls: 0.5, c: C.white });
          g.restore();
        }
      }
      function draw() {
        const T = T0 + st.t, x = KC.x, y = KC.y, w = KC.w, h = KC.h;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        K.card(g, x, y, w, h, { r: KC.r, fill: "#fbfaf7", blur: 26, dy: 10, shadow: "rgba(40,32,12,0.13)", stroke: false });
        g.save(); K.rr(g, x, y, w, h, KC.r); g.clip();
        g.fillStyle = "#f1eee7"; g.fillRect(x, y, w, KC.bar);
        g.fillStyle = C.steelL; g.fillRect(x, y + KC.bar - 1, w, 1.5);
        ["#e8aaa6", "#ecd197", "#a9d3b8"].forEach((c, i) => { g.beginPath(); g.arc(x + 30 + i * 22, y + KC.bar / 2, 6.5, 0, Math.PI * 2); g.fillStyle = c; g.fill(); });
        K.text(g, "cva_day12.py", x + 104, y + KC.bar / 2 + 7, { size: 20, mono: true, c: C.steelD });
        K.text(g, "python", x + w - 24, y + KC.bar / 2 + 6, { size: 18, mono: true, c: C.steel, align: "right" });
        const CW = K.tw(g, "0", FS, true), A = activeAt(T);
        // active row tints and bars
        for (let i = 1; i <= 16; i++) {
          const k = lerp(A.plines.includes(i) ? 1 : 0, A.lines.includes(i) ? 1 : 0, A.u);
          if (k <= 0.001 || T < SCHED.erase) continue;
          g.fillStyle = rgba(C.blueL, 0.85 * k); g.fillRect(x, rowTop(i), w, LH);
          g.fillStyle = rgba(C.blue, k); g.fillRect(x, rowTop(i), 4, LH);
        }
        // line numbers (always visible) and the code
        for (let i = 1; i <= 16; i++) {
          const act = T >= SCHED.erase && A.lines.includes(i) && A.u > 0.5;
          K.text(g, String(i), NX, rowBase(i), { size: 19, mono: true, wt: act ? 700 : 400, c: act ? C.blue : C.steel, align: "right" });
          drawLine(i, typed(i, T), lineAlpha(i, T, A), CW);
        }
        // token underlines (3 px brand blue under the exact tokens)
        for (const [l, tok, a, b] of SCHED.ul) {
          if (T < a || T > b + 0.3) continue;
          const col = CODE[l - 1].indexOf(tok); if (col < 0) continue;
          const k = eo(clamp((T - a) / 0.25)), out = 1 - clamp((T - b) / 0.3);
          const shown = clamp(typed(l, T) - col, 0, tok.length); if (shown <= 0) continue;
          g.save(); g.globalAlpha *= out; g.fillStyle = C.blue; g.fillRect(X0 + col * CW, rowBase(l) + 5, shown * CW * k, 3); g.restore();
        }
        caret(T, CW);
        // the console strip under a dashed divider
        g.save(); g.setLineDash([6, 6]); g.strokeStyle = C.steelL; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + 22, 1578); g.lineTo(x + w - 22, 1578); g.stroke(); g.restore();
        consoleLine(T);
        g.restore();
        badge(T);
        K.rr(g, x, y, w, h, KC.r); g.strokeStyle = C.steelL; g.lineWidth = 2; g.stroke();
      }
