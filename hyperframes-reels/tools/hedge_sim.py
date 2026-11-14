"""Delta-hedging numbers for the hedge reel: python3 tools/hedge_sim.py [out.json]
A short call (S0 100, K 100, vol 20%, 3 months, r 0) hedged with N equal rebalances on simulated GBM paths.
Prints the single-path story (one seed, N = 5 / 20 / 200), the spread of the final error over 2,000 paths,
and an illustrative trading cost (0.1% of each trade's value), and writes everything the scene draws."""
import json, math, sys
import numpy as np
from scipy.stats import norm

S0, K, VOL, T, M = 100.0, 100.0, 0.2, 0.25, 1600          # M fine steps; every N used divides M
COST = 0.001


def bs(S, tau):
    """Call value and delta; at tau = 0 the payoff and the step delta."""
    S = np.asarray(S, float); tau = np.asarray(tau, float)
    live = tau > 1e-12; ts = np.sqrt(np.where(live, tau, 1.0))
    d1 = (np.log(S / K) + 0.5 * VOL ** 2 * np.where(live, tau, 1.0)) / (VOL * ts)
    c = np.where(live, S * norm.cdf(d1) - K * norm.cdf(d1 - VOL * ts), np.maximum(S - K, 0))
    d = np.where(live, norm.cdf(d1), (S > K).astype(float))
    return c, d


def paths(rng, n):
    z = rng.standard_normal((n, M)); dt = T / M
    x = np.cumsum((-0.5 * VOL ** 2) * dt + VOL * math.sqrt(dt) * z, axis=1)
    return S0 * np.exp(np.hstack([np.zeros((n, 1)), x]))           # (n, M + 1)


def hedge(S, N):
    """Running P&L of (premium + delta hedge - option value) on the fine grid; returns (running, final, cost)."""
    n = S.shape[0]; step = M // N; tau = T - np.arange(M + 1) * T / M
    c0, _ = bs(S0, T)
    idx = np.arange(0, M, step); _, dk = bs(S[:, idx], tau[idx])              # deltas held after each rebalance
    held = np.repeat(dk, step, axis=1)                                           # (n, M): shares held over each fine step
    gains = np.hstack([np.zeros((n, 1)), np.cumsum(held * np.diff(S, axis=1), axis=1)])
    cv, _ = bs(S, tau[None, :])
    run = c0 + gains - cv
    trades = np.abs(np.diff(np.hstack([np.zeros((n, 1)), dk]), axis=1)) * S[:, idx]
    return run, run[:, -1], COST * trades.sum(axis=1)


if __name__ == "__main__":
    c0, d0 = bs(S0, T); c1, _ = bs(S0 + 1, T)
    gamma = norm.pdf((0.5 * VOL ** 2 * T) / (VOL * math.sqrt(T))) / (S0 * VOL * math.sqrt(T))
    out = {"S0": S0, "K": K, "vol": VOL, "T": T, "C0": round(float(c0), 3), "delta0": round(float(d0), 4),
           "gamma0": round(float(gamma), 5), "C_up1": round(float(c1), 3)}
    # pick a seed whose one path tells the story plainly: the error shrinks 5 -> 20 -> 200
    best = None
    for seed in range(1, 400):
        S = paths(np.random.default_rng(seed), 1)
        e = [float(hedge(S, n)[1][0]) for n in (5, 20, 200)]
        ok = 1.6 < abs(e[0]) < 2.6 and 0.3 < abs(e[1]) < 0.8 and abs(e[2]) < 0.06 and e[0] * e[1] > 0
        span = float(S.max() - S.min())
        if ok and span > 14 and (best is None or span > best[2]):
            best = (seed, e, span)
    seed = best[0]; S = paths(np.random.default_rng(seed), 1)
    stride = 4                                                                   # 401 points per line for drawing
    out["path"] = {"seed": seed, "S": [round(float(v), 2) for v in S[0, ::stride]],
                   "ST": round(float(S[0, -1]), 2), "min": round(float(S.min()), 2), "max": round(float(S.max()), 2)}
    for n in (5, 20, 200):
        run, fin, _ = hedge(S, n)
        out["path"][f"run{n}"] = [round(float(v), 3) for v in run[0, ::stride]]
        out["path"][f"err{n}"] = round(float(fin[0]), 2)
    # the spread of the final error over 2,000 paths, and an illustrative cost per trade
    big = paths(np.random.default_rng(2026), 2000)
    ns = [5, 10, 20, 40, 80, 160, 320]
    out["spread"] = {"paths": 2000, "N": ns, "std": [], "cost": []}
    for n in ns:
        _, fin, cost = hedge(big, n)
        out["spread"]["std"].append(round(float(fin.std()), 3)); out["spread"]["cost"].append(round(float(cost.mean()), 3))
    json.dump(out, open(sys.argv[1], "w") if len(sys.argv) > 1 else sys.stdout, separators=(",", ":"))
    print(json.dumps({k: out[k] for k in ("C0", "delta0", "gamma0", "C_up1")}), file=sys.stderr)
    print(json.dumps({"seed": seed, "ST": out["path"]["ST"], "min": out["path"]["min"], "max": out["path"]["max"],
                      "err": [out["path"][f"err{n}"] for n in (5, 20, 200)]}), file=sys.stderr)
    print(json.dumps(out["spread"]), file=sys.stderr)
