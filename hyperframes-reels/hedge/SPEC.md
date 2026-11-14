# Delta hedging in a minute — Desk2Quant explainer (English)

1080×1920, 30 fps, 59.1 s (voice 55.7 s). Voice: Manish (saved, consented voice; Audio8 on CPU), speaking English from his
Hindi reference, one take per line after a speech check (seed 11, except a07 seed 14: seed 11 said "the hedge drips"), long
pauses cut to 0.3 s, natural speed, joined at −16 LUFS (vo_spec.json).
Frame: filled top to bottom: header at y 44, two-line headlines at 116 px (y 136–368), the chart card y 452–1500 (charts drawn
for a 980 px card and stretched to 1,048 px, text kept upright), captions at 54 px from y 1528, footer, and a chapter strip
(payoff · delta · hedge · rebalance · simulate · 4× rule · cost) at y 1760–1816.
Look: the Desk2Quant product covers come alive. Grid paper #f7f8f3 with 48 px lines #e8e9e4, ink #0b0b0b, the cover yellow
#fdca38 as a highlighter behind one word per headline, a white chart card with a 4 px ink border and a hard 14 px ink shadow,
pastel stat cards (#fff3cc, #dff2f0, #ecebe4). Type: Space Grotesk 700 (headlines), Inter (chart titles, captions),
JetBrains Mono (labels, numbers). Captions: ink on the paper, the spoken word on yellow. Real logo, real product cover.
Sound: bed_synth.py marimba (--hit just after the last word) at −29 LUFS, a few UI sounds on visible actions.

Script (11 lines): You just sold a call option. If the stock rallies, you lose money. / So how does a trading desk sleep at
night? Delta hedging. / Delta tells you how much the option moves when the stock moves by one rupee. / Here, delta is about
zero point five, so for every option you sold, you buy half a share. / Now if the stock ticks up, you lose on the option, but
you gain on the shares. The two almost cancel out. / But delta keeps changing as the stock moves, so the hedge has to be
adjusted, again and again. That's rebalancing. / Watch one simulated path. Rebalance five times, and the hedge drifts. /
Twenty times, it's much closer. Two hundred times, the error almost disappears. / The rule of thumb: rebalance four times as
often, and the error roughly halves. / But every trade costs money, so finding that balance is the real job on the desk. /
Try it yourself in the Stochastic Calculus Visual Lab, on Desk to Quant. / Want the notebooks? Comment hedge, and we'll DM
you the link.

Numbers (tools/hedge_sim.py, Black–Scholes, S0 = K = ₹100, vol 20%, 3 months, r = 0):
- premium ₹3.988, delta 0.5199, gamma 0.0398; a ₹1 rise moves the call to ₹4.528, so the short call loses ₹0.54, the 0.52
  shares gain ₹0.52, net −₹0.02.
- one simulated path (seed 330, 1,600 steps, ₹100 → high ₹126.28 → ₹115.49 at expiry), short call hedged with N equal
  rebalances, final error premium + hedge − payoff: N = 5 → −₹2.38, 20 → −₹0.38, 200 → +₹0.02.
- spread (std) of the final error over 2,000 simulated paths (seed 2026): N = 5, 20, 80, 320 → ₹1.45, ₹0.75, ₹0.39, ₹0.20
  (each ×4 in N about halves it).
- illustrative trading cost of 0.1% of each trade's value, averaged over the same paths: ₹0.11 (5) → ₹0.62 (320); it crosses
  the error spread between 80 and 160 rebalances (the shaded "balance").
Every chart is labelled simulated or illustrative; the footer reads "Simulated data · Educational content, not trading advice".

Shots: 1 the short call's P&L at expiry (hockey stick, profit teal, loss rose); a marker rides from ₹100 to ₹124 on
"rallies" (−₹20.01). 2 the call's value today with its tangent, "slope = Δ = 0.52", stat cards "+₹1.00 stock moves" and
"≈ +₹0.52 option moves". 3 "Δ ≈ 0.52": a rose card "you sold 1 call" → a teal card filling to 0.52 of a share. 4 ₹100 → ₹101:
bars −₹0.54, +₹0.52, net −₹0.02 ≈ 0. 5 Δ against the stock price: the stock wanders 100 → 109 → 93 → 105, the shares held lag
the curve (the gap in rose) until each "rebalance". 6 the simulated path with its rebalance dots, and the error lines for 5,
20 and 200 rebalances drawn as each is spoken. 7 four bars of the error spread with ×4 and ÷2. 8 error spread vs trading cost
(log axis), the balance shaded. 9 the real Stochastic Calculus Visual Lab cover, "Try it yourself", desk2quant.com, and a comment card whose field waits
with a blinking cursor, types HEDGE on "hedge", then "and we'll DM you the link". The post caption must say "Comment HEDGE": the
auto-DM picks the keyword up from the caption, but only once "hedge" has a DM text in its keyword list.
