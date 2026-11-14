"""Assemble an English voiceover from chosen takes and time every word for the scene.
usage: python3 en_vo.py lines.json spec.json out_dir
spec.json: {"tempo": 1.15, "max_pause": 0.4, "keep": 0.3, "parts": [["a01", "takes/a01_s11.wav"], ...], "gaps": [0.3, ...]}
Each take has its long pauses cut (tighten.py), is sped up by ffmpeg's rubberband (pitch kept) into out_dir/<name>.wav,
then join_vo.py trims the silent edges, joins with the gaps and normalises to -16 LUFS (out_dir/vo.wav). en_words.py
hears every processed take again (a second speech check) and times its words; out_dir/timing.json holds W (every
word's onset in vo.wav) and VO_END for en_caps.py."""
import json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
lines, spec, out = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8")), sys.argv[3]
os.makedirs(out, exist_ok=True)
proc = []
for name, f in spec["parts"]:
    tight, fin = os.path.join(out, name + ".tight.wav"), os.path.join(out, name + ".wav")
    subprocess.run([sys.executable, os.path.join(here, "tighten.py"), f, tight, str(spec.get("max_pause", 0.4)), str(spec.get("keep", 0.3))],
                   check=True, capture_output=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tight, "-af", f"rubberband=tempo={spec['tempo']}", "-ar", "48000", "-ac", "1", fin], check=True)
    proc.append((name, fin))
json.dump({"parts": [[f, 0, None] for _, f in proc], "gaps": spec["gaps"]}, open(os.path.join(out, "join.json"), "w"))
r = subprocess.run([sys.executable, os.path.join(here, "join_vo.py"), os.path.join(out, "vo.wav"), os.path.join(out, "join.json")],
                   check=True, capture_output=True, text=True)
j = json.loads(r.stdout.strip().splitlines()[-1])
subprocess.run([sys.executable, os.path.join(here, "en_words.py"), lines, os.path.join(out, "words.json")] + [f"{n}={f}" for n, f in proc], check=True)
words = json.load(open(os.path.join(out, "words.json"), encoding="utf-8"))
W = []
for (name, _), off in zip(proc, j["offsets"]):
    W += [round(x + off, 3) for x in words[name]["onsets"]]
vo_end = round(words[proc[-1][0]]["end"] + j["offsets"][-1], 3)
json.dump({"W": W, "VO_END": vo_end, "seconds": j["seconds"]}, open(os.path.join(out, "timing.json"), "w"))
print(json.dumps({"seconds": j["seconds"], "VO_END": vo_end, "match": {n: words[n]["match"] for n, _ in proc}}))
