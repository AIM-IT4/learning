"""Score cloned-voice takes: character error rate after spelling normalisation, plus a key-word check,
with two recognisers (faster-whisper medium = the house standard, large-v3-turbo = second opinion).

  python3 score.py lines.json take_dir [take_dir ...]  -> prints a table, writes <take_dir>/score.json
"""
import json, re, subprocess, sys
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

KEYS = {
    "p1": ["उगते", "सूरज", "उपासना", "ऋग्वेद", "ऋचाओं", "स्तुति", "अर्घ्य", "परंपरा"],
    "p2": ["मान्यता", "सीता", "मुंगेर", "छठ", "व्रत", "महाभारत", "सूर्यपुत्र", "कर्ण", "अर्घ्य", "द्रौपदी"],
    "p3": ["पुराणों", "प्रियव्रत", "पुत्र", "षष्ठी", "जीवनदान", "छठी", "मइया", "मंदिर", "घाटों", "बिहार", "पीढ़ी"],
    "p4": ["पुरोहित", "मूर्ति", "सूरज", "आस्था", "महापर्व", "छठ"],
}

def norm(s):
    s = s.replace("़", "").replace("ॉ", "ो").replace("ँ", "ं").replace("ॅ", "े")
    s = re.sub(r"[^ऀ-ॿ]", "", s)
    return re.sub(r"[।॥]", "", s)

def cer(ref, hyp):
    a, b = norm(ref), norm(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)] / max(1, len(a))

def key_hit(key, hyp):
    k, h = norm(key), norm(hyp)
    best = 0.0
    for i in range(0, max(1, len(h) - len(k) + 1)):
        for L in (len(k) - 1, len(k), len(k) + 1):
            best = max(best, SequenceMatcher(None, k, h[i:i + L]).ratio())
    return best

def load16(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

lines = dict(json.load(open(sys.argv[1], encoding="utf-8")))
if "v2" in sys.argv[1]:
    KEYS.update({"p1": ["उगते", "सूरज", "उपासना", "रिग्वेद", "रिचाओं", "स्तुति", "अर्घ", "परंपरा"],
                 "p2": ["मान्यता", "सीता", "मुंगेर", "छठ", "व्रत", "महाभारत", "सूर्य", "पुत्र", "कर्ण", "अर्घ", "द्रौपदी"],
                 "p3": ["पुराणों", "प्रियव्रत", "पुत्र", "षष्ठी", "जीवनदान", "छठी", "मैया", "मंदिर", "घाटों", "बिहार", "पीढ़ी"],
                 "p4": ["पुरोहित", "मूर्ति", "सूरज", "आस्था", "महापर्व", "छठ", "पूजा"]})
models = {"medium": WhisperModel("Systran/faster-whisper-medium", device="cpu", compute_type="int8", cpu_threads=4),
          "turbo": WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)}
for td in map(Path, sys.argv[2:]):
    out = {}
    for name, text in lines.items():
        y = load16(td / f"{name}.wav"); row = {"script": text}
        for mn, m in models.items():
            segs, _ = m.transcribe(y, language="hi", beam_size=5, vad_filter=False,
                                   initial_prompt="छठ पूजा, छठी मइया, ऋग्वेद, सूर्यपुत्र कर्ण, द्रौपदी, षष्ठी देवी, प्रियव्रत, अर्घ्य, बिहार" if mn == "turbo_p" else None)
            hyp = " ".join(s.text.strip() for s in segs)
            keys = {k: round(key_hit(k, hyp), 2) for k in KEYS[name]}
            row[mn] = {"heard": hyp, "cer": round(cer(text, hyp), 3), "keys": keys, "weak": [k for k, v in keys.items() if v < 0.75]}
        out[name] = row
        print(f"{td.name}/{name}: CER medium {row['medium']['cer']:.1%}  turbo {row['turbo']['cer']:.1%}   weak(both): "
              f"{sorted(set(row['medium']['weak']) & set(row['turbo']['weak']))}   medium-only: {sorted(set(row['medium']['weak']) - set(row['turbo']['weak']))}", flush=True)
        print(f"   turbo heard: {row['turbo']['heard']}", flush=True)
    json.dump(out, open(td / "score.json", "w"), ensure_ascii=False, indent=1)
