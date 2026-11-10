"""Mix the homecoming film: the Chhath song under the whole film, the narration on top, a few quiet sound effects.

  python3 mix_ghar.py song.wav narration.wav timing.json out.wav [--under 14] [--swell 6] [--song-level 3] [--no-sfx]

Music bed: the song's instrumental intro, then the intro again from its first bar straight into the vocals, so the
song's vocal section starts exactly at timing["part1"] (part 2, the four days) and runs to the end (2.2 s fade).
The narration always leads: the bed sits --under LU below it while it speaks (it is never switched off), rises to
--swell LU below the narration's level between lines and after part 1's narration, and in part 2 the song (with its
vocals) plays --song-level LU below the narration's level, dipping to --under below it under the two narration lines there.
Sound effects (synthesised here): phone ringing until Maa's call is answered, a train horn, a station chime, and
fireworks for the kosi night. Then two-pass loudnorm to -14 LUFS, true peak -1.5 dBTP.
"""
import argparse, json, re, subprocess, tempfile
from pathlib import Path
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("song"); ap.add_argument("narration"); ap.add_argument("timing"); ap.add_argument("out")
ap.add_argument("--under", type=float, default=14.0, help="music while the narration speaks, LU below the narration")
ap.add_argument("--swell", type=float, default=6.0, help="part-1 music between and after lines, LU below the narration")
ap.add_argument("--song-level", dest="song_lu", type=float, default=3.0, help="part-2 song without narration, LU below the narration")
ap.add_argument("--no-sfx", action="store_true")
a = ap.parse_args()
SR = 48000
TM = json.load(open(a.timing, encoding="utf-8"))
P1, TOTAL, BAR = TM["part1"], TM["total"], TM["song"]["bar"]
INTRO_END, BAR0 = TM["song"]["intro_end"], TM["song"]["bar0"]
shot = {n: (s, e) for n, s, e in TM["shots"]}

