// Check ganit-core.js against the Python reference: token ids, tool results, logits, full answers.
//   node web/test_core.js <folder made by web/export.py, plus a vectors.json of reference outputs from the Python code>
const fs = require("fs");
const path = require("path");
const G = require("./ganit-core.js");

const dir = process.argv[2];
const vec = JSON.parse(fs.readFileSync(path.join(dir, "vectors.json"), "utf8"));
const tok = new G.Tokenizer(JSON.parse(fs.readFileSync(path.join(dir, "tokenizer.json"), "utf8")));

let bad = 0;
for (const c of vec.tokenizer) {
  const got = tok.encode(c.text);
  if (JSON.stringify(got) !== JSON.stringify(c.ids)) {
    if (bad < 3) console.log("TOKEN MISMATCH", JSON.stringify(c.text.slice(0, 80)), "\n  js ", got.slice(0, 30).join(","), "\n  py ", c.ids.slice(0, 30).join(","));
    bad++;
  } else if (tok.decode(got) !== c.text) { if (bad < 3) console.log("DECODE MISMATCH", JSON.stringify(c.text.slice(0, 60))); bad++; }
}
console.log(`tokenizer: ${vec.tokenizer.length - bad}/${vec.tokenizer.length} identical`);

let toolBad = 0;
for (const c of vec.tools) {
  let got;
  try { got = G.runTool(c.expr); } catch (e) { got = c.result === "ERROR" ? "ERROR" : "ERROR " + e.message; }
  if (got !== c.result) {
    const [a, b] = [parseFloat(got), parseFloat(c.result)];
    const close = isFinite(a) && Math.abs(a - b) <= Math.max(Math.abs(b) * 2e-3, 1e-4);
    if (toolBad < 8) console.log(`${close ? "near" : "TOOL MISMATCH"}: ${c.expr}\n  js ${got}  py ${c.result}`);
    toolBad++;
  }
}
console.log(`tools: ${vec.tools.length - toolBad}/${vec.tools.length} identical`);

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "ganit15m.json"), "utf8"));
const bufs = manifest.files.map((f) => manifest.encoding === "base64"
  ? Buffer.from(fs.readFileSync(path.join(dir, f), "utf8"), "base64") : fs.readFileSync(path.join(dir, f)));
const all = Buffer.concat(bufs);
const half = new Uint16Array(all.buffer, all.byteOffset, all.byteLength / 2);
const t0 = Date.now();
const model = new G.GPT(manifest, half);
console.log(`model loaded in ${Date.now() - t0} ms`);
const cache = model.newCache();
let logits;
const t1 = Date.now();
vec.logits.ids.forEach((id, i) => { logits = model.forward(id, i, cache); });
const per = (Date.now() - t1) / vec.logits.ids.length;
let maxDiff = 0;
vec.logits.values.forEach((v, i) => { maxDiff = Math.max(maxDiff, Math.abs(v - logits[i])); });
const am = (a) => a.indexOf(Math.max(...a));
console.log(`logits: max difference ${maxDiff.toExponential(2)}, same top token: ${am(Array.from(logits)) === am(vec.logits.values)}, ${per.toFixed(1)} ms per token`);

(async () => {
  let same = 0, sameAns = 0;
  const t2 = Date.now();
  for (const g of vec.gens) {
    let end;
    for await (const ev of G.generate(model, tok, g.question)) if (ev.type === "end") end = ev;
    if (end.text === g.text) same++; else if (same + 2 > vec.gens.length) {}
    if (end.answer === g.answer) sameAns++;
    else console.log("ANSWER DIFFERS:", g.question.slice(0, 70), "| js", end.answer, "py", g.answer);
  }
  console.log(`generation: ${same}/${vec.gens.length} identical answers word for word, ${sameAns}/${vec.gens.length} same final number, ${((Date.now() - t2) / vec.gens.length / 1000).toFixed(2)} s each`);
})();
