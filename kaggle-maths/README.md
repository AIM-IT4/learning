# kaggle-maths

Fine-tune a small open model to solve maths word problems on Kaggle's **free GPU**, measure
how much it improved, and run the result on a laptop.

- **Model:** Qwen3-0.6B-Base (Apache-2.0), 600 million parameters
- **Data:** GSM8K, 7,473 school maths word problems with worked solutions (MIT licence)
- **Method:** LoRA, which trains small add-on weights (1.7% of the model) instead of all of them
- **Check:** accuracy on 200 test problems the model never trains on, before and after
- **Cost:** about 30–60 minutes of Kaggle's ~30 free GPU hours a week

| File | What it is |
| --- | --- |
| `maths_finetune.py` | The notebook as a plain Python file: the source of truth |
| `maths_finetune.ipynb` | The same, as a Kaggle notebook (built by `build_notebook.py`) |
| `build_notebook.py` | Converts the `.py` into the `.ipynb` |
| `run_local.py` | Runs the trained model on a laptop CPU |

## Run it on Kaggle

**In the browser:** on Kaggle, *Create → New Notebook → File → Import Notebook*, pick
`maths_finetune.ipynb`. In the right panel set *Accelerator → GPU T4 x2* and turn *Internet*
on (both need a phone-verified Kaggle account). Then *Run All*, or *Save Version → Save & Run
All* to let it run in the background.

**From a terminal**, with the Kaggle CLI (`pip install kaggle six`) and your token in the
`KAGGLE_API_TOKEN` environment variable (Kaggle → Settings → API; never commit it). Next to the
notebook, create `kernel-metadata.json`:

```json
{
  "id": "YOUR_KAGGLE_USERNAME/maths-word-problems-lora",
  "title": "Maths Word Problems LoRA",
  "code_file": "maths_finetune.ipynb",
  "language": "python",
  "kernel_type": "notebook",
  "is_private": true,
  "enable_gpu": true,
  "enable_internet": true
}
```

```bash
kaggle kernels push -p . --accelerator NvidiaTeslaT4 -t 7200
kaggle kernels status YOUR_KAGGLE_USERNAME/maths-word-problems-lora
kaggle kernels output YOUR_KAGGLE_USERNAME/maths-word-problems-lora -p results --file-pattern 'results\.json$'
```

## Change it and test it first

Edit `maths_finetune.py`, then run a tiny version on your own CPU (about a minute; it uses
32 problems and 2 training steps, so its accuracy numbers mean nothing):

```bash
pip install torch transformers peft trl datasets accelerate
SMOKE=1 python maths_finetune.py
python build_notebook.py          # then upload or push the new .ipynb
```

For a stronger model, set `MODEL_ID = "Qwen/Qwen3-1.7B-Base"` (roughly three times slower).

## Run the trained model on your laptop

Download the `maths-model` folder from the notebook's *Output* tab (about 1.2 GB), then:

```bash
pip install torch transformers
python run_local.py ./maths-model "A pen costs 12 rupees. How much do 7 pens cost?"
python run_local.py ./maths-model      # interactive
```

It needs about 3 GB of RAM and answers in a few seconds on a laptop CPU.

## What to expect

GSM8K is hard for a model this small: a 0.6B model gets some problems right and many wrong.
The point is to see training work end to end and to measure the change honestly. Answers
without `#### number` are scored by their last number, so the untrained model isn't marked
wrong just for using a different format.
