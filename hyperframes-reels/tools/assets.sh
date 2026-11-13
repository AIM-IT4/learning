#!/usr/bin/env bash
# Fill each project's assets/ with the fonts and sound effects its scene uses (no media is kept in git).
# usage: tools/assets.sh   (from hyperframes-reels/)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
fonts="$here/../video-skills/painted-song-reel/fonts"
sfx="${SFX_DIR:-$HOME/.claude/skills/media-use/audio/assets/sfx}"
put() {  # project, then the sfx names
  local p="$1"; shift
  mkdir -p "$here/$p/assets/fonts" "$here/$p/assets/sfx"
  cp "$fonts"/{NotoSansDevanagari_700Bold,YatraOne,Poppins_600SemiBold,Poppins_700Bold}.ttf "$here/$p/assets/fonts/"
  for s in "$@"; do cp "$sfx/$s.mp3" "$here/$p/assets/sfx/"; done
}
put chai whoosh-short whoosh pop click-soft sparkle
put compound pop riser impact-bass-1 click-soft sparkle
put kinetic whoosh-short whoosh pop glitch-1 impact-bass-2 key-press typing click
put shape click click-soft chime notification whoosh-short whoosh-cinematic pop sparkle
put recur whoosh whoosh-short whoosh-cinematic pop ping key-press click-soft sparkle
put site3d click-soft whoosh whoosh-short whoosh-cinematic pop ping key-press sparkle
put maze whoosh-short whoosh pop click-soft sparkle chime
put tess whoosh-short whoosh-cinematic pop click-soft sparkle ping riser
put eqd whoosh-short whoosh pop click-soft sparkle ping key-press impact-bass-1 typing
put galton pop click-soft whoosh-short whoosh ping typing sparkle chime
put fourier pop click-soft whoosh-short whoosh ping sparkle chime
put golden pop click-soft whoosh-short whoosh ping sparkle chime key-press
for p in galton fourier golden; do cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf "$here/$p/assets/fonts/"; done  # φ, arrows, ↻ ↺
put montecarlo pop click-soft whoosh-short whoosh key-press typing sparkle chime
put brachisto pop click click-soft whoosh-short whoosh ping sparkle chime
for p in montecarlo brachisto; do cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf "$here/$p/assets/fonts/"; done
# round 6: each reel its own style, with its own open-licence (OFL) fonts from the Google Fonts repository
gf() { mkdir -p "$here/$1/assets/fonts" "$here/$1/assets/sfx"; curl -sfL -o "$here/$1/assets/fonts/$3" "https://raw.githubusercontent.com/google/fonts/main/ofl/$2"; }
gf neon "teko/Teko%5Bwght%5D.ttf" Teko.ttf
cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf "$here/neon/assets/fonts/"
for s in click whoosh whoosh-short impact-bass-2 click-soft sparkle glitch-1; do cp "$sfx/$s.mp3" "$here/neon/assets/sfx/"; done
gf chalk kalam/Kalam-Bold.ttf Kalam-Bold.ttf; gf chalk kalam/Kalam-Regular.ttf Kalam-Regular.ttf
cp "$sfx/whoosh-short.mp3" "$here/chalk/assets/sfx/"; python3 "$here/tools/chalk_sfx.py" "$here/chalk/assets/sfx"   # synthesised chalk strokes
gf paper rozhaone/RozhaOne-Regular.ttf RozhaOne-Regular.ttf; gf paper tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf TiroDevanagariHindi-Regular.ttf
gf paper unifrakturmaguntia/UnifrakturMaguntia-Book.ttf UnifrakturMaguntia-Book.ttf; gf paper "playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" PlayfairDisplay.ttf
for s in whoosh-cinematic impact-bass-1 whoosh-short typing pop click key-press impact-bass-2; do cp "$sfx/$s.mp3" "$here/paper/assets/sfx/"; done
echo "fonts and sfx in place; add assets/vo.wav and assets/bgm.wav per project"
echo "site3d also needs assets/desk2quant-logo.png (from the site) and assets/page/t00-t12.jpg (tools/site_capture)"
echo "eqd also needs assets/eqd-cover.webp (desk2quant.com/assets/images/covers/equity-derivatives-quant-notes-1200.webp)"
