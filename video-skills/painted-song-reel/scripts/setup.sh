#!/bin/bash
# One-time setup for painted-song-reel (safe to re-run; quick when everything is there):
#   python packages, fonts (OFL, from the npm packages of Google Fonts), the open-source models (about 9 GB in the
#   Hugging Face cache: DreamShaper XL Lightning fp16, Depth Anything V2 Small, YuNet, faster-whisper large-v3-turbo,
#   HTDemucs) and the intro's laptop picture.
#   bash setup.sh            everything
#   bash setup.sh fonts      only the fonts;  EXTRA_FONTS="noto-sans-gurmukhi noto-sans-tamil" adds lyric fonts
HERE="$(cd "$(dirname "$0")" && pwd)"; SK="$(dirname "$HERE")"
ok=1

# ---------------------------------------------------------------- python packages
if [ "$1" != fonts ]; then
python3 - <<'EOF' > /tmp/psr_missing.txt
import importlib
need = {"torch": "torch", "diffusers": "diffusers", "transformers": "transformers", "accelerate": "accelerate",
        "safetensors": "safetensors", "huggingface_hub": "huggingface_hub", "cv2": "opencv-python-headless",
        "librosa": "librosa", "soundfile": "soundfile", "faster_whisper": "faster-whisper", "demucs": "demucs", "PIL": "pillow"}
for mod, pkg in need.items():
    try: importlib.import_module(mod)
    except Exception: print(pkg)
EOF
MISSING=$(cat /tmp/psr_missing.txt)
if echo "$MISSING" | grep -qx torch; then
  pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu || pip install -q torch torchaudio || ok=0
  MISSING=$(echo "$MISSING" | grep -vx torch)
fi
[ -n "$MISSING" ] && { pip install -q $MISSING || ok=0; }
python3 -c "
import cv2; from PIL import features
assert hasattr(cv2, 'FaceDetectorYN'), 'OpenCV is too old for YuNet (needs 4.5.4+)'
print('python packages ok; raqm text shaping:', features.check('raqm'))" || ok=0
fi

# ---------------------------------------------------------------- fonts
F="$SK/fonts"; mkdir -p "$F"
if [ ! -f "$F/NotoSansDevanagari_700Bold.ttf" ] || [ ! -f "$F/Poppins_500Medium.ttf" ] || [ -n "$EXTRA_FONTS" ]; then
  T=$(mktemp -d); ( cd "$T" && for p in poppins noto-sans-devanagari yatra-one $EXTRA_FONTS; do npm pack "@expo-google-fonts/$p" --silent >/dev/null 2>&1 || echo "font package $p: failed"; done
    for t in *.tgz; do tar xzf "$t"; done
    find . -name "*.ttf" \( -name "Poppins_300Light*" -o -name "Poppins_500Medium*" -o -name "Poppins_600SemiBold*" -o -name "*_700Bold.ttf" -o -name "YatraOne_400Regular*" \) -exec cp {} "$F/" \; )
  rm -rf "$T"; [ -f "$F/YatraOne_400Regular.ttf" ] && cp "$F/YatraOne_400Regular.ttf" "$F/YatraOne.ttf"
fi
ls "$F" | grep -q NotoSansDevanagari_700Bold && echo "fonts ok: $F" || { echo "fonts missing"; ok=0; }
[ "$1" = fonts ] && exit 0

# ---------------------------------------------------------------- models
python3 - <<'EOF' || ok=0
from huggingface_hub import snapshot_download, hf_hub_download
snapshot_download("Lykon/dreamshaper-xl-lightning", allow_patterns=["model_index.json", "scheduler/*", "tokenizer/*", "tokenizer_2/*",
    "*/config.json", "unet/*.fp16.safetensors", "vae/*.fp16.safetensors", "text_encoder/*.fp16.safetensors", "text_encoder_2/*.fp16.safetensors"])
snapshot_download("depth-anything/Depth-Anything-V2-Small-hf")
hf_hub_download("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx")
snapshot_download("mobiuslabsgmbh/faster-whisper-large-v3-turbo")
snapshot_download("adefossez/HTDemucs", allow_patterns=["htdemucs.yaml", "955717e8*"])
print("models ok")
EOF

# ---------------------------------------------------------------- the laptop for the intro
[ -f "$SK/assets/laptop.png" ] || node "$HERE/make_laptop.cjs" "$SK/assets/laptop.png" || ok=0
[ $ok = 1 ] && echo "painted-song-reel: ready" || echo "painted-song-reel: setup had errors (see above)"
