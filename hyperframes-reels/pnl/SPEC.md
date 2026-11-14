# "We made $1.5 million today. Why?" — P&L explain on a desk screen (English)

1080×1920, 30 fps, 62.8 s (voice 60.0 s). Voice: Amit (the founder's saved, consented English voice; Audio8 on CPU), same processing
as the hedge reel (speech-checked takes, pauses to 0.3 s, ×1.15 rubberband, −16 LUFS). Takes: seed 11, except b06 seed 12
(after the speed-up, seed 11 had an "uh" before "six") and b11 seed 12 (seed 11 dropped the opening "If").
Look: a light trading-desk screen in the site's own palette (paper #eef3f8 with a 36 px dot grid, white panels with a 2 px
#d6dfeb border and a soft shadow, navy #06275b, teal #08a9a2 / #067a75, rose #f43f5e, amber #f59e0b). Type: Inter (UI) and
JetBrains Mono (numbers, clock, formulas). Captions: white on a navy band, the spoken word on teal. Real logo, real cover.
Sound: bed_synth.py pulse (--hit just after the last word) at −29 LUFS, a notification on the head of desk's message, soft UI sounds on the bars.

The book is illustrative and says so on screen ("ILLUSTRATIVE BOOK", "illustrative", footer "Illustrative book ·
Educational content, not trading advice"): a long-options book on a day the market fell 2%, implied vol rose 1 point and one
day passed. P&L explain: delta +$900k (short delta into a 2% fall), gamma +$300k (long options, big move), vega +$600k
(+1 vol point), theta −$350k (one day), explained $1.45M; actual $1.5M; unexplained +$50k. The intraday line is a seeded
random walk (mulberry32 seed 26, 5-minute steps, 09:00–18:00) tied to end at $1.5M; it is marked illustrative.
The end card is real: Quantitative Finance for Absolute Beginners, chapter 26 "P&L Thinking and Desk Intuition", whose
opening line is "We made $1.5 million today. Why?", 28 chapters · 28 Python scripts (both the homepage and the cover agree;
the page count is left out because the cover says 542 and the homepage says 378).

Script (12 lines): Six p.m. on the trading desk. The head of desk has one question. / We made one and a half million dollars
today. Why? / Every desk has to answer that, every single day. It's called P and L explain. / Start with delta. The market
fell two percent, and we were short, so delta made nine hundred thousand. / Then gamma. We were long options, so the big move
paid extra: another three hundred thousand. / Volatility jumped one point, and our vega added six hundred thousand. / But a
day went by, and options lose value with time, so theta cost us three hundred and fifty thousand. / Add it up: one point
four five million. / The last fifty thousand is unexplained, and that small gap is where the real questions begin. / A model
problem? A missing risk? A booking error? / If you can explain your P and L, you understand your book. / That's chapter
twenty-six of Quantitative Finance for Absolute Beginners, on Desk to Quant.

Shots: 1 the desk screen: clock 17:59:59 → 18:00:00 on "Six", today's P&L counting with the intraday line to +$1,500,000.
2 the head of desk's message (typing dots, then "We made $1.5M today. Why?"), an amber "Why?" tag on the number. 3 the P&L
explain waterfall panel with seven columns (Delta Δ·ΔS, Gamma ½Γ·ΔS², Vega ν·Δσ, Theta Θ·Δt, Explained, Gap, Actual) and
three market tiles. 4–7 each leg grows from the running total as it is spoken, its tile and formula lit (market −2.0%,
implied vol +1.0 pt, time −1 day). 8 explained $1.45M (navy). 9 actual $1.5M and the +$50k gap, amber with a "?". 10 three
question chips. 11 "Explain the P&L → know the book". 12 the real book cover, chapter 26, desk2quant.com.
