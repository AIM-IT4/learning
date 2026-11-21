      // ---- ov: the caption IS the voice. Bold D2QSans 72 px, centred lines in the band y 150-470, built word by word on
      // each word's spoken onset; 2-3 lines per page, pages turn at phrase ends. One or two key words per page get a solid
      // marker box (yellow; red for the crash words) that wipes in behind them as they are said. Ink on paper, white on
      // the brand-blue blocks. The hook's first words are on screen at frame 1 and lift as they are spoken.
      const g = document.getElementById("ov-cv").getContext("2d");
      const { C, clamp, lerp, eo, mix } = K;
      const st = { t: 0 };
      const FS = 72, LH = 86, MAXW = 980, CY = 312;
      const PUNCT = /[.,:;!?]+$/;
      // lines: the fewest that fit MAXW, broken so their widths are as even as possible (no orphan word on a last line);
      // a token in P.br always starts a new line
      function layout(P) {
        g.save(); K.font(g, FS, false, -0.5);
        const sp = g.measureText(" ").width;
        const W = P.tok.map((tk) => g.measureText(tk.s).width), CORE = P.tok.map((tk) => g.measureText(tk.s.replace(PUNCT, "")).width);
        g.restore();
        const segs = []; let cur = [];
        P.tok.forEach((_, i) => { if (P.br.includes(i) && cur.length) { segs.push(cur); cur = []; } cur.push(i); });
        segs.push(cur);
        const lineW = (a, b) => { let x = 0; for (let i = a; i <= b; i++) x += W[i] + (i > a ? sp : 0); return x; };
        const rows = [];
        for (const sg of segs) {
          const n = sg.length;
          // best[i][l] = [cost, prev]: the first i tokens of the segment in l lines
          let lines = 1; while (true) {
            const best = Array.from({ length: n + 1 }, () => Array(lines + 1).fill(null)); best[0][0] = [0, -1];
            for (let i = 1; i <= n; i++) for (let l = 1; l <= lines; l++) for (let j = 0; j < i; j++) {
              if (!best[j][l - 1]) continue;
              const w = lineW(sg[j], sg[i - 1]); if (w > MAXW && i - j > 1) continue;
              const cost = Math.max(best[j][l - 1][0], w);         // the widest line, as narrow as it can be
              if (!best[i][l] || cost < best[i][l][0]) best[i][l] = [cost, j];
            }
            if (best[n][lines]) {
              const cuts = []; let i = n, l = lines; while (i > 0) { const j = best[i][l][1]; cuts.unshift([j, i]); i = j; l--; }
              cuts.forEach(([j, i]) => { const row = []; let x = 0; for (let q = j; q < i; q++) { row.push({ i: sg[q], tk: P.tok[sg[q]], w: W[sg[q]], core: CORE[sg[q]], x }); x += W[sg[q]] + sp; } rows.push(row); });
              break;
            }
            lines++;
          }
        }
        const widths = rows.map((r) => { const l = r[r.length - 1]; return l.x + l.w; });
        return { rows, widths, h: rows.length * LH };
      }
      const LAY = {};
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        let pi = 0; for (let i = 0; i < PAGES.length; i++) if (t >= PAGES[i].start) pi = i;
        const P = PAGES[pi];
        const ready = document.fonts && document.fonts.check(`700 ${FS}px D2QSans`);
        const lay = LAY[pi] || (ready ? (LAY[pi] = layout(P)) : layout(P));
        const top = CY - lay.h / 2;
        const bl = K.blueAt(t, B, THEME), ink = mix(C.ink, C.white, bl);
        const pos = [];
        lay.rows.forEach((row, r) => {
          const off = (1080 - lay.widths[r]) / 2;
          row.forEach((c) => { pos[c.i] = { x: off + c.x, base: top + r * LH + FS * 0.8, w: c.w, core: c.core, row: r }; });
        });
        const pre = (i) => i < (P.pre || 0);
        // marker boxes (one per line the span covers), growing word by word as each word of the span is said
        const markOf = {};
        for (const [a, b, kind] of P.mark) {
          const col = kind === "r" ? C.red : C.yel;
          for (let i = a; i <= b; i++) markOf[i] = kind;
          let i = a;
          while (i <= b) {
            let j = i; while (j + 1 <= b && pos[j + 1].row === pos[i].row) j++;
            let xr = null;
            for (let q = i; q <= j; q++) {
              const m = clamp((t - (P.tok[q].on - 0.06)) / 0.16);
              if (m <= 0) break;
              xr = lerp(pos[q].x - 6, pos[q].x + pos[q].core, eo(m));
            }
            if (xr !== null) {
              const x0 = pos[i].x - 14, y0 = pos[i].base - FS * 0.8, y1 = pos[i].base + FS * 0.2;
              g.save(); K.rr(g, x0, y0, xr + 14 - x0, y1 - y0, 10); g.fillStyle = col; g.fill(); g.restore();
            }
            i = j + 1;
          }
        }
        // the words
        g.save(); K.font(g, FS, false, -0.5); g.textBaseline = "alphabetic"; g.textAlign = "left";
        P.tok.forEach((tk, i) => {
          const p = pos[i];
          const k = pre(i) ? 1 : clamp((t - (tk.on - 0.07)) / 0.09);
          if (k <= 0) return;
          let dy = 18 * (1 - eo(k)), sc = 1;
          const u = t - tk.on;
          if (pre(i) && u > 0 && u < 0.22) { const q = Math.sin(Math.PI * u / 0.22); dy -= 8 * q; sc = 1 + 0.05 * q; }
          g.globalAlpha = clamp(k * 1.4);
          // a marked word turns ink (yellow box) or white (red box) once its box has reached it; punctuation after the
          // box stays ink, on every page
          const boxed = markOf[i] && t >= tk.on - 0.02;
          const core = tk.s.replace(PUNCT, ""), tail = tk.s.slice(core.length);
          const put = (x0, y0) => {
            if (boxed) {
              g.fillStyle = markOf[i] === "r" ? C.white : C.ink; g.fillText(core, x0, y0);
              if (tail) { g.fillStyle = C.ink; g.fillText(tail, x0 + g.measureText(core).width, y0); }
            } else { g.fillStyle = ink; g.fillText(tk.s, x0, y0); }
          };
          if (sc !== 1) {
            g.save(); g.translate(p.x + p.w / 2, p.base - FS * 0.3 + dy); g.scale(sc, sc); put(-p.w / 2, FS * 0.3); g.restore();
          } else put(p.x, p.base + dy);
        });
        g.restore();
      }
