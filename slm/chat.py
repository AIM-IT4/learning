"""Chat with our model in the browser. Its thinking and every tool call appear live.

    python chat.py --run runs/stage1            # then open http://localhost:8000

Uses only Python's standard library for the web server; the model needs torch,
tokenizers and QuantLib, the same as solve.py.
"""
import argparse
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import solve

PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Our Quant Model</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@600;700&display=swap">
<style>
:root { --bg:#f3f5f8; --panel:#fff; --ink:#14171c; --ink-2:#4a505b; --ink-3:#69707c; --rule:#dde2ea; --grid:#e7ecf4;
  --accent:#2a78d6; --accent-ink:#1c5cab; --accent-soft:#e7f0fb; --btn-bg:#1c5cab; --btn-ink:#fff; --model:#1c5cab;
  --think-bg:#f1f5fb; --calc:#9c3a14; --calc-bg:#fde8dd; --calc-line:#eb6834; --ql:#0b6b48; --ql-bg:#e3f6ee; --ql-line:#1baf7a;
  --bad:#b42318; --display:"Space Grotesk","Segoe UI",system-ui,sans-serif; --body:"Inter","Segoe UI",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace; }
@media (prefers-color-scheme: dark) { :root { --bg:#101216; --panel:#191c21; --ink:#eef0f3; --ink-2:#bcc2cc; --ink-3:#9198a3;
  --rule:#2a2f37; --grid:#20262e; --accent:#3987e5; --accent-ink:#86b6ef; --accent-soft:#172638; --btn-bg:#86b6ef; --btn-ink:#0b1626;
  --model:#86b6ef; --think-bg:#151d29; --calc:#ffb592; --calc-bg:#3a2419; --calc-line:#d95926; --ql:#7fe0b8; --ql-bg:#12291f;
  --ql-line:#199e70; --bad:#ff8a80; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:400 16px/1.6 var(--body); }
.wrap { max-width:900px; margin:0 auto; padding:32px 16px 64px; display:grid; gap:20px; }
h1 { font:700 clamp(28px,5vw,40px)/1.1 var(--display); letter-spacing:-0.02em; margin:0; }
.info { color:var(--ink-2); font-size:15px; }
.examples { display:flex; flex-wrap:wrap; gap:8px; }
.ex { font:500 13.5px/1.3 var(--body); text-align:left; padding:8px 12px; border-radius:999px; border:1px solid var(--rule);
  background:var(--panel); color:var(--ink); cursor:pointer; }
.ex:hover { border-color:var(--accent); }
form { display:grid; gap:10px; background:var(--panel); border:1px solid var(--rule); border-radius:14px; padding:14px; }
textarea { width:100%; min-height:92px; resize:vertical; font:400 16px/1.5 var(--body); color:var(--ink); background:transparent;
  border:1px solid var(--rule); border-radius:10px; padding:10px 12px; }
textarea:focus, .ex:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.row { display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; }
button.go { font:600 15px/1 var(--body); padding:11px 18px; border-radius:9px; border:0; background:var(--btn-bg); color:var(--btn-ink); cursor:pointer; }
button.go:disabled { opacity:.6; cursor:progress; }
.hint { color:var(--ink-3); font-size:13.5px; }
.answers { display:grid; gap:16px; }
.card { background:var(--panel); border:1px solid var(--rule); border-radius:14px; overflow:hidden; }
.q { padding:14px 16px; border-bottom:1px solid var(--rule); font-weight:500; }
.q b { font-family:var(--mono); color:var(--ink-3); margin-right:6px; }
.paper { padding:12px 16px 16px; font:400 14px/24px var(--mono); white-space:pre-wrap; overflow-wrap:anywhere; color:var(--model);
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:24px 24px; background-position:-1px -1px; min-height:60px; }
.think { display:block; margin:2px 0 8px; padding:10px 12px; background:var(--think-bg); border:1px dashed var(--accent); border-radius:10px; }
.tl { display:block; font:600 11.5px/1.3 var(--body); letter-spacing:.07em; text-transform:uppercase; color:var(--accent-ink); }
.c { color:var(--calc); background:var(--calc-bg); box-shadow:inset 0 0 0 1px var(--calc-line); border-radius:4px; padding:1px 4px; font-weight:600; }
.g { color:var(--ql); background:var(--ql-bg); box-shadow:inset 0 0 0 1px var(--ql-line); border-radius:4px; padding:1px 4px; font-weight:600; }
.foot { display:flex; flex-wrap:wrap; gap:6px 18px; padding:10px 16px; border-top:1px solid var(--rule); font-size:14px; color:var(--ink-2); }
.foot b { color:var(--ink); }
.foot .err { color:var(--bad); }
.legend { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:13.5px; color:var(--ink-2); }
.legend span { display:inline-flex; align-items:center; gap:7px; }
.sw { font:600 12px/1.4 var(--mono); }
</style></head>
<body><div class="wrap">
  <header><h1>Our quant model</h1><p class="info" id="info">Loading…</p></header>
  <div class="examples" id="examples"></div>
  <form id="f">
    <label for="q" class="hint">Ask a quant question. Give the numbers, as in the examples.</label>
    <textarea id="q" placeholder="A stock trades at ₹100. Its volatility is 20% a year. The risk-free rate is 7% a year, continuously compounded. What is a 6-month European call with strike ₹105 worth?"></textarea>
    <div class="row"><button class="go" id="go" type="submit">Solve</button><span class="hint">Ctrl + Enter also works</span></div>
  </form>
  <div class="legend"><span><span class="sw" style="color:var(--model)">Abc</span> Written by our model</span>
    <span><span class="sw c">0.5</span> Calculator</span><span><span class="sw g">5.009</span> QuantLib</span></div>
  <div class="answers" id="answers"></div>
</div>
<script>
const EXAMPLES = [
  "A stock trades at ₹100. Its volatility is 20% a year. The risk-free rate is 7% a year, continuously compounded. What is a 6-month European call with strike ₹105 worth?",
  "The share price is ₹50. The stock's annual volatility is 30%. The risk-free rate is 6% a year, continuously compounded. Price a 1-year American put with strike ₹52.",
  "What is the price of a 5-year bond with face value ₹1000 paying a 8% coupon once a year, if its yield is 7.5%?",
  "Under the Vasicek model with mean reversion a = 0.15, long-run rate b = 6%, volatility σ = 1% and a current short rate of 5%, what is a 3-year zero-coupon bond paying ₹100 worth?",
  "A portfolio is worth ₹1000000. Its daily volatility is 1.2%. What is its 1-day 99% value at risk, assuming normal returns?",
  "The risk-free rate is 8% a year, compounded quarterly. A stock trades at ₹100. A European put on the same stock, same expiry, strike ₹100, trades at ₹4.2. What is a 6-month European call with strike ₹105 worth?"
];
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function render(segs) {
  let html = "";
  for (const s of segs) {
    if (s.type === "text") html += esc(s.text);
    else html += '<span class="' + (s.expr.startsWith("QL.") ? "g" : "c") + '">' + esc(s.result) + "</span>";
  }
  return html.replace(/^\s*&lt;think&gt;\n?/, '<span class="think"><span class="tl">Thinking</span>').replace(/\n?&lt;\/think&gt;\n?/, "</span>");
}
async function ask(question) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = '<div class="q"><b>Q:</b></div><div class="paper"></div><div class="foot">Thinking…</div>';
  card.querySelector(".q").append(document.createTextNode(question));
  $("#answers").prepend(card);
  const paper = card.querySelector(".paper"), foot = card.querySelector(".foot");
  const segs = [];
  $("#go").disabled = true;
  try {
    const res = await fetch("/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.type === "text" || ev.type === "tool") { segs.push(ev); paper.innerHTML = render(segs); }
        if (ev.type === "end") {
          foot.innerHTML = (ev.answer !== null ? "<span>Answer: <b>" + esc(ev.answer) + "</b></span>" : "<span class='err'>No final answer</span>") +
            "<span>Tool calls: " + ev.calls + "</span><span>" + ev.seconds + " s</span>" + (ev.error ? "<span class='err'>" + esc(ev.error) + "</span>" : "");
        }
      }
    }
  } catch (e) { foot.innerHTML = "<span class='err'>Could not reach the model: " + esc(String(e)) + "</span>"; }
  $("#go").disabled = false;
}
for (const q of EXAMPLES) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ex"; b.textContent = q.length > 70 ? q.slice(0, 68) + "…" : q; b.title = q;
  b.addEventListener("click", () => { $("#q").value = q; ask(q); });
  $("#examples").append(b);
}
$("#f").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#q").value.trim(); if (q) ask(q); });
$("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("#f").requestSubmit(); });
fetch("/info").then((r) => r.json()).then((i) => {
  $("#info").textContent = "Built from scratch: " + (i.params / 1e6).toFixed(1) + " million parameters, " +
    (i.tokens ? (i.tokens / 1e6).toFixed(0) + " million training tokens, " : "") + "tools: calculator and QuantLib. " +
    "It knows the kinds of problems it practised; anything else it may get wrong.";
});
</script></body></html>
"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--run", required=True, help="folder with model.pt and tokenizer.json")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args()

    model, tok = solve.load(a.run)
    info = {"params": model.num_params(), "vocab": tok.get_vocab_size(), "tokens": None}
    summary = os.path.join(a.run, "summary.json")
    if os.path.exists(summary):
        with open(summary) as f:
            info["tokens"] = json.load(f).get("tokens")
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body, kind):
            data = body.encode() if isinstance(body, str) else body
            self.send_response(code)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/":
                self._send(200, PAGE, "text/html; charset=utf-8")
            elif self.path == "/info":
                self._send(200, json.dumps(info), "application/json")
            else:
                self._send(404, "not found", "text/plain")

        def do_POST(self):
            if self.path != "/ask":
                return self._send(404, "not found", "text/plain")
            n = int(self.headers.get("Content-Length") or 0)
            try:
                question = str(json.loads(self.rfile.read(n) or b"{}").get("question", "")).strip()[:2000]
            except json.JSONDecodeError:
                return self._send(400, "send JSON like {\"question\": \"...\"}", "text/plain")
            if not question:
                return self._send(400, "empty question", "text/plain")
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with lock:
                t0 = time.time()
                for ev in solve.generate(model, tok, question):
                    if ev[0] == "text":
                        msg = {"type": "text", "text": ev[1]}
                    elif ev[0] == "tool":
                        msg = {"type": "tool", "expr": ev[1], "result": ev[2]}
                    else:
                        msg = {"type": "end", "answer": ev[2], "calls": len(ev[3]), "error": ev[4],
                               "seconds": round(time.time() - t0, 1)}
                    self.wfile.write((json.dumps(msg, ensure_ascii=False) + "\n").encode())
                    self.wfile.flush()

        def log_message(self, *args):
            pass

    print(f"Our quant model ({info['params'] / 1e6:.1f}M parameters) is ready: open http://{a.host}:{a.port}", flush=True)
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
