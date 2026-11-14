# tiny-math-llm (paused)

Parts of an experiment with a very small maths model that hands its arithmetic to a calculator.
The experiment was paused before any model was trained here, so this folder holds no model.

- `calc.py`: input clean-up, tokenizer and a safe calculator that runs the short programs such a
  model writes. Self-test with `python calc.py`.
- `handwritten.py`: 155 everyday maths questions with their answers, plus 15 harder "stretch"
  questions. Useful for testing any maths model. Do not train on them.

Why it was paused: a model this small can only solve the problem types it is trained on. It cannot
reason through arbitrary complex maths, which needs a model of several gigabytes.
