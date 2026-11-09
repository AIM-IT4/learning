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
* **Moving people (video)** – MoveNet SinglePose Lightning (Apache-2.0; TF.js weights from @vladmandic/human-models,
  MIT, re-packed here with 8-bit per-channel weights, ~2.4 MB) finds 17 body points on the device. Natural fit is
  placed from the shoulders and hips on every frame, so it follows the person as they walk, turn or come closer;
  the face lock follows the eyes. Other body edits and dark-circle spots are stamped with the frame they were placed
  on and follow the person through a move/turn/scale transform from that frame's pose (torso for the body, eyes for
  spots). Poses are smoothed with a One-Euro filter. On photos, Natural fit now finds head and feet by itself.
* **Combine two videos** – Video tab: rotate either clip in 90° steps, then join them **one after another** with a
  Smooth blend, Spin (one full turn with motion blur), Zoom or Slide transition (mirrored edges, so no gaps or
  lines), or merge them **side by side / top and bottom** with an overlapping soft blend and colour matching so no
  seam line shows. Clip 2 can fill the frame or show whole over a blurred copy of itself. The preview plays both
  clips on one clock. Export decodes both files on a shared timeline. Sound: the two AAC tracks are joined untouched
  when their formats match; otherwise they are decoded, crossfaded or mixed and re-encoded (AAC, or Opus where the
  browser has no AAC encoder).

The embedded sample photo is AI-generated (SDXL-Turbo).

## Stability notes

* The photo pipeline re-runs only when the photo changes; text edits redraw the text layer only.
* Text layers are cached as bitmaps (glow/shadow blurs are slow on phones) and re-rendered only on style change.
* Half-resolution preview while a slider or finger moves; full quality 250 ms after it stops.
* WebGL context loss (phones under memory pressure) is handled: programs, textures and buffers are rebuilt and
  edits are kept. TF.js (person cut-out and body points) runs on the graphics chip when possible and falls back to the processor if that fails.
* Each new gesture clears stale pointers; a global error handler resets gesture state; layout changes are debounced.
* Phones hand the browser a picked video as a reference into Google Photos, Files or a cloud app; some of these
  only allow reading front to back, or stop allowing reads later ("the requested file could not be read"). When a
  clip is opened the app checks it can read the file in pieces; if not, it copies it once, front to back, into the
  page's private storage (Origin Private File System, or browser-managed Blobs as a fallback) and saves from the
  copy. A read failure during saving triggers one automatic retry from a copy; a file that can't be read at all
  If even a front-to-back copy is refused, the video is made from the player that already has the file open
  ("player mode"): each output frame is shown on the player (seek + requestVideoFrameCallback) and copied, and the
  sound is recorded while the clips play once in real time through Web Audio, each clip separately together with
  its playing position, then lined up per clip and crossfaded or mixed before encoding.
* During a video export the preview's graphics buffers are freed, the screen is kept awake (Wake Lock where
  allowed), the canvas is hidden while it is used for frames, and layout changes wait until it finishes.
* Tested with 700 random actions in headless Chrome (sliders, text, behind-person, zoom, body tools, undo/redo)
  plus a forced context loss: no errors, memory stable, 4K export still works.