def load(f, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()
def save(f, y):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", str(y.shape[1]), "-i", "-", "-c:a", "pcm_s24le", str(f)], input=y.astype(np.float32).tobytes(), check=True)
def lufs(y):
    with tempfile.NamedTemporaryFile(suffix=".wav") as tf:
        save(tf.name, y if y.ndim == 2 else y[:, None])
        err = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", tf.name, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])
db = lambda x: 10 ** (x / 20)

song, narr = load(a.song), load(a.narration, 1)[:, 0]
N = int(round(TOTAL * SR)); narr = np.pad(narr, (0, max(0, N - len(narr))))[:N]
# ---- bed: intro, then the intro again from its first bar running on into the vocals
s1 = song[: int((INTRO_END + 0.03) * SR)]                          # 60 ms equal-power crossfade centred on the bar line
s2 = song[int((BAR0 - 0.03) * SR): int((INTRO_END + (TOTAL - P1) + 0.5) * SR)]
xf = int(0.06 * SR); fo, fi = np.cos(np.linspace(0, np.pi / 2, xf))[:, None], np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
bed = np.concatenate([s1[:-xf], s1[-xf:] * fo + s2[:xf] * fi, s2[xf:]])[:N]
bed = np.pad(bed, ((0, max(0, N - len(bed))), (0, 0)))
assert abs(INTRO_END + (INTRO_END - BAR0) - P1) < 0.02, "bed and part-1 length disagree"
# ---- levels from measured loudness
speech = narr[np.abs(narr) > 1e-4]
Lv = lufs(speech[:, None]); Lintro = lufs(song[int(BAR0 * SR): int(INTRO_END * SR)]); Lvoc = lufs(song[int(INTRO_END * SR): int((INTRO_END + 30) * SR)])
narr *= db(-16 - Lv); Lv = -16.0
g_under, g_swell = Lv - a.under - Lintro, Lv - a.swell - Lintro   # dB gains for the intro bed
g_song, g_duck2 = Lv - a.song_lu - Lvoc, Lv - a.under - Lvoc            # dB gains for the vocal section
# ---- voice activity -> gain curve (dB), smoothed
hop = SR // 100; env = np.sqrt(np.convolve(narr ** 2, np.ones(hop * 3) / (hop * 3), "same"))[::hop]
act = env > db(-42) * env.max()
idx = np.where(act)[0]; on = np.zeros_like(act)
for i in idx: on[max(0, i - 30): i + 60] = True                     # 0.3 s anticipation, 0.6 s hold
t = np.arange(len(on)) / 100
gdb = np.where(t < P1, np.where(on, g_under, g_swell), np.where(on, g_duck2, g_song))
gdb[t < 0.2] = g_under
k = 25; gdb = np.convolve(np.pad(gdb, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), "valid")   # ~0.5 s ramps
gain = db(np.interp(np.arange(N) / SR, t, gdb))
fade = np.clip((TOTAL - np.arange(N) / SR) / 2.2, 0, 1) ** 1.5 * np.clip(np.arange(N) / SR / 0.4, 0, 1)
music = bed * (gain * fade)[:, None]
# ---- sound effects
rng = np.random.default_rng(7)
def place(sig, t0, gain_db):
    i0 = int(t0 * SR); n = min(len(sig), N - i0)
    if n > 0: sfx[i0: i0 + n] += sig[:n] * db(gain_db)
def tone(f, d, amp=1.0): tt = np.arange(int(d * SR)) / SR; return amp * np.sin(2 * np.pi * f * tt)
def env_ad(n, a_, d_): e = np.ones(n); na = int(a_ * SR); e[:na] = np.linspace(0, 1, na); e *= np.exp(-np.arange(n) / SR / d_); return e
sfx = np.zeros((N, 2))
if not a.no_sfx:
    # phone: a soft two-tone trill, twice a second, until the call is picked up (just before "बबुआ")
    ps, pe = shot["phone"][0] + 0.25, (TM["cues"].get("babua", shot["phone"][0] + 3.9) - 0.6)
    tt = np.arange(int((pe - ps) * SR)) / SR
    trill = np.where((tt % 2.0) < 1.1, 1.0, 0.0) * np.where((tt * 20) % 2 < 1, np.sin(2 * np.pi * 1046 * tt), np.sin(2 * np.pi * 1318 * tt)) * 0.5
    trill *= np.clip(tt / 0.05, 0, 1) * np.clip((pe - ps - tt) / 0.1, 0, 1)
    place(np.stack([trill, trill], 1), ps, Lv - 20 + 16)
    # train horn: two-note chord with a soft attack, low-passed by a running mean
    d = 1.5; tt = np.arange(int(d * SR)) / SR; horn = sum(np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 for f in (311, 392)) * np.clip(tt / 0.12, 0, 1) * np.clip((d - tt) / 0.4, 0, 1)
    horn = np.convolve(horn, np.ones(24) / 24, "same"); place(np.stack([horn, horn * 0.8], 1), shot["train"][0] + 0.15, Lv - 22 + 16)
    # station chime: three soft bells, before the first board
    ch = np.zeros(int(1.2 * SR))
    for j, f in enumerate((659.3, 523.3, 392.0)):
        b = (tone(f, 0.9) + 0.35 * tone(2 * f, 0.9)) * env_ad(int(0.9 * SR), 0.005, 0.35); i0 = int(j * 0.18 * SR); ch[i0: i0 + len(b)] += b[: len(ch) - i0]
    place(np.stack([ch, ch], 1) * 0.5, shot["stations"][0] - 0.25, Lv - 22 + 16)
    # fireworks over the kosi night: a thump at each burst, then crackle (burst times as in chhath_ghar.html)
    k0 = shot["kosi"][0]
    for j, tb in enumerate([0.2, 0.75, 1.3, 1.9, 2.45, 3.0, 3.55, 4.1, 4.65, 5.2]):
        n = int(0.5 * SR); tt = np.arange(n) / SR
        thump = np.sin(2 * np.pi * (70 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) + rng.normal(0, 1, n) * np.exp(-tt * 40) * 0.6
        place(np.stack([thump, thump], 1) * 0.6, k0 + tb + 0.08, Lv - 14 + 16)
        cr = np.zeros(int(1.6 * SR))
        for _ in range(140):
            i0 = int(rng.uniform(0.15, 1.5) * SR); m = int(0.004 * SR); cr[i0: i0 + m] += rng.normal(0, 1, m) * np.exp(-np.arange(m) / (0.0012 * SR)) * rng.uniform(0.2, 1)
        pan = 0.3 + 0.4 * (j % 2); place(np.stack([cr * (1 - pan), cr * pan], 1) * 0.9, k0 + tb + 0.1, Lv - 20 + 16)
    # the anar fountain's hiss under the kosi shot
    d = shot["kosi"][1] - k0; n = int(d * SR); hiss = rng.normal(0, 1, n); hiss = hiss - np.convolve(hiss, np.ones(8) / 8, "same")
    hiss *= np.clip(np.arange(n) / SR / 0.6, 0, 1) * np.clip((d - np.arange(n) / SR) / 0.6, 0, 1) * 0.15
    place(np.stack([hiss, hiss], 1), k0, Lv - 26 + 16)
    sfx *= fade[:, None]
mix = music + narr[:, None] + sfx
on_s = np.repeat(on, hop)[:N] if len(on) * hop >= N else np.pad(np.repeat(on, hop), (0, N - len(on) * hop))
under_meas = lufs(music[on_s & (np.abs(narr) > 1e-4)]) - Lv          # music level while the voice speaks, re the voice
with tempfile.TemporaryDirectory() as td:
    pre = Path(td) / "pre.wav"; save(pre, mix)
    m = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", str(pre), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(pre), "-af", ln + ",aresample=48000", "-c:a", "pcm_s24le", a.out], check=True)
print(json.dumps({"music_under_voice_LU": round(under_meas, 1), "narration_LUFS": Lv, "intro_LUFS": round(Lintro, 1), "vocal_LUFS": round(Lvoc, 1), "gain_dB": {"under": round(g_under, 1), "swell": round(g_swell, 1), "song": round(g_song, 1), "duck2": round(g_duck2, 1)},
                  "input": {k: j[k] for k in ("input_i", "input_tp", "input_lra")}}))
