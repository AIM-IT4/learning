# त्रिकोण का जादू — Pythagoras by rearrangement, chalkboard style

1080×1920, 30 fps, 29.5 s. Voice: Manish (saved, consented voice; Audio8).
Look: green slate (#22392f) with soft smudges, broken half-erased swipes and dust, a wooden frame and a chalk tray (drawn once).
Chalk: every line is a fixed cloud of speckles along a slightly wobbly path, so it never flickers; fills are 45° chalk hatching
clipped to the shape; letters are Kalam (handwritten Devanagari + Latin, Google Fonts, OFL) revealed left to right.
Colours: white chalk, yellow c², pink a², blue b². Captions in Kalam: the line dim, the spoken word yellow, no boxes.
Sound: synthesised chalk (strokes, scribbled hatching, writing, taps) and bed_synth.py lofi (Rhodes 9th chords, swung drums,
vinyl crackle).

Script: एक समकोण त्रिकोण। दो साइड, a और b, और सबसे लंबी साइड, c। अब ऐसे चार त्रिकोण, एक बड़े वर्ग में सजाइए।
बीच में बची जगह? c का वर्ग। अब इन्हीं त्रिकोणों को, नए तरीक़े से जमाइए… अब बची जगह है, a का वर्ग, और b का वर्ग।
बड़ा वर्ग वही, त्रिकोण वही… तो बची जगह भी बराबर! a का वर्ग, जोड़ b का वर्ग, बराबर c का वर्ग।
ये प्रमेय, हज़ारों साल पुराना है, और आज भी उतना ही सच।

Proof: legs a = 3, b = 4 (c = 5) in a 7 × 7 square, 600 px across. Arrangement A puts the four triangles' right angles in the four
corners (b-leg along the edge, each turned 90°), leaving a tilted c × c hole. Arrangement B needs no turning at all: triangle 1 slides
right by a, triangle 2 slides (−b, +a), triangle 3 slides up by b, triangle 4 stays; the hole becomes a² (top left) and b² (bottom
right). Then the dashed c² outline returns over B, and a² + b² = c² is written, underlined twice and ringed, signed "— Pythagoras".
Voice: p1 seed 11, p2 seed 12, p3 seed 11 cut at 8.80 s (both seeds said "पितागोरस", so the name is written, not spoken), and a new
closing line p4 seed 13. Each part had its pauses over 0.5 s cut to 0.36 s (tools/tighten.py) to fit in 30 s.
