"""Build the reel page from the template, optionally with a voiceover.

    python build.py --print-script         # the exact narration text to send to the TTS
    python build.py                        # no voice: estimated timings, device-voice fallback
    python build.py --voice voice.mp3      # embed the voice and time every scene to it
    python build.py --out some/page.html   # write somewhere else (default: build/ig-reel.html)

With a voice, scene changes are placed on the real pauses between sentences
(found with ffmpeg's silencedetect, then matched to the lines by dynamic
programming), so captions and animations land on the words. Needs ffmpeg and
ffprobe on your PATH; no Python packages.
"""
import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "ig-reel.template.html"
OUT = HERE / "build" / "ig-reel.html"
LEAD_MS = 260                                # a scene appears this long before its line starts
END_HOLD_MS = 2600                           # keep the end card up after the last word


def narration_lines():
    src = TEMPLATE.read_text()
    block = re.search(r"const VO = \[(.*?)\];", src, re.S).group(1)
    lines = re.findall(r'"((?:[^"\\]|\\.)*)"', block)
    return [re.sub(r"\s+", " ", s.replace("*", "").replace("|", "")).strip() for s in lines]


def ffprobe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip()) * 1000


def silences(path, noise_db=-32, min_s=0.22):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af",
                          f"silencedetect=noise={noise_db}dB:d={min_s}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) * 1000 for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) * 1000 for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def align(lines, gaps, speech_start, speech_end, pause_bonus=0.3):
    """Choose which pauses are the scene changes (dynamic programming).

    Every line should take time roughly in proportion to its length, and the
    pause after a full sentence is usually longer than one after a comma. So
    among all ordered choices of len(lines)-1 pauses, pick the one whose scene
    durations best match the line lengths, with a small bonus for long pauses.
    """
    k_scenes = len(lines)
    if len(gaps) < k_scenes - 1:                       # not enough pauses: fall back to even pacing
        span, total, acc, out = speech_end - speech_start, sum(map(len, lines)), 0, []
        for line in lines[:-1]:
            acc += len(line)
            t = speech_start + span * acc / total
            out.append((t, t))
        return out
    total_chars = sum(len(l) for l in lines)
    expected = [(speech_end - speech_start) * len(l) / total_chars for l in lines]
    lengths = sorted(e - s for s, e in gaps)
    typical = lengths[len(lengths) // 2] or 1.0

    def seg_cost(k, start, end):
        return ((end - start - expected[k]) / expected[k]) ** 2

    def bonus(j):
        return -pause_bonus * (gaps[j][1] - gaps[j][0]) / typical

    INF = float("inf")
    n = len(gaps)
    # best[b][j]: cheapest way to place boundary b (after scene b) at gap j
    best = [[INF] * n for _ in range(k_scenes - 1)]
    back = [[-1] * n for _ in range(k_scenes - 1)]
    for j in range(n):
        best[0][j] = seg_cost(0, speech_start, gaps[j][0]) + bonus(j)
    for b in range(1, k_scenes - 1):
        for j in range(b, n):
            for i in range(b - 1, j):
                if best[b - 1][i] == INF:
                    continue
                c = best[b - 1][i] + seg_cost(b, gaps[i][1], gaps[j][0]) + bonus(j)
                if c < best[b][j]:
                    best[b][j], back[b][j] = c, i
    last = k_scenes - 2
    end_j = min(range(n), key=lambda j: best[last][j] + seg_cost(k_scenes - 1, gaps[j][1], speech_end)
                if best[last][j] < INF else INF)
    picks = [end_j]
    for b in range(last, 0, -1):
        picks.append(back[b][picks[-1]])
    return [gaps[j] for j in reversed(picks)]


def measure(voice):
    lines = narration_lines()
    dur = ffprobe_duration(voice)
    gaps = silences(voice)
    speech_start, speech_end = 0.0, dur
    if gaps and gaps[0][0] <= 30:                       # leading silence
        speech_start = gaps[0][1] or 0.0
        gaps = gaps[1:]
    if gaps and (gaps[-1][1] is None or gaps[-1][1] >= dur - 30):   # trailing silence
        speech_end = gaps[-1][0]
        gaps = gaps[:-1]
    gaps = [(s, e) for s, e in gaps if e is not None]

    chosen = align(lines, gaps, speech_start, speech_end)

    scenes, prev_end = [], speech_start
    for k in range(len(lines)):
        s_start = speech_start if k == 0 else chosen[k - 1][1]
        s_end = chosen[k][0] if k < len(chosen) else speech_end
        start = 0 if k == 0 else max(prev_end + 40, s_start - LEAD_MS)
        scenes.append({"start": round(start), "speechStart": round(s_start), "speechEnd": round(s_end)})
        prev_end = s_end
    total = round(max(speech_end + END_HOLD_MS, dur + 600))
    return {"scenes": scenes, "total": total}, dur, len(gaps)


def build(voice=None, out=OUT, audio=None):
    """Time the reel to `voice`; embed `audio` (default: the voice itself, or e.g. the voice+music mix)."""
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    html = TEMPLATE.read_text()
    timing, voice_uri = None, None
    if voice:
        timing, dur, n_gaps = measure(voice)
        embed = Path(audio or voice)
        voice_uri = "data:audio/mpeg;base64," + base64.b64encode(embed.read_bytes()).decode()
        timing_file = HERE / "build" / "timing.json"
        timing_file.parent.mkdir(parents=True, exist_ok=True)
        timing_file.write_text(json.dumps(timing, indent=1))
        print(f"voice {dur / 1000:.1f}s, {n_gaps} pauses found, reel {timing['total'] / 1000:.1f}s "
              f"(timing saved to {timing_file}; embedded {embed.name})")
        for k, s in enumerate(timing["scenes"]):
            print(f"  scene {k}: shows {s['start'] / 1000:5.2f}s  speech {s['speechStart'] / 1000:5.2f}-{s['speechEnd'] / 1000:5.2f}s")
    html = html.replace("/*VOICE*/null", json.dumps(voice_uri))
    html = html.replace("/*TIMING*/null", json.dumps(timing))
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", help="the voiceover; scenes are timed to its pauses")
    ap.add_argument("--audio", help="audio to embed instead of the bare voice (e.g. build/mix.mp3)")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--print-script", action="store_true")
    a = ap.parse_args()
    if a.print_script:
        print(" ".join(narration_lines()))
        sys.exit()
    build(a.voice, a.out, a.audio)
