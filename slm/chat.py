"""Ganit: chat with our quant models in the browser. Thinking and tool calls appear live.

    python chat.py                                   # finds runs/ganit-* automatically
    python chat.py --model "Ganit-100M=runs/ganit-100m" --model "Ganit-15M=runs/ganit-15m"
    # then open http://localhost:8000

The web server uses only Python's standard library; the models need torch, tokenizers and
QuantLib, the same as solve.py.
"""
import argparse
import glob
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import solve

PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ganit</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+Devanagari:wght@600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* Ganit: a dark-first workspace. Saffron marks the brand, blue marks what the model writes,
   orange and green mark what the calculator and QuantLib compute. */
:root {
  --bg: #0b0f17; --panel: #111826; --panel-2: #0e1420; --line: #1f2a3b; --ink: #e8edf5; --ink-2: #a9b5c7; --ink-3: #7d8a9e;
  --accent: #7aa7ff; --accent-strong: #4f86f7; --accent-soft: rgba(122, 167, 255, .12); --brand: #ff9f43; --brand-ink: #1a0f02;
  --user: #1b2b4b; --user-ink: #e8edf5; --answer: #14233d; --answer-line: #2c4a7a;
  --calc: #ffb592; --calc-bg: #3a2419; --calc-line: #d95926; --ql: #7fe0b8; --ql-bg: #12291f; --ql-line: #199e70;
  --think-bg: rgba(122, 167, 255, .06); --bad: #ff8a80; --shadow: 0 10px 40px -20px rgba(0, 0, 0, .8);
  --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif; --body: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; --deva: "Noto Sans Devanagari", "Mangal", sans-serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) { :root {
  --bg: #f4f6fb; --panel: #ffffff; --panel-2: #f8fafd; --line: #e1e7f0; --ink: #0f172a; --ink-2: #475569; --ink-3: #64748b;
  --accent: #2563eb; --accent-strong: #1d4ed8; --accent-soft: rgba(37, 99, 235, .08); --brand: #f08c24; --brand-ink: #1a0f02;
  --user: #e7efff; --user-ink: #0f172a; --answer: #eef4ff; --answer-line: #bcd0f7;
  --calc: #9c3a14; --calc-bg: #fde8dd; --calc-line: #eb6834; --ql: #0b6b48; --ql-bg: #e3f6ee; --ql-line: #1baf7a;
  --think-bg: rgba(37, 99, 235, .04); --bad: #b42318; --shadow: 0 10px 40px -24px rgba(15, 23, 42, .35); color-scheme: light; } }
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 15.5px/1.6 var(--body); }
button, textarea { font: inherit; color: inherit; }
button:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.app { display: grid; grid-template-columns: 300px minmax(0, 1fr); height: 100%; }

/* sidebar */
aside { border-right: 1px solid var(--line); background: var(--panel-2); padding: 20px 18px; display: flex; flex-direction: column; gap: 22px; overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 12px; }
.logo { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: var(--brand); color: var(--brand-ink);
  font: 600 25px/1 var(--deva); box-shadow: 0 6px 20px -8px var(--brand); }
.brand b { display: block; font: 700 22px/1.1 var(--display); letter-spacing: -0.02em; }
.brand span { display: block; font-size: 12.5px; color: var(--ink-3); }
.label { font: 600 11.5px/1.3 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 8px; }
.models { display: grid; gap: 8px; }
.mcard { text-align: left; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); cursor: pointer; display: grid; gap: 2px; }
.mcard b { font: 600 15px/1.3 var(--display); }
.mcard span { font-size: 12.5px; color: var(--ink-3); }
.mcard[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); background: var(--accent-soft); }
.groups { display: grid; gap: 14px; }
.group h4 { margin: 0 0 6px; font: 600 12.5px/1.3 var(--body); color: var(--ink-2); }
.ex { display: block; width: 100%; text-align: left; padding: 8px 10px; margin: 0 0 6px; border-radius: 10px; border: 1px solid transparent;
  background: transparent; color: var(--ink-2); font-size: 13.5px; line-height: 1.4; cursor: pointer; }
.ex:hover { background: var(--panel); border-color: var(--line); color: var(--ink); }
.legend { margin-top: auto; display: grid; gap: 6px; font-size: 12.5px; color: var(--ink-3); }
.legend div { display: flex; align-items: center; gap: 8px; }
.sw { font: 600 11.5px/1.5 var(--mono); padding: 0 6px; border-radius: 5px; }
.sw.m { color: var(--accent); background: var(--accent-soft); }
.sw.c { color: var(--calc); background: var(--calc-bg); box-shadow: inset 0 0 0 1px var(--calc-line); }
.sw.q { color: var(--ql); background: var(--ql-bg); box-shadow: inset 0 0 0 1px var(--ql-line); }

