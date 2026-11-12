# कंपाउंडिंग का जादू — vertical explainer reel

1080×1920, 30 fps, 26.4 s. Hindi voiceover in the founder's own cloned voice ("amit", Audio8, local).
House reel style: paper #f7f7f3, ink #12221f, teal #0b7f79, yellow highlight #ffd23f; content fills y 230–1440.

## Script (the voice is the clock)
1. अगर आप हर महीने सिर्फ़ पाँच हज़ार रुपये बचाएँ, तो बीस साल में आप जमा करेंगे बारह लाख।
2. लेकिन बारह प्रतिशत सालाना रिटर्न पर, यही पैसा बन जाता है, करीब पचास लाख!
3. यानी सैंतीस लाख से ज़्यादा, सिर्फ़ ब्याज पर ब्याज से। यही है कंपाउंडिंग का जादू। जल्दी शुरू कीजिए।

## Data (exact)
₹5,000 at the end of every month, 12% a year compounded monthly (1%/month), 20 years.
Deposits ₹12 लाख; value FV = 5000·((1.01^240 − 1)/0.01) = ₹49.46 लाख; interest ₹37.5 लाख.
Disclaimer on the end card: illustrative, returns not guaranteed.

## Shots (film time = voice time + 0.2 s)
| cue | word | what moves |
| --- | --- | --- |
| 0.0 | — | poster: ₹5,000 / हर महीने / × 20 साल = ? (250 px / 104 px) |
| 2.62 | बचाएँ | coin drops into column 1 (0.32 s, power2.in), pop |
| 4.12 | बीस | 20 deposit columns ramp linearly; total counts ₹5,000 → ₹12 लाख |
| 7.76 | बारह (%) | "12% सालाना" badge, back.out, click |
| 9.14 | रिटर्न | interest (yellow) grows on every column, power2.in; axis 12 → 50 लाख |
| 13.08 | पचास | ₹49.5 लाख lands, "20 साल बाद"; riser peaks here + bass hit |
| 14.94 | सैंतीस | legend: yellow ₹37.5 लाख सिर्फ़ ब्याज से / teal ₹12 लाख आपका पैसा; brackets on col 20 |
| 17.52 | ब्याज | dashed curve 30 px above the real column tops draws left → right; "ब्याज पर ब्याज" |
| 20.12 | कंपाउंडिंग | annotations blur out, chart dims to 35%, "कंपाउंडिंग का जादू" (Yatra One 140 px), sparkle |
| 21.93 | जल्दी | "जल्दी शुरू कीजिए।" on yellow; disclaimer card at +0.5 s, held 4 s |

Captions: Noto Sans Devanagari 700, 46 px, y 1330, balanced lines; the spoken word gets the yellow bar.

## Rebuild
`python3 tools/build_vo.py compound/assets/vo.wav 0.45 takes/c1.wav takes/c2.wav` (−16 LUFS); measure the words
(`tools/words.py` + `tools/sil.py`, pause snap); `python3 tools/apply_compound.py compound compound/cues.json` patches CAPS
and rewrites index.html with every SFX on its cue.
Bed: MusicGen-small, normalised to −30 LUFS under the voice.
