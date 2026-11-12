# रिकर्शन, तीन अंदाज़ में — recursion in three genres (after @emollick's "recursion explained in genres" on prompt-motion.com)

1080×1920, 30 fps, 29.5 s. Voice: Manish (Audio8; r1 seed 11, r2 first half seed 12 to fix "छोटी", rest seed 11).

Poster: the title inside itself, 7 levels, each 0.66× about the fixed point (540, 1040); "क्या" zooms one level in.
1 कोड: a dark editor card (JetBrains Mono): countdown(n) with `if (n === 0) return; // बेस केस` and `countdown(n - 1); // खुद को`;
   a yellow self-call arrow in the gutter; each count (पाँच … एक) pushes a stack frame and prints to the console; "रुक गया" adds the
   yellow base-case frame, then the stack unwinds.
2 गुड़िया: nesting dolls drawn in SVG (innermost first, so each doll sits inside the one that holds it); the top half flies off and the
   next, smaller doll grows out (scale 1 → 0.78 → 0.6 → 0.45); the smallest is solid; "यही है बेस केस" lines all four up as n=3…n=0.
3 आईना: a Droste tunnel, 16 frames each 0.8× and turned 7°; it zooms by whole levels forever (period 4 levels), faster on
   "बिना बेस केस के", with ∞. End: "रिकर्शन — खुद को बुलाओ, पर रुकना मत भूलो।"
Chips 1/2/3 in the header follow the genre. Bed: bed_synth.py marimba (a copy of the motif joins every 2 bars).
