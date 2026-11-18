"""Bundle our code into a self-contained Kaggle script kernel.

    python kaggle/build_kernel.py speed       --user KAGGLE_USERNAME --out /tmp/kernel-speed
    python kaggle/build_kernel.py stage1      --user KAGGLE_USERNAME --out /tmp/kernel-stage1
    python kaggle/build_kernel.py stage1_rl   --user KAGGLE_USERNAME --out /tmp/kernel-rl     # practice with judge
    python kaggle/build_kernel.py stage2_data --user KAGGLE_USERNAME --out /tmp/kernel-data   # CPU only
    python kaggle/build_kernel.py bench       --user KAGGLE_USERNAME --out /tmp/kernel-bench    # benchmark
    python kaggle/build_kernel.py stage2_a    --user KAGGLE_USERNAME --out /tmp/kernel-2a     # reading, session 1
    python kaggle/build_kernel.py stage2_b    --user KAGGLE_USERNAME --out /tmp/kernel-2b     # reading ends, practice, tests
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
READ = {"name": "read", "data": "data2/read", "lr": 6e-4, "warmup": 1000, "out": "run"}
JOBS = {
    "speed": dict(template="speed_test.py", title="SLM Speed Test", slug="slm-speed-test", files=CORE,
                  internet=False, gpu=True),
    "stage1": dict(template="stage1.py", title="SLM Stage 1", slug="slm-stage-1", files=FULL, internet=True, gpu=True),
    "stage2_data": dict(template="stage2_data.py", title="SLM Stage 2 Data", slug="slm-stage-2-data", files=FULL,
                        internet=True, gpu=False),
    "stage1_rl": dict(template="rl_kernel.py", title="SLM Stage 1 RL", slug="slm-stage-1-rl", files=FULL + ["rl.py"],
                      internet=True, gpu=True, sources=["slm-stage-1"],
                      config={"init": "run/model.pt", "steps": 200, "lr": 2e-5, "prompts": 8, "samples": 8,
                              "minutes": 45}),
    "bench": dict(template="bench_kernel.py", title="SLM Benchmark", slug="slm-benchmark",
                  files=FULL + ["bench.py", "quantexam.py"], internet=True, gpu=True,
                  sources=["slm-stage-2-data", "slm-stage-1"],
                  config={"gpu0": ["ours:run/model.pt", "hf:HuggingFaceTB/SmolLM2-135M-Instruct",
                                   "hf:HuggingFaceTB/SmolLM2-360M-Instruct", "hf:Qwen/Qwen2.5-0.5B-Instruct"],
                          "gpu1": ["hf:Qwen/Qwen3-0.6B", "hf:Qwen/Qwen2.5-Math-1.5B-Instruct"], "n": 200, "gsm": 300}),
    "stage2_a": dict(template="stage2_train.py", title="SLM Stage 2 A", slug="slm-stage-2-a", files=FULL,
                     internet=True, gpu=True, sources=["slm-stage-2-data"],
                     config={"steps": [dict(READ, minutes=680)], "eval": False}),
    "stage2_b": dict(template="stage2_train.py", title="SLM Stage 2 B", slug="slm-stage-2-b", files=FULL,
                     internet=True, gpu=True, sources=["slm-stage-2-data", "slm-stage-2-a"],
                     config={"steps": [dict(READ, minutes=330, resume="run/ckpt.pt"),
                                       {"name": "practice", "data": "data2/practice", "lr": 3e-4, "warmup": 300,
                                        "minutes": 240, "init": "run/model.pt", "out": "run-practice"}],
                             "eval": True}),
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("job", choices=sorted(JOBS))
    p.add_argument("--user", required=True, help="your Kaggle username")
    p.add_argument("--out", required=True, help="folder to write the kernel into")
    a = p.parse_args()

    job = JOBS[a.job]
    code = {name: base64.b64encode((SLM / name).read_bytes()).decode() for name in job["files"]}
    src = (HERE / job["template"]).read_text()
    assert src.count("CODE = {}") == 1
    src = src.replace("CODE = {}", "CODE = " + json.dumps(code), 1)
    if "config" in job:
        assert src.count("CONFIG = {}") == 1
        src = src.replace("CONFIG = {}", "CONFIG = " + repr(job["config"]), 1)     # a Python literal, not JSON
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / job["template"]).write_text(src)
    meta = {"id": f"{a.user}/{job['slug']}", "title": job["title"], "code_file": job["template"], "language": "python",
            "kernel_type": "script", "is_private": True, "enable_gpu": job["gpu"], "enable_tpu": False,
            "enable_internet": job["internet"], "dataset_sources": [], "competition_sources": [],
            "kernel_sources": [f"{a.user}/{s}" for s in job.get("sources", [])], "model_sources": []}
    (out / "kernel-metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {out / job['template']} ({sum(len(v) for v in code.values()) // 1024} KB of embedded code)")


if __name__ == "__main__":
    main()
