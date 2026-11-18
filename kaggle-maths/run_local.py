"""Run the fine-tuned maths model on a laptop CPU (no GPU needed).

    pip install torch transformers
    python run_local.py ./maths-model "A pen costs 12 rupees. How much do 7 pens cost?"
    python run_local.py ./maths-model          # interactive: type questions, empty line to quit

`./maths-model` is the folder from the Kaggle notebook's Output tab.
"""
import sys

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

PROMPT = "Question: {q}\nAnswer: Let's think step by step.\n"   # same format the model was trained on


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    tok = AutoTokenizer.from_pretrained(path)
    model = AutoModelForCausalLM.from_pretrained(path, dtype=torch.float32)   # float32 is fastest on a CPU
    model.eval()

    def ask(question):
        enc = tok(PROMPT.format(q=question), return_tensors="pt")
        with torch.no_grad():
            out = model.generate(**enc, max_new_tokens=320, do_sample=False, pad_token_id=tok.eos_token_id)
        text = tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
        return text.split("Question:")[0].strip()

    if len(sys.argv) > 2:
        print(ask(" ".join(sys.argv[2:])))
        return
    while True:
        question = input("\nQuestion (empty line to quit): ").strip()
        if not question:
            break
        print(ask(question))


if __name__ == "__main__":
    main()
