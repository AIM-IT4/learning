# एक शेप, छह काम — UI shape morph (after @twoclipping's "shape morphing through UI states" on prompt-motion.com)

1080×1920, 30 fps, 20 s. Voice: Manish (saved, consented voice in the private studio repo; Audio8, seed 11). House palette.

Script: ये एक साधारण सा शेप है। क्लिक कीजिए, और ये बटन बन गया। अब लोडिंग… और काम हो गया! अब ये बना एक नोटिफ़िकेशन,
फिर म्यूज़िक प्लेयर, और आख़िर में, एक स्लाइडर। एक ही शेप, छह काम। अच्छे मोशन डिज़ाइन में, हर हरकत का एक मक़सद होता है।

One SVG rect (centre 540, 900) is the whole cast: only width, height, corner radius and colour tween (a proxy + onUpdate, no layout
properties). An oversized arrow cursor (130 px, tip at 21%/14%) enters from below and every click causes the next state:
square 240 → button 620×160 ("शुरू करें →") → loader 170 (spinner) → done 200 (check draws, ring pulses) → notification 760×130 (ink)
→ music player 820×330 (play → pause, progress runs) → slider 820×34 (cursor drags the knob 0 → 100%).
"एक ही शेप": it flicks back through all six in 1 s. End: "हर हरकत का एक मक़सद।" with the six jobs as icons.
Counter 0/6 → 6/6 top right, state label under the shape, karaoke captions at y 1310.
Sound: clicks on clicks, chime on the check, notification ping, whooshes on morphs, sparkle on "मक़सद". Bed: bed_synth.py pop (112 bpm).
