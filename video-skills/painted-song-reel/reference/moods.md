# Mood → look

Pick the row that fits the song, then mix in what the lyrics name. The cast and settings follow the song's world:
Indian songs get Indian characters, clothes and places; adapt everything for other cultures. Keep one style prefix
for the whole reel (the face repair reuses it).

## Painting style (the prefix every prompt starts with)
| style | prefix | for |
|---|---|---|
| soft semi-realistic (default; the reference reels) | `Beautiful semi-realistic digital painting, smooth soft shading, painterly brushwork, gentle warm light:` | most film songs |
| watercolour storybook | `Delicate watercolour painting, soft washes, paper texture, gentle light:` | lullabies, childhood, light love songs |
| classical oil | `Classical Indian oil painting, rich glazes, soft chiaroscuro, museum quality:` | ghazals, period songs, devotional |
| vintage film poster | `Hand-painted 1970s Bollywood film poster art, gouache, bold warm colours:` | retro / old classics |
| folk-inspired gouache | `Indian folk-inspired gouache painting, flat decorative colours, fine outlines:` | devotional, festival, folk songs |
Change the light words to the mood ("cool blue rain light", "warm diya light", "silver moonlight").
Add "anime, cartoon, 3d render, photo" to the negative prompt for every style.

## Moods
| mood | light and palette | places and motifs | effects (`fx`) | grade | cut and camera |
|---|---|---|---|---|---|
| romantic / longing | golden hour, pinks and golds, then moonlit blues | grass and daisies, swing under a banyan, window with bougainvillea, terraces at night, bazaar lights, a dream among stars | petals, dust, bokeh, stars; cloud `heart` overlay | warm by day, `night` for night shots | 1-2 bars a shot; whip, zoom-through, flash on the hook; slow pushes toward faces |
| heartbreak / sad / viraha | grey-blue dusk, rain, single warm lamp | rain on a window, empty railway platform, letters, a chair left empty, umbrella in the street | rain, dust (sparse) | `rain` or `cool`, `sepia` for memories | 2 bars a shot, fades and slow dissolves, no flashes; slow pull-backs, little roll |
| devotional / bhakti | dawn gold, saffron and marigold, diya light | temple steps, river ghats with diyas, aarti, flute, peacock feather, lotus pond, bells | embers (rising), petals with `color: [255, 150, 40]` (marigold), dust | `dawn`, `warm` | 2 bars, fades and zoom-throughs; rising camera (c moves up), gentle pushes to the deity's symbol, never a real person |
| festive / wedding / dance | night lights, reds, golds, magenta | haldi, mehendi hands, baraat, fairy lights, dhol, rangoli, fireworks | bokeh (many), embers, petals in red and gold | `warm` | 1 bar a shot on the beat, whips and flashes; swing and roll with the rhythm |
| monsoon / rain song | silver-green, wet reflections | first rain on a terrace, paper boats, chai on the balcony, umbrella shared, puddles | rain, petals (few), bokeh | `rain` softened with `warm` close-ups | 1-2 bars; whips; parallax on wet streets |
| friendship / road trip / fun | bright afternoon, teal and yellow | open road, bikes, college steps, beach, rooftop | dust, bokeh | none or `warm` | 1 bar, whips left and right, punch-in zooms |
| lullaby / mother | candle and moonlight, cream and soft blue | cradle, mother's hands, starry window, toys, night sky | stars, fireflies, dust | `night`, `dawn` at the end | 2 bars, fades only, slow drifts |
| sufi / qawwali | lamplight, deep teal and amber | dargah courtyard, whirling white robes, lanterns, desert night | embers, dust, stars | `warm`, `dusk` | 2 bars, slow rolls (rot ±3), zoom-throughs |
| patriotic | sunrise, saffron white green | fields, soldiers' boots in silhouette (no real people), the flag in wind, mountains | dust, petals (saffron) | `dawn` | 1-2 bars, rising pushes |
| retro / ghazal / nostalgia | sepia lamplight | gramophone, old letters, train window, rain on a car, black-and-white photos | dust | `sepia` for the past, colour for the present | 2 bars, dissolves |
| winter / hills | cold blue, warm windows | snowfall in the hills, shawls, chai stall, pine forest | snow, bokeh (window lights) | `cool`, `warm` inside | 2 bars, fades, slow drifts |

## Effects reference (render_mv.py)
`fx`: `{"kind": "petals|dust|bokeh|stars|rain|snow|fireflies|embers", "n": 20, "alpha": 0.8, "color": [r, g, b],
"area": [x0, y0, x1, y1], "t_off": 0}`. Usual counts: petals 6-14, dust 12-24, bokeh 10-16, stars 14-26 in the sky
area, rain 120-200, snow 60-120, fireflies 18-30, embers 20-30.
`grade`: night, warm, cool, rain, sepia, dusk, dawn (per shot, or `"grade"` at the top of reel.json for all).
`overlays`: `{"kind": "heart", "x": 700, "y": 300, "size": 470, "form": 1.6}` - a cloud drifting into a heart over
`form` seconds, in screen pixels; `form: 0.01` = already formed.
`out` (into the next shot): `whip` (left), `whipleft`, `whipup`, `whipdown`, `zoom`, `flash`, `fade`, `cut`; `out_d`
0.30-0.46 s. Use flashes and zooms on the hook's strong beats, fades on quiet ones.
Camera: `z` zoom, `c` centre, `rot` roll in degrees, `par` parallax in pixels, `dolly` near layers grow, `swing`
[degrees, period] for swings and dances, `ease` in|out|inout|linear, `d0` the depth that stays put.
