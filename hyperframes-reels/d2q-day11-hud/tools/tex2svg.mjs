// Typeset work/formulas.tex.json to self-contained SVG with MathJax 3 (TeX input, SVG output, glyphs as paths, no
// font files at render time) and write work/formulas.json: { id: { svg, w, h, a } } with the box in em
// (w wide, h tall, a = baseline height above the bottom), so a scene can size it to any font size.
// usage: NODE_PATH=<dir with mathjax-full>/node_modules node tools/tex2svg.mjs
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = JSON.parse(fs.readFileSync(path.join(HERE, "work/formulas.tex.json"), "utf8"));
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: "none" }) });
const out = {};
for (const [id, tex] of Object.entries(src)) {
  const node = doc.convert(tex, { display: true, em: 16, ex: 8, containerWidth: 1000 });
  const svg = adaptor.firstChild(node);
  // width / height come as "12.345ex"; the viewBox is in 1/1000 em
  const vb = adaptor.getAttribute(svg, "viewBox").split(/\s+/).map(Number);
  const va = parseFloat((adaptor.getAttribute(svg, "style") || "").replace(/.*vertical-align:\s*([-\d.]+)ex.*/, "$1")) || 0;
  let s = adaptor.outerHTML(svg);
  if (/merror|data-mjx-error/.test(s)) throw new Error("TeX error in " + id + ": " + tex);
  s = s.replace(/ width="[^"]*"/, "").replace(/ height="[^"]*"/, "").replace(/ style="[^"]*"/, "");
  out[id] = { svg: s, w: vb[2] / 1000, h: vb[3] / 1000, a: (vb[3] + vb[1]) / 1000, va };
}
fs.writeFileSync(path.join(HERE, "work/formulas.json"), JSON.stringify(out));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.w.toFixed(2)} x ${v.h.toFixed(2)} em, ${(v.svg.length / 1024).toFixed(1)} KB`).join("\n"));
