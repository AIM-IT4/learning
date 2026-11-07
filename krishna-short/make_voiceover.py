#!/usr/bin/env python3
"""
make_voiceover.py - generate a Hindi AI voiceover with Piper TTS (free, offline, open source)
and write a timed lyrics file that make_short.py can use directly.

Input is a plain text file, one line of the poem per line:
  * a blank line   = stanza break (longer pause)
  * a leading "!"  = dramatic line: spoken slower, with a longer pause before it

  python make_voiceover.py --text poem.txt --voice rohan --out-audio voice.wav --out-lyrics lyrics.txt
  python make_short.py --images imgs --audio voice.wav --music epic.mp3 --lyrics lyrics.txt --out short.mp4

Voices (Hindi, downloaded once into ./voices from huggingface.co/rhasspy/piper-voices):
  rohan, pratham (male)   priyamvada (female)

The "epic" effect lowers the pitch slightly and adds warmth, compression and a hall-like echo.
An AI voice is good for drafts; your own recitation will always carry more emotion.

Needs: pip install piper-tts numpy ; ffmpeg on PATH.
"""
import argparse
import io
import subprocess
import tempfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
VOICE_DIR = HERE / "voices"
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/{v}/medium/hi_IN-{v}-medium.{ext}"
VOICES = ("rohan", "pratham", "priyamvada")


def ensure_voice(name):
    VOICE_DIR.mkdir(exist_ok=True)
    model = VOICE_DIR / f"hi_IN-{name}-medium.onnx"
    for ext in ("onnx", "onnx.json"):
        dest = VOICE_DIR / f"hi_IN-{name}-medium.{ext}"
        if not dest.exists():
            print(f"downloading voice {dest.name} ...")
            urllib.request.urlretrieve(HF.format(v=name, ext=ext), dest)
    return model


def parse_text(path):
    """Return a list of (text, dramatic, stanza_break_before)."""
    out, gap = [], False
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            gap = gap or (not line and bool(out))
            continue
        if "|" in line and line.split("|", 1)[0].replace(":", "").replace(".", "").strip().isdigit():
            line = line.split("|", 1)[1].strip()  # accept an old timed lyrics file too
        dramatic = line.startswith("!")
        out.append((line.lstrip("!").strip(), dramatic, gap))
        gap = False
    if not out:
        raise SystemExit(f"no text found in {path}")
    return out


def synth(voice, text, length_scale):
    from piper import SynthesisConfig

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        voice.synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=length_scale))
    buf.seek(0)
    with wave.open(buf, "rb") as rf:
        sr = rf.getframerate()
        pcm = np.frombuffer(rf.readframes(rf.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    # trim silence at both ends so our own pauses control the rhythm
    loud = np.flatnonzero(np.abs(pcm) > 0.02)
    if loud.size:
        pad = int(0.03 * sr)
        pcm = pcm[max(loud[0] - pad, 0):loud[-1] + pad]
    return pcm, sr


def fmt_time(t):
    m, s = divmod(t, 60)
    return f"{int(m)}:{s:05.2f}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", required=True, help="poem text, one line per caption")
    ap.add_argument("--voice", default="rohan", choices=VOICES)
    ap.add_argument("--speed", type=float, default=1.0, help=">1 faster, <1 slower (default 1.0)")
    ap.add_argument("--lead", type=float, default=1.2, help="silence before the first line (s)")
    ap.add_argument("--gap", type=float, default=0.45, help="pause between lines (s)")
    ap.add_argument("--stanza-gap", type=float, default=1.1, help="pause at a blank line (s)")
    ap.add_argument("--tail", type=float, default=1.5, help="silence after the last line (s)")
    ap.add_argument("--effect", default="epic", choices=("epic", "none"))
    ap.add_argument("--out-audio", default="voice.wav")
    ap.add_argument("--out-lyrics", default="lyrics.txt")
    args = ap.parse_args()

    from piper import PiperVoice

    voice = PiperVoice.load(str(ensure_voice(args.voice)))
    lines = parse_text(args.text)

    base_scale = 1.12 / args.speed          # a little slower than normal speech suits poetry
    chunks, timed, t, sr = [], [], args.lead, None
    for i, (text, dramatic, stanza) in enumerate(lines):
        if i:
            t += args.stanza_gap if stanza else args.gap
        if dramatic:
            t += 0.5
        pcm, sr = synth(voice, text, base_scale * (1.18 if dramatic else 1.0))
        if dramatic:
            pcm = np.clip(pcm * 1.25, -1, 1)
        chunks.append((t, pcm))
        timed.append((t, text))
        t += len(pcm) / sr
        print(f"{fmt_time(timed[-1][0]):>7}  {'!' if dramatic else ' '} {text}")
    total = t + args.tail

    mix = np.zeros(int(total * sr) + 1, dtype=np.float32)
    for start, pcm in chunks:
        a = int(start * sr)
        mix[a:a + len(pcm)] += pcm
    raw = Path(tempfile.mkdtemp()) / "dry.wav"
    with wave.open(str(raw), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())

    if args.effect == "epic":
        # deeper pitch (duration unchanged), chest warmth, presence, compression, hall echo
        af = (f"asetrate={sr}*0.93,aresample={sr},atempo={1/0.93:.5f},"
              "equalizer=f=110:t=q:w=1:g=4,equalizer=f=3200:t=q:w=1.2:g=2.5,highpass=f=60,"
              "acompressor=threshold=0.1:ratio=4:attack=5:release=120:makeup=2,"
              "aecho=0.85:0.6:70|140|230:0.22|0.14|0.08,loudnorm=I=-16:TP=-1.5")
    else:
        af = "loudnorm=I=-16:TP=-1.5"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", af,
                    "-ar", "44100", "-ac", "2", args.out_audio], check=True)

    Path(args.out_lyrics).write_text(
        "# generated by make_voiceover.py  (time | text)\n"
        + "".join(f"{fmt_time(s)} | {txt}\n" for s, txt in timed), encoding="utf-8")
    print(f"voice  -> {args.out_audio}  ({total:.1f}s)\nlyrics -> {args.out_lyrics}")


if __name__ == "__main__":
    main()
