#!/bin/bash
# Setup script for the Claude Code cloud environment. Paste this whole file into the environment's settings (cloud
# environment menu in the session title bar -> Edit -> Setup script). Every NEW session then starts with:
#   1. the video skills in ~/.claude/skills (anime-cel, paper-cutout, painted-animation, the current HyperFrames
#      skills, vox-director and vox-explainer, ...)
#   2. painted-song-reel (this repo's skill: a painted music-video reel for any song), fetched from GitHub
#   3. flow-mcp (Google Flow through Chrome; the Google sign-in is not kept between sessions)
# Each part runs even if another fails.

# ======================================================================== 1. video skills
( set -e
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
#   sarpstar/cinecode               MIT  cinecode (one sentence -> a short film, ad or music video with sound; its own
#                                         hooks run its local guard only while the skill is in use)
#   ./painted-song-reel (this repo)       painted-song-reel (painted music-video reel for any song, local painter)
#
# Not installed: reelmimic's .claude/settings.json hooks (they drive its own app) and Joker-chichi/claude-mv-skill
# (a copy of painted-animation with extra intake rules). Telemetry of the bundled media tools is switched off.
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
fetch sarpstar/cinecode               c8a3e7552699360a2b0142c9620882af2069eedb cinecode '/*' '!/docs/media/'

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
put "$TMP/cinecode" cinecode   # one sentence -> a film with sound (reviewed 2026-11-14 at c8a3e75)
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
) || echo "video skills: install failed"

# ======================================================================== 2. painted-song-reel
# This repo's own skill (AIM-IT4/learning is public): a painted music-video reel for any song. Its models (about 9 GB)
# are fetched the first time it is used (its scripts/setup.sh), not here.
( set -e
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
git init -q "$T/l"; cd "$T/l"
git remote add origin https://github.com/AIM-IT4/learning
git sparse-checkout set video-skills/painted-song-reel
git fetch -q --depth 1 --filter=blob:none origin ccr-713d3cac-20zpd5 || git fetch -q --depth 1 --filter=blob:none origin main
git -c advice.detachedHead=false checkout -q FETCH_HEAD
mkdir -p "$HOME/.claude/skills"; rm -rf "$HOME/.claude/skills/painted-song-reel"
cp -r video-skills/painted-song-reel "$HOME/.claude/skills/painted-song-reel"
echo "installed painted-song-reel"
) || echo "painted-song-reel: install failed"

# ======================================================================== 3. flow-mcp
DIR=/opt/flow-mcp
if [ ! -f "$DIR/dist/index.js" ]; then
  rm -rf "$DIR"
  git clone --depth 1 https://github.com/GTAI-1/flow-mcp.git "$DIR" && (cd "$DIR" && npm install --no-audit --no-fund && npm run build) || echo "flow-mcp: install failed"
fi
cat > /usr/local/bin/flow-chrome <<'FLOWEOF'
#!/bin/sh
# Chrome for flow-mcp: starts its own virtual screen (:99) when needed, runs as root, uses the session's proxy.
# A resumed machine can keep /tmp and the profile but not the processes, so clear leftovers from the last run.
export DISPLAY=:99
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  rm -f /tmp/.X11-unix/X99 /tmp/.X99-lock
  setsid Xvfb :99 -screen 0 1280x900x24 -nolisten tcp >/dev/null 2>&1 < /dev/null &
  sleep 1.5
fi
if [ -z "$(pgrep -f "user-data-dir=.*chrome-profile" | grep -vx "$$")" ]; then   # none but this script
  rm -f "${FLOW_MCP_HOME:-$HOME/.flow-mcp}"/chrome-profile/Singleton*
fi
exec /usr/bin/google-chrome --no-sandbox ${HTTPS_PROXY:+--proxy-server=$HTTPS_PROXY} --window-position=0,0 --window-size=1280,900 "$@"
FLOWEOF
chmod +x /usr/local/bin/flow-chrome
if command -v claude >/dev/null 2>&1 && [ -f "$DIR/dist/index.js" ]; then
  claude mcp remove --scope user flow >/dev/null 2>&1
  claude mcp add --scope user flow -e DISPLAY=:99 -e FLOW_MCP_CHROME=/usr/local/bin/flow-chrome -- node "$DIR/dist/index.js"
fi
echo "setup done"
