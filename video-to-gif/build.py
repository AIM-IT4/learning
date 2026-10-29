"""Inline the encoder worker, main script and sample clip into one self-contained page.

    python3 build.py                 -> index.html (standalone; open it or host it anywhere)
    python3 build.py --body OUT.html -> page content without the document skeleton
"""
import base64
import pathlib
import sys

here = pathlib.Path(__file__).parent
src = here / 'src'
worker = (src / 'worker.js').read_text()
main = (src / 'main.js').read_text()
for name, code in (('worker.js', worker), ('main.js', main)):
    assert '</script' not in code.lower(), f'{name} must not contain a closing script tag'
sample = base64.b64encode((src / 'sample.mp4').read_bytes()).decode()
body = (src / 'template.html').read_text().replace('{{SAMPLE}}', sample).replace('{{WORKER}}', worker).replace('{{MAIN}}', main)

if len(sys.argv) == 3 and sys.argv[1] == '--body':
    pathlib.Path(sys.argv[2]).write_text(body)
else:
    head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
            '</head><body>')
    (here / 'index.html').write_text(head + body + '</body></html>\n')
