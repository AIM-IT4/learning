"""Day 11/30, Making Quant Easy: the volatility smile. Every number on screen comes from this script.
Run: python3 work/smile.py  -> work/numbers.json (and asserts the checks below).

1. 19 Oct 1987: the S&P 500 closed at 224.84, down from 282.70 on Fri 16 Oct (S&P Dow Jones Indices daily closes).
2. At 20% a year, one standard deviation of a day is 20%/sqrt(252) = 1.26%. The crash in those units, and its chance
   under a normal curve (simple returns; the log-return version is smaller still).
3. An illustrative crash model (Merton jump-diffusion, risk-neutral, zero rates): 15% volatility plus a fixed -20%
   crash arriving at 0.1 a year (about once every ten years). One-month options at strikes 80-120 priced on 1,000,000
   simulated paths (seed 11) and checked against the model's exact series price. Implied vol = the Black-Scholes
   volatility that gives the same price (out-of-the-money puts below 100, calls from 100 up).
"""
import json, os
from math import exp, log, sqrt, factorial, lgamma, pi
import numpy as np
from scipy.stats import norm, t as student_t
from scipy.optimize import brentq

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "numbers.json")
N = {}

# ---------- 1. Black Monday ----------
c16, c19 = 282.70, 224.84
ret = c19 / c16 - 1
N["crash"] = dict(date="19 Oct 1987", prev_date="16 Oct 1987", close_prev=c16, close=c19, points=round(c16 - c19, 2),
                  ret=ret, ret_pct=round(100 * ret, 2), logret=log(c19 / c16))
assert round(100 * ret, 2) == -20.47

# ---------- 2. In typical days, and the normal curve's odds ----------
sig_ann = 0.20
sd_day = sig_ann / sqrt(252)
z = abs(ret) / sd_day
z_log = abs(log(c19 / c16)) / sd_day
log10p = norm.logcdf(-z) / log(10)          # log10 of P(Z <= -z)
log10p_log = norm.logcdf(-z_log) / log(10)
days_big_bang = 13.8e9 * 252                 # trading days in 13.8 billion years
log10_expected = log10p + np.log10(days_big_bang)
N["normal"] = dict(sigma_annual=sig_ann, sd_day=sd_day, sd_day_pct=round(100 * sd_day, 2), z=z, z_round=round(z, 1),
                   z_log=z_log, log10_p=log10p, log10_p_log=log10p_log, p_mantissa=10 ** (log10p - np.floor(log10p)),
                   p_exp=int(np.floor(log10p)), days_since_big_bang=days_big_bang,
                   log10_expected_since_big_bang=log10_expected)
assert round(100 * sd_day, 2) == 1.26 and 16.0 < z < 16.5 and log10p < -58 and log10_expected < -40

# bell curve of daily moves (in %, sd 1.26) on -5%..+5%, plus an illustrative fat-tailed curve with the same spread
xs = np.linspace(-5, 5, 201)
sdp = 100 * sd_day
pdf_n = norm.pdf(xs / sdp) / sdp
nu = 3.0
scale_t = sdp / sqrt(nu / (nu - 2))          # Student-t with 3 degrees of freedom, scaled to sd 1.26%
pdf_t = student_t.pdf(xs / scale_t, nu) / scale_t
N["bell"] = dict(x=[round(v, 3) for v in xs], normal=[round(v, 5) for v in pdf_n], fat=[round(v, 5) for v in pdf_t],
                 fat_note="illustrative fat-tailed curve: Student-t, 3 degrees of freedom, same 1.26% spread")
# how much more often a day worse than -4 sd comes under the fat-tailed curve
p4n = norm.cdf(-4.0); p4t = student_t.cdf(-4.0 * sdp / scale_t, nu)
N["bell"].update(p_below_4sd_normal=p4n, p_below_4sd_fat=p4t, ratio_4sd=p4t / p4n,
                 per_year_normal=252 * p4n, per_year_fat=252 * p4t)

# ---------- 3. The crash model and its smile ----------
S0, T, r = 100.0, 1 / 12, 0.0
sig, lam, J = 0.15, 0.10, -0.20
lnJ = log(1 + J)
k = J                                        # E[jump factor] - 1 for a fixed jump
Ks = [80, 85, 90, 95, 100, 105, 110, 115, 120]

def bs(S, K, T, s, rr=0.0, cp=1):
    d1 = (log(S / K) + (rr + 0.5 * s * s) * T) / (s * sqrt(T)); d2 = d1 - s * sqrt(T)
    return cp * (S * norm.cdf(cp * d1) - K * exp(-rr * T) * norm.cdf(cp * d2))

def merton_exact(K, cp):
    lp = lam * (1 + k); tot = 0.0
    for n in range(40):
        rn = -lam * k + n * lnJ / T
        w = exp(-lp * T + n * log(lp * T) - lgamma(n + 1)) if n else exp(-lp * T)
        tot += w * bs(S0, K, T, sig, rn, cp)
    return tot

def implied(p, K, cp):
    return brentq(lambda s: bs(S0, K, T, s, 0.0, cp) - p, 1e-4, 3.0)

