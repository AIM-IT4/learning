# सबसे तेज़ रास्ता — the brachistochrone race, then the tautochrone

1080×1920, 30 fps, 25.6 s. Voice: Manish (saved, consented voice; Audio8). House palette: paper, ink, teal, ochre, coral, yellow.

Script: ऊपर से नीचे तक, सबसे तेज़ रास्ता कौन सा है? सरल रेखा? उसमें दूरी तो सबसे कम है। पर दौड़ कराइए… और ये मुड़ा हुआ
रास्ता जीत जाता है! शुरू में तेज़ी से गिरिए, तो रफ़्तार जल्दी बनती है। इसे कहते हैं, cycloid। और कमाल देखिए: इस रास्ते पर,
गेंदें कहीं से भी चलें, नीचे एक ही पल में पहुँचती हैं!

Physics, computed in the page for A → B = 10 m across and 4 m down, no friction, g = 9.81 (88 px a metre):
straight line s = ½ g sinα t² → 2.43 s; circular arc leaving A straight down (radius 5.8 m), timed by integrating ds / √(2gy) → 1.89 s;
cycloid x = r(θ − sin θ), y = r(1 − cos θ) through A and B (θ_B = 3.82, r = 2.25 m), θ(t) = t·√(g/r) → 1.83 s. The race runs in
real time and starts on "कराइए" so that the cycloid ball crosses B on "जीत"; each result row pops as its ball arrives.
Then a stroboscopic replay (where each ball was every 0.15 s, at 0.75× speed), then a wheel of radius r rolling under the line
through A with a point on its rim tracing the cycloid in yellow. Tautochrone: a full cycloid bowl with the same r; arc length from
the bottom s = 4r sin(φ/2) moves as s0·cos(ωt), ω = √(g/4r), so all four balls (four different heights) reach the bottom after
π·√(r/g) = 1.50 s, on "ही", and again 3.0 s later; a stopwatch counts to 1.50 s and stops.
Sound: bed_synth.py pop (low-passed at 4 kHz); a starter click, a ping for the winner, clicks for the others, sparkle for the
strobe, chime when the four arrive together.
