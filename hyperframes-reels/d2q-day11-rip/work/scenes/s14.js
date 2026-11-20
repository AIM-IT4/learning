      // ---- s14, the call to action: "Comment FORMULA, and we'll DM you the free Quant Formula Sheet. Save this, share it,
      // and follow Desk2Quant for Day 12." A comment card: FORMULA types into the box and posts. On "DM" a direct message
      // from desk2quant slides in with the Formula Sheet's real cover. Three buttons light on their words: SAVE on "Save
      // this", SHARE on "share it", FOLLOW on "follow"; the DESK2QUANT plate (the real logo, @desk2quant, desk2quant.com)
      // rises on "follow Desk2Quant" and a "Day 12 →" chip lands on "Day 12". The last frame holds.
      // words (global): 231 Comment 232 FORMULA, 233 and 234 we'll 235 DM 236 you 237 the 238 free 239 Quant 240 Formula
      //   241 Sheet. 242 Save 243 this, 244 share 245 it, 246 and 247 follow 248-250 Desk2Quant 251 for 252 Day 253 12.
      const g = document.getElementById("s14-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ logo: "assets/logo.png", cover: "assets/covers/formula-sheet.png" }, "s14-images", () => draw()); }
      const WORD = "FORMULA";
      const tCard = 0.04, tType = w(232) - 0.02, tPost = w(233) + 0.04, tDM = w(235) - 0.08, tFree = w(238) - 0.02, tTitle = w(239) - 0.04;
      const tSave = w(242) - 0.02, tShare = w(244) - 0.02, tFollow = w(247) - 0.02, tPlate = w(247) - 0.1, tDay = w(252) - 0.04;
      const X0 = 40, W0 = 1000;
      function commentCard(t) {
        const P = K.enter(t - tCard, { dy: 200, pitch: 0.4, yaw: 0, sc: 0.92 });
        const Y = 506, H = 292;
        g.save(); K.apply(g, 540, Y + H / 2, P);
        K.card(g, X0, Y, W0, H, { r: 30, blur: 40, dy: 20 });
        K.text(g, "COMMENTS", X0 + 40, Y + 56, { size: 26, mono: true, ls: 3, c: rgba(C.ink, 0.55) });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y + 82, W0 - 60, 2);
        const iy = Y + 150, n = t >= tPost ? 0 : clamp(Math.floor((t - tType) / 0.055) + 1, 0, WORD.length);
        K.avatar(g, X0 + 66, iy, 34);
        K.rr(g, X0 + 118, iy - 38, W0 - 150, 76, 38); g.strokeStyle = n > 0 ? rgba(C.blue, 0.75) : rgba(C.ink, 0.18); g.lineWidth = n > 0 ? 3.5 : 2; g.stroke();
        if (n > 0) {
          const ww = K.text(g, WORD.slice(0, n), X0 + 152, iy + 15, { size: 42 });
          if (Math.floor((T0 + t) * 6) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(X0 + 158 + ww, iy - 22, 3, 44); }
        } else K.text(g, "Add a comment…", X0 + 152, iy + 11, { size: 32, c: rgba(C.ink, 0.36) });
        K.text(g, "Post", X0 + W0 - 66, iy + 11, { size: 32, c: n >= WORD.length ? C.blue : rgba(C.ink, 0.28), align: "right" });
        // the posted comment rises out of the box into the thread
        const kp = clamp((t - tPost) / 0.3);
        if (kp > 0) {
          const ry = lerp(iy, Y + 244, eo(kp));
          g.save(); g.globalAlpha *= clamp(kp * 2);
          K.avatar(g, X0 + 66, ry, 30);
          K.text(g, "you", X0 + 118, ry - 6, { size: 26, c: rgba(C.ink, 0.6) });
          K.text(g, "now", X0 + 172, ry - 6, { size: 26, mono: true, c: rgba(C.ink, 0.4) });
          K.text(g, WORD, X0 + 252, ry - 2, { size: 40 });
          K.heart(g, X0 + W0 - 62, ry - 12, 36, rgba(C.ink, 0.5), null);
          g.restore();
        }
        g.restore();
      }
      function dmCard(t) {
        const k = clamp((t - 0.14) / 0.35); if (k <= 0) return;
        const Y = 818, H = 400, dx = 240 * (1 - eo(k));
        g.save(); g.globalAlpha *= clamp(k * 2.4); g.translate(dx, 0);
        K.card(g, X0, Y, W0, H, { r: 30, blur: 40, dy: 20 });
        const lg = K.pic("logo", 60); if (lg) g.drawImage(lg, X0 + 34, Y + 28, 60, 60);
        K.text(g, "desk2quant", X0 + 112, Y + 62, { size: 34 });
        K.text(g, "DIRECT MESSAGE", X0 + 113, Y + 92, { size: 26, mono: true, ls: 2.5, c: rgba(C.ink, 0.5) });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X0 + 30, Y + 116, W0 - 60, 2);
        // before "DM": typing dots; then the message: the real cover, its title, FREE
        if (t < tDM) {
          K.rr(g, X0 + 50, Y + 150, 170, 90, 34); g.fillStyle = C.mist; g.fill();
          for (let d = 0; d < 3; d++) { const ph = Math.sin(t * 9 - d * 0.9); g.beginPath(); g.arc(X0 + 100 + d * 36, Y + 195 - 7 * Math.max(0, ph), 10, 0, Math.PI * 2); g.fillStyle = rgba(C.ink, 0.35 + 0.3 * Math.max(0, ph)); g.fill(); }
          g.restore(); return;
        }
        const km = clamp((t - tDM) / 0.3), cw = 176, cv = K.pic("cover", cw);
        g.save(); g.translate(X0 + 138, Y + 260); g.scale(back(km, 2), back(km, 2)); g.translate(-(X0 + 138), -(Y + 260));
        if (cv) {
          const ch = cw * cv.height / cv.width, cx = X0 + 50, cy = Y + 140;
          g.save(); g.shadowColor = "rgba(40,32,12,0.28)"; g.shadowBlur = 20; g.shadowOffsetY = 10; g.fillStyle = C.white; g.fillRect(cx, cy, cw, ch); g.restore();
          g.drawImage(cv, cx, cy, cw, ch); g.strokeStyle = rgba(C.ink, 0.15); g.lineWidth = 1.5; g.strokeRect(cx, cy, cw, ch);
        }
        g.restore();
        const kt = clamp((t - tTitle) / 0.3);
        K.text(g, "Quant Formula", X0 + 270, Y + 212 + 10 * (1 - eo(kt)), { size: 52, a: kt });
        K.text(g, "Sheet", X0 + 270, Y + 272 + 10 * (1 - eo(kt)), { size: 52, a: kt });
        K.chip(g, "PDF", X0 + 270, Y + 338, { k: clamp((t - tTitle - 0.3) / 0.3), size: 28, mono: true, fill: C.mist, stroke: "rgba(0,0,0,0)", shadow: "rgba(0,0,0,0)" });
        if (t > tFree) K.chip(g, "FREE", X0 + W0 - 40, Y + 214, { k: clamp((t - tFree) / 0.25), size: 40, align: "right", fill: C.yel, col: C.ink, stroke: "rgba(0,0,0,0)", rot: 0.06 });
        g.restore();
      }
      function actions(t) {
        const Y = 1250, labels = [["SAVE", tSave], ["SHARE", tShare], ["FOLLOW", tFollow]];
        const k = clamp((t - 0.24) / 0.3); if (k <= 0) return;
        const bw = (W0 - 2 * 24) / 3;
        labels.forEach(([s, t0], i) => {
          const x = X0 + i * (bw + 24), on = clamp((t - t0) / 0.2), pop = 1 + 0.1 * Math.sin(Math.PI * on);
          g.save(); g.globalAlpha *= clamp(k * 2); g.translate(x + bw / 2, Y + 50); g.scale(pop, pop); g.translate(-(x + bw / 2), -(Y + 50));
          K.card(g, x, Y, bw, 100, { r: 50, fill: on > 0.5 ? C.blue : C.white, shadow: on > 0.5 ? "rgba(37,99,235,0.4)" : "rgba(52,40,14,0.18)", blur: 22, dy: 10 });
          const ic = on > 0.5 ? C.white : C.ink, ix = x + 62, iy = Y + 50;
          if (i === 0) K.bookmark(g, ix, iy, 40, on > 0.5 ? C.white : null, ic, 4);
          else if (i === 1) K.plane(g, ix, iy, 40, ic, 4);
          else { g.save(); g.strokeStyle = ic; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(ix - 16, iy); g.lineTo(ix + 16, iy); g.moveTo(ix, iy - 16); g.lineTo(ix, iy + 16); g.stroke(); g.restore(); }
          K.text(g, s, x + 100, Y + 62, { size: 34, c: on > 0.5 ? C.white : C.ink });
          if (on > 0 && t - t0 < 0.5) { const q = (t - t0) / 0.5; g.save(); g.strokeStyle = rgba(C.blue, 0.6 * (1 - q)); g.lineWidth = 4; K.rr(g, x - 14 * q, Y - 14 * q, bw + 28 * q, 100 + 28 * q, 50 + 14 * q); g.stroke(); g.restore(); }
          g.restore();
        });
      }
      function plate(t) {
        const k = clamp((t - 0.34) / 0.4); if (k <= 0) return;
        const Y = 1374, H = 258, dy = 120 * (1 - eo(k));
        g.save(); g.globalAlpha *= clamp(k * 2.2); g.translate(0, dy);
        K.card(g, X0, Y, W0, H, { r: 30, blur: 40, dy: 18 });
        const L = 170, lg = K.pic("logo", L);
        if (lg) g.drawImage(lg, X0 + 40, Y + 44, L, L);
        K.text(g, "DESK2QUANT", X0 + 240, Y + 104, { size: 60, ls: 3 });
        K.text(g, "@desk2quant", X0 + 242, Y + 160, { size: 38, mono: true, ls: 1, c: C.blue });
        K.rr(g, X0 + 240, Y + 182, 470, 58, 16); g.fillStyle = C.blue; g.fill();
        K.text(g, "desk2quant.com", X0 + 475, Y + 223, { size: 36, align: "center", c: C.white });
        if (t > tDay) K.chip(g, "Day 12 →", X0 + W0 - 36, Y + 128, { k: clamp((t - tDay) / 0.3), size: 44, align: "right", fill: C.yel, col: C.ink, stroke: "rgba(0,0,0,0)", rot: -0.05, padX: 28 });
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        commentCard(t);
        dmCard(t);
        actions(t);
        plate(t);
      }