/* main */
main { display: flex; flex-direction: column; min-width: 0; height: 100%; }
.topbar { display: none; }
.scroll { flex: 1; overflow-y: auto; padding: 28px 24px 16px; }
.thread { max-width: 860px; margin: 0 auto; display: grid; gap: 22px; }
.hero { max-width: 860px; margin: 6vh auto 0; text-align: left; }
.hero h1 { font: 700 clamp(30px, 4.6vw, 46px)/1.05 var(--display); letter-spacing: -0.03em; margin: 0 0 10px; }
.hero h1 em { font-style: normal; color: var(--brand); }
.hero p { color: var(--ink-2); max-width: 60ch; margin: 0 0 22px; }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.card { text-align: left; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--panel); cursor: pointer; display: grid; gap: 4px; }
.card:hover { border-color: var(--accent); }
.card b { font: 600 14.5px/1.3 var(--display); }
.card span { font-size: 13.5px; color: var(--ink-2); line-height: 1.45; }
.user { justify-self: end; max-width: 78%; background: var(--user); color: var(--user-ink); padding: 12px 16px; border-radius: 18px 18px 4px 18px; }
.bot { display: grid; gap: 10px; }
.bothead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.avatar { width: 30px; height: 30px; border-radius: 9px; background: var(--brand); color: var(--brand-ink); display: grid; place-items: center; font: 600 17px/1 var(--deva); }
.bothead b { font: 600 14.5px/1 var(--display); }
.pill { font-size: 12.5px; color: var(--ink-2); border: 1px solid var(--line); background: var(--panel); padding: 3px 10px; border-radius: 999px; }
.pill.live { background: linear-gradient(90deg, var(--panel) 0%, var(--accent-soft) 50%, var(--panel) 100%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
.pill.bad { color: var(--bad); }
details.think { border: 1px dashed var(--accent); background: var(--think-bg); border-radius: 14px; padding: 10px 14px; }
details.think summary { cursor: pointer; font: 600 12px/1.6 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); list-style: none; }
details.think summary::-webkit-details-marker { display: none; }
details.think summary::before { content: "▸ "; }
details.think[open] summary::before { content: "▾ "; }
.tk { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; margin-top: 6px; font-size: 14.5px; }
.tk .k { font-weight: 600; color: var(--ink-2); }
.tk ol { margin: 0; padding-left: 18px; }
.work { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; font: 400 13.5px/1.75 var(--mono);
  color: var(--accent); white-space: pre-wrap; overflow-wrap: anywhere; box-shadow: var(--shadow); }
.work:empty { display: none; }
.call { display: inline; padding: 1px 6px; border-radius: 6px; font-size: 12.5px; }
.call.c { color: var(--calc); background: var(--calc-bg); }
.call.q { color: var(--ql); background: var(--ql-bg); }
.call .fn { font-weight: 600; margin-right: 4px; }
.res { display: inline-block; font-weight: 600; padding: 0 6px; border-radius: 6px; animation: pop .25s ease-out; }
.res.c { color: var(--calc); background: var(--calc-bg); box-shadow: inset 0 0 0 1px var(--calc-line); }
.res.q { color: var(--ql); background: var(--ql-bg); box-shadow: inset 0 0 0 1px var(--ql-line); }
.arrow { color: var(--ink-3); margin: 0 4px; }
@keyframes pop { from { transform: scale(.6); opacity: .2; } to { transform: none; opacity: 1; } }
.caret { display: inline-block; width: .5em; height: 1.05em; vertical-align: -0.18em; background: var(--accent); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.answer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-radius: 16px;
  background: var(--answer); border: 1px solid var(--answer-line); }
.answer .k { font: 600 11.5px/1.3 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.answer .v { font: 700 30px/1.15 var(--display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.answer .meta { font-size: 13px; color: var(--ink-3); }
.copy { border: 1px solid var(--line); background: var(--panel); border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 13.5px; }
.err { color: var(--bad); font-size: 14px; }

/* composer */
.composer { padding: 12px 24px calc(18px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--line); background: var(--bg); }
.box { max-width: 860px; margin: 0 auto; display: flex; gap: 10px; align-items: flex-end; background: var(--panel); border: 1px solid var(--line);
  border-radius: 18px; padding: 10px 10px 10px 16px; box-shadow: var(--shadow); }
.box:focus-within { border-color: var(--accent); }
textarea { flex: 1; min-height: 26px; max-height: 180px; resize: none; border: 0; background: transparent; outline: none; line-height: 1.5; padding: 4px 0; }
textarea:focus-visible { outline: none; }   /* the box's focus-within border shows focus */
.send { width: 42px; height: 42px; flex: none; border: 0; border-radius: 12px; background: var(--accent-strong); color: #fff; cursor: pointer; display: grid; place-items: center; }
.send:disabled { opacity: .5; cursor: progress; }
.hint { max-width: 860px; margin: 6px auto 0; font-size: 12px; color: var(--ink-3); display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }

@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  aside { display: none; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--panel-2); }
  .topbar .brand b { font-size: 19px; }
  .topbar select { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; font: 500 13.5px var(--body); }
  .scroll { padding: 20px 16px 12px; }
  .composer { padding-left: 12px; padding-right: 12px; }
  .cards { grid-template-columns: 1fr; }
  .user { max-width: 90%; }
}
@media (prefers-reduced-motion: reduce) { .pill.live, .caret, .res { animation: none; } }
</style></head>
<body><div class="app">
<aside>
  <div class="brand"><div class="logo" aria-hidden="true">ग</div><div><b>Ganit</b><span>गणित · a quant model built from scratch</span></div></div>
  <div><p class="label">Model</p><div class="models" id="models"></div></div>
  <div><p class="label">Try asking</p><div class="groups" id="groups"></div></div>
  <div class="legend">
    <div><span class="sw m">Abc</span> written by Ganit</div>
    <div><span class="sw c">0.5</span> worked out by the calculator</div>
    <div><span class="sw q">5.009</span> computed by QuantLib</div>
    <div style="margin-top:6px">Ganit knows the kinds of quant problems it practised. Outside them it can be wrong, so it shows every step.</div>
  </div>
</aside>
<main>
  <div class="topbar"><div class="brand"><div class="logo" aria-hidden="true">ग</div><b>Ganit</b></div><select id="msel" aria-label="Model"></select></div>
  <div class="scroll" id="scroll">
    <section class="hero" id="hero">
      <h1>Ask <em>Ganit</em> a quant question</h1>
      <p>Option prices and Greeks, bonds and yields, interest-rate models, swaps and risk. Give the numbers and Ganit plans the steps, calls the calculator and QuantLib for every exact number, and checks its answer.</p>
      <div class="cards" id="cards"></div>
    </section>
    <div class="thread" id="thread"></div>
  </div>
  <div class="composer">
    <form class="box" id="form">
      <textarea id="q" rows="1" placeholder="e.g. Price a 6-month European call: stock ₹100, strike ₹105, volatility 20%, rate 7% continuous"></textarea>
      <button class="send" id="send" type="submit" aria-label="Ask Ganit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </form>
    <div class="hint"><span>Enter to send · Shift + Enter for a new line</span><span id="mhint"></span></div>
  </div>
</main>
</div>
<script>
const GROUPS = {
  "Options": [
    ["European call", "A stock trades at ₹100. Its volatility is 20% a year. The risk-free rate is 7% a year, continuously compounded. What is a 6-month European call with strike ₹105 worth?"],
    ["American put", "The share price is ₹50. The stock's annual volatility is 30%. The risk-free rate is 6% a year, continuously compounded. Price a 1-year American put with strike ₹52."],
    ["Hidden volatility", "The risk-free rate is 8% a year, compounded quarterly. A stock trades at ₹100. A European put on the same stock, same expiry, strike ₹100, trades at ₹4.2. What is a 6-month European call with strike ₹105 worth?"]],
  "Bonds and rates": [
    ["Bond price", "What is the price of a 5-year bond with face value ₹1000 paying a 8% coupon once a year, if its yield is 7.5%?"],
    ["Rate conversion", "Convert 8% compounded quarterly into the equivalent rate continuously compounded."]],
  "Rate models": [
    ["Vasicek bond", "Under the Vasicek model with mean reversion a = 0.15, long-run rate b = 6%, volatility σ = 1% and a current short rate of 5%, what is a 3-year zero-coupon bond paying ₹100 worth?"]],
  "Risk": [
    ["Value at risk", "A portfolio is worth ₹1000000. Its daily volatility is 1.2%. What is its 1-day 99% value at risk, assuming normal returns?"]]
};
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let MODELS = [], current = null, busy = false;

function setModel(name) {
  current = name;
  document.querySelectorAll(".mcard").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === name)));
  $("#msel").value = name;
  const m = MODELS.find((x) => x.name === name);
  $("#mhint").textContent = m ? `${m.name} · ${(m.params / 1e6).toFixed(1)}M parameters · runs on this computer` : "";
}

