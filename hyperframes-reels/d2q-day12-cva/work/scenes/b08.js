      // ---- b08, add it up (vo 78.46-89.96): "Now combine them, month by month: exposure, times the chance they default that
      // month, times the discount factor, times the sixty percent we lose. Add it up." The formula
      // CVA = (1 − R) × Σ DF(t) × EE(t) × ΔPD(t) writes across the card top on "combine" (line 13 types); the 60 month
      // slots tick in along the bottom on "month by month". Each term gets its box (and its colour) as it is named, while
      // its code types or its tokens underline: EE(t) blue (line 14), ΔPD(t) red (line 15), DF(t) (np.exp(-r * t)),
      // (1 − R) "= 60%" ((1 - R)), Σ (np.sum). As EE(t), ΔPD(t) and DF(t) are named, each draws in its own lane over the same
      // months (each scaled to its own maximum: EE is the hump, the other two are nearly flat). On "Add it up" the lanes
      // give way to the 60 monthly contributions, building left to right while the counter runs Σ = $0 → $64,563 through
      // the running sums (NUM.cum).
      const g = document.getElementById("b08-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const ONE_R = Math.round((1 - NUM.R) * 100) + "%";
      // the formula's tokens: [text, box key or null, gap after (px at 40 px type)]
      const TOK = [["CVA", null, 16], ["=", null, 16], ["(1 − R)", "R", 22], ["×", null, 22], ["Σ", "S", 20], ["DF(t)", "DF", 22],
        ["×", null, 22], ["EE(t)", "EE", 22], ["×", null, 22], ["ΔPD(t)", "PD", 0]];
      const BOX = {
        EE: { t: CUE.exposure, col: C.blue, cap: "exposure" }, PD: { t: CUE.chance, col: C.red, cap: "default" },
        DF: { t: CUE.discount, col: C.steelD, cap: "discount" }, R: { t: CUE.sixty, col: C.ink, cap: "= " + ONE_R },
        S: { t: CUE.add, col: C.blue, cap: "sum" } };
      const FB = 482, MAXW = 870;
      function formula(T) {
        const widthAt = (fs) => TOK.reduce((p, [s, , gp]) => p + K.tw(g, s, fs, false, -0.5) + gp * fs / 40, 0);
        let fs = 46; while (fs > 30 && widthAt(fs) > MAXW) fs -= 1;
        const Wt = widthAt(fs);
        let x = 540 - Wt / 2; const x0 = x;
        const kw = eio(clamp((T - CUE.combine) / 1.0));        // written left to right on "combine"
        g.save(); g.beginPath(); g.rect(x0 - 30, FB - fs - 40, (Wt + 60) * kw, fs + 140); g.clip();
        TOK.forEach(([s, key, gp]) => {
          const w = K.tw(g, s, fs, false, -0.5), b = key ? BOX[key] : null, kb = b ? eo(clamp((T - b.t + 0.04) / 0.22)) : 0;
          if (b && kb > 0) {
            const pad = 8, bx = x - pad, by = FB - fs * 0.86, bw = w + 2 * pad, bh = fs * 1.2, sc = lerp(1.18, 1, back(kb, 2));
            g.save(); g.translate(bx + bw / 2, by + bh / 2); g.scale(sc, sc); g.translate(-(bx + bw / 2), -(by + bh / 2)); g.globalAlpha *= clamp(kb * 2);
            K.rr(g, bx, by, bw, bh, 11); g.fillStyle = rgba(b.col, 0.09); g.fill(); g.strokeStyle = b.col; g.lineWidth = 3; g.stroke();
            g.restore();
            K.text(g, b.cap, x + w / 2, FB + 42 + 10 * (1 - kb), { size: 19, mono: true, wt: 700, c: b.col, align: "center", a: kb });
          }
          const col = b ? mix(C.ink, b.col === C.steelD ? C.ink : b.col, kb) : C.ink;
          K.text(g, s, x, FB, { size: fs, ls: -0.5, c: col });
          x += w + gp * fs / 40;
        });
        g.restore();
      }
      // the plot under the formula: three lanes (EE, ΔPD, DF over the months), then the 60 monthly contributions
      const PX = 130, PY = 640, PW = 820, PH = 250, NM = NUM.contrib.length, CMAX = Math.max(...NUM.contrib);
      const LANES = [["EE(t)", NUM.ee, C.blue, "EE", 598], ["ΔPD(t)", NUM.dpd, C.red, "PD", 692], ["DF(t)", NUM.df, C.steelD, "DF", 786]];
      function lanes(T, fade) {
        const bw = PW / NM;
        LANES.forEach(([lab, ys, col, key, top]) => {
          const k = clamp((T - BOX[key].t + 0.02) / 0.7); if (k <= 0 || fade <= 0) return;
          const mx = Math.max(...ys), h = 62, y0 = top + 12 + h;
          g.save(); g.globalAlpha *= fade;
          K.text(g, lab, PX, top, { size: 19, mono: true, wt: 700, c: col, a: clamp(k * 4) });
          g.fillStyle = rgba(C.ink, 0.06); g.fillRect(PX, y0, PW, 1.5);
          const m = Math.max(1, Math.ceil(NM * eo(k)));
          g.beginPath();
          for (let i = 0; i < m; i++) { const px = PX + (i + 0.5) * bw, py = y0 - h * ys[i] / mx; i ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
          g.restore();
        });
      }
      function bars(T) {
        const bw = PW / NM, base = PY + PH;
        // the month slots tick in on "month by month"
        const km = clamp((T - CUE.month + 0.05) / 0.8);
        for (let i = 0; i < NM; i++) {
          const a = clamp((km * NM - i) / 4); if (a <= 0) break;
          g.fillStyle = rgba(C.ink, 0.28 * a); g.fillRect(PX + i * bw + bw / 2 - 1, base + 4, 2, (i + 1) % 12 === 0 ? 12 : 7);
        }
        if (km > 0) {
          g.save(); g.globalAlpha *= clamp(km * 3); g.strokeStyle = rgba(C.ink, 0.7); g.lineWidth = 2;
          g.beginPath(); g.moveTo(PX, base); g.lineTo(PX + PW * eo(km), base); g.stroke(); g.restore();
          [1, 12, 24, 36, 48, 60].forEach((m) => K.text(g, String(m), PX + (m - 0.5) * bw, base + 40, { size: 18, mono: true, c: C.steelD, align: "center", a: clamp(km * NM / m - 0.2) }));
          K.text(g, "month", PX + PW, base + 66, { size: 18, mono: true, c: C.steelD, align: "right", a: km });
        }
        // the lanes give way to the build: bar i starts as the sweep reaches it; the counter shows the running sum
        // (NUM.cum) of the bars so far
        const tb0 = CUE.add + 0.1, tb1 = CUE.land, prog = clamp((T - tb0) / (tb1 - tb0)) * NM;
        lanes(T, 1 - eio(clamp((T - CUE.add + 0.05) / 0.3)));
        const ksc = clamp((T - CUE.lose + 0.1) / Math.max(0.4, Math.min(1.0, CUE.add - CUE.lose)));
        if (ksc > 0 && ksc < 1) {
          const sx = PX + PW * eio(ksc);
          g.save(); g.globalAlpha *= Math.sin(Math.PI * ksc); g.strokeStyle = C.blue; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(sx, 596); g.lineTo(sx, PY + PH); g.stroke();
          const gr = g.createLinearGradient(sx - 60, 0, sx, 0); gr.addColorStop(0, rgba(C.blue, 0)); gr.addColorStop(1, rgba(C.blue, 0.12));
          g.fillStyle = gr; g.fillRect(sx - 60, 596, 60, PY + PH - 596); g.restore();
        }
        const kl = clamp((T - CUE.add) / 0.3);
        if (kl > 0) K.text(g, NM + " monthly slices · simulated", PX, PY + 6, { size: 18, mono: true, c: C.steelD, a: kl });
        for (let i = 0; i < NM; i++) {
          const k = eo(clamp((prog - i) / 2.5)); if (k <= 0) break;
          const h = (PH - 20) * NUM.contrib[i] / CMAX * k;
          K.rr(g, PX + i * bw + 1.5, base - h, bw - 3, h, 2); g.fillStyle = mix(C.blueM, C.blue, k); g.fill();
        }
        const kc = clamp((T - CUE.add + 0.02) / 0.2);
        if (kc > 0) {
          const n = Math.min(NM, Math.floor(prog)), v = n > 0 ? NUM.cum[n - 1] * 1e6 : 0;
          g.save(); g.globalAlpha *= kc;
          const s1 = "Σ = ", w1 = K.tw(g, s1, 46, false, -1), s2 = K.money(v), w2 = K.tw(g, s2, 46, false, -1);
          K.text(g, s1, PX + PW - w2 - w1, PY + 40, { size: 46, ls: -1, c: C.blue });
          K.text(g, s2, PX + PW - w2, PY + 40, { size: 46, ls: -1, c: C.ink });
          g.restore();
        }
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        formula(T);
        bars(T);
        g.restore();
      }
