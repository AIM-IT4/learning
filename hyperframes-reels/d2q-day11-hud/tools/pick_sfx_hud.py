"""Pick each sound-effect role from the CC0 uisfx packs (Real SFX's bundled library) by listening with earshot, then
copy the winners to assets/sfx/<role>.mp3 and write assets/sfx/PICKS.json.
usage: UISFX_SOUNDS=<uisfx>/sounds ~/.local/share/earshot/.venv/bin/python tools/pick_sfx_hud.py"""
import json, os, shutil
from earshot import api

# the uisfx package's sounds folder (CC0 1.0), as bundled with the Real SFX skill: set UISFX_SOUNDS to it
U = os.environ.get("UISFX_SOUNDS", "uisfx/sounds")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx")
ROLES = {
    "scan": ("a soft sci-fi scanning sweep, a light beam passing over an object",
             ["scifi/scanning", "scifi/swipe", "scifi/loading", "glass/scanning", "scifi/processing", "minimal/scanning"]),
    "lock": ("a short two-tone digital beep confirming a target lock",
             ["scifi/select", "scifi/check", "scifi/success", "scifi/notification", "scifi/connect", "minimal/check", "glass/check"]),
    "chip": ("a soft digital click as a small panel docks into place",
             ["scifi/drop", "scifi/press", "minimal/select", "minimal/drop", "scifi/toggle-on", "glass/select"]),
    "glitch": ("a short harsh digital glitch burst",
               ["scifi/error", "scifi/disconnect", "scifi/blocked", "arcade/error", "scifi/warning", "minimal/error"]),
    "ignite": ("a bright sci-fi power-up shimmer, a hologram switching on",
               ["scifi/level-up", "scifi/achievement", "scifi/unlock", "scifi/wake", "glass/achievement", "dreamy/achievement"]),
    "type": ("fast digital typing on a keyboard",
             ["scifi/typing", "mechanical/typing", "minimal/typing", "studio/typing", "glass/typing"]),
    "send": ("a quick digital send whoosh",
             ["scifi/send", "minimal/send", "glass/send", "soft/send", "studio/send"]),
    "end": ("a calm sci-fi closing tone, a system powering down gently",
            ["scifi/complete", "scifi/sleep", "glass/complete", "minimal/complete", "zen/complete", "scifi/stop"]),
}
os.makedirs(OUT, exist_ok=True)
picks = {}
for role, (query, cands) in ROLES.items():
    files = [f"{U}/{c}.mp3" for c in cands if os.path.exists(f"{U}/{c}.mp3")]
    res = api.rank(files, query)
    best = res["results"][0] if isinstance(res, dict) and "results" in res else res[0]
    path = best["path"] if isinstance(best, dict) else best
    shutil.copy(path, os.path.join(OUT, f"{role}.mp3"))
    picks[role] = {"file": os.path.relpath(path, U), "query": query, "licence": "CC0-1.0 (uisfx)"}
    print(role, "->", picks[role]["file"], flush=True)
json.dump(picks, open(os.path.join(OUT, "PICKS.json"), "w"), indent=1)
