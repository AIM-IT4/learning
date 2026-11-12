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
echo "fonts and sfx in place; add assets/vo.wav and assets/bgm.wav per project"
echo "site3d also needs assets/desk2quant-logo.png (from the site) and assets/page/t00-t12.jpg (tools/site_capture)"
