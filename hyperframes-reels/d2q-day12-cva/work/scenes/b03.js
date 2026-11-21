      // ---- b03, the big picture (vo 16.40-27.80): "When a bank trades a swap with a client, the client might go bust while
      // owing the bank money. C V A is what that risk costs today, and every derivatives desk prices it in." Two boxes,
      // BANK (that's us) and CLIENT, are there from the start (line 1 types on "When"). On "swap" two arrows draw: CLIENT →
      // BANK "fixed", BANK → CLIENT "floating", with payments flowing along them. On "go bust" the client shakes and turns
      // red ("✕ default") and the flows stop; on "owing the bank money" a "$ owed to us" chip lands on the arrow to the bank
      // and is struck through in red ("lost"); on "C V A is what that risk costs today" a price tag swings in on the bank's
      // side, its words landing as they are said; on "every derivatives desk prices it in" three chips: swap + CVA,
      // FX forward + CVA, option + CVA.
      const g = document.getElementById("b03-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const BK = { x: 110, y: 452, w: 280, h: 160 }, CL = { x: 690, y: 452, w: 280, h: 160 };
      const AY1 = 500, AY2 = 566, AX0 = BK.x + BK.w + 10, AX1 = CL.x - 10;
      function bankIcon(cx, cy, s, col) {
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4; g.lineJoin = "round";
        g.beginPath(); g.moveTo(cx - s * 0.55, cy - s * 0.22); g.lineTo(cx, cy - s * 0.52); g.lineTo(cx + s * 0.55, cy - s * 0.22); g.closePath(); g.stroke();
        g.fillRect(cx - s * 0.5, cy - s * 0.18, s, 5);
        for (let i = 0; i < 4; i++) g.fillRect(cx - s * 0.42 + i * s * 0.26, cy - s * 0.1, 7, s * 0.46);
        g.fillRect(cx - s * 0.58, cy + s * 0.4, s * 1.16, 6);
        g.restore();
      }
      function officeIcon(cx, cy, s, col) {
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4; g.lineJoin = "round";
        K.rr(g, cx - s * 0.36, cy - s * 0.5, s * 0.72, s * 0.96, 4); g.stroke();
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(cx - s * 0.24 + c * s * 0.18, cy - s * 0.38 + r * s * 0.2, s * 0.1, s * 0.1);
        g.fillRect(cx - s * 0.07, cy + s * 0.22, s * 0.14, s * 0.24);
        g.restore();
      }
      function box(B, lab, sub, icon, T, red, P) {
        g.save(); K.apply(g, B.x + B.w / 2, B.y + B.h / 2, P);
        const sh = red > 0 ? K.shake(T - CUE.bust, 9, 2) : [0, 0];
        g.translate(sh[0], sh[1]);
        K.card(g, B.x, B.y, B.w, B.h, { r: 22, blur: 22, dy: 9, fill: mix(C.white, C.redL, red), shadow: "rgba(40,32,12,0.16)", stroke: false });
        K.rr(g, B.x, B.y, B.w, B.h, 22); g.strokeStyle = mix(C.steelL, C.red, red); g.lineWidth = 2.5; g.stroke();
        const col = mix(C.ink, C.red, red);
        icon(B.x + B.w / 2, B.y + 58, 74, col);
        K.text(g, lab, B.x + B.w / 2, B.y + 134, { size: 34, ls: 1, c: col, align: "center" });
        if (sub) K.text(g, sub, B.x + B.w / 2, B.y + B.h + 30, { size: 18, mono: true, c: C.steelD, align: "center" });
        g.restore();
      }
      // an arrow from x0 to x1 at y, drawn to k; flowing payment dots while `flow` > 0
      function arrow(x0, x1, y, k, col, T, flow) {
        if (k <= 0) return;
        const xe = lerp(x0, x1, eo(k)), dir = Math.sign(x1 - x0);
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, y); g.lineTo(xe, y); g.stroke();
        g.beginPath(); g.moveTo(xe + dir * 6, y); g.lineTo(xe - dir * 12, y - 10); g.lineTo(xe - dir * 12, y + 10); g.closePath(); g.fill();
        if (flow > 0 && k >= 1) {
          for (let i = 0; i < 3; i++) {
            const p = ((T * 0.55 + i / 3) % 1), px = lerp(x0 + dir * 20, x1 - dir * 24, p);
            g.globalAlpha = flow * Math.sin(Math.PI * p); g.beginPath(); g.arc(px, y, 6, 0, Math.PI * 2); g.fill();
          }
        }
        g.restore();
      }
      // a white pill with two-colour text: a (ink) then b (blue, bold)
      function plus(s1, s2, cx, y, k) {
        if (k <= 0) return;
        const sz = 24, w1 = K.tw(g, s1, sz, true, 0, 700), w2 = K.tw(g, s2, sz, true, 0, 700), w = w1 + w2 + 40, h = 50;
        const sc = lerp(0.5, 1, back(k, 2.4));
        g.save(); g.globalAlpha *= clamp(k * 3); g.translate(cx, y); g.scale(sc, sc); g.translate(-cx, -y);
        K.card(g, cx - w / 2, y - h / 2, w, h, { r: h / 2, blur: 14, dy: 5, shadow: "rgba(52,40,14,0.18)", stroke: "rgba(13,21,38,0.12)" });
        K.text(g, s1, cx - w / 2 + 20, y + 8, { size: sz, mono: true, wt: 700, c: C.ink });
        K.text(g, s2, cx - w / 2 + 20 + w1, y + 8, { size: sz, mono: true, wt: 700, c: C.blue });
        g.restore();
      }
      function priceTag(T) {
        const u = T - CUE.c; if (u <= 0) return;
        const words = [["CVA", CUE.c], [" =", CUE.a + 0.12], [" what", CUE.what], [" that", CUE.that], [" risk", CUE.risk], [" costs", CUE.costs], [" today", CUE.today]];
        const sz = 24, full = words.map(([s]) => s).join(""), W = K.tw(g, full, sz, true, 0, 700) + 70, H = 62, x = 110, y = 690;
        const p = K.spring(u, 0.35, 9), rot = -0.25 * (1 - p) + 0.012 * Math.sin(2 * Math.PI * (T - CUE.c) / 2.6);
        g.save(); g.globalAlpha *= clamp(u / 0.12); g.translate(x + 18, y); g.rotate(rot); g.translate(-(x + 18), -y);
        // the tag: a pointed left end with a hole
        g.save(); g.shadowColor = "rgba(37,99,235,0.35)"; g.shadowBlur = 18; g.shadowOffsetY = 7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y - H / 2); g.lineTo(x + W - 12, y - H / 2); g.arcTo(x + W, y - H / 2, x + W, y, 12);
        g.arcTo(x + W, y + H / 2, x + W - 12, y + H / 2, 12); g.lineTo(x + 30, y + H / 2); g.closePath(); g.fillStyle = C.blue; g.fill(); g.restore();
        g.beginPath(); g.arc(x + 26, y, 6, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
        // the words land as they are said; "CVA" letter by letter
        let px = x + 46;
        words.forEach(([s, t], i) => {
          let shown = s;
          if (i === 0) shown = T < CUE.v ? "C" : T < CUE.a ? "CV" : "CVA";
          const a = clamp((T - t + 0.05) / 0.12);
          K.text(g, shown, px, y + 8, { size: sz, mono: true, wt: 700, c: C.white, a });
          if (i === 6 && T > CUE.today) { const ku = eo(clamp((T - CUE.today) / 0.3)), ww = K.tw(g, s, sz, true, 0, 700) - K.tw(g, " ", sz, true, 0, 700);
            g.fillStyle = C.white; g.fillRect(px + K.tw(g, " ", sz, true, 0, 700), y + 16, ww * ku, 3); }
          px += K.tw(g, s, sz, true, 0, 700);
        });
        g.restore();
      }
      function draw() {
        const T = T0 + st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const A = K.xfade(T, T0 + 0.1, T0 + NEXT);
        if (A.a <= 0) return;
        g.save(); K.inCard(g); g.globalAlpha = A.a; g.translate(0, A.dy);
        const red = eo(clamp((T - CUE.bust) / 0.25)), flow = 1 - clamp((T - CUE.bust) / 0.3);
        // the two arrows (under the boxes' edges), drawn on "swap"
        const kA = clamp((T - CUE.swap + 0.04) / 0.45), kB = clamp((T - CUE.swap - 0.18) / 0.45);
        arrow(AX1, AX0, AY1, kA, mix(C.blue, C.steel, red), T, flow);
        arrow(AX0, AX1, AY2, kB, mix(C.ink, C.steel, red), T + 0.4, flow);
        if (kA > 0.6) K.text(g, "fixed", AX1 - 8, AY1 - 18, { size: 22, mono: true, wt: 700, c: mix(C.blue, C.steel, red), align: "right", a: clamp((kA - 0.6) * 3) });
        if (kB > 0.6) K.text(g, "floating", AX0 + 16, AY2 + 38, { size: 22, mono: true, wt: 700, c: mix(C.ink, C.steel, red), a: clamp((kB - 0.6) * 3) });
        box(BK, "BANK", "that's us", bankIcon, T, 0, K.life(T, T0 + 0.1, null, { dy: 40, rot: 0, yaw: 0.2, pitch: 0.1, sc: 0.94 }));
        box(CL, "CLIENT", null, officeIcon, T, red, K.life(T, T0 + 0.22, null, { dy: 40, rot: 0, yaw: -0.2, pitch: 0.1, sc: 0.94 }));
        // ✕ default
        const kd = clamp((T - CUE.bust - 0.05) / 0.3);
        if (kd > 0) K.tag(g, "✕ default", CL.x + CL.w / 2, CL.y + CL.h + 34, { k: kd, size: 24, h: 46, fill: C.red, align: "center", shadow: "rgba(224,49,49,0.35)" });
        // "$ owed to us" on the arrow to the bank, struck through on "money" ("lost")
        const ko = clamp((T - CUE.owing + 0.04) / 0.3);
        if (ko > 0) {
          const cx = 490, w = K.chip(g, "$ owed to us", cx, AY1, { k: ko, size: 22, mono: true, wt: 700, align: "center", h: 42, padX: 16, fill: C.white, col: C.ink, stroke: "rgba(13,21,38,0.16)" });
          const ks = eo(clamp((T - CUE.money - 0.1) / 0.3));
          if (ks > 0) {
            g.save(); g.strokeStyle = C.red; g.lineWidth = 4; g.lineCap = "round";
            g.beginPath(); g.moveTo(cx - w / 2 + 8, AY1 + 2); g.lineTo(cx - w / 2 + 8 + (w - 16) * ks, AY1 - 2); g.stroke(); g.restore();
            K.tag(g, "lost", cx, AY1 - 46, { k: clamp((T - CUE.money - 0.25) / 0.3), size: 22, h: 40, fill: C.red, align: "center", shadow: "rgba(224,49,49,0.3)" });
          }
        }
        priceTag(T);
        // every desk prices it in
        [["swap", CUE.every], ["FX forward", CUE.derivatives], ["option", CUE.desk]].forEach(([s, t], i) => {
          plus(s, " + CVA", [224, 520, 830][i], 880, clamp((T - t + 0.04) / 0.3));
        });
        g.restore();
      }
