# Roshni Photo Studio

Single-file, in-browser photo editor (WebGL 2). Published as a claude.ai Artifact; this is its source.
Photos are processed on the viewer's device and never uploaded.

* **Enhance** – Auto 4K HDR: measures each photo's noise and sets smoothing to match; colour noise is cleaned
  harder than brightness detail; Lanczos-3 resampling with anti-ringing; contrast-adaptive sharpening plus
  fine-texture recovery; local (HDR) tone mapping from a fixed whole-photo brightness map, so the look is the
  same in the preview, when zoomed and in the 4K file. Classic image processing only: faces are never redrawn.
* **Auto modes** – Natural / Vivid / Max HDR, each with automatic white balance (partial, keeps the scene's
  mood), black/white levels and face light when the face area is set. New **Texture** control (medium detail).
* **Retouch** – Dark circles (tap under each eye; lifts only the low-frequency shadow tone toward the cheek below,
  so texture and features are unchanged), Skin smooth (skin tones inside the face area only), Face light.
* **Zoom** – pinch, double-tap, mouse wheel or +/−; the zoomed area is re-processed at full detail (up to 4
  screen pixels per photo pixel).
* **Body** – **Natural fit** (tap top of head and between the feet; proportions place neck, shoulders, chest,
  waist, belly, hips and legs; Lean / Fit / Athletic; gentle strengths; face lock set automatically), Head, All body, Length, Legs, Hips, Hip lift, Waist, Belly, Back, Neck, Arms, Chest, Shoulders,
  free Push, plus a Face lock area that every body warp skips. Up to 24 edits, undo/redo.
* **Colour** – 12 looks (Cinematic, Golden hour, Diwali glow, …) and 18 adjustments incl. split toning.
* **Text** – **Behind person**: MediaPipe Selfie Segmentation (Apache-2.0, TF.js weights from
  @vladmandic/human-models, MIT) finds the person on the device; the edge is refined with a guided filter.
  ~75 Google Fonts (28 with Devanagari), gradient fill, outline, glow, shadow, box, rotation.
* **Save** – 4K (3840 px long side), 2K or original, JPEG or PNG, via the Artifact `downloads` capability
  (falls back to press-and-hold on the shown image).

The embedded sample photo is AI-generated (SDXL-Turbo).

## Stability notes

* The photo pipeline re-runs only when the photo changes; text edits redraw the text layer only.
* Text layers are cached as bitmaps (glow/shadow blurs are slow on phones) and re-rendered only on style change.
* Half-resolution preview while a slider or finger moves; full quality 250 ms after it stops.
* WebGL context loss (phones under memory pressure) is handled: programs, textures and buffers are rebuilt and
  edits are kept. The person cut-out runs on TF.js's CPU backend so it never opens a second graphics context.
* Each new gesture clears stale pointers; a global error handler resets gesture state; layout changes are debounced.
* Tested with 700 random actions in headless Chrome (sliders, text, behind-person, zoom, body tools, undo/redo)
  plus a forced context loss: no errors, memory stable, 4K export still works.
