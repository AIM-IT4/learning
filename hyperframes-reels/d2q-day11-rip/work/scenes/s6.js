      const NUM_KEYS = ["crash", "logpdf", "bell"];
      const TEX_IDS = ["fat_ratio"];
      // ---- s6, but it did (brand-blue block): "But it did. Real returns have fat tails: crashes come far more often."
      // s3's calendar page (MON 19 OCT 1987) slams back in and a red BUT IT DID stamp lands on "did". On "Real returns"
      // it flies to the corner of a white chart card: daily-return densities on a log scale (logpdf): the normal plunges
      // to 10⁻⁵⁸ at the crash; on "fat tails" a second curve lifts off the normal's floor to the illustrative fat-tailed
      // one (Student-t, 3 d.f.); on "crashes come far more often" a chip: ≈97× more 4σ days (bell.ratio_4sd, fat_ratio).
      // words (global): 85 But 86 it 87 did. 88 Real 89 returns 90 have 91-92 fat tails: 93 crashes 94 come 95 far 96 more
      //   97 often.
      const g = document.getElementById("s6-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, ei, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { K.texLoad(TEX, "s6-tex", { red: { ink: C.ink, acc: C.red } }, () => draw()); }
      const L = NUM.logpdf, CR = NUM.crash;
      const MONL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const [dd, mon, yy] = CR.date.split(" "), mi = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mon);
      const CAL = { day: dd, month: MONL[mi], year: yy, dow: DOW[new Date(Date.UTC(+yy, mi, +dd)).getUTCDay()], page: true, ring: 1, hl: 1 };
      const tSlam = w(85) - 0.06, tStamp = w(87) - 0.02, tCard = w(88) - 0.06, tFly = w(88) - 0.04;
      const tN0 = tCard + 0.25, tLift = w(91) - 0.06, tLift1 = w(92) + 0.3, tChip = w(93), tForm = w(95) - 0.1;
      const X0 = 40, Y0 = 506, W0 = 1000, H0 = 1126;
      const Fr = K.frame(206, Y0 + 210, 784, 640, [-22, 6], [-70, 2]);
      const PAGE = { cx: 900, cy: Y0 + 66 + 0, w: 150, rot: 0.08 };
      const sup = (e) => "10" + String(e).split("").map((c) => ({ "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" })[c]).join("");
      const at = (arr, x) => { const i = Math.round((x - L.x[0]) / (L.x[1] - L.x[0])); return arr[Math.max(0, Math.min(arr.length - 1, i))]; };
      function page(cx, cy, sc, rot, stampU) {
        g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(sc, sc);
        K.calendar(g, 0, 0, 760, CAL);
        if (stampU > 0) K.stamp(g, "BUT IT DID", 0, 40, { u: stampU, rot: -0.2, size: 84, col: C.red, ground: C.white, seed: 4, fill: "rgba(255,255,255,0.88)" });
        g.restore();
      }
      function chart(t) {
        const P = K.enter(t - tCard, { dy: 260, pitch: 0.45, yaw: 0, sc: 0.92 });
        if (t > NEXT) Object.assign(P, K.combine(P, K.leave(t - NEXT, { dy: -170, dur: 0.3 })));
        g.save(); K.apply(g, 540, Y0 + H0 / 2, P);
        K.card(g, X0, Y0, W0, H0, { r: 30, shadow: "rgba(8,22,90,0.45)", blur: 50, dy: 26 });
        K.text(g, "Daily returns · log scale", X0 + 40, Y0 + 80, { size: 42 });
        K.prov(g, "ILLUSTRATIVE", X0 + 40, Y0 + 138, { col: C.red, tc: C.ink });
        K.axes(g, Fr, { k: clamp((t - tCard - 0.1) / 0.4), xt: [-20, -15, -10, -5, 0, 5], xf: (v) => (v < 0 ? K.MINUS : "") + Math.abs(v) + "%",
          yt: [0, -20, -40, -60], yf: (v) => sup(v), size: 26, xl: "DAILY RETURN", yl: "LIKELIHOOD" });
        // the normal: drawn left to right
        const kn = clamp((t - tN0) / 0.5);
        K.line(g, Fr, L.x, L.normal, { k: eio(kn), c: C.ink, w: 6, head: true });
        if (kn > 0.9) K.chip(g, "NORMAL", Fr.X(-14.5), Fr.Y(at(L.normal, -14.5)) + 52, { k: clamp((kn - 0.9) * 10), size: 26, mono: true, h: 46, fill: C.white });
        // the fat tail lifts off the normal's floor on "fat tails"
        const kf = eio(clamp((t - tLift) / (tLift1 - tLift)));
        if (kf > 0) {
          const ys = L.fat.map((v, i) => lerp(L.normal[i], v, kf));
          // the extra tail likelihood: the gap between the two curves
          g.save(); g.beginPath(); g.rect(Fr.x, Fr.y - 10, Fr.w, Fr.h + 10); g.clip(); g.beginPath();
          L.x.forEach((x, i) => (i ? g.lineTo(Fr.X(x), Fr.Y(ys[i])) : g.moveTo(Fr.X(x), Fr.Y(ys[i]))));
          for (let i = L.x.length - 1; i >= 0; i--) g.lineTo(Fr.X(L.x[i]), Fr.Y(L.normal[i]));
          g.closePath(); g.fillStyle = rgba(C.red, 0.18 * kf); g.fill(); g.restore();
          K.line(g, Fr, L.x, ys, { c: C.red, w: 8, glow: 0.4 * kf });
          K.chip(g, "FAT TAILS · illustrative: Student-t, 3 d.f.", Fr.X(-17.5), Fr.Y(-24), { k: clamp((kf - 0.5) * 2), size: 26, mono: true, h: 48, fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(229,72,77,0.3)" });
        }
        // the crash: the normal says 10⁻⁵⁸, the fat tail says 10⁻⁵
        if (kn > 0.95) {
          const x = Fr.X(CR.ret_pct);
          g.save(); g.setLineDash([10, 8]); g.strokeStyle = rgba(C.red, 0.7); g.lineWidth = 3; g.beginPath(); g.moveTo(x, Fr.y + Fr.h); g.lineTo(x, Fr.y - 6); g.stroke(); g.restore();
          K.dot(g, x, Fr.Y(L.crash_normal), { r: 11, c: C.ink });
          K.text(g, CR.date.split(" ")[2], x + 22, Fr.Y(L.crash_normal) + 10, { size: 28, mono: true });
          if (kf > 0) {
            const y1 = Fr.Y(lerp(L.crash_normal, L.crash_fat, kf));
            g.save(); g.strokeStyle = C.red; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(x, Fr.Y(L.crash_normal) - 18); g.lineTo(x, y1 + 18); g.stroke();
            g.beginPath(); g.moveTo(x - 14, y1 + 32); g.lineTo(x, y1 + 14); g.lineTo(x + 14, y1 + 32); g.stroke(); g.restore();
            K.dot(g, x, y1, { r: 13, c: C.red, pulse: clamp((t - tLift1) / 0.5) });
          }
        }
        // ≈97× more 4σ days
        const kc = clamp((t - tChip) / 0.3);
        if (kc > 0) K.chip(g, "≈" + Math.round(NUM.bell.ratio_4sd) + "× MORE 4σ DAYS", Fr.x + Fr.w - 8, Fr.Y(-52), { k: kc, size: 36, align: "right", fill: C.red, col: C.white, stroke: "rgba(0,0,0,0)", shadow: "rgba(229,72,77,0.35)" });
        K.tex(g, "fat_ratio", 540, Y0 + H0 - 110, 46, { align: "center", valign: "middle", k: clamp((t - tChip) / 0.45), variant: "red" });
        // the calendar page, landed in the corner
        if (t >= tFly + 0.5) page(PAGE.cx, PAGE.cy + 40, PAGE.w / 760, PAGE.rot, 1);
        g.restore();
      }
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        if (t > tCard) chart(t);
        // the calendar page: slams in, gets the stamp, then flies to the card's corner
        if (t > tSlam && t < tFly + 0.5) {
          const u = t - tSlam, sl = clamp(u / 0.14), sh = K.shake(u - 0.14, 14, 2), sh2 = K.shake(t - tStamp - 0.1, 10, 5);
          const q = eio(clamp((t - tFly) / 0.5));
          const cx = lerp(540 + sh[0] + sh2[0], PAGE.cx, q), cy = lerp(1072 + sh[1] + sh2[1], PAGE.cy + 40, q) - 120 * Math.sin(Math.PI * q);
          g.save(); g.globalAlpha = sl;
          page(cx, cy, lerp(lerp(1.4, 1, ei(sl)), PAGE.w / 760, q), lerp(-0.04, PAGE.rot, q), t - tStamp);
          g.restore();
        }
      }
