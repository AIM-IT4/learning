# Desk2Quant, laid flat — landing-page 3D glide (after @twoclipping's "landing page 3D scroll" on prompt-motion.com)

1080×1920, 30 fps, 28.5 s. Voice: Manish (Audio8; d1 first sentence seed 13 because seed 11 skipped "एक बात है").
Only what the live page says: Practitioner-built; 54+ learning resources ("All 54 resources by name"); notes, code labs, playbooks;
"Learn the model. Implement it. Break it. Validate it. Explain it."; Personalized 1-on-1 Sessions. Real logo (site's desk2quant-logo.png).

Capture: shoot_scroll.js (Playwright, viewport 1280×900 at 1.5×, analytics rejected, floating widgets hidden, a screenshot per
screen after its reveal animations) stitched into one 1920×29101 page, cut into 13 tiles. measure.js / measure3.js give the
page coordinates of the words that get highlighter marks.
Camera: #q-stage holds perspective 1500 px; #q-cam sits at the focal point (540, 900) and tilts (rotationX 24–58°, rotation −4 to −24°,
scale 0.45–1.45); #q-pg slides so the focus point lands under it. Beats: hero push-in, marks on "Interview" and "Desk" as they are
said → nav logo → glide down the product grid → fast run to "All 54 resources" (counter 0 → 54+) → flatten over the method heading,
one mark per phrase → 1-on-1 Sessions → pull far back, end card with logo and desk2quant.com. Bed: bed_synth.py pulse with a riser
into a hit on "डेस्क टू क्वांट डॉट कॉम".
