# %% [markdown]
# # Teach a small model to solve maths word problems
#
# This notebook fine-tunes **Qwen3-0.6B-Base**, a small open model (Apache-2.0 licence),
# on **GSM8K**: 7,473 school maths word problems with step-by-step solutions (MIT licence).
#
# It measures the model **before and after** training on 200 problems it never sees in
# training, so you can see exactly what the training changed. Then it saves the trained
# model so you can download it and run it on a laptop.
#
# **How to run on Kaggle:** Settings → Accelerator → **GPU T4 x2** (or P100), Internet **on**,
# then **Run All**. About 30–60 minutes of your free weekly GPU quota.
#
# **Method:** LoRA. Instead of changing all 600 million weights, it trains small add-on
# matrices (about 1–2% of the size), which is fast and fits easily in a free 16 GB GPU.

# %%
# Setup: install the exact library versions this notebook was tested with.
import os
import subprocess
import sys

IN_KAGGLE = os.path.exists("/kaggle")


def internet_on():
    import socket
    try:
        socket.create_connection(("pypi.org", 443), timeout=5).close()
        return True
    except OSError:
        return False


if IN_KAGGLE:
    if not internet_on():
        raise RuntimeError("Internet is off for this notebook. On Kaggle, verify your phone number "
                           "(Settings → Phone verification), then switch Internet on in the notebook's "
                           "right-hand panel and run again.")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                    "transformers==5.23.0", "peft==0.21.3", "trl==1.18.1",
                    "datasets==5.2.0", "accelerate==1.16.0"], check=True)
# Use one GPU even when Kaggle offers two: simpler and more reliable for a model this size.
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "0")

# %%
# Settings. Change MODEL_ID to "Qwen/Qwen3-1.7B-Base" for a stronger (slower) model.
import json
import random
import re
import time

import torch

SMOKE = os.environ.get("SMOKE") == "1"          # a tiny run, used to test this code on a CPU
MODEL_ID = os.environ.get("MODEL_ID", "Qwen/Qwen3-0.6B-Base")
N_TRAIN = 32 if SMOKE else None                 # None = all 7,473 training problems
N_EVAL = 4 if SMOKE else 200                    # unseen test problems scored before and after
MAX_NEW_TOKENS = 40 if SMOKE else 320
EPOCHS = 1
OUT_DIR = "/kaggle/working" if os.path.exists("/kaggle/working") else "out"
os.makedirs(OUT_DIR, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print("Device:", DEVICE, torch.cuda.get_device_name(0) if DEVICE == "cuda" else "(no GPU: slow, fine for a test run)")
if IN_KAGGLE and DEVICE == "cpu" and not SMOKE:
    raise RuntimeError("No GPU on this notebook. On Kaggle, verify your phone number (Settings → Phone "
                       "verification), then set Accelerator to 'GPU T4 x2' in the right-hand panel and run again.")
random.seed(0)
torch.manual_seed(0)

# %% [markdown]
# ## 1. The data
# Each training example is a question and a worked solution ending in `#### answer`.
# GSM8K solutions include calculator notes like `<<48/2=24>>`; we remove them.

# %%
from datasets import load_dataset

gsm = load_dataset("openai/gsm8k", "main")
PROMPT = "Question: {q}\nAnswer: Let's think step by step.\n"


def clean(solution):
    return re.sub(r"<<[^>]*>>", "", solution).strip()


def final_number(text, last_number_fallback=False):
    """The number after '####'. For model answers without '####', the last number mentioned,
    so an untrained model isn't marked wrong just for using a different format."""
    m = re.search(r"####\s*\$?\s*(-?[\d,]*\.?\d+)", text)
    if m:
        return m.group(1).replace(",", "")
    if last_number_fallback:
        nums = re.findall(r"-?\d[\d,]*(?:\.\d+)?", text)
        return nums[-1].replace(",", "") if nums else None
    return None


def to_example(row):
    return {"prompt": PROMPT.format(q=row["question"].strip()), "completion": clean(row["answer"])}


train = gsm["train"].map(to_example, remove_columns=gsm["train"].column_names)
if N_TRAIN:
    train = train.select(range(N_TRAIN))
test = gsm["test"].select(range(N_EVAL))
print(f"{len(train)} training problems, {len(test)} test problems\n")
print(train[0]["prompt"] + train[0]["completion"])

# %% [markdown]
# ## 2. Load the model and score it before training

# %%
from transformers import AutoModelForCausalLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained(MODEL_ID)
tok.padding_side = "left"                       # needed to generate answers in batches
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float32).to(DEVICE)
print(f"{MODEL_ID}: {sum(p.numel() for p in model.parameters()) / 1e6:.0f}M parameters")


def answers_match(pred, gold):
    try:
        return pred is not None and gold is not None and abs(float(pred) - float(gold)) < 1e-6
    except ValueError:
        return False


