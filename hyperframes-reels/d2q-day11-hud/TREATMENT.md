# Day 11 · the volatility smile, in a light Hologram HUD

The voice, script, numbers and timing of the isometric Day 11 stay exactly as they are (78 s, 14 beats, VoxCPM
narrator, every number from work/numbers.json). Only the picture and the sound world change: everything becomes scanned
data, a line wireframe above one projector pad. The founder asked for no dark theme, so the stage is light (the
style's grammar kept, its palette inverted: deep-blue lines, white plates, navy text, an orange accent).

## Three candidate structures

1. **One object, layer by layer.** A single wireframe volatility surface sits on the pad all film; each beat scans one
   layer onto it (the 1987 spike, the bell, the fat tails, the put, the solver, the simulation) until the smile ignites.
   Pure to the style (one subject), but most beats would have to become layers of a surface they are not: loose
   metaphors, which the series forbids.
2. **A teardown of the smile.** Open on the finished smile, lock the 80 strike, explode it into its put, its payoff,
   the crash data and the tails, then rebuild. Strong grammar, but it fights the fixed voice order (hook, 1987, normal,
   fat tails, put, solver, simulation, smile, answer).
3. **One pad, a scan sequence.** The pad, the dot grid, the HUD chrome, the subtitles and the chip rail never cut. Each
   beat's subject is the literal thing the voice says, scanned in by the scan plane and erased by it when the next one
   arrives (the style's only transitions). Target boxes lock onto each number as it is said; values roll from glyphs
   into the orange accent and dock into the left chip rail, so the film accumulates its facts:
   −20.47% · 16.2σ · 10⁻⁵⁹ · 0.090 · 20.7% · 29.7%. The vol columns that open the film come back at the end and ignite
   once into a solid hologram: the smile.

**Choice: 3.** It keeps every object literal and keeps the voice order, and it uses the style's native moves where they
mean something: scan growth = real data; target lock = look here; rolling digits = the payoff; chip accumulation =
reading time; one solid hologram = the whole is ready (the smile); one three-frame glitch on the biggest change ("But it
did.").

## Look decisions
- **Hue and accent:** deep blue (hue 218) and orange (hue 22) on a light stage. Orange only on locked values, the frame
  they become true. No green.
- **Format:** 1080×1920, 24 fps. The caption band (y 150–540) carries the HUD subtitle plate (white plate, corner
  brackets, voiceprint bars, Fredoka Medium navy); the top-left chrome carries the real logo (the one `keep` colour),
  "DESK2QUANT // DAY 11/30"; the top right a live status line.
- **The guide:** the series' trader stays in his own colours on a small projector pad in the lower right, lip-synced as
  before.
- **Camera:** an orbit camera per subject: high 3/4 scan-ins, a push-in on the key value, a lateral dolly along the
  simulated path, a top-down plan view for the histogram, and an eye-level crane for the smile's ignition.
- **Sound:** a new synth score on a grid (saw arpeggio with ping-pong delay, square pulse, 8th bass, synth hats,
  detuned pads), one beat of true silence before "But it did.", a drop on it, locks as thump + clack + two-tone beep,
  rolls ticking, projector hum under it all; CC0 effects only; the voice ducks it with a held envelope; −14 LUFS.

## Rebuild: quant charts (the founder's review)
The founder's review: the props (chairs, a calendar, stacked blocks, a machine with a dial, wireframe columns on a pad) did
not look like quant finance and did not match the words. Every scene is now the literal quant object the voice names,
drawn as a light-HUD analytics screen (white plates, corner brackets, target locks, rolling values, the chip rail):
- s1-s2: the Black-Scholes formula with its one σ; implied vol by strike, flat, against market quotes that are not.
- s3: the real S&P 500 daily candles, Sep-Oct 1987, and the 19 Oct candle (282.70 -> 224.84, -20.47%).
- s4-s5: σ_day = 20%/√252 = 1.26%; the normal curve of daily moves and a σ ruler to -16.2σ; P(Z ≤ -16.2) ≈ 1.2×10⁻⁵⁹,
  and the Big Bang count.
- s6: the crash happened; on a log density axis the normal tail plunges while the fat tail (illustrative) stays up; ×97.
- s7: the 90 put's payoff diagram; its price with one σ (0.014) against with crashes (0.090).
- s8: the Black-Scholes price against σ; Newton's method walks to the market price: implied vol 20.7%.
- s9-s10: the model dS/S = σdW - 20%dN; a fan of simulated paths with their crashes; the histogram of a million
  one-month outcomes with the strikes 80-120; P(K) = mean max(K - S_T, 0).
- s11: implied vol by strike, locking 15.6%, 20.7%, 29.7% as said; the flat line bends into the smile.
- s12-s13: the answer as two rows: normal returns -> flat; fat tails -> the smile (K↓ ⇒ σ_imp↑).
- s14: the end card as flat panels.
Formulas are typeset LaTeX (MathJax SVG at build time) with their numbers generated from work/numbers.json.
