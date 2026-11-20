      const TEX_IDS = [];
      const NUM_KEYS = [];
      // ---- s14: the end card, as flat HUD panels (no phone, no pad). "Comment FORMULA, and we'll DM you the free Quant
      // Formula Sheet. Save this, share it, and follow Desk2Quant for Day 12."
      // Left: the comment card on @desk2quant's post (FORMULA types into the box on "FORMULA", then posts: POSTED ✓) and
      // the DM from desk2quant (the real logo) with the real Quant Formula Sheet cover, locked on "Quant".
      // Right: SAVE / SHARE / FOLLOW light on their words; the DESK2QUANT plate (the real logo, @desk2quant,
      // desk2quant.com) on "Desk2Quant"; NEXT · MAKING QUANT EASY · DAY 12 →, 12 locking on "12". The film ends on it: no erase.
      // words: 0 Comment 1 FORMULA, 2 and 3 we'll 4 DM 5 you 6 the 7 free 8 Quant 9 Formula 10 Sheet. 11 Save 12 this,
      //        13 share 14 it, 15 and 16 follow 17 Desk2Quant 18 for 19 Day 20 12.
      const { HUD } = HOLOHUD;
      const T = HUD.theme(218, 22), FPS = 24, FONT = HUD.FONT;
      const { clamp, lerp, eo, eio } = QC;
      const g = document.getElementById("s14-cv").getContext("2d");
      const w = (i) => W[i];
      // layout: left column the comment card and the DM; right column the three rows, the brand plate, the next day
      const CC = { x: 40, y: 566, w: 520, h: 262 }, DM = { x: 40, y: 842, w: 520, h: 624 };
      const FLD = { x: 64, y: 742, w: 472, h: 58 };                                   // the comment box
      const COV = { w: 266, y: DM.y + 224 }; COV.x = DM.x + (DM.w - COV.w) / 2;       // the cover in the DM
      const RX = 576, RW = 464, RY = [566, 702, 838], RH = 120;
      // the brand plate fills the bottom band left of the trader (the chip rail has faded out by then)
      const BR = { x: 54, y: 1502, w: 686, h: 196 }, NX = { x: RX, y: 974, w: RW, h: 492 };
      // timing, all from the words
      const tType = w(1) - 0.05, tPost = tType + 0.6, tDM = w(4) - 0.06, tMsg = tDM + 0.12, tCover = tDM + 0.22, tCovLock = w(8) + 0.2;
      const tRows = w(11) - 0.3, tB = [w(11), w(13), w(16)], tProf = w(17) - 0.08, tDay = w(19) - 0.04, tTwelve = w(20) + 0.12;
      const hit = (t, t0) => t - t0 > 0 && t - t0 < 3 / FPS;
      const st = { t: 0 };
      // the real cover and the real logo: loaded in init (the render waits for them), drawn only once complete, from a
      // smooth step-by-step downscale cached per size
      const IMG = {}, SMALL = {};
      function init() {
        const load = (k, src) => new Promise((res) => {
          const im = new Image(); IMG[k] = im;
          im.onload = () => { res(); draw(); }; im.onerror = () => res(); im.src = src;
        });
        window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
        window.__hf.buildReady["s14-images"] = Promise.all([load("cover", "assets/covers/formula-sheet.png"), load("logo", "assets/logo.png")]);
      }
      function pic(k, wd) {
        const key = k + ":" + wd; if (SMALL[key]) return SMALL[key];
        const im = IMG[k]; if (!im || !im.complete || !im.naturalWidth) return null;
        let src = im, sw = im.naturalWidth, sh = im.naturalHeight;
        while (sw / 2 >= wd) {
          const c = document.createElement("canvas"); c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
          const cx = c.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(src, 0, 0, c.width, c.height);
          src = c; sw = c.width; sh = c.height;
        }
        const c = document.createElement("canvas"); c.width = wd; c.height = Math.round(wd * sh / sw);
        const cx = c.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(src, 0, 0, c.width, c.height);
        return (SMALL[key] = c);
      }
      function rr(x, y, wd, ht, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + wd, y, x + wd, y + ht, r); g.arcTo(x + wd, y + ht, x, y + ht, r); g.arcTo(x, y + ht, x, y, r); g.arcTo(x, y, x + wd, y, r); g.closePath(); }
      function ftext(s, size, wt = 500, mono = false) { g.save(); g.letterSpacing = "0px"; g.font = `${wt} ${size}px ${mono ? FONT.mono : FONT.ui}`; const v = g.measureText(s).width; g.restore(); return v; }
      // line icons: 0 bookmark (save), 1 paper plane (share), 2 person + (follow), 3 a commenter
      function icon(kind, x, y, s, col) {
        g.save(); g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = "round"; g.lineCap = "round"; g.beginPath();
        if (kind === 0) { g.moveTo(x - s * 0.32, y - s * 0.45); g.lineTo(x + s * 0.32, y - s * 0.45); g.lineTo(x + s * 0.32, y + s * 0.45); g.lineTo(x, y + s * 0.2); g.lineTo(x - s * 0.32, y + s * 0.45); g.closePath(); }
        else if (kind === 1) { g.moveTo(x - s * 0.45, y - s * 0.05); g.lineTo(x + s * 0.45, y - s * 0.42); g.lineTo(x + s * 0.12, y + s * 0.45); g.lineTo(x - s * 0.02, y + s * 0.08); g.closePath(); g.moveTo(x - s * 0.02, y + s * 0.08); g.lineTo(x + s * 0.45, y - s * 0.42); }
        else if (kind === 2) { g.arc(x - s * 0.08, y - s * 0.18, s * 0.2, 0, Math.PI * 2); g.moveTo(x - s * 0.45, y + s * 0.45); g.quadraticCurveTo(x - s * 0.45, y + s * 0.05, x - s * 0.08, y + s * 0.05); g.quadraticCurveTo(x + s * 0.29, y + s * 0.05, x + s * 0.29, y + s * 0.45);
          g.moveTo(x + s * 0.36, y - s * 0.2); g.lineTo(x + s * 0.36, y + s * 0.12); g.moveTo(x + s * 0.2, y - s * 0.04); g.lineTo(x + s * 0.52, y - s * 0.04); }
        else { g.lineWidth = 2; g.arc(x, y, s * 0.5, 0, Math.PI * 2); g.moveTo(x + s * 0.17, y - s * 0.12); g.arc(x, y - s * 0.12, s * 0.17, 0, Math.PI * 2); g.moveTo(x - s * 0.3, y + s * 0.36); g.quadraticCurveTo(x, y + s * 0.02, x + s * 0.3, y + s * 0.36); }
        g.stroke(); g.restore();
      }
      // ---- the comment card: FORMULA types into the box and posts ----
      function commentCard(t, f) {
        QC.panel(g, T, CC.x, CC.y, CC.w, CC.h, { open: clamp(t / 0.45), title: "Comments", index: "14", sub: "@desk2quant · Day 11", frame: f });
        const ka = clamp((t - 0.25) / 0.3);
        if (ka <= 0) return;
        const { x, y, w: wd, h } = FLD, n = clamp(Math.floor((t - tType) / 0.0625) + 1, 0, 7), posted = t >= tPost, kp = clamp((t - tPost) / 0.3);
        g.save(); g.globalAlpha = ka;
        g.strokeStyle = T.line(0.8); g.lineWidth = 2; rr(x, y, wd, h, h / 2); g.stroke();
        g.textBaseline = "alphabetic"; g.textAlign = "left";
        if (!posted && n > 0) {
          const s = "FORMULA".slice(0, n);
          g.font = `600 30px ${FONT.ui}`; g.fillStyle = T.hi(1); g.fillText(s, x + 30, y + 40);
          if (f % 12 < 7) { g.fillStyle = T.line(0.9); g.fillRect(x + 34 + g.measureText(s).width, y + 13, 2.5, 33); }
        } else { g.font = `400 26px ${FONT.ui}`; g.fillStyle = T.dim(0.95); g.fillText("Add a comment…", x + 30, y + 38); }
        // the send arrow: navy once the word is typed
        const ax = x + wd - 52, ay = y + h / 2, full = n >= 7 && !posted;
        g.strokeStyle = full ? T.hi(0.95) : T.line(0.7); g.fillStyle = T.hi(0.95); g.lineWidth = 2.5; g.lineJoin = "round";
        g.beginPath(); g.moveTo(ax - 14, ay - 12); g.lineTo(ax + 16, ay); g.lineTo(ax - 14, ay + 12); g.lineTo(ax - 7, ay); g.closePath();
        if (full) g.fill(); g.stroke();
        g.restore();
        // the posted comment: the word rises out of the box into the thread
        if (kp > 0) {
          const ry = lerp(y + 40, CC.y + 142, eo(kp)), a = clamp(kp * 2);
          icon(3, CC.x + 44, ry - 10, 40, T.line(0.85 * a));
          QC.text(g, T, "FORMULA", CC.x + 78, ry, { size: 30, wt: 600, a });
          QC.text(g, T, "POSTED ✓", CC.x + CC.w - 24, ry - 2, { size: 21, mono: true, c: "line", align: "right", a: clamp((kp - 0.5) * 2), roll: clamp((kp - 0.4) * 1.7), frame: f, seed: 4 });
        }
        // "FORMULA,": the target box locks onto the comment box, released as it posts
        const kf = clamp((t - (w(1) - 0.02)) / 0.22), fa = 1 - clamp((t - (tPost - 0.05)) / 0.2);
        if (kf > 0 && fa > 0) QC.lock(g, T, [x, y, x + wd, y + h], kf, { pad: 10, tag: "COMMENT", flash: hit(t, w(1) + 0.2), alpha: fa });
      }
      // ---- the DM: desk2quant's message with the real cover ----
      function dmCard(t, f) {
        const k = clamp((t - tDM) / 0.3);
        if (k <= 0) return;
        QC.panel(g, T, DM.x, DM.y, DM.w, DM.h, { open: k, op: 0.9 });
        const ka = clamp((k - 0.4) / 0.6);
        if (ka <= 0) return;
        const lg = pic("logo", 56);
        if (lg) { g.save(); g.globalAlpha = ka; g.drawImage(lg, DM.x + 24, DM.y + 24, 56, 56); g.restore(); }
        QC.text(g, T, "desk2quant", DM.x + 96, DM.y + 52, { size: 30, wt: 600, a: ka, roll: clamp((t - tDM) / 0.4), frame: f, seed: 3 });
        QC.text(g, T, "DIRECT MESSAGE", DM.x + 97, DM.y + 79, { size: 18, mono: true, c: "dim", ls: 1.5, a: ka });
        g.save(); g.fillStyle = T.line(0.3 * ka); g.fillRect(DM.x + 24, DM.y + 102, DM.w - 48, 1.5); g.restore();
        // the message bubble
        const km = clamp((t - tMsg) / 0.3);
        if (km > 0) {
          const bx = DM.x + 24, by = DM.y + 120, bw = DM.w - 48, bh = 86;
          g.save(); g.globalAlpha = clamp(km * 2); rr(bx, by, bw * eo(km), bh, 16);
          g.fillStyle = T.line(0.07); g.fill(); g.strokeStyle = T.line(0.45); g.lineWidth = 1.5; g.stroke(); g.restore();
          QC.text(g, T, "Hey! Here's your free", bx + 22, by + 37, { size: 28, wt: 500, a: clamp(km * 2), roll: km, frame: f, seed: 5 });
          QC.text(g, T, "Quant Formula Sheet", bx + 22, by + 72, { size: 28, wt: 600, a: clamp(km * 2), roll: clamp(km * 1.2 - 0.2), frame: f, seed: 7 });
        }
        // the cover, scanned in top to bottom
        const cv = pic("cover", COV.w), kc = clamp((t - tCover) / 0.45);
        if (cv && kc > 0) {
          const ch = cv.height, vis = ch * eo(kc);
          g.save();
          g.fillStyle = T.line(0.25); g.fillRect(COV.x - 2, COV.y - 2, COV.w + 4, vis + 4);
          g.drawImage(cv, 0, 0, cv.width, vis, COV.x, COV.y, COV.w, vis);
          if (kc < 1) { g.fillStyle = T.line(0.9); g.fillRect(COV.x - 8, COV.y + vis - 1.5, COV.w + 16, 3); }
          g.restore();
          // "Quant": the target box locks onto the sheet, released as SAVE arrives
          const kl = clamp((t - (tCovLock - 0.22)) / 0.22), la = 1 - clamp((t - (tB[0] - 0.3)) / 0.25);
          if (kl > 0 && la > 0) QC.lock(g, T, [COV.x, COV.y, COV.x + COV.w, COV.y + ch], kl, { pad: 12, flash: hit(t, tCovLock), alpha: la });
        }
      }
      // ---- SAVE / SHARE / FOLLOW: the three rows arrive dim, each lights on its word ----
      function row(i, label, t, f) {
        const y = RY[i], k = clamp((t - (tRows + i * 0.07)) / 0.3);
        if (k <= 0) return;
        const lit = clamp((t - (tB[i] - 0.04)) / 0.2), a = clamp((k - 0.3) / 0.5);
        QC.panel(g, T, RX, y, RW, RH, { open: k, op: lerp(0.72, 0.95, lit) });
        if (a <= 0) return;
        const bs = RH - 32;
        g.save(); g.globalAlpha = a;
        g.fillStyle = T.line(0.1 * lit); g.fillRect(RX + 16, y + 16, bs, bs);
        g.strokeStyle = lit > 0 ? T.line(0.4 + 0.5 * lit) : T.dim(0.5); g.lineWidth = 1.4; g.strokeRect(RX + 16.5, y + 16.5, bs - 1, bs - 1);
        g.fillStyle = T.line(lit); g.fillRect(RX, y + 10, 4, (RH - 20) * eo(lit));
        g.restore();
        icon(i, RX + 16 + bs / 2, y + 16 + bs / 2, bs * 0.62, lit > 0.5 ? T.hi(0.95 * a) : T.dim(0.85 * a));
        QC.text(g, T, label, RX + 16 + bs + 28, y + RH / 2 + 13, { size: 36, wt: 600, ls: 4, c: lit > 0.5 ? "hi" : "dim", a: a * (0.75 + 0.25 * lit),
          roll: clamp(k * 1.5 - 0.3), frame: f, seed: 3 + i });
        QC.text(g, T, "0" + (i + 1), RX + RW - 18, y + 30, { size: 18, wt: 400, mono: true, c: "dim", align: "right", a });
        const kb = clamp((t - (tB[i] - 0.02)) / 0.22), ba = 1 - clamp((t - (tB[i] + 0.75)) / 0.25);
        if (kb > 0 && ba > 0) QC.lock(g, T, [RX, y, RX + RW, y + RH], kb, { pad: 8, flash: hit(t, tB[i] + 0.2), alpha: ba });
      }
      // ---- the DESK2QUANT plate: the real logo, the name, the handle, the site ----
      function brand(t, f) {
        const k = clamp((t - tProf) / 0.35);
        if (k <= 0) return;
        QC.panel(g, T, BR.x, BR.y, BR.w, BR.h, { open: k, op: 0.94 });
        const ka = clamp((k - 0.35) / 0.65);
        if (ka <= 0) return;
        const L = 132, lg = pic("logo", L), lx = BR.x + 32, ly = BR.y + (BR.h - L) / 2, tx = lx + L + 36;
        if (lg) { const vis = L * eo(ka); g.save(); g.drawImage(lg, 0, 0, lg.width, lg.height * vis / L, lx, ly, L, vis); g.restore(); }
        QC.text(g, T, "DESK2QUANT", tx, BR.y + 80, { size: 46, wt: 600, ls: 4, a: ka, roll: clamp(k * 1.5 - 0.3), frame: f, seed: 5 });
        QC.text(g, T, "@desk2quant", tx, BR.y + 124, { size: 27, mono: true, ls: 1, c: "line", a: ka, roll: clamp(k * 1.5 - 0.45), frame: f, seed: 7 });
        QC.text(g, T, "desk2quant.com", tx, BR.y + 166, { size: 30, wt: 500, c: "line", a: ka, roll: clamp(k * 1.5 - 0.55), frame: f, seed: 9 });
      }
      // ---- NEXT · MAKING QUANT EASY · DAY 12 →: "Day" types in, 12 rolls and locks in the accent on "12." ----
      function nextDay(t, f) {
        const k = clamp((t - tDay) / 0.3);
        if (k <= 0) return;
        const { x, y, w: wd, h } = NX;
        QC.panel(g, T, x, y, wd, h, { open: k, op: 0.94 });
        const r = eo(k);
        g.save(); g.fillStyle = T.line(0.9); g.fillRect(x + 24, y + 24, 34 * r, 5); g.fillStyle = T.line(0.35); g.fillRect(x + 62, y + 26, (wd - 86) * r, 1.5); g.restore();
        QC.text(g, T, "NEXT · MAKING QUANT EASY", x + 24, y + 62, { size: 19, mono: true, ls: 1.5, c: "dim", a: clamp(k * 2 - 0.4), roll: clamp(k * 1.5 - 0.2), frame: f, seed: 3 });
        const base = y + 250, size = 88, locked = t >= tTwelve;
        const dw = QC.text(g, T, "DAY", x + 22, base, { size, wt: 400, a: clamp(k * 2 - 0.5) }) + ftext(" ", size, 400) + 12;
        const v = QC.value(g, T, "12", x + 22 + dw, base, { size, roll: locked ? 1 : Math.min(0.99, clamp((t - (tDay + 0.08)) / (tTwelve - tDay - 0.08))), frame: f, flash: hit(t, tTwelve) });
        if (locked) {   // the arrow: on to Day 12
          const ka = eo(clamp((t - tTwelve) / 0.25)), ax0 = v.x0 + v.w + 40, ay = base - 30, ax1 = ax0 + 64 * ka;
          g.save(); g.strokeStyle = T.hi(0.95); g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
          g.beginPath(); g.moveTo(ax0, ay); g.lineTo(ax1, ay); g.moveTo(ax1 - 22 * ka, ay - 22 * ka); g.lineTo(ax1, ay); g.lineTo(ax1 - 22 * ka, ay + 22 * ka); g.stroke(); g.restore();
        }
        // the series so far: 30 cells, Day 1-11 done, Day 12 next
        const kp = clamp((t - (tDay + 0.15)) / 0.5), cw = (wd - 48 - 29 * 5) / 30, py = y + 336;
        if (kp > 0) {
          g.save();
          for (let d = 0; d < 30; d++) {
            const cx = x + 24 + d * (cw + 5), on = d < 11 * eo(kp) - 0.5, nxt = d === 11;
            g.fillStyle = on ? T.line(0.9) : nxt && locked ? T.acc(0.95) : T.dim(0.22);
            g.fillRect(cx, py, cw, 34);
          }
          g.restore();
          QC.text(g, T, "11 OF 30 DAYS DONE · DAY 12 NEXT", x + 24, py + 76, { size: 19, mono: true, ls: 1.5, c: "dim", a: kp });
        }
        // the target box flies onto the 12 and flashes as it locks; then only its corner brackets stay (no cross over the
        // digits: the end card holds still)
        const kb = clamp((t - (tTwelve - 0.22)) / 0.22), bb = v.bb, p = 12;
        if (!bb) return;
        if (kb > 0 && t < tTwelve + 3 / FPS) QC.lock(g, T, bb, kb, { pad: p, flash: hit(t, tTwelve) });
        else if (t >= tTwelve + 3 / FPS) {
          g.save(); g.strokeStyle = T.line(0.9); g.lineWidth = 2;
          HUD.corners(g, bb[0] - p, bb[1] - p, bb[2] + p, bb[3] + p, Math.min(bb[2] - bb[0], bb[3] - bb[1]) / 2 * 0.38 + 14); g.restore();
        }
      }
      function draw() {
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        const xIn = QC.scanIn(t, 0, 0.6);
        QC.clipStage(g, xIn, QC.STAGE.x0);   // no erase: the film ends on this card
        commentCard(t, f);
        dmCard(t, f);
        row(0, "SAVE", t, f); row(1, "SHARE", t, f); row(2, "FOLLOW", t, f);
        brand(t, f);
        nextDay(t, f);
        g.restore();
        QC.scanLine(g, T, xIn);
      }