function renderThink(t) {
  const rows = [];
  for (const line of t.split("\n")) {
    const m = line.match(/^(Goal|Known|Need|Plan):\s*(.*)$/);
    if (!m) { if (line.trim()) rows.push(`<div class="tk"><span class="k"></span><span>${esc(line)}</span></div>`); continue; }
    let body = esc(m[2]);
    if (m[1] === "Plan") {
      const items = m[2].split(/\s*\d+\)\s+/).filter(Boolean);
      body = "<ol>" + items.map((i) => `<li>${esc(i)}</li>`).join("") + "</ol>";
    }
    rows.push(`<div class="tk"><span class="k">${m[1]}</span><div>${body}</div></div>`);
  }
  return rows.join("");
}

function render(st) {
  let text = "", tools = [];
  for (const s of st.segs) {
    if (s.type === "text") text += s.text;
    else {
      const at = text.lastIndexOf("<<");
      if (at >= 0) text = text.slice(0, at);
      text += "\u0000" + tools.length + "\u0000";
      tools.push(s);
    }
  }
  let think = "", work = text, thinking = false;
  const a = text.indexOf("<think>");
  if (a >= 0) {
    const b = text.indexOf("</think>");
    if (b < 0) { think = text.slice(a + 7); work = ""; thinking = true; }
    else { think = text.slice(a + 7, b); work = text.slice(b + 8); }
  }
  let answer = null;
  const m = work.match(/####\s*(-?[\d,]*\.?\d+)/);
  if (m) { answer = m[1]; work = work.slice(0, m.index); }
  let html = esc(work.replace(/^\s*\n/, "").replace(/\s+$/, ""));
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => {
    const t = tools[+i], q = t.expr.startsWith("QL."), res = t.result.split(">>")[0];
    const expr = q ? t.expr.slice(3) : t.expr;
    const fn = q ? expr.slice(0, expr.indexOf("(")) : "";
    const args = q ? expr.slice(expr.indexOf("(")) : expr;
    return `<span class="call ${q ? "q" : "c"}" title="${esc(t.expr)}">${q ? `<span class="fn">QuantLib</span>${esc(fn)}${esc(args)}` : esc(args)}</span><span class="arrow">→</span><span class="res ${q ? "q" : "c"}">${esc(res)}</span>`;
  });
  const caret = st.done ? "" : '<span class="caret"></span>';
  st.el.querySelector(".thinkbody").innerHTML = renderThink(think) + (thinking && !st.done ? caret : "");
  st.el.querySelector(".work").innerHTML = html + (!thinking && !st.done && !answer ? caret : "");
  const pill = st.el.querySelector(".pill");
  if (!st.done) { pill.textContent = thinking || !work ? "Thinking…" : "Working it out…"; pill.className = "pill live"; }
  const ans = st.el.querySelector(".answerslot");
  if (st.done) {
    pill.className = "pill" + (st.end.error ? " bad" : "");
    pill.textContent = st.end.error ? "Stopped: a tool call failed" : `Done in ${st.end.seconds} s · ${st.end.calls} tool call${st.end.calls === 1 ? "" : "s"}`;
    if (st.end.answer !== null) {
      ans.innerHTML = `<div class="answer"><div><div class="k">Answer</div><div class="v">${esc(st.end.answer)}</div><div class="meta">${esc(st.model)} · every number from the calculator or QuantLib</div></div><button class="copy" type="button">Copy</button></div>`;
      ans.querySelector(".copy").addEventListener("click", (e) => {
        const done = () => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1500); };
        navigator.clipboard && navigator.clipboard.writeText(st.end.answer).then(done).catch(() => {});
      });
    } else {
      ans.innerHTML = `<div class="err">${st.end.error ? esc(st.end.error) : "Ganit didn't reach a final answer. Try wording the question like the examples."}</div>`;
    }
  }
}