@torch.no_grad()
def score(m, rows, batch_size=16, keep=3):
    """Greedy answers for every test problem; a problem counts only if the final number is right."""
    m.eval()
    correct, samples = 0, []
    for i in range(0, len(rows), batch_size):
        batch = rows.select(range(i, min(i + batch_size, len(rows))))
        prompts = [PROMPT.format(q=q.strip()) for q in batch["question"]]
        enc = tok(prompts, return_tensors="pt", padding=True).to(DEVICE)
        out = m.generate(**enc, max_new_tokens=MAX_NEW_TOKENS, do_sample=False,
                         pad_token_id=tok.pad_token_id, eos_token_id=tok.eos_token_id)
        for j, row in enumerate(batch):
            text = tok.decode(out[j][enc["input_ids"].shape[1]:], skip_special_tokens=True)
            text = text.split("Question:")[0].strip()   # base models sometimes start a new question
            ok = answers_match(final_number(text, last_number_fallback=True), final_number(row["answer"]))
            correct += ok
            if len(samples) < keep:
                samples.append({"question": row["question"], "model_answer": text, "correct": bool(ok),
                                "true_answer": final_number(row["answer"])})
    return correct / len(rows), samples


t0 = time.time()
acc_before, samples_before = score(model, test)
print(f"BEFORE training: {acc_before:.1%} of {len(test)} unseen problems correct ({time.time() - t0:.0f}s)")
for s in samples_before[:2]:
    print("\n---", s["question"], "\n>>", s["model_answer"][:500], f"\n[correct: {s['correct']}]")

# %% [markdown]
# ## 3. Train with LoRA
# The loss is computed only on the solutions (`completion_only_loss`), so the model learns
# to *solve*, not to repeat questions.

# %%
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM")
cfg = SFTConfig(
    output_dir=os.path.join(OUT_DIR, "checkpoints"),
    num_train_epochs=EPOCHS,
    max_steps=2 if SMOKE else -1,
    per_device_train_batch_size=2 if SMOKE else 8,
    gradient_accumulation_steps=1 if SMOKE else 2,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_steps=0.03,
    logging_steps=1 if SMOKE else 25,
    save_strategy="no",
    report_to="none",
    bf16=False,                                  # T4 and P100 GPUs don't support bf16; use fp16 instead
    fp16=(DEVICE == "cuda"),
    use_cpu=(DEVICE == "cpu"),
    max_length=512,
    completion_only_loss=True,
)
trainer = SFTTrainer(model=model, args=cfg, train_dataset=train, processing_class=tok, peft_config=lora)
trainer.model.print_trainable_parameters()

t0 = time.time()
trainer.train()
train_minutes = (time.time() - t0) / 60
print(f"Training took {train_minutes:.1f} minutes")

# %% [markdown]
# ## 4. Score it again on the same unseen problems

# %%
tok.padding_side = "left"
t0 = time.time()
acc_after, samples_after = score(trainer.model, test)
print(f"AFTER training:  {acc_after:.1%} of {len(test)} unseen problems correct ({time.time() - t0:.0f}s)")
print(f"BEFORE training: {acc_before:.1%}")
for s in samples_after[:2]:
    print("\n---", s["question"], "\n>>", s["model_answer"][:500], f"\n[correct: {s['correct']}]")

# %% [markdown]
# ## 5. Save the trained model
# The LoRA add-ons are merged into the model, saved in half precision (about 1.2 GB for
# 0.6B). On Kaggle, find it under **Output → maths-model** and download it.

# %%
merged = trainer.model.merge_and_unload()
if DEVICE == "cuda":
    merged = merged.to(torch.float16)
save_dir = os.path.join(OUT_DIR, "maths-model")
merged.save_pretrained(save_dir)
tok.save_pretrained(save_dir)

results = {
    "model": MODEL_ID, "train_problems": len(train), "test_problems": len(test),
    "accuracy_before": acc_before, "accuracy_after": acc_after, "train_minutes": round(train_minutes, 1),
    "device": torch.cuda.get_device_name(0) if DEVICE == "cuda" else "cpu",
    "examples_before": samples_before, "examples_after": samples_after,
    "training_log": trainer.state.log_history,
}
with open(os.path.join(OUT_DIR, "results.json"), "w") as f:
    json.dump(results, f, indent=2)
print("Saved model to", save_dir, "and results to results.json")

# %% [markdown]
# ## 6. Ask it your own question

# %%
def ask(question):
    enc = tok(PROMPT.format(q=question), return_tensors="pt").to(DEVICE)
    out = merged.generate(**enc, max_new_tokens=MAX_NEW_TOKENS, do_sample=False, pad_token_id=tok.pad_token_id)
    return tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).split("Question:")[0].strip()


print(ask("A shop sells pens for 12 rupees each. Riya buys 7 pens and pays with a 100 rupee note. "
          "How much change does she get?"))
