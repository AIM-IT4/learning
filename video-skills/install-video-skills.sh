#!/bin/bash
# Installs the video skills for Claude Code into ~/.claude/skills (user level, so every project and every session on
# this machine sees them). Sources are pinned to the commits reviewed on 2026-11-12; re-running updates in place.
# Usage:  bash install-video-skills.sh        (CLAUDE_SKILLS_DIR=... to install elsewhere)
#
#   edenfunf/reelmimic              MIT  anime-cel, paper-cutout, painted-animation (watercolour), crayon-storybook,
#                                         pixel-art, whiteboard, video-clone (reference video -> style -> engine), ...
#   heygen-com/hyperframes          Apache-2.0  the current HyperFrames skills: hyperframes, hyperframes-cli,
#                                         hyperframes-registry, media-use, figma, slideshow, remotion-to-hyperframes,
#                                         reverse-any-video, style-sampling (they replace the older copies reelmimic
#                                         ships; the skills HyperFrames has retired are removed, as its own updater does)
#   Alisa0808/vox-director          MIT  vox-director (Vox-style paper-collage explainer; needs an Atlas Cloud API key)
#   CK42BB/vox-explainer-skill      MIT  vox-explainer (Vox-style explainer pipeline; needs an Atlas Cloud API key)
#   tuzhechen2005/painted-animation MIT  kinetic-reel (its painted-animation is the same engine as reelmimic's)
#   am-will/music-video-reimagined  MIT  music-video-reimagined (remake a music video as a hand-painted cartoon)
#   cth9191/animate                 MIT  animate (procedural animation: cut paper, ink, riso, sketchbook, pixel, ...)
#   ./painted-song-reel (this repo)       painted-song-reel (painted music-video reel for any song, local painter)
#
# Not installed: reelmimic's .claude/settings.json hooks (they drive its own app) and Joker-chichi/claude-mv-skill
# (a copy of painted-animation with extra intake rules). Telemetry of the bundled media tools is switched off.
set -e
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fetch() {   # owner/repo  commit  dir  [sparse patterns...]
  git init -q "$TMP/$3"
  git -C "$TMP/$3" remote add origin "https://github.com/$1"
  if [ $# -gt 3 ]; then git -C "$TMP/$3" sparse-checkout set --no-cone "${@:4}"; F=--filter=blob:none; else F=; fi
  GIT_LFS_SKIP_SMUDGE=1 git -C "$TMP/$3" fetch -q --depth 1 $F origin "$2"
  git -C "$TMP/$3" -c advice.detachedHead=false checkout -q FETCH_HEAD
}
fetch edenfunf/reelmimic              74fc0c507242c64f215b88b2408bcdbacef3bcd0 reelmimic
fetch heygen-com/hyperframes          256675f92c44827ac3309cac615f46424dfca895 hyperframes '/skills/'
fetch Alisa0808/vox-director          6a85a7c341610442a6a5b1885e6e0217ab82a11f voxdirector '/*' '!/assets/' '!/*.skill'
fetch CK42BB/vox-explainer-skill      7003225dc3ed1dee9e2ef8b91b05b82c04691aa9 voxexplainer
fetch tuzhechen2005/painted-animation 59744a69c7b916cfbe4c4ec84006b0c2f5e2fde1 painted
fetch am-will/music-video-reimagined  7d6b7b22caf08c6e330e1abb869953d8e4f2cc1a reimagined
fetch cth9191/animate                 7e5eb56feb2dd573f890e1b7b34748af43d58263 animate

mkdir -p "$DEST"
put() { rm -rf "$DEST/$2"; cp -r "$1" "$DEST/$2"; rm -rf "$DEST/$2/.git"; }
for s in "$TMP"/reelmimic/.claude/skills/*/; do
  put "$s" "$(basename "$s")"
  # the reelmimic docs give project-relative paths (.claude/skills/...); point them at the user-level install
  find "$DEST/$(basename "$s")" -name '*.md' -print0 | xargs -0 sed -i -E 's#([ `"(])\.claude/skills/#\1~/.claude/skills/#g'
done
cp "$TMP/reelmimic/requirements.txt" "$DEST/video-clone/requirements-reelmimic.txt"
# HyperFrames: the current official skills replace reelmimic's older copies; the skills HyperFrames retired go
# (their knowledge now lives in the hyperframes skill's references), and video-clone is pointed at /hyperframes
for s in hyperframes-animation hyperframes-audio hyperframes-core hyperframes-creative hyperframes-keyframes \
         hyperframes-studio embedded-captions faceless-explainer general-video motion-graphics music-to-video \
         pr-to-video product-launch-video talking-head-recut; do rm -rf "${DEST:?}/$s"; done
for s in "$TMP"/hyperframes/skills/*/; do put "$s" "$(basename "$s")"; done
( cd "$DEST/video-clone/styles" && sed -i \
  -e 's#走 `/hyperframes` → `/faceless-explainer`#走 `/hyperframes`（faceless explainer 的做法在它的 references 裡；Vox 風格拼貼可用 `/vox-director`）#' \
  -e 's#走 `/hyperframes` 路由 → `/motion-graphics`（短、無旁白）或 `/general-video`（較長、多段）#走 `/hyperframes`（motion graphics 與多段影片的做法都在它的 references 裡）#' \
  -e 's#走 `/hyperframes` → `/music-to-video`#走 `/hyperframes`（music video 做法在它的 references 裡）#' \
  -e 's#走 `/hyperframes` → `/product-launch-video`#走 `/hyperframes`（launch film 做法在它的 references 裡）#' \
  faceless-explainer.md motion-graphics.md music-kinetic.md product-promo.md )
# Vox-style explainers (both need ATLASCLOUD_API_KEY to run; installing them is free)
rm -rf "$DEST/vox-director" && mkdir -p "$DEST/vox-director" && cp -r "$TMP"/voxdirector/{SKILL.md,references,scripts,examples,LICENSE,README.md} "$DEST/vox-director/"
rm -rf "$DEST/vox-explainer" && mkdir -p "$DEST/vox-explainer" && cp -r "$TMP"/voxexplainer/{SKILL.md,references,LICENSE,README.md} "$DEST/vox-explainer/"
put "$TMP/painted/skills/kinetic-reel" kinetic-reel
put "$TMP/reimagined/skills/music-video-reimagined" music-video-reimagined
put "$TMP/animate/plugins/animate/skills/animate" animate
# this repo's own skill: painted-song-reel (a painted music-video reel for any song; see painted-song-reel/SKILL.md)
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$HERE/painted-song-reel" ]; then put "$HERE/painted-song-reel" painted-song-reel; fi

# telemetry off for the HyperFrames / media-use / Remotion tools these skills call
python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
s.setdefault("env", {}).update({"DO_NOT_TRACK": "1", "HYPERFRAMES_NO_TELEMETRY": "1", "REMOTION_TELEMETRY_DISABLED": "1"})
os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(s, open(p, "w"), indent=2)
EOF
echo "installed: $(ls "$DEST" | wc -l) skills in $DEST"
