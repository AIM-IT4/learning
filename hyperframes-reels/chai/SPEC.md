GOAL:    the viewer knows the exact masala chai ratio after 25 s and wants to make a cup now
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps
TIME:    25.0 s x 30 = 750 frames; the Hindi voiceover (assets/vo.wav, starts 0.2 s) is the clock
LOOK:    a risograph spice-packet print. paper: turmeric #F3B13B, 3% fibre noise, no gradients.
         ink A chai brown #3A1D12: every word to read, every outline (6 px).
         ink B chilli red #E2412A: one focus per frame (the measurement being named).
         overprint orange #EE7B2E: where the inks meet (the caption's current word bar, flame core).
         steel #C9CED5 only for the pan, cup and jug; halftone dots (8 px pitch) are the only shading.
         display: Yatra One 150 px (title), measurement numbers Poppins 600 120 px, labels Noto Sans Devanagari 700 64 px,
         captions Noto Sans Devanagari 700 54 px.
OBJECTS: a steel saucepan with a black handle on a gas flame; a steel measuring cup; a knob of ginger; two green
         cardamom pods; two cloves; a spoon of tea leaves; a small steel milk jug; two sugar cubes; a tea strainer;
         a cutting-chai glass. The liquid's surface inside the pan rises and changes colour: water, amber tea, milky chai.
MOTION:  arrivals expo.out 0.5 s; drops fall power2.in 0.35 s then a splash ring 0.4 s; pours rotate power3.inOut 0.4 s;
         stamps land back.out(1.6) 0.25 s, leave as a blur swap 0.15 s; liquid level and colour power2.inOut 0.8-1.0 s.
SHOTS:   0.0-3.8  title stamped, empty pan on the flame (frame 0 is the poster); "सही नाप से" underline draws on "सही"
         3.8-6.7  cup slides in on "पैन", pours on "एक कप", water rises; stamp "1 कप / पानी" on "पानी"
         6.7-11.0 ginger, 2 cardamom, 2 cloves drop on their words, each with a splash and its stamp
         11.0-15.3 spoon tips leaves on "चाय पत्ती", water turns amber; timer ring 2:00 → 0:00 on "दो मिनट", bubbles boil
         15.3-18.4 jug pours milk on "दूध", liquid turns milky; two sugar cubes on "चीनी"
         18.4-25.0 pan slides left and tilts, chai pours through the strainer into the glass on "छानिए"; "बस!";
                   "आपकी मसाला चाय तैयार" on "तैयार", steam; the recipe card lists all seven measurements, held to the end
SOUND:   voice is the clock; local music bed (warm acoustic, tabla/sitar, 96 bpm) at 0.12 under the voice;
         pop on each drop, short whoosh on each vessel entering, sparkle once on "तैयार"
BANNED:  dark void; glow; purple or mesh gradients; cream paper with serif and italic accents; pill chips; HUD labels;
         everything centred and fading up together; titles moving after they land; three cards in a row
QA:      0.0 (poster readable), 6.4 (water + stamp), 10.8 (spices), 14.6 (timer + amber), 18.2 (milk + sugar),
         20.2 (strain + बस), 22.4 (final title), 24.6 (recipe card)
