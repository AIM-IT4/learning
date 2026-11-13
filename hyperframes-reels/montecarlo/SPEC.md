# बिंदुओं से π — Monte Carlo: random dots find π

1080×1920, 30 fps, 25.1 s. Voice: Manish (saved, consented voice; Audio8). House palette: paper, ink, teal, coral, yellow, ochre.

Script: एक वर्ग, और उसके अंदर एक गोला। अब इस पर, बिना निशाना लगाए, बिंदु बरसाइए। कोई अंदर गिरेगा, कोई बाहर।
अंदर वाले बिंदु गिनिए, कुल से बाँटिए, और चार से गुणा कीजिए… जितने ज़्यादा बिंदु, उतना सटीक पाई! इसे कहते हैं, Monte Carlo।
कई options की कीमत भी, इसी तरह निकाली जाती है।

The maths is real: 50,000 seeded points (mulberry32, seed 8) in a 660 px square; a point is inside when x² + y² ≤ 1, and every
number on screen is counted from those points. Seed 8 was picked as a typical run, not a lucky one: it ends at 4 × 39,234 ÷ 50,000 =
3.1387, about 0.003 from π, which is what 50,000 points usually give (σ ≈ 0.007). Shown to three places: 3.139.
Beats: the square and its circle draw themselves → twelve dots land one by one (teal inside, coral outside), "अंदर" and "बाहर" tags
on the first of each → forty → the formula assembles word by word: π ≈ 4 × 31 ÷ 40 = 3.10 → "जितने ज़्यादा": a rush to 50,000
(log-paced), the formula counting live, and a convergence chart (estimate against points, log scale, π dashed) settling onto π →
"पाई!" the estimate lights up → the title becomes a "Monte Carlo" chip → thirty simulated price paths (geometric Brownian motion,
σ = 0.3) fan out against a dashed strike, teal if they end above it, coral if below, labelled "simulated".
Sound: bed_synth.py pulse with its riser and hit on "पाई" (low-passed at 4.5 kHz); key presses for the first dots, a typing flurry,
clicks as the formula assembles, sparkle on "पाई".
