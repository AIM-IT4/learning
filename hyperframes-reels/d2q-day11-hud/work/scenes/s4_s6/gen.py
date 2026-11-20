"""Assemble work/scenes/s4.js, s5.js, s6.js from the shared chart block (common.js) and each scene's body: the three
scenes carry one chart across their cuts, so the block must stay identical in all three. Edit common.js or sN.body.js
here, then run: python3 work/scenes/s4_s6/gen.py && python3 tools/compose.py s4 s5 s6"""
import os, sys

SRC = os.path.dirname(os.path.abspath(__file__))
DST = os.path.dirname(SRC)                       # work/scenes
common = open(os.path.join(SRC, "common.js"), encoding="utf-8").read().rstrip() + "\n"

HEAD = {
    "s4": ('["sigma_day", "z_crash"]', """\
      // ---- s4: "At 20% volatility, a typical day moves 1.26%. So that crash was a 16-sigma day." ----
      // The normal density of daily moves (sd 1.26% a day, from sigma = 20% a year) on -6..+6 %. sigma_day types in on
      // "20% volatility" and its 1.26% locks on "1.26%" with the +-1 sigma band; z_crash types in on "So that crash", the
      // x axis zooms out to -22..+6 % (the bell shrinks to a spike), the crash lands on the axis at -20.47 %, a sigma ruler
      // runs left to it in 1-sigma steps with a rolling count, and -16.2 sigma locks on "16-sigma".
      // Continues into s5 (no erase): the chart, the strip and the readout end exactly where s5 begins.
      // words: 0 At 1 20% 2 volatility, 3 a 4 typical 5 day 6 moves 7 1.26%. 8 So 9 that 10 crash 11 was 12 a
      //        13 16-sigma 14 day."""),
    "s5": ('["sigma_day", "z_crash", "p_tail", "big_bang", "expected"]', """\
      // ---- s5: "If returns were normal, like Black-Scholes assumes, a day like that would never happen. Not once since
      // the Big Bang." ----
      // The same chart, carried on from s4. The title becomes THE NORMAL CURVE (on "normal") and WHAT BLACK-SCHOLES
      // ASSUMES (on "Black-Scholes"); on "a day like that" an inset opens over the left tail at the crash and its y axis
      // zooms in x10^57 until the curve shows there; p_tail types in and 1.2 x 10^-59 locks on "never happen"; on "Not once
      // since the Big Bang" big_bang and expected type in and the expected count (4 x 10^-47 days) locks on "Bang".
      // Continues into s6 (no erase).
      // words: 0 If 1 returns 2 were 3 normal, 4 like 5 Black-Scholes 6 assumes, 7 a 8 day 9 like 10 that 11 would
      //        12 never 13 happen. 14 Not 15 once 16 since 17 the 18 Big 19 Bang."""),
    "s6": ('["p_tail", "big_bang", "expected", "fat_ratio"]', """\
      // ---- s6: "But it did. Real returns have fat tails: crashes come far more often." ----
      // The same chart, carried on from s5. "did.": the film's one 3-frame glitch and the real crash (19 Oct 1987,
      // -20.47 %) slams onto the axis, tagged IT HAPPENED. "Real returns have fat tails": the y axis turns into log10
      // density (10^0 .. 10^-70), the normal curve becomes the parabola that plunges to ~10^-58 at the crash, the
      // fat-tailed curve (Student-t, 3 df, same 1.26 % sd: illustrative) draws on top, and the crash dot rises onto it
      // (~10^-5). "crashes come far more often": fat_ratio (~97) locks on "more", with the per-year counts of days below
      // -4 sigma as a small table (normal 0.008, fat tails 0.78). Scan-erase at the end.
      // words: 0 But 1 it 2 did. 3 Real 4 returns 5 have 6 fat tails: 7 crashes 8 come 9 far 10 more 11 often."""),
}

for s in sys.argv[1:] or ["s4", "s5", "s6"]:
    ids, desc = HEAD[s]
    body = open(os.path.join(SRC, s + ".body.js"), encoding="utf-8").read().rstrip() + "\n"
    out = (f"      const TEX_IDS = {ids};\n"
           f'      const NUM_KEYS = ["normal", "crash", "bell", "logpdf"];\n'
           f"{desc}\n"
           f"      const {{ HUD }} = HOLOHUD;\n"
           f"      const T = HUD.theme(218, 22), FPS = 24;\n"
           f"      const {{ clamp, lerp, eo, eio }} = QC;\n"
           f'      const g = document.getElementById("{s}-cv").getContext("2d");\n'
           f"      const w = (i) => W[i];\n"
           + common + body)
    open(os.path.join(DST, s + ".js"), "w", encoding="utf-8").write(out)
    print(f"{s}: {len(out.splitlines())} lines")