rng = np.random.default_rng(11)
NP = 1_000_000
Z = rng.standard_normal(NP)
NJ = rng.poisson(lam * T, NP)
lnST = log(S0) + (r - lam * k - 0.5 * sig * sig) * T + sig * sqrt(T) * Z + NJ * lnJ
ST = np.exp(lnST)
rows = []
for K in Ks:
    cp = -1 if K < 100 else 1
    pay = np.maximum(cp * (ST - K), 0.0)
    p_mc = float(pay.mean()); se = float(pay.std(ddof=1) / sqrt(NP))
    p_ex = merton_exact(K, cp)
    iv_mc, iv_ex = implied(p_mc, K, cp), implied(p_ex, K, cp)
    rows.append(dict(K=K, type="put" if cp < 0 else "call", price_mc=p_mc, se=se, price_exact=p_ex,
                     iv_mc=iv_mc, iv_exact=iv_ex, iv_pct=round(100 * iv_mc, 1)))
    assert abs(iv_mc - iv_ex) < 0.004, (K, iv_mc, iv_ex)   # simulation agrees with the exact price within 0.4 vol pts
iv = {row["K"]: row["iv_pct"] for row in rows}
assert iv[80] > iv[90] > iv[100] and iv[100] < 17
N["model"] = dict(S0=S0, T_months=1, r=r, sigma=sig, crash=J, crash_rate=lam, crash_every_years=1 / lam,
                  paths=NP, seed=11, paths_with_crash=int((NJ > 0).sum()), strikes=Ks, rows=rows, iv_pct=iv)

# the 80 put: what one volatility (the at-the-money one) says it is worth, against the crash model
atm = rows[Ks.index(100)]["iv_mc"]
p80_bs = bs(S0, 80, T, atm, 0.0, -1)
p80_mc = rows[0]["price_mc"]
N["put80"] = dict(K=80, price_one_vol=p80_bs, price_model=p80_mc, ratio=p80_mc / p80_bs, atm_iv=atm,
                  iv=rows[0]["iv_mc"])

# the 90 put (a low strike): its simulated price, what one volatility (the at-the-money one) would charge, and the
# volatility Black-Scholes needs to match the simulated price (its implied vol)
r90 = rows[Ks.index(90)]
p90_bs = bs(S0, 90, T, atm, 0.0, -1)
N["put90"] = dict(K=90, price_model=r90["price_mc"], price_one_vol=p90_bs, ratio=r90["price_mc"] / p90_bs,
                  atm_iv=atm, iv=r90["iv_mc"], iv_pct=r90["iv_pct"])
assert abs(bs(S0, 90, T, r90["iv_mc"], 0.0, -1) - r90["price_mc"]) < 1e-9

# where the million simulated months end: histogram of S_T (70..130, bins of 2.5), crash paths separately
edges = np.arange(70, 132.5, 2.5)
h_all, _ = np.histogram(np.clip(ST, 70, 129.99), edges)
h_crash, _ = np.histogram(np.clip(ST[NJ > 0], 70, 129.99), edges)
N["ends"] = dict(edges=edges.tolist(), all=h_all.tolist(), crash=h_crash.tolist(),
                 below_85=int((ST < 85).sum()), below_85_normal=float(NP * norm.cdf(log(85 / S0) / (sig * sqrt(T)))))

# one simulated ten-year daily path of the model with its crash (for the picture; seed chosen so one crash shows)
def one_path(seed, years=10):
    g = np.random.default_rng(seed); n = 252 * years; dt = 1 / 252
    jumps = g.poisson(lam * dt, n)
    inc = (r - lam * k - 0.5 * sig * sig) * dt + sig * sqrt(dt) * g.standard_normal(n) + jumps * lnJ
    return np.concatenate([[S0], S0 * np.exp(np.cumsum(inc))]), np.nonzero(jumps)[0].tolist()
for seed in range(1, 200):
    path, jd = one_path(seed)
    if len(jd) == 1 and 900 < jd[0] < 1700 and path.max() < 260 and path[-1] > 60:
        break
N["path"] = dict(seed=seed, days=len(path) - 1, crash_day=jd[0], values=[round(v, 2) for v in path[::5]], step=5,
                 before=round(float(path[jd[0]]), 2), after=round(float(path[jd[0] + 1]), 2))

# ---------- 4. For the charts ----------
# 4a. the real S&P 500, 1 Sep - 30 Oct 1987, daily open/high/low/close (data/spx_1987.csv: Yahoo Finance ^GSPC, which
#     carries S&P Dow Jones Indices' published index levels); the two closes above must match it
import csv
HERE = os.path.dirname(os.path.abspath(__file__))
rows87 = [r_ for r_ in csv.DictReader(open(os.path.join(HERE, "data", "spx_1987.csv")))
          if "1987-09-01" <= r_["date"] <= "1987-10-30"]
