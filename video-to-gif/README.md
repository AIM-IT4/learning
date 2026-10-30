# Framepress: video to GIF in the browser

A single self-contained page that converts video to high-quality GIFs entirely on the device. Nothing is uploaded, so it is fine for private footage.

Open `index.html` directly in Chrome, Edge, Safari or Firefox, or host it on any static server. No build step is needed to use it.

## What it does

- **Inputs:** MP4, MOV, M4V, 3GP (including fragmented MP4), WebM and MKV, with H.264, HEVC, VP8, VP9 or AV1 video. HEVC needs a browser with HEVC decoding (Safari, or Chrome/Edge on hardware that supports it). Anything else the browser's `<video>` element can play goes through a slower compatibility path.
- **Any length:** frames stream through a bounded pipeline. Only the compressed GIF is held in memory.
- **Controls:** trim (in/out points), crop (drag a box on the video or type pixel values; Free, Original, 1:1, 4:5, 9:16, 16:9, 4:3), width, frame rate (8–50 fps), playback speed (0.5–4×), per-frame or shared palette, dither (Floyd–Steinberg, Bayer 8×8, off), loop forever or play once.

## How it is fast

1. **Demux in JS.** `src/main.js` parses the MP4/MOV sample tables (`stsz/stco/stsc/stts/ctts/stss`, edit lists, `moof/trun` fragments) and Matroska/WebM clusters (including the unknown-size clusters MediaRecorder writes). Trimming seeks to the keyframe before the in-point, so nothing before it is decoded.
2. **Decode with WebCodecs.** The `VideoDecoder` uses hardware decoding when available. Frames are resized on the GPU with `createImageBitmap(frame, {resizeQuality: 'high'})`, and container rotation (phone video) is applied.
3. **Encode in parallel.** A pool of `hardwareConcurrency - 1` workers (`src/worker.js`) each takes a chunk of frames. Each chunk carries a copy of the previous frame, so chunks are independent and the output stays pixel-exact.

## How it gets good quality

- **Palette:** Xiaolin Wu's variance-minimizing quantizer on a 6-bit-per-channel histogram (finer than the usual 5-bit), 255 colors plus one transparent slot. You can pick one palette per frame, or one shared palette sampled across the clip.
- **Mapping:** exact nearest color in weighted RGB (2:4:3), cached per 6-bit cell. Lookups only search the palette entries that can win inside a coarse cell.
- **Dither:** serpentine Floyd–Steinberg at 7/8 strength, or ordered Bayer 8×8, which compresses better and does not crawl between frames.
- **Frame diff:** a pixel is redrawn only if its displayed color changes. Unchanged pixels become transparent over a cropped rectangle (disposal = keep), and identical frames are folded into the previous frame's delay. Static scenes and screen recordings shrink dramatically.
- **Timing:** delays come from cumulative rounding in centiseconds, so the average rate is exact. Delays never drop below 2 cs, where browsers would otherwise clamp them to 100 ms.

On identical input frames, the quantizer scores 2.8–5 dB higher PSNR than ffmpeg's `palettegen=stats_mode=single` + `paletteuse=new=1:dither=sierra2_4a`.

## Editing

Edit `src/template.html`, `src/main.js` or `src/worker.js`, then run:

```sh
python3 build.py          # rebuilds index.html
```
