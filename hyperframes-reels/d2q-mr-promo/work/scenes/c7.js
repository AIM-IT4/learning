      // ---- c7, the call to action (brand-blue block): "Comment RISK, and we will DM you fifty percent off. The code works for
      // seven days. Save this for your next risk interview."
      // Four white cards deal in at once (so the block is never empty): a comment card where RISK types in on "RISK" and
      // posts on "and"; a direct message from desk2quant (typing dots until "DM", then the real cover thumbnail and the
      // product name; "50% OFF" in a yellow marker on "fifty percent"; a blurred code chip "•••••" with a lock on "code" -
      // the code itself never appears; "valid 7 days" on "seven days"); a row "Send to a friend preparing for risk
      // interviews" + SAVE (SAVE lights on "Save this", the send row on "next risk interview"); and the DESK2QUANT plate (the
      // real logo, @desk2quant, desk2quant.com). The last frame holds.
      // words (global): 105 Comment 106 RISK, 107 and 108 we 109 will 110 DM 111 you 112 50% 113 off. 114 The 115 code
      //   116 works 117 for 118 7 119 days. 120 Save 121 this 122 for 123 your 124 next 125 risk 126 interview.
      const g = document.getElementById("c7-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, mix, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.load({ logo: "assets/logo.png", cover: "assets/img/cover.jpg" }, "c7-images", () => draw()); }
      const WORD = "RISK";
      const tType = w(106) - 0.02, tPost = w(107) + 0.02, tDM = w(110) - 0.08, tOff = w(112) - 0.04, tCode = w(115) - 0.04,
        tValid = w(118) - 0.04, tSave = w(120) - 0.03, tSend = w(124) - 0.03;
      const X = 40, W = 1000, SH = "rgba(8,22,90,0.42)";
      const dealt = (t, t0, P0) => K.combine(K.enter(t - t0, Object.assign({ dy: 230, pitch: 0.4, yaw: 0, rot: 0.02, sc: 0.92 }, P0 || {})),
        { dx: 0, dy: K.bob(t, t0 * 7, 2.5), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
      function commentCard(t) {
        const Y = 300, H = 282;
        g.save(); K.apply(g, 540, Y + H / 2, dealt(t, 0.04));
        K.card(g, X, Y, W, H, { r: 30, blur: 44, dy: 22, shadow: SH });
        K.text(g, "COMMENTS", X + 40, Y + 54, { size: 26, mono: true, ls: 3, c: rgba(C.ink, 0.55) });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 80, W - 60, 2);
        const iy = Y + 142, n = t >= tPost ? 0 : clamp(Math.floor((t - tType) / 0.065) + 1, 0, WORD.length);
        K.avatar(g, X + 66, iy, 34);
        K.rr(g, X + 118, iy - 38, W - 150, 76, 38); g.strokeStyle = n > 0 ? rgba(C.blue, 0.8) : rgba(C.ink, 0.18); g.lineWidth = n > 0 ? 3.5 : 2; g.stroke();
        if (n > 0) {
          const ww = K.text(g, WORD.slice(0, n), X + 152, iy + 15, { size: 42 });
          if (Math.floor((T0 + t) * 6) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(X + 158 + ww, iy - 22, 3, 44); }
        } else K.text(g, "Add a comment…", X + 152, iy + 11, { size: 32, c: rgba(C.ink, 0.36) });
        const ready = n >= WORD.length, pp = clamp((t - tPost + 0.12) / 0.12) * (1 - clamp((t - tPost) / 0.2));
        K.text(g, "Post", X + W - 66, iy + 11, { size: 32 + 4 * pp, c: ready || pp > 0 ? C.blue : rgba(C.ink, 0.28), align: "right" });
        // the posted comment rises out of the box into the thread
        const kp = clamp((t - tPost) / 0.3);
        if (kp > 0) {
          const ry = lerp(iy, Y + 232, eo(kp));
          g.save(); g.globalAlpha *= clamp(kp * 2);
          K.avatar(g, X + 66, ry, 30);
          K.text(g, "you", X + 118, ry - 4, { size: 27, c: rgba(C.ink, 0.6) });
          K.text(g, "now", X + 176, ry - 4, { size: 26, mono: true, c: rgba(C.ink, 0.4) });
          K.text(g, WORD, X + 262, ry + 1, { size: 44 });
          K.heart(g, X + W - 62, ry - 10, 36, rgba(C.ink, 0.5), null);
          g.restore();
        }
        g.restore();
      }
      function dmCard(t) {
        const Y = 606, H = 384;
        g.save(); K.apply(g, 540, Y + H / 2, dealt(t, 0.08, { dx: 260, dy: 40, yaw: -0.3, pitch: 0.1 }));
        K.card(g, X, Y, W, H, { r: 30, blur: 44, dy: 22, shadow: SH });
        const lg = K.pic("logo", 60); if (lg) g.drawImage(lg, X + 34, Y + 26, 60, 60);
        K.text(g, "desk2quant", X + 112, Y + 60, { size: 34 });
        K.text(g, "DIRECT MESSAGE", X + 113, Y + 90, { size: 25, mono: true, ls: 2.5, c: rgba(C.ink, 0.5) });
        K.text(g, t < tDM ? "typing…" : "now", X + W - 40, Y + 66, { size: 26, mono: true, align: "right", c: t < tDM ? C.blue : rgba(C.ink, 0.45) });
        g.fillStyle = rgba(C.ink, 0.08); g.fillRect(X + 30, Y + 114, W - 60, 2);
        if (t < tDM) { K.typingDots(g, X + 40, Y + 150, t); g.restore(); return; }
        const km = clamp((t - tDM) / 0.32);
        // the real cover
        const cw = 196, cx = X + 40, cy = Y + 146, cs = back(km, 2);
        g.save(); g.translate(cx + cw / 2, cy + cw / 2); g.scale(cs, cs); g.translate(-(cx + cw / 2), -(cy + cw / 2)); g.globalAlpha *= clamp(km * 3);
        K.photo(g, "cover", cx, cy, cw, { r: 16, blur: 22, dy: 10, res: cw });
        g.restore();
        const x0 = X + 274;
        // 50% OFF in a yellow marker, on "fifty percent"
        const ko = clamp((t - tOff) / 0.3);
        const offS = FACTS.offer_pct + "% OFF", ow = K.tw(g, offS, 70, false, -1);
        if (ko > 0) {
          g.save(); g.translate(x0 + ow / 2, Y + 192); const ps = 1 + 0.12 * Math.sin(Math.PI * clamp((t - tOff) / 0.3)); g.scale(ps, ps); g.translate(-(x0 + ow / 2), -(Y + 192));
          g.save(); g.shadowColor = "rgba(120,90,0,0.3)"; g.shadowBlur = 16; g.shadowOffsetY = 6;
          K.rr(g, x0 - 14, Y + 152, (ow + 28) * eo(ko), 82, 14); g.fillStyle = C.yel; g.fill(); g.restore();
          K.text(g, offS, x0, Y + 218, { size: 70, ls: -1, a: clamp(ko * 2) });
          const gp = ((t - tOff - 0.6) % 1.8) / 0.5;
          if (t > tOff + 0.6 && gp < 1) {
            g.save(); K.rr(g, x0 - 14, Y + 152, ow + 28, 82, 14); g.clip();
            const gx = lerp(x0 - 120, x0 + ow + 120, gp);
            const gr = g.createLinearGradient(gx - 60, 0, gx + 60, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = gr; g.fillRect(gx - 60, Y + 152, 120, 82); g.restore();
          }
          g.restore();
        } else {
          K.rr(g, x0 - 14, Y + 152, ow + 28, 82, 14); g.setLineDash([10, 8]); g.strokeStyle = rgba(C.ink, 0.16); g.lineWidth = 3; g.stroke(); g.setLineDash([]);
        }
        K.text(g, FACTS.product, x0, Y + 282 + 8 * (1 - eo(km)), { size: 37, a: km, maxW: W - 274 - 40 });
        // the code chip: blurred, with a lock; then "valid 7 days"
        const kc = clamp((t - tCode) / 0.3), cy2 = Y + 304, chw = 262, chh = 60;
        if (kc > 0) {
          const s = lerp(0.6, 1, back(kc, 2.2));
          g.save(); g.translate(x0 + chw / 2, cy2 + chh / 2); g.scale(s, s); g.translate(-(x0 + chw / 2), -(cy2 + chh / 2)); g.globalAlpha *= clamp(kc * 3);
          K.rr(g, x0, cy2, chw, chh, chh / 2); g.fillStyle = C.ink; g.fill();
          g.save(); K.rr(g, x0, cy2, chw, chh, chh / 2); g.clip(); g.filter = "blur(6px)";
          K.text(g, "•••••", x0 + 30, cy2 + 44, { size: 46, ls: 6, c: C.white }); g.filter = "none"; g.restore();
          g.beginPath(); g.arc(x0 + chw - 32, cy2 + chh / 2, 21, 0, Math.PI * 2); g.fillStyle = C.yel; g.fill();
          K.lock(g, x0 + chw - 32, cy2 + chh / 2 - 2, 24, { col: C.ink, hole: C.yel });
          g.restore();
        } else {
          K.rr(g, x0, cy2, chw, chh, chh / 2); g.setLineDash([10, 8]); g.strokeStyle = rgba(C.ink, 0.16); g.lineWidth = 3; g.stroke(); g.setLineDash([]);
          K.text(g, "CODE", x0 + chw / 2, cy2 + 39, { size: 25, mono: true, ls: 3, align: "center", c: rgba(C.ink, 0.3) });
        }
        const kv = clamp((t - tValid) / 0.3);
        if (kv > 0) {
          const vs = "valid " + FACTS.offer_days + " days", vw = K.tw(g, vs, 30) + 96, vx = x0 + chw + 18, s = lerp(0.6, 1, back(kv, 2.2));
          g.save(); g.translate(vx + vw / 2, cy2 + chh / 2); g.scale(s, s); g.translate(-(vx + vw / 2), -(cy2 + chh / 2)); g.globalAlpha *= clamp(kv * 3);
          K.rr(g, vx, cy2, vw, chh, chh / 2); g.fillStyle = C.mist; g.fill();
          const ccx = vx + 34, ccy = cy2 + chh / 2;   // a clock glyph
          g.beginPath(); g.arc(ccx, ccy, 15, 0, Math.PI * 2); g.strokeStyle = C.blue; g.lineWidth = 4; g.stroke();
          g.beginPath(); g.moveTo(ccx, ccy - 8); g.lineTo(ccx, ccy); g.lineTo(ccx + 7, ccy + 4); g.lineCap = "round"; g.stroke();
          K.text(g, vs, vx + 62, cy2 + chh / 2 + 11, { size: 30 });
          g.restore();
        }
        g.restore();
      }
      function actions(t) {
        const Y = 1014, H = 120;
        g.save(); K.apply(g, 540, Y + H / 2, dealt(t, 0.12, { dy: 60, pitch: 0.3 }));
        // send to a friend
        const ks = clamp((t - tSend) / 0.22), sw = 708;
        const ps = 1 + 0.06 * Math.sin(Math.PI * ks) * (ks < 1 ? 1 : 0);
        g.save(); g.translate(X + sw / 2, Y + H / 2); g.scale(ps, ps); g.translate(-(X + sw / 2), -(Y + H / 2));
        K.card(g, X, Y, sw, H, { r: 30, blur: 36, dy: 18, shadow: SH, fill: mix(C.white, C.ink, ks) });
        g.beginPath(); g.arc(X + 66, Y + H / 2, 36, 0, Math.PI * 2); g.fillStyle = mix(C.blueL, C.blue, ks); g.fill();
        K.plane(g, X + 64, Y + H / 2 + 2, 36, mix(C.blue, C.white, ks), 4);
        K.text(g, "Send to a friend", X + 124, Y + 54, { size: 38, c: mix(C.ink, C.white, ks) });
        K.text(g, "preparing for risk interviews", X + 125, Y + 92, { size: 28, c: mix("#5d6678", "#c9d5ef", ks) });
        g.restore();
        // SAVE
        const kv = clamp((t - tSave) / 0.2), bx = X + sw + 22, bw = W - sw - 22;
        const pb = 1 + 0.1 * Math.sin(Math.PI * kv) * (kv < 1 ? 1 : 0);
        g.save(); g.translate(bx + bw / 2, Y + H / 2); g.scale(pb, pb); g.translate(-(bx + bw / 2), -(Y + H / 2));
        K.card(g, bx, Y, bw, H, { r: 30, blur: 36, dy: 18, shadow: kv > 0.5 ? "rgba(150,20,20,0.45)" : SH, fill: kv > 0.5 ? C.red : C.white });
        K.bookmark(g, bx + 74, Y + H / 2, 46, kv > 0.5 ? C.white : null, kv > 0.5 ? C.white : C.ink, 4.5);
        K.text(g, "SAVE", bx + 118, Y + H / 2 + 14, { size: 40, c: kv > 0.5 ? C.white : C.ink });
        if (kv > 0 && t - tSave < 0.5) { const q = (t - tSave) / 0.5; g.save(); g.strokeStyle = rgba(C.white, 0.7 * (1 - q)); g.lineWidth = 4; K.rr(g, bx - 14 * q, Y - 14 * q, bw + 28 * q, H + 28 * q, 30 + 14 * q); g.stroke(); g.restore(); }
        g.restore();
        g.restore();
      }
      function plate(t) {
        const Y = 1158, H = 190;
        g.save(); K.apply(g, 540, Y + H / 2, dealt(t, 0.16, { dy: 40, pitch: 0.3 }));
        K.card(g, X, Y, W, H, { r: 30, blur: 40, dy: 20, shadow: SH });
        const L = 134, lg = K.pic("logo", L);
        if (lg) g.drawImage(lg, X + 30, Y + 28, L, L);
        K.text(g, "DESK2QUANT", X + 192, Y + 88, { size: 56, ls: 3 });
        K.text(g, FACTS.handle, X + 194, Y + 140, { size: 34, mono: true, ls: 1, c: C.blue });
        const sw = K.tw(g, FACTS.site, 32) + 52;
        K.rr(g, X + W - 32 - sw, Y + 113, sw, 56, 18); g.fillStyle = C.blue; g.fill();
        K.text(g, FACTS.site, X + W - 32 - sw / 2, Y + 152, { size: 32, align: "center", c: C.white });
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        plate(t);
        actions(t);
        dmCard(t);
        commentCard(t);
        K.floor(g);
      }
