# गैल्टन बोर्ड — a thousand coin flips make a bell curve

1080×1920, 30 fps, 23.7 s. Voice: Manish (saved, consented voice; Audio8). House palette: paper, ink, teal, yellow, coral.

Script: ऊपर से एक गेंद गिराइए। हर कील पर, वो या तो दाएँ जाएगी, या बाएँ। पचास-पचास का खेल। एक गेंद कहाँ गिरेगी, कोई नहीं जानता।
पर हज़ार गेंदें गिराइए… और देखिए, एक घंटी जैसा आकार बन जाता है। इसे कहते हैं, normal distribution। बेतरतीबी में भी, एक नियम होता है।

Board: 12 rows of pegs (68 px apart, rows 46 px), 13 bins (floor at y 1300), a funnel at the top. Every ball's path is 12 seeded
coin flips (mulberry32, seed 1888), so every render is identical; the whole board is one canvas redrawn from timeline time.
Beats: one big yellow ball hops peg to peg at about half a second a row; its path is forced right on "दाएँ" and left on "बाएँ", and
a tag pops beside it at that moment → three more balls on "एक गेंद कहाँ गिरेगी" → a coral "?" on "कोई नहीं जानता" → "हज़ार गेंदें":
1,000 small balls launch faster and faster (start = s0 + (s1 − s0)·u^0.6), each stacks in its bin by landing order (8 per row), the
counter counts landings and ends on 1000 → "normal": the expected curve, N·φ((k − 6)/√3)/√3 scaled to the stack rows, draws over the
stacks with a "Normal distribution" chip → pegs fade to 25 %, "बेतरतीबी में भी, एक नियम होता है।"
Sound: bed_synth.py marimba (96 bpm); four typing clips rising under the stream as the clatter; pop, click-soft, ping, sparkle, chime.
