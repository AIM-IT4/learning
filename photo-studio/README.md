# Roshni Photo Studio

Single-file, in-browser photo editor (WebGL 2). Published as a claude.ai Artifact; this is its source.
Photos are processed on the viewer's device and never uploaded.

* **Enhance** – Auto 4K HDR: measures each photo's noise and sets smoothing to match; colour noise is cleaned
  harder than brightness detail; Lanczos-3 resampling with anti-ringing; contrast-adaptive sharpening plus
  fine-texture recovery; local (HDR) tone mapping from a fixed whole-photo brightness map, so the look is the
  same in the preview, when zoomed and in the 4K file. Classic image processing only: faces are never redrawn.
* **Zoom** – pinch, double-tap, mouse wheel or +/−; the zoomed area is re-processed at full detail (up to 4
  screen pixels per photo pixel).
* **Body** – **Natural fit** (tap top of head and between the feet; proportions place neck, shoulders, chest,
  waist, belly, hips and legs; Lean / Fit / Athletic; gentle strengths; face lock set automatically), Head, All body, Length, Legs, Hips, Hip lift, Waist, Belly, Back, Neck, Arms, Chest, Shoulders,
  free Push, plus a Face lock area that every body warp skips. Up to 24 edits, undo/redo.
* **Colour** – 12 looks (Cinematic, Golden hour, Diwali glow, …) and 18 adjustments incl. split toning.
* **Text** – ~75 Google Fonts (28 with Devanagari), gradient fill, outline, glow, shadow, box, rotation.
* **Save** – 4K (3840 px long side), 2K or original, JPEG or PNG, via the Artifact `downloads` capability
  (falls back to press-and-hold on the shown image).

The embedded sample photo is AI-generated (SDXL-Turbo).
