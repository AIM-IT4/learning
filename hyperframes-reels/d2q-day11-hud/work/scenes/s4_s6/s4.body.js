      // ---- s4 timeline ----
      const tF1 = w(1) - 0.05, tB0 = w(3) - 0.35, tB1 = w(6) + 0.2, tSD = w(7), tF2 = w(8);
      const tZ0 = w(8) + 0.12, tZ1 = w(10) + 0.2, tPin = w(10) + 0.04, tR0 = w(10) + 0.14, tR1 = w(13) - 0.02, tLock = w(13);
      const ACCR = {};
      const st = { t: 0 };
      function init() {
        for (const id of TEX_IDS) ACCR[id] = accRange(TEX[id].svg);
        QC.tex.init(document.querySelector('[data-composition-id="s4"]'), TEX, T);
        READY = true;
      }
      function draw() {
        if (!READY) return;
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        const xIn = QC.scanIn(t, 0, 0.6), xOut = QC.STAGE.x0;          // no erase: s5 carries the chart on
        QC.clipStage(g, xIn, xOut);
        const clip = [xOut, xIn];
        // ---- the strip: sigma_day on "20% volatility" (1.26% locks on "1.26%"), z_crash on "So that crash" ----
        strip(clamp(t / 0.45));
        strip4({ clip,
          a1: clamp((t - tF1) / 0.15), k1: clamp((t - tF1) / 0.6), lock1: t >= tSD, kl1: clamp((t - (tSD - 0.2)) / 0.3), fl1: hit(t, tSD + 0.1),
          kDiv: clamp((t - tF2) / 0.3),
          a2: clamp((t - tF2) / 0.15), k2: clamp((t - tF2) / 0.55), lock2: t >= tLock, kl2: clamp((t - (tLock - 0.2)) / 0.3), fl2: hit(t, tLock + 0.1) });
        // ---- the chart ----
        const kP = clamp((t - 0.1) / 0.45);
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: kP });
        panelHead({ k: kP, index: "04", title: TITLE4, sub: SUB, tag: "MODEL", frame: f });
        const z = eio((t - tZ0) / (tZ1 - tZ0)), F = frameAt(z, 0);
        const kPin = clamp((t - tPin) / 0.25), kB = clamp((t - tB0) / (tB1 - tB0));
        const kR = clamp((t - tR0) / (tR1 - tR0)), nR = ZF * (1 - (1 - kR) * (1 - kR)), final = t >= tLock - 0.1;
        // the +-1 sigma band on "1.26%", with its label inside it (gone before the axis zooms out)
        const aLab = clamp((t - (tSD - 0.1)) / 0.25) * (1 - clamp((t - tZ0) / 0.2));
        const under = () => {
          if (aLab <= 0) return;
          const cx = F.X(0);
          QC.text(g, T, "±1σ", cx, 1188, { size: 26, wt: 600, align: "center", c: "hi", a: aLab });
          QC.value(g, T, SD.toFixed(2), cx - 4, 1262, { size: 56, align: "center", unit: "%", roll: clamp((t - (tSD - 0.25)) / 0.35), frame: f, flash: hit(t, tSD + 0.1), a: aLab });
        };
        chart4(F, { axK: clamp((t - 0.25) / 0.5), hideXa: 1 - clamp(kPin * 4),
          bandK: clamp((t - (tSD - 0.12)) / 0.3), under,
          bellX1: lerp(XL0, XL1, eio(kB)), bellHead: kB > 0 && kB < 1, bellA: kB > 0 ? 1 : 0,
          rulerN: nR,
          pinK: kPin, locked: t >= tLock + 0.1, lockK: clamp((t - (tLock - 0.2)) / 0.3), flash: hit(t, tLock + 0.1),
          pulse: clamp((t - w(14)) / 0.6) < 1 ? clamp((t - w(14)) / 0.6) : 0,
          countA: kR > 0 ? clamp(kR * 6) : 0, countS: final ? undefined : MINUS + Math.min(Math.floor(ZF), Math.ceil(nR)),
          countRoll: final ? clamp((t - (tLock - 0.1)) / 0.2) : 0.999, countFlash: hit(t, tLock + 0.1), hroll: clamp(kR * 2), frame: f });
        g.restore();
        QC.scanLine(g, T, xIn < QC.STAGE.x1 ? xIn : xOut);
        QC.tex.end();
      }
