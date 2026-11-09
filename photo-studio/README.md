# Roshni Photo Studio

Single-file, in-browser photo and video editor (WebGL 2 + WebCodecs). Published as a claude.ai Artifact; this
is its source. Photos and videos are processed on the viewer's device and never uploaded.

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

* **Video** – MP4 / MOV (H.264; HEVC where the browser can decode it). The file is opened from the device with an
  object URL, so a 600 MB clip opens instantly with nothing uploaded. Preview with play/pause and a scrubber; every
  photo tool works on the frame on screen. **Save video** runs every frame through the same pipeline:
  mp4box.js (BSD-3) reads only the index, samples are read from the file 4 MB at a time, WebCodecs decodes and
  re-encodes (H.264 High, VP9/AV1 fallback), the phone's rotation flag is applied, and mp4-muxer (MIT) writes a new
  MP4 with the original AAC sound copied untouched. Output: 4K, Full HD or original size, High or Standard
  quality, progress with time left, Stop. The output file is moved into Blobs every 32 MB so long clips don't
  sit in JavaScript memory. Text behind the person is cut out on every frame; body and dark-circle edits placed
  on the paused frame follow the person (centre and height from the person finder, smoothed). Film grain moves
  per frame. "This frame" saves a JPEG of the frame on screen.

The embedded sample photo is AI-generated (SDXL-Turbo).

## Stability notes

* The photo pipeline re-runs only when the photo changes; text edits redraw the text layer only.
* Text layers are cached as bitmaps (glow/shadow blurs are slow on phones) and re-rendered only on style change.
* Half-resolution preview while a slider or finger moves; full quality 250 ms after it stops.
* WebGL context loss (phones under memory pressure) is handled: programs, textures and buffers are rebuilt and
  edits are kept. The person cut-out runs on TF.js's CPU backend so it never opens a second graphics context.
* Each new gesture clears stale pointers; a global error handler resets gesture state; layout changes are debounced.
* During a video export the preview's graphics buffers are freed, the screen is kept awake (Wake Lock where
  allowed), the canvas is hidden while it is used for frames, and layout changes wait until it finishes.
* Tested with 700 random actions in headless Chrome (sliders, text, behind-person, zoom, body tools, undo/redo)
  plus a forced context loss: no errors, memory stable, 4K export still works.
