      // ---- s5 timeline ----
      const tN1 = w(3) - 0.05, tN2 = w(5) - 0.04, tE0 = w(7) + 0.28, tE1 = w(12) + 0.05, tSw = w(7) + 0.04, tP = w(9);
      const tPL = w(13) - 0.04, tUp = w(14) - 0.1, tBB = w(14) + 0.02, tEx = w(17) - 0.12, tEL = w(19) - 0.04;
      const ACCR = {};
      const st = { t: 0 };
      function init() {
        TEX.expected.svg = accAfterApprox(TEX.expected.svg);
        for (const id of TEX_IDS) ACCR[id] = accRange(TEX[id].svg);
        QC.tex.init(document.querySelector('[data-composition-id="s5"]'), TEX, T);
        READY = true;
      }
      function draw() {
        if (!READY) return;
        const t = st.t, f = Math.floor(t * FPS);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        QC.tex.begin();
        QC.clipStage(g);                                               // no scan-in, no erase: carried on from s4, into s6
        const clip = [QC.STAGE.x0, QC.STAGE.x1];
        // ---- the strip: s4's formulas sweep away on "a day like that"; p_tail types in and locks on "never happen";
        //      on "Not once since the Big Bang" it moves up, big_bang and expected type in, the expected count locks ----
        strip(1);
        const sx = lerp(ST.x - 2, ST.x + ST.w + 2, eio((t - tSw) / 0.34));
        if (sx < ST.x + ST.w) strip4({ sweep: sx, clip });
        stripScan(sx);
        strip5({ clip,
          pY: lerp(R2, R1, eio((t - tUp) / 0.3)), pA: clamp((t - tP) / 0.12), pK: clamp((t - tP) / 0.45), pLock: t >= tPL,
          pLK: clamp((t - (tPL - 0.2)) / 0.3), pFl: hit(t, tPL + 0.1), pLA: 1 - eio((t - tUp) / 0.3),
          bA: clamp((t - tBB) / 0.12), bK: clamp((t - tBB) / 0.5),
          eA: clamp((t - tEx) / 0.12), eK: clamp((t - tEx) / 0.34), eLock: t >= tEL, eLK: clamp((t - (tEL - 0.2)) / 0.3), eFl: hit(t, tEL + 0.1) });
        // ---- the chart: the title becomes THE NORMAL CURVE on "normal" and WHAT BLACK-SCHOLES ASSUMES on "Black-Scholes" ----
        QC.panel(g, T, PX.x, PX.y, PX.w, PX.h, { open: 1 });
        panelHead({ k: 1, sub: SUB, tag: "MODEL" });
        const kA = clamp((t - tN1) / 0.4), kB = clamp((t - tN2) / 0.45);
        panelLabel("04", UP(TITLE4), 1 - clamp((t - (tN1 - 0.06)) / 0.1));
        if (kA > 0) panelLabel(HUD.rollText("05", kA, f, 3),
          HUD.rollText(UP(TITLE5A), kA, f, 5) + (kB > 0 ? HUD.rollText(UP(TITLE5B), kB, f, 9) : ""));
        const F = frameAt(1, 0);
        const kG = clamp((t - (w(3) - 0.1)) / 0.2) * (1 - clamp((t - (w(3) + 0.45)) / 0.45));
        const pu = clamp((t - w(7)) / 0.6);
        chart4(F, { glow: kG, pulse: pu < 1 ? pu : 0 });
        // ---- the inset over the left tail at the crash: its y axis zooms in x10^57 before the curve even shows there ----
        inset(F, { open: clamp((t - w(7)) / 0.3), link: clamp((t - w(7)) / 0.25), e: eo((t - tE0) / (tE1 - tE0)),
          area: clamp((t - w(12)) / 0.25), locked: t >= tPL, frame: f });
        g.restore();
        QC.tex.end();
      }