async function ask(question) {
  if (busy || !question.trim()) return;
  busy = true; $("#send").disabled = true;
  $("#hero").hidden = true;
  const u = document.createElement("div"); u.className = "user"; u.textContent = question;
  const b = document.createElement("div"); b.className = "bot";
  b.innerHTML = `<div class="bothead"><div class="avatar" aria-hidden="true">ग</div><b>${esc(current)}</b><span class="pill live">Thinking…</span></div>
    <details class="think" open><summary>Thinking</summary><div class="thinkbody"></div></details><div class="work"></div><div class="answerslot"></div>`;
  $("#thread").append(u, b);
  const st = { segs: [], el: b, done: false, model: current };
  const scroll = () => { const s = $("#scroll"); s.scrollTop = s.scrollHeight; };
  scroll();
  try {
    const res = await fetch("/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, model: current }) });
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
        if (ev.type === "end") { st.done = true; st.end = ev; } else st.segs.push(ev);
        render(st); scroll();
      }
    }
  } catch (e) {
    st.done = true; st.end = { error: "Could not reach Ganit: " + e, answer: null, calls: 0, seconds: 0 }; render(st);
  }
  busy = false; $("#send").disabled = false; $("#q").focus();
}

for (const [group, items] of Object.entries(GROUPS)) {
  const g = document.createElement("div"); g.className = "group";
  g.innerHTML = `<h4>${esc(group)}</h4>`;
  for (const [label, q] of items) {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "ex"; btn.textContent = label; btn.title = q;
    btn.addEventListener("click", () => ask(q)); g.append(btn);
  }
  $("#groups").append(g);
}
for (const [label, q] of [GROUPS["Options"][0], GROUPS["Options"][2], GROUPS["Bonds and rates"][0], GROUPS["Risk"][0]]) {
  const c = document.createElement("button"); c.type = "button"; c.className = "card";
  c.innerHTML = `<b>${esc(label)}</b><span>${esc(q.length > 120 ? q.slice(0, 118) + "…" : q)}</span>`;
  c.addEventListener("click", () => ask(q)); $("#cards").append(c);
}
const ta = $("#q");
ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(180, ta.scrollHeight) + "px"; });
ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#form").requestSubmit(); } });
$("#form").addEventListener("submit", (e) => { e.preventDefault(); const q = ta.value; ta.value = ""; ta.style.height = "auto"; ask(q); });
$("#msel").addEventListener("change", (e) => setModel(e.target.value));
fetch("/info").then((r) => r.json()).then((info) => {
  MODELS = info.models;
  for (const m of MODELS) {
    const c = document.createElement("button"); c.type = "button"; c.className = "mcard"; c.dataset.name = m.name;
    c.innerHTML = `<b>${esc(m.name)}</b><span>${(m.params / 1e6).toFixed(1)}M parameters · ${esc(m.note || "")}</span>`;
    c.addEventListener("click", () => setModel(m.name)); $("#models").append(c);
    const o = document.createElement("option"); o.value = m.name; o.textContent = m.name; $("#msel").append(o);
  }
  if (MODELS.length) setModel(MODELS[0].name);
});
</script></body></html>
"""

NOTES = {"ganit-100m": "best at new wording", "ganit-15m": "fastest, strong on new combinations"}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", action="append", default=[], help='NAME=FOLDER with model.pt and tokenizer.json (repeatable)')
    p.add_argument("--run", help="a single model folder (older usage)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args()

    specs = [m.split("=", 1) for m in a.model]
    if a.run:
        specs.append([os.path.basename(os.path.normpath(a.run)), a.run])
    if not specs:                                    # find runs/ganit-* next to this file, biggest first
        here = os.path.dirname(os.path.abspath(__file__))
        found = sorted(glob.glob(os.path.join(here, "runs", "ganit-*")), key=lambda d: -os.path.getsize(os.path.join(d, "model.pt")))
        specs = [[os.path.basename(d).replace("ganit", "Ganit").replace("m", "M"), d] for d in found if os.path.exists(os.path.join(d, "model.pt"))]
    if not specs:
        raise SystemExit("No model found. Put model.pt and tokenizer.json in runs/ganit-100m (see README), or pass --model NAME=FOLDER.")

    models, info = {}, []
    for name, folder in specs:
        model, tok = solve.load(folder)
        models[name] = (model, tok)
        info.append({"name": name, "params": model.num_params(), "note": NOTES.get(os.path.basename(os.path.normpath(folder)).lower(), "")})
        print(f"loaded {name} ({model.num_params() / 1e6:.1f}M parameters) from {folder}", flush=True)
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
                self._send(200, json.dumps({"models": info}), "application/json")
            else:
                self._send(404, "not found", "text/plain")

        def do_POST(self):
            if self.path != "/ask":
                return self._send(404, "not found", "text/plain")
            n = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except json.JSONDecodeError:
                return self._send(400, 'send JSON like {"question": "..."}', "text/plain")
            question = str(body.get("question", "")).strip()[:2000]
            name = body.get("model") if body.get("model") in models else info[0]["name"]
            if not question:
                return self._send(400, "empty question", "text/plain")
            model, tok = models[name]
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
                               "seconds": round(time.time() - t0, 1), "model": name}
                    self.wfile.write((json.dumps(msg, ensure_ascii=False) + "\n").encode())
                    self.wfile.flush()

        def log_message(self, *args):
            pass

    print(f"Ganit is ready: open http://{a.host}:{a.port}", flush=True)
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
