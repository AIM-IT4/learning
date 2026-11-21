import numpy as np
N, T, VOL = 100, 5, 0.01        # size, years, rate vol
R, S, r = 0.4, 0.012, 0.03      # recovery, spread, rate
t = np.linspace(T / 60, T, 60)  # month ends
def swap_values(n):             # we receive fixed
    z = np.random.default_rng(7).normal(size=(n, 60))
    dx = VOL * np.sqrt(T / 60) * z.cumsum(1)  # rate moves
    return -N * (T - t) * dx    # rates up: we lose
def exposure(v):
    return np.maximum(v, 0).mean(0)   # EE(t)
def default_prob():
    return 1 - np.exp(-S / (1 - R) * t)   # credit triangle
def cva(n=10_000):
    ee = exposure(swap_values(n))
    dpd = np.diff(default_prob(), prepend=0)   # each month
    return (1 - R) * np.sum(np.exp(-r * t) * ee * dpd)
