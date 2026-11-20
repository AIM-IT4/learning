      // ---- ov: the spoken subtitle, low (band y ~1380-1500, above Instagram's caption zone). Bold D2QSans 56 px, centred,
      // built word by word on each word's spoken onset; a page is one phrase (one or two lines) and turns at the phrase end.
      // One or two keywords per phrase sit in solid accent pills (red, white type; yellow with ink type only for "50% off")
      // that pop in as the word is said. Ink on paper, white on the brand-blue block. The hook's first phrase (page 0) is on
      // screen from frame 1, faint, and each word lights up (with a small lift) as it is spoken.
      const g = document.getElementById("ov-cv").getContext("2d");
      const { C, clamp, lerp, eo, back, mix } = K;
      const st = { t: 0 };
      const FS = 56, LH = 76, MAXW = 880, CY = 1454, PX = 13;
      const PUNCT = /[.,:;!?]+$/;
      // lines: the fewest that fit MAXW, broken so their widths are as even as possible; a token in P.br starts a new line
      function layout(P) {
        g.save(); K.font(g, FS, false, -0.5);
        const sp = g.measureText(" ").width;
        const CORE = P.tok.map((tk) => g.measureText(tk.s.replace(PUNCT, "")).width);
        const W = P.tok.map((tk, i) => g.measureText(tk.s).width + (tk.k ? 2 * PX : 0));
        g.restore();
        const segs = []; let cur = [];
        P.tok.forEach((_, i) => { if (P.br.includes(i) && cur.length) { segs.push(cur); cur = []; } cur.push(i); });
        segs.push(cur);
        const lineW = (a, b) => { let x = 0; for (let i = a; i <= b; i++) x += W[i] + (i > a ? sp : 0); return x; };
        const rows = [];
        for (const sg of segs) {
          const n = sg.length;
          let lines = 1; while (true) {
            const best = Array.from({ length: n + 1 }, () => Array(lines + 1).fill(null)); best[0][0] = [0, -1];
            for (let i = 1; i <= n; i++) for (let l = 1; l <= lines; l++) for (let j = 0; j < i; j++) {
              if (!best[j][l - 1]) continue;
              const w = lineW(sg[j], sg[i - 1]); if (w > MAXW && i - j > 1) continue;
              const cost = Math.max(best[j][l - 1][0], w);
              if (!best[i][l] || cost < best[i][l][0]) best[i][l] = [cost, j];
            }
            if (best[n][lines]) {
              const cuts = []; let i = n, l = lines; while (i > 0) { const j = best[i][l][1]; cuts.unshift([j, i]); i = j; l--; }
              cuts.forEach(([j, i]) => { const row = []; let x = 0; for (let q = j; q < i; q++) { row.push({ i: sg[q], w: W[sg[q]], core: CORE[sg[q]], x }); x += W[sg[q]] + sp; } rows.push(row); });
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
        g.save(); K.font(g, FS, false, -0.5); g.textBaseline = "alphabetic"; g.textAlign = "left";
        lay.rows.forEach((row, r) => {
          const off = (1080 - lay.widths[r]) / 2, base = top + r * LH + FS * 0.86;
          row.forEach((c) => {
            const tk = P.tok[c.i];
            const k = P.pre ? 1 : clamp((t - (tk.on - 0.07)) / 0.09);
            if (k <= 0) return;
            let dy = 16 * (1 - eo(k));
            const lit = P.pre ? clamp((t - (tk.on - 0.05)) / 0.12) : 1;
            if (P.pre) { const u = t - (tk.on - 0.05); if (u > 0 && u < 0.26) dy -= 7 * Math.sin(Math.PI * u / 0.26); }
            const x = off + c.x + (tk.k ? PX : 0);
            const core = tk.s.replace(PUNCT, ""), tail = tk.s.slice(core.length);
            g.globalAlpha = clamp(k * 1.4);
            if (P.pre && lit < 1 && !(tk.k && lit > 0)) {
              // not yet spoken: faint
              g.fillStyle = mix(C.ink, C.paper, 0.78 - 0.78 * lit); g.fillText(tk.s, x, base + dy); return;
            }
            if (tk.k) {
              // the pill pops in on the word (a small overshoot), the word turns white (ink on yellow)
              const u = clamp((t - (tk.on - 0.05)) / 0.26), s = lerp(0.55, 1, back(u, 2.2));
              const cx = x + c.core / 2, cy = base - FS * 0.33;
              const fill = tk.k === "y" ? C.yel : C.red, tc = tk.k === "y" ? C.ink : C.white;
              g.save(); g.translate(cx, cy + dy); g.scale(s, s); g.translate(-cx, -cy);
              g.save(); g.shadowColor = tk.k === "y" ? "rgba(120,90,0,0.3)" : "rgba(170,20,20,0.32)"; g.shadowBlur = 14; g.shadowOffsetY = 6;
              K.rr(g, x - PX, base - FS * 0.83, c.core + 2 * PX, FS * 1.08, 14); g.fillStyle = fill; g.fill(); g.restore();
              g.fillStyle = tc; g.fillText(core, x, base);
              g.restore();
              if (tail) { g.fillStyle = ink; g.fillText(tail, x + c.core + PX + 2, base + dy); }
            } else {
              g.fillStyle = ink; g.fillText(tk.s, x, base + dy);
            }
          });
        });
        g.restore();
      }
