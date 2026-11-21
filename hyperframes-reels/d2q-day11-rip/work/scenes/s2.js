      const NUM_KEYS = ["normal", "model"];
      // ---- s2, the question (brand-blue block): "Then the interviewer asks: so why does the market quote a different
      // volatility for every strike?" s1's dial leaves; an interview chat card rises (a neutral icon, no face): a typing
      // indicator on "Then the interviewer asks:", then the question types out word by word as it is said, "different
      // volatility" highlighted as it is spoken. The five tickets carry over from s1 exactly as they stand; on "market
      // quote" their σ fields widen to five tiles (20.0%), on "different" the digits spin and land on different
      // values (model.iv_pct at 80/90/100/110/120), labelled ILLUSTRATIVE QUOTES. This frame is the cover.
      // words (global): 9 Then 10 the 11 interviewer 12 asks: 13 so 14 why 15 does 16 the 17 market 18 quote 19 a
      //   20 different 21 volatility 22 for 23 every 24 strike?
      const g = document.getElementById("s2-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { }
      const SIG = Math.round(100 * NUM.normal.sigma_annual);
      const KS = NUM.model.strikes.filter((k) => k % 10 === 0), IV = NUM.model.iv_pct;
      const TW = K.TK.W, TH = K.TK.H, TY = K.TK.Y, TX = K.TK.X;
      // s1's light reached each ticket at these film times (same constants as s1): the glow keeps decaying across the cut
      const S1 = { GX: 540, FOOT: 800 + 262 + 60, MY: 1166, SPEED: 1500 };
      const s1Arrive = (i) => { const tF = WA[7] - 0.26, tM = tF + (S1.MY - S1.FOOT) / S1.SPEED;
        return tM + Math.abs(TX(i) + TW / 2 - S1.GX) / S1.SPEED + (TY + 8 - S1.MY) / S1.SPEED; };
      // beats
      const tCard = 0.1, tDots = w(9) - 0.05, tExpand = w(17) - 0.04, tSpin = w(20) - 0.04, tLab = w(21) + 0.1;
      // the question, typed as it is said: one token per spoken word
      const Q = ["So", "why", "does", "the", "market", "quote", "a", "different", "volatility", "for", "every", "strike?"];
      const QW = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const QFS = 58, QLH = 72, QMAX = 820;
      let QL = null;
      function qLayout() {
        g.save(); K.font(g, QFS, false, -0.5);
        const sp = g.measureText(" ").width, rows = [[]]; let x = 0;
        Q.forEach((s, i) => { const ww = g.measureText(s).width; if (x > 0 && x + ww > QMAX) { rows.push([]); x = 0; } rows[rows.length - 1].push({ i, s, w: ww, x }); x += ww + sp; });
        g.restore();
        return rows;
      }
      // a σ tile row: before "market quote" the s1 tiles (2, 0, %); after, five tiles (2 0 . 0 %) that spin to the quote
      function tiles(i, t) {
        if (t < tExpand) return { sig: ["2", "0", "%"].map((c) => ({ prev: c, cur: c, f: 0 })), wide: 0 };
        const tgt = IV[String(KS[i])].toFixed(1).split("").concat(["%"]);
        const init = String(SIG).split("").concat([".", "0", "%"]);
        const ts = tSpin + 0.08 * i;
        const sig = init.map((c, j) => {
          if (c === "%" ) return { prev: "%", cur: "%", f: 0 };
          if (c === ".") return K.flapState([" ", "."], tExpand, 0.1, t);
          const pre = j === 3 ? K.flapState([" ", "0"], tExpand, 0.1, t) : { prev: c, cur: c, f: 0 };
          if (t < ts + 0.03 * j) return pre;
          const seq = [c].concat([0, 1, 2, 3].map((q) => String(Math.floor(K.rnd(i * 13 + j * 5 + q * 1.7) * 10))), [tgt[j]]);
          return K.flapState(seq, ts + 0.03 * j, 0.055, t);
        });
        return { sig, wide: eo(clamp((t - tExpand) / 0.2)) };
      }
      const landed = (i) => tSpin + 0.08 * i + 0.09 + 5 * 0.055;
      function chatCard(t) {
        const P = K.enter(t - tCard, { dy: 220, pitch: 0.45, yaw: 0, rot: -0.03, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        const X = 40, Y = 506, W = 1000, H = 664;
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X, Y, W, H, { r: 30, shadow: "rgba(8,22,90,0.45)", blur: 50, dy: 26 });
        // header: a neutral person icon (no face), the role, the status
        K.avatar(g, X + 76, Y + 70, 40);
        K.text(g, "Interviewer", X + 134, Y + 66, { size: 38 });
        K.text(g, "QUANT INTERVIEW", X + 136, Y + 102, { size: 26, mono: true, ls: 2, c: rgba(C.ink, 0.5) });
        const typing = t > tDots && t < w(24) + 0.3;
        g.beginPath(); g.arc(X + W - 186, Y + 66, 8, 0, Math.PI * 2); g.fillStyle = typing ? C.blue : C.green; g.fill();
        K.text(g, typing ? "typing…" : "online", X + W - 168, Y + 76, { size: 28, mono: true, c: typing ? C.blue : rgba(C.ink, 0.55) });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 134, W - 60, 2);
        // the bubble: the typing dots, then the question word by word
        if (!QL && document.fonts && document.fonts.check(`700 ${QFS}px D2QSans`)) QL = qLayout();
        const rows = QL || qLayout();
        const bx = X + 50, by = Y + 172;
        const shown = Q.map((_, i) => clamp((t - (WA[QW[i]] - T0 - 0.06)) / 0.08));
        const nVis = shown.filter((v) => v > 0).length;
        if (t > tDots && nVis === 0) {
          const bw = 170, bh = 92;
          K.rr(g, bx, by, bw, bh, 34); g.fillStyle = C.mist; g.fill();
          for (let d = 0; d < 3; d++) { const ph = Math.sin((t - tDots) * 9 - d * 0.9); g.beginPath(); g.arc(bx + 50 + d * 36, by + 46 - 7 * Math.max(0, ph), 10, 0, Math.PI * 2); g.fillStyle = rgba(C.ink, 0.35 + 0.3 * Math.max(0, ph)); g.fill(); }
        }
        if (nVis > 0) {
          // the bubble grows with the visible lines
          let lines = 0, wmax = 0;
          rows.forEach((r, ri) => { const vis = r.filter((c) => shown[c.i] > 0); if (vis.length) { lines = ri + 1; const l = vis[vis.length - 1]; wmax = Math.max(wmax, l.x + l.w); } });
          const bw = Math.min(W - 100, wmax + 72), bh = lines * QLH + 52;
          K.rr(g, bx, by, bw, bh, 34); g.fillStyle = C.mist; g.fill();
          g.beginPath(); g.moveTo(bx + 4, by + 30); g.lineTo(bx - 16, by + 4); g.lineTo(bx + 40, by + 8); g.fillStyle = C.mist; g.fill();
          // "different volatility": a highlighter as it is said
          rows.forEach((r, ri) => r.forEach((c) => {
            if (c.i !== 7 && c.i !== 8) return;
            const u = clamp((t - (WA[QW[c.i]] - T0 - 0.04)) / 0.2);
            K.highlight(g, bx + 36 + c.x - 6, by + 26 + ri * QLH + 2, c.w + 12, QLH - 6, u);
          }));
          rows.forEach((r, ri) => r.forEach((c) => {
            const k = shown[c.i]; if (k <= 0) return;
            K.text(g, c.s, bx + 36 + c.x, by + 26 + ri * QLH + QFS * 0.86 + 10 * (1 - eo(k)), { size: QFS, ls: -0.5, a: clamp(k * 1.5) });
          }));
        }
        // the reply row: an empty answer field with a blinking caret, and a send button
        const ry = Y + H - 118;
        K.field(g, X + 40, ry, W - 190, 84, { r: 42, fill: "#f4f6fa" });
        K.text(g, "Your answer…", X + 84, ry + 54, { size: 32, c: rgba(C.ink, 0.38) });
        if (Math.floor((T0 + t) * 2.2) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(X + 74, ry + 22, 3, 40); }
        g.beginPath(); g.arc(X + W - 82, ry + 42, 42, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
        K.plane(g, X + W - 84, ry + 44, 40, C.white, 4);
        g.restore();
      }
      function draw() {
        const t = st.t, T = T0 + t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        if (t > tCard) chatCard(t);
        // the tickets, carried over from s1 (same row, same float), then out with the beat
        const out = t > NEXT ? K.leave(t - NEXT, { dy: 160, dur: 0.3, pitch: -0.2 }) : K.still;
        for (let i = 0; i < 5; i++) {
          const cx = TX(i) + TW / 2, cy = TY + TH / 2 + K.bob(T, i * 1.3, 2.5);
          const { sig, wide } = tiles(i, t);
          const hl = Math.max(Math.exp(-(T - s1Arrive(i)) * 3), t > landed(i) ? Math.exp(-(t - landed(i)) * 2.5) : 0);
          g.save(); K.apply(g, cx, cy, out); g.translate(cx, cy);
          K.ticket(g, -TW / 2, -TH / 2, TW, TH, { K: KS[i], sig, hl, wide, ground: C.blue });
          g.restore();
        }
        // the label: the quotes are illustrative
        const kl = clamp((t - tLab) / 0.3);
        if (kl > 0) {
          g.save(); K.apply(g, 540, 1604, out);
          K.chip(g, "ILLUSTRATIVE QUOTES · A DIFFERENT σ FOR EVERY STRIKE", 540, 1604, { k: kl, size: 27, align: "center", col: C.blue, shadow: "rgba(8,22,90,0.4)", stroke: "rgba(0,0,0,0)" });
          g.restore();
        }
      }