c87 = {r_["date"]: float(r_["close"]) for r_ in rows87}
assert c87["1987-10-16"] == c16 and c87["1987-10-19"] == c19
N["spx1987"] = dict(source="S&P 500 daily levels (S&P Dow Jones Indices), via Yahoo Finance ^GSPC",
                    date=[r_["date"] for r_ in rows87], open=[float(r_["open"]) for r_ in rows87],
                    high=[float(r_["high"]) for r_ in rows87], low=[float(r_["low"]) for r_ in rows87],
                    close=[float(r_["close"]) for r_ in rows87], crash_index=[r_["date"] for r_ in rows87].index("1987-10-19"))

# 4b. the 90 put's Black-Scholes price as a function of volatility, and Newton's method finding its implied vol
#     (the volatility at which Black-Scholes gives the simulated price)
p_mkt = r90["price_mc"]
def vega(K, s):
    d1 = (log(S0 / K) + 0.5 * s * s * T) / (s * sqrt(T)); return S0 * norm.pdf(d1) * sqrt(T)
sg = np.round(np.arange(0.05, 0.4001, 0.0025), 4)
newton = [0.30]                               # start from above: the put's price is convex in vol here, so Newton
for _ in range(8):                            # walks down onto the root without overshooting
    s_ = newton[-1]; newton.append(s_ - (bs(S0, 90, T, s_, 0.0, -1) - p_mkt) / vega(90, s_))
    if abs(newton[-1] - newton[-2]) < 1e-6: break
assert abs(newton[-1] - r90["iv_mc"]) < 1e-6 and all(a > b for a, b in zip(newton, newton[1:]))
N["bscurve"] = dict(K=90, S0=S0, T_months=1, sigma=sg.tolist(), price=[bs(S0, 90, T, s_, 0.0, -1) for s_ in sg],
                    market=p_mkt, one_vol=atm, one_vol_price=p90_bs, iv=r90["iv_mc"],
                    newton=[dict(sigma=s_, price=bs(S0, 90, T, s_, 0.0, -1)) for s_ in newton])

# 4c. a fan of simulated ten-year paths of the model (seed 2), every 5th trading day, with each path's crash days
g2 = np.random.default_rng(2); NF, nd = 40, 2520; dt = 1 / 252
jf = g2.poisson(lam * dt, (NF, nd))
inc = (r - lam * k - 0.5 * sig * sig) * dt + sig * sqrt(dt) * g2.standard_normal((NF, nd)) + jf * lnJ
fan = np.concatenate([np.full((NF, 1), S0), S0 * np.exp(np.cumsum(inc, 1))], 1)
N["fan"] = dict(seed=2, paths=NF, days=nd, step=5, values=[[round(v, 2) for v in p_[::5]] for p_ in fan],
                crash_days=[np.nonzero(j_)[0].tolist() for j_ in jf], with_crash=int((jf.sum(1) > 0).sum()),
                crashes=int(jf.sum()))
assert 0.4 * NF < N["fan"]["with_crash"] < 0.9 * NF          # about 1 - exp(-1) = 63% of ten-year paths see a crash

# 4d. log10 of the daily-move density (per 1% move), normal against the illustrative fat-tailed curve (same 1.26% sd),
#     from -22% to +6%: the crash (-20.47%) sits where the normal curve has all but vanished
xl = np.round(np.arange(-22.0, 6.0001, 0.1), 2)
N["logpdf"] = dict(x=xl.tolist(), normal=[round(float(norm.logpdf(v / sdp) - log(sdp)) / log(10), 3) for v in xl],
                   fat=[round(float(student_t.logpdf(v / scale_t, nu) - log(scale_t)) / log(10), 3) for v in xl],
                   crash_x=round(100 * ret, 2),
                   crash_normal=round(float(norm.logpdf(100 * ret / sdp) - log(sdp)) / log(10), 2),
                   crash_fat=round(float(student_t.logpdf(100 * ret / scale_t, nu) - log(scale_t)) / log(10), 2))

json.dump(N, open(OUT, "w"), indent=1)
print(json.dumps({"crash": N["crash"]["ret_pct"], "sd_day": N["normal"]["sd_day_pct"], "z": round(z, 2),
                  "z_log": round(z_log, 2), "log10p": round(log10p, 2), "log10p_log": round(log10p_log, 2),
                  "log10_expected_since_big_bang": round(log10_expected, 2),
                  "fat_ratio_4sd": round(p4t / p4n, 1), "per_year_4sd": [round(252 * p4n, 4), round(252 * p4t, 2)],
                  "iv": iv, "iv_exact": {r_["K"]: round(100 * r_["iv_exact"], 2) for r_ in rows},
                  "crash_paths": N["model"]["paths_with_crash"], "put80": [round(p80_bs, 5), round(p80_mc, 4), round(p80_mc / p80_bs, 1)],
                  "below85": [N["ends"]["below_85"], round(N["ends"]["below_85_normal"], 1)],
                  "path": [seed, jd, N["path"]["before"], N["path"]["after"]], "put90": [round(r90["price_mc"], 4), round(p90_bs, 4), round(r90["price_mc"] / p90_bs, 2)]}, indent=0))
