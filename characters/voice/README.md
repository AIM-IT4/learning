# Voices for the cast

**Rule: female characters get a female voice, male characters get a male voice.** Check every build with `tools/check_voices.py`.

| Character | Gender | Voice | Engine (licence) |
|---|---|---|---|
| A, B, D, F | male | Charon-matched male | Chatterbox (MIT), conditioned on `refs/male_ref_03.wav` + `refs/male_ref_04.wav` (Desk2Quant FX reel narration) |
| C, E, G | female | `af_heart` (warm, young American female) | Kokoro-82M (Apache-2.0) |

Both engines run locally on CPU and are cleared for commercial use. Don't use the founder's own voice, and never say the narration is AI. ElevenLabs output is only commercially licensed on a paid plan, so don't use it from a Free account.

## Project layout the tools expect

```
<project>/vo/script.txt            one dialogue line per row, as shown on screen ("AI", "Desk2Quant", "P&L")
<project>/vo/speakers.txt          one cast letter per row (A..G), same rows as script.txt
<project>/vo/tts_lines.txt         the same rows as spoken, letters spaced for the aligner ("A I", "Desk to Quant", "P and L")
<project>/vo/tts_lines_male.txt    Chatterbox input: initialisms written solid ("AI", "PDF")
<project>/vo/tts_lines_female.txt  Kokoro input: initialisms with dots ("A.I."), names as spoken ("Desk to Quant")
<project>/reel/                    the page; make_vojs.py and make_lips.py write reel/vo.js and reel/lips.js
```

## Pipeline (run from `<project>/vo`, tools from `characters/voice/tools`)

```bash
T=../../characters/voice/tools          # adjust to where the kit lives
python3 $T/chatterbox_vo.py takes tts_lines_male.txt 7 1,2,3,4,5,7,8    # male rows only (0-based)
python3 $T/kokoro_vo.py     takes tts_lines_female.txt af_heart 1.0 0,6,9   # female rows only
python3 $T/assemble_vo.py takes 0.32 1.0 voice         # trims, joins with 0.32 s gaps -> voice/vo-raw.wav.parts, voice/vo.wav
python3 $T/check_voices.py voice/vo-raw.wav.parts speakers.txt   # must print ok for every row
python3 $T/align_words.py voice/vo-raw.wav.parts 0.32 voice/words.json   # wav2vec2 forced alignment (~360 MB model, first run)
python3 $T/make_vojs.py 0.25                           # -> ../reel/vo.js (VO starts 0.25 s into the reel)
python3 $T/make_lips.py voice/vo-raw.wav.parts 0.32 0.25   # -> ../reel/lips.js (mouth openness per speaker, 60 fps)
```

`make_vojs.py` reads `script.txt`/`speakers.txt` next to itself: copy it into `<project>/vo/` (or run it from there).

In the page, drive mouths with `Kit.lipFrom(window.LIPS, 'C')`, and nods and hand accents with `Kit.nodFrom(words)` and `Kit.accentFrom(words)` built from that speaker's words in `window.VO`.

## Install

- Chatterbox: `pip install chatterbox-tts` (the first run downloads ~3 GB of weights to `~/.cache/huggingface`).
- Kokoro on Python 3.13: `pip install --ignore-requires-python --only-binary=spacy,thinc,blis,cymem,preshed,murmurhash,srsly "kokoro==0.9.4" "misaki[en]==0.9.4" soundfile` (the first run downloads ~330 MB).
- Alignment and checks need `torch` and `torchaudio`.

Cloud sessions have a small disk allowance. If a download fails for space, ask before deleting caches.
