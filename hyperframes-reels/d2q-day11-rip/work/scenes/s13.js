      const NUM_KEYS = ["model"];
      const TEX_IDS = ["skew"];
      // ---- s13, why: "Real returns have fat tails, so low-strike puts cost more, and implied vol rises as the strike
      // falls." The smile card turns back in (s12's answer card turns away): its top now carries THE SKEW (skew), and
      // a three-link chain over the chart lights link by link on its words: FAT TAILS → LOW-STRIKE PUTS COST MORE →
      // IMPLIED VOL RISES AS THE STRIKE FALLS; on "rises as the strike falls" a highlighter runs up the curve from the
      // money to the 80 strike.
      // words (global): 213 Real 214 returns 215 have 216-217 fat tails, 218 so 219 low-strike 220 puts 221 cost 222 more,
      //   223 and 224 implied 225 vol 226 rises 227 as 228 the 229 strike 230 falls.
      const g = document.getElementById("s13-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s13-tex", { ink: { ink: C.ink, acc: C.blue } }, () => draw()); }
      const M = NUM.model, SMILE = K.smileCard(M);
      const LINKS = [["FAT TAILS", w(216) - 0.04, C.red], ["LOW-STRIKE PUTS COST MORE", w(219) - 0.04, C.blue], ["IV RISES AS THE STRIKE FALLS", w(226) - 0.04, C.blue]];
      const tTrace0 = w(226) - 0.02, tTrace1 = w(230) + 0.25, tSkew = 0.3;
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      function turned(th, fn) {
        const c = Math.cos(th), sx = Math.max(0.02, Math.abs(c));
        g.save(); g.translate(540, Y0 + H0 / 2); g.transform(sx, 0.12 * Math.sin(th), 0, 1, 0, 0); g.translate(-540, -(Y0 + H0 / 2));
        fn();
        if (sx < 0.98) { K.rr(g, X0, Y0, W0, H0, 30); g.fillStyle = `rgba(13,21,38,${0.3 * (1 - sx)})`; g.fill(); }
        g.restore();
      }
      function extra(t) {
        return (g) => {
          // the top: THE SKEW, in place of the big number
          K.text(g, "THE SKEW", X0 + 40, Y0 + 170, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.55) });
          K.tex(g, "skew", X0 + 44, Y0 + 262, 76, { valign: "middle", k: clamp((t - tSkew) / 0.5) });
          // the chain: three links, lit one by one
          const Fr = SMILE.Fr, lx = X0 + 470, lw = W0 - 506, lh = 64;
          LINKS.forEach(([s, t0, col], i) => {
            const y = Fr.y + 6 + i * 92, on = clamp((t - t0) / 0.25), pop = 1 + 0.06 * Math.sin(Math.PI * on);
            if (i > 0) {   // the link from the pill above, in the gap between them
              g.save(); g.strokeStyle = on > 0 ? col : rgba(C.ink, 0.25); g.lineWidth = 7; g.lineCap = "round";
              g.beginPath(); g.moveTo(lx + lw / 2, y - 26); g.lineTo(lx + lw / 2, y - 2); g.stroke(); g.restore();
            }
            g.save(); g.translate(lx + lw / 2, y + lh / 2); g.scale(pop, pop); g.translate(-(lx + lw / 2), -(y + lh / 2));
            g.save(); if (on > 0) { g.shadowColor = rgba(col, 0.4 * on); g.shadowBlur = 18; g.shadowOffsetY = 6; }
            K.rr(g, lx, y, lw, lh, lh / 2); g.fillStyle = on > 0 ? K.mix("#ffffff", col, on) : "#ffffff"; g.fill(); g.restore();
            K.rr(g, lx, y, lw, lh, lh / 2); g.strokeStyle = on > 0 ? col : rgba(C.ink, 0.22); g.lineWidth = 3; g.stroke();
            K.text(g, (i + 1) + "  " + s, lx + 26, y + lh / 2 + 10, { size: 27, c: on > 0.5 ? C.white : rgba(C.ink, 0.5), maxW: lw - 44 });
            g.restore();
          });
          // rises as the strike falls: a highlighter up the curve from the money to the 80 strike
          const kt = eio(clamp((t - tTrace0) / (tTrace1 - tTrace0)));
          if (kt > 0) {
            const k1 = lerp(100, 80, kt), xs = SMILE.CXS.filter((x) => x <= 100 + 1e-9 && x >= k1 - 1e-9).reverse();
            const pts = xs.map((x) => [Fr.X(x), Fr.Y(SMILE.SM(x))]);
            if (pts.length > 1) {
              g.save(); g.globalCompositeOperation = "multiply"; g.lineCap = "round"; g.lineJoin = "round";
              K.poly(g, pts); g.strokeStyle = C.yel; g.lineWidth = 30; g.stroke(); g.restore();
              const e = pts[pts.length - 1], p = pts[Math.max(0, pts.length - 4)], an = Math.atan2(e[1] - p[1], e[0] - p[0]);
              g.save(); g.translate(e[0], e[1]); g.rotate(an); g.beginPath(); g.moveTo(26, 0); g.lineTo(-8, -18); g.lineTo(-8, 18); g.closePath(); g.fillStyle = C.ink; g.fill(); g.restore();
            }
          }
        };
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        // turns back in: s12's card turns away over the first 0.18 s, this one turns in over the next 0.18 s
        const f = clamp((t - 0.18) / 0.18), th = (Math.PI / 2) * (1 - eio(f));
        if (t < 0.18) return;
        const out = t > NEXT ? K.leave(t - NEXT, { dy: -170, dur: 0.3 }) : K.still;
        g.save(); K.apply(g, 540, Y0 + H0 / 2, out);
        turned(th, () => SMILE.draw(g, 100, SMILE.S_END, K.still, { big: false, chips: false, stamp: false, extra: extra(t) }));
        g.restore();
      }
