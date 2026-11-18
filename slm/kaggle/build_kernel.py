"""Bundle our code into a self-contained Kaggle script kernel.

    python kaggle/build_kernel.py speed  --user KAGGLE_USERNAME --out /tmp/kernel-speed
    python kaggle/build_kernel.py stage1 --user KAGGLE_USERNAME --out /tmp/kernel-stage1
    kaggle kernels push -p /tmp/kernel-stage1 --accelerator NvidiaTeslaT4 -t 7200

The kernel embeds our source files, so the repo stays the single source of truth and
nothing has to be uploaded separately. The username is passed in, never stored here.
"""
import argparse
import base64
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
SLM = HERE.parent
CORE = ["model.py", "train.py"]
FULL = CORE + ["prepare.py", "mathgen.py", "quantgen.py", "calc.py", "qltools.py", "tools.py", "solve.py"]
JOBS = {  # job: (template in this folder, kernel title, kernel slug, files to embed, needs internet)
    "speed": ("speed_test.py", "SLM Speed Test", "slm-speed-test", CORE, False),
    "stage1": ("stage1.py", "SLM Stage 1", "slm-stage-1", FULL, True),
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("job", choices=sorted(JOBS))
    p.add_argument("--user", required=True, help="your Kaggle username")
    p.add_argument("--out", required=True, help="folder to write the kernel into")
    a = p.parse_args()

    template, title, slug, files, internet = JOBS[a.job]
    code = {name: base64.b64encode((SLM / name).read_bytes()).decode() for name in files}
    src = (HERE / template).read_text()
    assert src.count("CODE = {}") == 1
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / template).write_text(src.replace("CODE = {}", "CODE = " + json.dumps(code), 1))
    meta = {"id": f"{a.user}/{slug}", "title": title, "code_file": template, "language": "python",
            "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_tpu": False,
            "enable_internet": internet, "dataset_sources": [], "competition_sources": [],
            "kernel_sources": [], "model_sources": []}
    (out / "kernel-metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {out / template} ({sum(len(v) for v in code.values()) // 1024} KB of embedded code)")


if __name__ == "__main__":
    main()
