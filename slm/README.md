# Our own quant model, built from scratch

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
| `chat.py` | A chat page in your browser that shows the thinking and tool calls live |
| `kaggle/` | Builds self-contained Kaggle kernels: the speed test and Stage 1 training |

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

## What it will not do

It only understands questions worded like the ones it practised (a bigger model trained
on English text first will widen that), it has no market data (you give the inputs), it
gives no trading advice, and it will not invent new models. When a question is outside
what it learned it can answer confidently and wrongly, which is why it shows every step.
