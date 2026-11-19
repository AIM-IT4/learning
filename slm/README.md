# Ganit (गणित): our own quant model, built from scratch

A small language model that reads quant questions in plain English, writes out its
thinking (goal, known values, plan, steps, a check) and gets every exact number from
tools: our calculator for formula steps and [QuantLib](https://www.quantlib.org/) for
pricing, trees, curves and simulation. Nothing here starts from someone else's model:
the training problems, the vocabulary (tokenizer) and the network are all ours, and the
network starts from random numbers.

## How it works

```
problems from parts ──► our tokenizer ──► our GPT ──► training ──► answers with live tools
   (quantgen.py)         (prepare.py)    (model.py)   (train.py)      (solve.py, chat.py)
```

1. **Problems built from parts** (`quantgen.py`). 14 kinds of quant task (option prices,
   Greeks, American options, implied volatility, put-call parity, bond price, yield and
   duration, zero-coupon bonds, rate conversion, forward rates, Vasicek and CIR bonds, swap
   rates, VaR and expected shortfall). Their inputs can be *disguised*: the volatility hidden
   in another option's price, the rate given with quarterly compounding or as a zero-coupon
   bond price, the stock price hidden in a futures price, and so on. Combining disguises
   makes problem structures the model has never seen. Some training solutions contain a
   deliberate slip that the solver notices and fixes.
2. **Written-out thinking.** Every solution has a `<think>` block (Goal, Known, Need, Plan),
   the working with tool calls, and a check (no-arbitrage bounds, repricing, a second
   formula, a simulation).
3. **Tools while writing** (`tools.py`). When the model writes `<<6/12=` or
   `<<QL.european_option(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)=`, our code runs it and
   writes the result back (`0.5>>0.5`), exactly as in training. The `=` inside `S=100` never
   triggers a call because the parentheses are not yet balanced.
4. **Honest tests.** Level 1: new numbers. Level 2: wordings never used in training.
   Level 3: combinations of disguises held out of training, or three at once.

## Files

| File | What it does |
|---|---|
| `calc.py` | Safe calculator: numbers, `+ - * / ^ ( )`, `pi`, `ln exp sqrt abs max min N invN` |
| `qltools.py` | 28 one-line QuantLib tools, checked against closed-form formulas |
| `tools.py` | When a tool call is complete, and how it is run |
| `mathgen.py` | 27 kinds of everyday maths, physics, finance and statistics problems |
| `quantgen.py` | Quant problems built from parts, with thinking, checks and slips |
| `prepare.py` | Generates the data, trains our tokenizer, writes token files and test sets |
| `model.py` | Our GPT: RMSNorm, rotary positions, SwiGLU, tied embeddings, KV cache |
| `train.py` | Training on CPU, one GPU or several (torchrun), with resume across sessions |
| `solve.py` | Answers a question with live tools, or grades the test sets |
| `chat.py` | Ganit's chat app: pick a model, watch the thinking and tool calls live |
| `kaggle/` | Builds self-contained Kaggle kernels: the speed test and Stage 1 training |
| `web/` | Ganit-15M in the browser: the page, a JavaScript copy of the model and tools, the export script |

## Use Ganit in your browser (nothing to install)

Ganit-15M runs entirely inside the browser: https://claude.ai/artifact/8oo1Jj8C8S9NcgC9FFh4xs
(the link is private until you share it from the page's **Share** menu). Each visit downloads
the model (about 40 MB); after that it answers on your own device and nothing you type is sent
anywhere. Ganit-100M is too heavy for a browser, so use the chat app below for it.

`web/ganit-core.js` is a JavaScript copy of our model, tokenizer, calculator and the 28 quant
tools. Checked against the Python version, it gives identical tokens (283 of 283 cases), logits
within 6e-6 and word-for-word identical answers (30 of 30). To rebuild the page's files after training:

```bash
python web/export.py --run runs/ganit-15m --out web/dist
cp web/ganit.html web/ganit-core.js web/dist/
cd web/dist && python -m http.server 8000      # open http://localhost:8000/ganit.html
```

## Use Ganit (chat app)

Two models: **Ganit-100M** (Stage 2, best at new wording) and **Ganit-15M** (Stage 1, fastest).

1. Get the code: clone this repo (or download it as a ZIP from GitHub) and open the `slm` folder.
2. Install: `pip install torch numpy tokenizers QuantLib`
   (on Windows, the small CPU build of torch: `pip install torch --index-url https://download.pytorch.org/whl/cpu`).
3. Get the model files (too big for git) from your Kaggle notebooks' **Output** tab:
   - `slm-stage-2-b` → `run-practice/model.pt` and `tokenizer.json` → save into `runs/ganit-100m/`
   - `slm-stage-1` → `run/model.pt` and `tokenizer.json` → save into `runs/ganit-15m/`
4. Run `python chat.py` and open http://localhost:8000

On a 4-core laptop CPU, Ganit-100M writes about 58 tokens a second, so most answers take 5–10 seconds.
Ask questions worded like the examples in the app; outside the kinds of problems it practised it can
be wrong, which is why every step and tool result is shown.

## Run it on a laptop

```bash
pip install torch numpy tokenizers QuantLib
python quantgen.py                 # see example problems
python quantgen.py --check         # verify every split: all tool results must reproduce
python prepare.py --out data/stage1 --problems 250000
python train.py --data data/stage1 --preset 15m --seq 768 --micro-batch 16 --grad-accum 1 \
    --lr 1e-3 --tokens 4e7 --minutes 180 --out runs/stage1
cp data/stage1/tokenizer.json runs/stage1/
python solve.py --run runs/stage1 --eval data/stage1 --n 200
python chat.py --run runs/stage1   # then open http://localhost:8000
```

A 15M-parameter model trains at about 3,600 tokens a second on a 4-core laptop CPU.

## Run it on Kaggle's free GPUs

Store your Kaggle API token as the environment variable `KAGGLE_API_TOKEN` (never in code or
chat), then:

```bash
python kaggle/build_kernel.py stage1 --user YOUR_KAGGLE_USERNAME --out /tmp/kernel-stage1
kaggle kernels push -p /tmp/kernel-stage1 --accelerator NvidiaTeslaT4 -t 7200
kaggle kernels output YOUR_KAGGLE_USERNAME/slm-stage-1 -p out/   # when it has finished
```

Measured on Kaggle's two T4 GPUs, the 100M-parameter model trains at 39,044 tokens a second
(19,999 on one GPU), so 2 billion tokens take about 14 hours.

## Results so far

**Stage 1** (14.9M parameters, 240M tokens, 22 minutes on Kaggle's two T4 GPUs), graded on
1,922 problems it never saw (`results/stage1.json`):

| Test | Score |
|---|---|
| Level 1: new numbers | 100.0% of 453 |
| Level 3: new combinations of disguises | 48.6% of 500 |
| Level 2: wording never used in training | 27.6% of 500 |
| Everyday maths, practised wording | 98.6% of 219 |
| Everyday maths, new wording | 47.6% of 250 |

It learned every method, and solves about half the problem structures it never practised.
Unfamiliar wording is its weak spot, which is what Stage 2 (a 100M model that first reads
1.6 billion tokens of English) is for.

## What it will not do

It only understands questions worded like the ones it practised (a bigger model trained
on English text first will widen that), it has no market data (you give the inputs), it
gives no trading advice, and it will not invent new models. When a question is outside
what it learned it can answer confidently and wrongly, which is why it shows every step.
