# घूमते गोले — circles on circles draw a heart, then a rising chart (Fourier series)

1080×1920, 30 fps, 22.1 s. Voice: Manish (saved, consented voice; Audio8). House palette: paper, ink, teal, yellow, coral, ochre.

Script: एक गोला, जो घूम रहा है। उसके किनारे पर एक और गोला, और उस पर एक और। हर गोले की अपनी रफ़्तार।
अब आख़िरी गोले की नोक से एक लकीर खींचिए… और देखिए, ये दिल बना रहा है! सही गोले चुनिए, तो ये कुछ भी बना सकते हैं।
इसे कहते हैं, Fourier series।

The maths runs in the page: a discrete Fourier transform of each closed curve; every term is one circle (radius |cₖ|, k turns per loop),
largest first. The heart x = 16 sin³θ, y = 13 cos θ − 5 cos 2θ − 2 cos 3θ − cos 4θ is exactly eight circles (1×, 3×, 2× the other way,
then five small ones). The second drawing is the rising-chart line with its arrowhead, walked there and back as one closed loop and
sampled by arc length (512 points); its 60 largest terms draw it.
Beats: one teal circle and its arm on "एक गोला" → an ochre circle on its rim, then an ink one → speed chips 1× ↻ 3× ↻ 2× ↺ on "रफ़्तार"
→ five small circles cascade in, a yellow pen appears on "नोक", and the trace starts on "लकीर": one full turn draws the heart by
"है!", which fills → on "गोले चुनिए" the heart machine fades and sixty grey circles cascade in over chart paper → the arrow draws on
"कुछ भी बना सकते हैं" → the title becomes a "Fourier series" chip and f(t) = ∑ cₙ·eⁱⁿᵗ sits below.
Sound: bed_synth.py space (76 bpm); pops per circle, clicks per chip, ping for the pen, chime when the heart closes.
