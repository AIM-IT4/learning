"""Speak lines with the Paradee 1.2 ONNX model (an 8M distillation of Kokoro-82M).

    say.py lines.json out_dir [--voice af_heart] [--speed 1.0]

lines.json: [{"id": "l01", "text": "...", "pause_after": 0.25}, ...]
Writes out_dir/<id>.wav per line (24 kHz mono) and out_dir/lines.json with each line's duration.
G2P is misaki (Kokoro's own), with the American lexicon for af_/am_ voices and British for bf_/bm_.
"""
import json, sys, argparse
from pathlib import Path
import numpy as np
import onnxruntime as ort
import soundfile as sf

MODEL = Path.home() / ".cache/paradee/model"
VOICES = ["af_heart", "bf_isabella", "am_puck", "bm_fable"]   # row order of the 1.2 model's voice table
SR = 24000

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--voice", default="af_heart", choices=VOICES)
    ap.add_argument("--speed", type=float, default=1.0)
    a = ap.parse_args()
    import espeakng_loader                                   # bundled espeak-ng (no system package needed)
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(espeakng_loader.get_library_path())
    EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    from misaki import en, espeak
    british = a.voice.startswith("b")
    g2p = en.G2P(trf=False, british=british, fallback=espeak.EspeakFallback(british=british), unk="")
    vocab = json.load(open(MODEL / "config.json"))["vocab"]
    so = ort.SessionOptions(); so.intra_op_num_threads = 2
    sess = ort.InferenceSession(str(MODEL / "onnx/paradee_int8.onnx"), so, providers=["CPUExecutionProvider"])
    names = [i.name for i in sess.get_inputs()]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    meta = []
    for line in json.load(open(a.lines)):
        ps, _ = g2p(line["text"])
        ids = [0] + [vocab[c] for c in ps if c in vocab][:510] + [0]
        feed = {"input_ids": np.array([ids], np.int64), "speed": np.array([line.get("speed", a.speed)], np.float32)}
        if "voice" in names:
            feed["voice"] = np.array([VOICES.index(a.voice)], np.int64)
        wav = sess.run(None, feed)[0][0].astype(np.float32)
        sf.write(out / f"{line['id']}.wav", wav, SR)
        meta.append({**line, "phonemes": ps, "dur": round(len(wav) / SR, 3)})
        print(f"{line['id']}  {len(wav)/SR:5.2f}s  {line['text']}")
    json.dump(meta, open(out / "lines.json", "w"), indent=1)

if __name__ == "__main__":
    main()
