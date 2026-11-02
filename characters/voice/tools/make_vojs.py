"""words.json (forced alignment) -> reel/vo.js (+ speakers); without it, estimate word times so scenes can be built early."""
import json, os, sys, re
D = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(D, 'voice', 'words.json')
lines = [l.strip() for l in open(os.path.join(D, 'script.txt')) if l.strip()]
who = [l.strip() for l in open(os.path.join(D, 'speakers.txt')) if l.strip()]
OFF = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
if os.path.exists(src):
    words = json.load(open(src))
    for w in words: w['start'] = round(w['start'] + OFF, 3); w['end'] = round(w['end'] + OFF, 3)
else:
    words, t = [], OFF
    for li, l in enumerate(lines):
        for w in l.split():
            d = 0.11 + 0.05 * len(re.sub(r'[^A-Za-z0-9]', '', w)) + (0.16 if w[-1] in ',:.?' else 0)
            words.append({'text': w, 'start': round(t, 3), 'end': round(t + d - 0.04, 3), 'line': li}); t += d
        t += 0.32
L = []
for li, l in enumerate(lines):
    ws = [w for w in words if w['line'] == li]
    L.append({'s': ws[0]['start'], 'e': ws[-1]['end'], 'text': l, 'who': who[li]})
open(os.path.join(D, '..', 'reel', 'vo.js'), 'w').write('window.VO = ' + json.dumps({'lines': L, 'words': words}) + ';\n')
print('lines', len(L), 'end', L[-1]['e'], 'from', 'alignment' if os.path.exists(src) else 'estimate')
