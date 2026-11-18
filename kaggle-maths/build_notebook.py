"""Turn maths_finetune.py (cells marked with '# %%') into maths_finetune.ipynb.

    python build_notebook.py

The .py file is the source of truth: it's easy to read, diff and test with
`SMOKE=1 python maths_finetune.py`. The notebook is what you upload to Kaggle.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = (HERE / "maths_finetune.py").read_text()

cells = []
for i, chunk in enumerate(src.split("# %%")[1:]):
    kind = "markdown" if chunk.startswith(" [markdown]") else "code"
    body = chunk.split("\n", 1)[1] if "\n" in chunk else ""
    cell_id = f"cell-{i:02d}"                    # notebook format 4.5 requires an id on every cell
    if kind == "markdown":
        lines = [ln[2:] if ln.startswith("# ") else ln.lstrip("#") for ln in body.strip("\n").splitlines()]
        text = "\n".join(lines)
        cells.append({"cell_type": "markdown", "id": cell_id, "metadata": {}, "source": text.splitlines(keepends=True)})
    else:
        text = body.strip("\n")
        cells.append({"cell_type": "code", "id": cell_id, "metadata": {}, "execution_count": None, "outputs": [],
                      "source": text.splitlines(keepends=True)})

notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}
out = HERE / "maths_finetune.ipynb"
out.write_text(json.dumps(notebook, indent=1))
print(f"wrote {out.name}: {sum(c['cell_type'] == 'code' for c in cells)} code cells, "
      f"{sum(c['cell_type'] == 'markdown' for c in cells)} text cells")
