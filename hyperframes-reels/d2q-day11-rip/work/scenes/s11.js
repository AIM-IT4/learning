      const NUM_KEYS = ["model"];
      // ---- s11, the smile: "At the money, implied vol is 15.6%. At 90, 20.7. At 80, 29.7. One stock, one model, and the
      // flat line bends into a smile." A big white card "Implied vol by strike" (SIMULATED, seed 11, model.iv_pct): the
      // money strike's point pops with a counter rolling to 15.6% and a dashed flat line runs out from it; 90 and 80 land
      // on that line and rise to 20.7 and 29.7 as they are said (the big number top left and the Monte Carlo price top
      // right follow each one); the other six join on "One stock, one model" (two chips); on "bends into a smile" the
      // flat line bends through all nine points and on "smile." the area under it fills: THE SMILE. No exit: the smile
      // holds into s12.
      // words (global): 164 At 165 the 166 money, 167 implied 168 vol 169 is 170-173 15.6%. 174 At 175 90, 176-178 20.7.
      //   179 At 180 80, 181-183 29.7. 184 One 185 stock, 186 one 187 model, 188 and 189 the 190 flat 191 line 192 bends
      //   193 into 194 a 195 smile.
      const g = document.getElementById("s11-cv").getContext("2d");
      const { C, clamp, lerp, eo, eio, back, rgba } = K;
      const st = { t: 0 };
      const w = (i) => WA[i] - T0;
      function init() { }
      const SMILE = K.smileCard(NUM.model);
      const S = {
        tPop: { 100: w(170) - 0.1, 90: w(175) + 0.04, 80: w(180) + 0.04 },
        tLock: { 100: w(173) + 0.16, 90: w(178) + 0.12, 80: w(183) + 0.12 },
        tRise: { 90: w(176) - 0.02, 80: w(181) - 0.02 },
        tTick: { 100: w(166) - 0.02, 90: w(175) - 0.02, 80: w(180) - 0.02 },
        tFlat: w(173) + 0.1, tO0: w(184) - 0.04, tOs: 0.13, tChip1: w(184), tChip2: w(186) - 0.02, tFlatHi: w(190) - 0.04,
        tBend0: w(192) - 0.06, tBend1: w(194) + 0.06, tSmile: w(195) + 0.02 };
      function draw() {
        const t = st.t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        if (t > NEXT) return;                     // s12 opens on this exact card
        SMILE.draw(g, t, S, K.enter(t - 0.02, { dy: 260, pitch: 0.5, yaw: 0, rot: 0.03, sc: 0.92 }));
      }
