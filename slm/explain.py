"""Questions without all the numbers, and questions Ganit cannot answer.

    python explain.py            # print one example of each kind
    python explain.py --check    # build many of each kind; every tool call must run

Same format as quantgen.py (a <think> block, working whose tool calls really run, then
"#### answer"). Five kinds:
  method   "How do I price X?": what X is, the steps, the inputs and where to get them, then a
           worked example with typical numbers computed by the tools, and a check.
  assume   a pricing question with inputs missing: they are filled with labelled typical values
           (volatility 25%, INR rate 6%, USD rate 4%, 99%, 1 day) that the user should replace.
  full     the new instruments (FX forwards, cross-currency swaps, FX and futures options) with
           every input given.
  unknown  a topic Ganit has not learned, or not finance at all: it says so (no "####").
  hello    greetings and "what can you do?" (no "####").
"""
import argparse
import math
import random
import re

import qltools
from quantgen import Retry, Work, months_adj, months_noun

CAN = ("European and American options, the Greeks, implied volatility, put-call parity, bond prices, yields and "
       "duration, zero-coupon bonds, rate conversions, forward rates, interest rate swaps, the Vasicek and CIR models, "
       "VaR and expected shortfall, FX forwards, FX options, options on futures and cross-currency swaps")
RATES_INR = [0.055, 0.0575, 0.06, 0.0625, 0.065, 0.0675, 0.07]
RATES_USD = [0.035, 0.0375, 0.04, 0.0425, 0.045]
DEFAULT = {   # value, how it is written in the Assume line
    "vol": (0.25, "vol = 25% (typical for a large stock; use the implied volatility from the option chain)"),
    "r_inr": (0.06, "r = 6% continuous (close to the Indian 1-year T-bill yield; use today's yield)"),
    "r_usd": (0.04, "r = 4% continuous (close to the US 1-year Treasury yield; use today's yield)"),
    "rd": (0.06, "INR rate = 6% continuous (close to the Indian 1-year T-bill yield; use today's rate)"),
    "rf": (0.04, "USD rate = 4% continuous (close to the US 1-year Treasury yield; use today's rate)"),
    "zd": (0.06, "INR zero rate = 6% continuous (read it from the INR OIS curve for your maturity)"),
    "zf": (0.04, "USD zero rate = 4% continuous (read it from the SOFR curve for your maturity)"),
    "conf": (0.99, "confidence = 99% (the usual level for VaR)"),
    "days": (1, "horizon = 1 day"),
}
FREQ_WORD = {1: "once a year", 2: "twice a year", 4: "quarterly"}


# ---------------------------------------------------------------- formatting

def num(x):
    s = f"{x:.6f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pct(x):
    return num(round(x * 100, 6)) + "%"


def dec(x):
    return num(round(x, 8))


def indian(n):
    s = str(n)
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    return ",".join(([head] if head else []) + parts + [tail])


def money(R, v, cur="₹"):
    """How a person might write an amount: ₹1240, ₹1,240, Rs 12,40,000 ..."""
    s = num(v)
    if v >= 1000 and float(v).is_integer():
        u = R.random()
        if u < 0.25:
            s = f"{int(v):,}"
        elif u < 0.4 and cur == "₹":
            s = indian(int(v))
    if cur != "₹":
        return cur + s
    return R.choice(["₹", "₹", "₹", "Rs ", "Rs. "]) + s


def big(R, v):
    """A large rupee amount: (as written, as in Known, calculator expression or None)."""
    if v % 10**7 == 0 and R.random() < 0.5:
        return f"₹{v // 10**7} crore", f"{v // 10**7} crore", f"{v // 10**7}*10000000"
    if v % 10**5 == 0 and v < 10**8 and R.random() < 0.6:
        return f"₹{v // 10**5} lakh", f"{v // 10**5} lakh", f"{v // 10**5}*100000"
    return money(R, v), num(v), None


def stock(R):
    return R.choice([R.randint(10, 60) * 10, R.randint(40, 400) * 10])


def near(R, x, lo=0.9, hi=1.1):
    step = 5 if x < 300 else 10 if x < 1000 else 50 if x < 10000 else 100
    return max(step, round(x * R.uniform(lo, hi) / step) * step)


def write_T(w, m):
    if m % 12 == 0:
        return num(m // 12)
    w.say(f"T = {m} / 12 = ")
    T = w.tool(f"{m}/12")
    w.say(" years.\n")
    return T


def opt(kind, S, K, T, r, vol):
    return f"{kind}, S={num(S)}, K={num(K)}, T={T}, r={dec(r)}, vol={dec(vol)}"


def bounds(w, kind, S, K, T, r, P):
    w.say("Check: K * exp(-r * T) = ")
    pvk = w.tool(f"{num(K)}*exp(-{dec(r)}*{T})")
    if kind == "call":
        w.say(". A call is worth between max(S - K * exp(-r * T), 0) = ")
        w.tool(f"max({num(S)}-{pvk}, 0)")
        w.say(f" and S = {num(S)}; {P} is inside.\n")
    else:
        w.say(". A put is worth between max(K * exp(-r * T) - S, 0) = ")
        w.tool(f"max({pvk}-{num(S)}, 0)")
        w.say(f" and K * exp(-r * T) = {pvk}; {P} is inside.\n")


EXAMPLE = "Example with typical numbers (replace them with yours): "


# ---------------------------------------------------------------- worked examples (method answers)

def ex_european(R, w, arg=None):
    S, m, vol, r, kind = stock(R), R.choice([3, 6, 9, 12]), R.randint(15, 40) / 100, R.choice(RATES_INR), arg or R.choice(["call", "put"])
    K = near(R, S)
    w.say(EXAMPLE + f"a {months_adj(m)} European {kind} on a stock at ₹{num(S)} with strike ₹{num(K)}, volatility {pct(vol)} "
          f"and a risk-free rate of {pct(r)} (continuous).\n")
    T = write_T(w, m)
    w.say("Price = ")
    P = w.tool(f"QL.european_option({opt(kind, S, K, T, r, vol)})")
    w.say("\n")
    bounds(w, kind, S, K, T, r, P)
    return P


def ex_greek(R, w, greek=None):
    S, m, vol, r, kind = stock(R), R.choice([3, 6, 9, 12]), R.randint(15, 40) / 100, R.choice(RATES_INR), R.choice(["call", "put"])
    K = near(R, S)
    w.say(EXAMPLE + f"a {months_adj(m)} European {kind} on a stock at ₹{num(S)} with strike ₹{num(K)}, volatility {pct(vol)} "
          f"and a risk-free rate of {pct(r)} (continuous).\n")
    T = write_T(w, m)
    first = None
    for g in ([greek] if greek else ["delta", "gamma"]):
        w.say(f"{g.capitalize()} = ")
        x = w.tool(f"QL.{g}({opt(kind, S, K, T, r, vol)})")
        w.say("\n")
        first = first or x
        v = float(x)
        if g == "delta":
            lo, hi = ("0", "1") if kind == "call" else ("-1", "0")
            w.say(f"Check: a {kind}'s delta lies between {lo} and {hi}, and {x} does.\n")
        elif g == "gamma":
            w.say(f"Check: gamma is positive for every option, and {x} is.\n")
        elif g == "vega":
            w.say(f"Check: vega is positive: more volatility makes any option worth more, and {x} is positive.\n")
        elif g == "theta":
            w.say("Check: theta is negative: the option loses value as time passes.\n" if v < 0 else
                  "Check: theta is positive here, which happens for deep in-the-money European puts.\n")
        else:
            w.say(f"Check: rho is {'positive for a call' if kind == 'call' else 'negative for a put'}, and {x} is.\n")
    return first


def ex_american(R, w, arg=None):
    S, m, vol, r = stock(R), R.choice([3, 6, 9, 12]), R.randint(15, 40) / 100, R.choice(RATES_INR)
    K = near(R, S, 0.95, 1.15)
    w.say(EXAMPLE + f"a {months_adj(m)} American put on a stock at ₹{num(S)} with strike ₹{num(K)}, volatility {pct(vol)} "
          f"and a risk-free rate of {pct(r)} (continuous), on a 500-step tree.\n")
    T = write_T(w, m)
    w.say("American put = ")
    A = w.tool(f"QL.american_option({opt('put', S, K, T, r, vol)}, steps=500)")
    w.say("\nEuropean put = ")
    E = w.tool(f"QL.european_option({opt('put', S, K, T, r, vol)})")
    w.say("\nCheck: the American put must be worth at least the European one; early exercise adds ")
    w.tool(f"{A}-{E}")
    w.say(".\n")
    return A


def ex_implied(R, w, arg=None):
    S, m, vol, r = stock(R), R.choice([3, 6, 9, 12]), R.randint(15, 45) / 100, R.choice(RATES_INR)
    K = near(R, S)
    price = round(qltools.european_option("call", S, K, m / 12, r, vol), 2)
    if price < 0.5:
        raise Retry("price too small")
    w.say(EXAMPLE + f"a {months_adj(m)} European call with strike ₹{num(K)} on a stock at ₹{num(S)} trades at ₹{num(price)}; "
          f"the risk-free rate is {pct(r)} (continuous).\n")
    T = write_T(w, m)
    w.say("Implied volatility = ")
    v = w.tool(f"QL.implied_vol(call, price={num(price)}, S={num(S)}, K={num(K)}, T={T}, r={dec(r)})")
    w.say("\nCheck: Black-Scholes at this volatility gives ")
    p2 = w.tool(f"QL.european_option(call, S={num(S)}, K={num(K)}, T={T}, r={dec(r)}, vol={v})")
    if abs(float(p2) - price) > 0.003 * price + 0.01:
        raise Retry("reprice too far")
    w.say(f", the market price of {num(price)}.\n")
    return v


def ex_parity(R, w, arg=None):
    S, m, vol, r = stock(R), R.choice([3, 6, 9, 12]), R.randint(15, 40) / 100, R.choice(RATES_INR)
    K = near(R, S)
    C = round(qltools.european_option("call", S, K, m / 12, r, vol), 2)
    w.say(EXAMPLE + f"a {months_adj(m)} European call with strike ₹{num(K)} on a stock at ₹{num(S)} costs ₹{num(C)}; "
          f"the risk-free rate is {pct(r)} (continuous). Find the put with the same strike and expiry.\n")
    T = write_T(w, m)
    w.say("K * exp(-r * T) = ")
    pvk = w.tool(f"{num(K)}*exp(-{dec(r)}*{T})")
    w.say("\nPut = C - S + K * exp(-r * T) = ")
    P = w.tool(f"{num(C)}-{num(S)}+{pvk}")
    if float(P) <= 0:
        raise Retry("negative put")
    w.say("\nCheck: the put must be worth at least max(K * exp(-r * T) - S, 0) = ")
    w.tool(f"max({pvk}-{num(S)}, 0)")
    w.say(f", and {P} is.\n")
    return P


def bond_terms(R):
    F, c, years, freq = R.choice([100, 1000]), R.choice([6, 6.5, 7, 7.5, 8, 8.5, 9]) / 100, R.randint(2, 10), R.choice([1, 2])
    y = R.choice([x / 100 for x in (5.5, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 8, 8.5, 9.5) if abs(x / 100 - c) > 1e-9])
    return F, c, years, freq, y


def bond_args(F, c, years, freq):
    return f"face={num(F)}, coupon={dec(c)}, years={years}, freq={freq}"


def bond_text(F, c, years, freq):
    return f"a {years}-year bond with face value ₹{num(F)} and a {pct(c)} coupon paid {FREQ_WORD[freq]}"


def ex_bond(R, w, arg=None):
    F, c, years, freq, y = bond_terms(R)
    w.say(EXAMPLE + f"{bond_text(F, c, years, freq)}, at a yield of {pct(y)}.\n")
    w.say("Price = ")
    P = w.tool(f"QL.bond_price({bond_args(F, c, years, freq)}, ytm={dec(y)})")
    side = "above" if c > y else "below"
    w.say(f"\nCheck: the coupon rate {pct(c)} is {'above' if c > y else 'below'} the yield {pct(y)}, so the price is {side} "
          f"the face value of {num(F)}, as it is.\n")
    return P


def ex_ytm(R, w, arg=None):
    F, c, years, freq, y = bond_terms(R)
    price = round(qltools.bond_price(F, c, years, freq, y), 2)
    w.say(EXAMPLE + f"{bond_text(F, c, years, freq)}, trading at ₹{num(price)}.\n")
    w.say("YTM = ")
    Y = w.tool(f"QL.bond_ytm({bond_args(F, c, years, freq)}, price={num(price)})")
    w.say("\nCheck: at this yield the bond is worth ")
    p2 = w.tool(f"QL.bond_price({bond_args(F, c, years, freq)}, ytm={Y})")
    if abs(float(p2) - price) > 0.002 * price:
        raise Retry("reprice too far")
    w.say(f", its market price.\n")
    return Y


def ex_duration(R, w, arg=None):
    F, c, years, freq, y = bond_terms(R)
    w.say(EXAMPLE + f"{bond_text(F, c, years, freq)}, at a yield of {pct(y)}.\n")
    w.say("Modified duration = ")
    D = w.tool(f"QL.bond_duration({bond_args(F, c, years, freq)}, ytm={dec(y)}, kind=modified)")
    w.say("\nPrice = ")
    P = w.tool(f"QL.bond_price({bond_args(F, c, years, freq)}, ytm={dec(y)})")
    w.say("\nIf the yield rises by 1%, the price falls by about ")
    w.tool(f"{D}*0.01*{P}")
    w.say(f".\nCheck: the duration is below the {years}-year maturity, as it must be for a bond that pays coupons.\n")
    return D


def ex_zero(R, w, arg=None):
    F, T, y = R.choice([100, 1000]), R.randint(1, 10), R.choice([0.055, 0.06, 0.065, 0.07, 0.075, 0.08])
    w.say(EXAMPLE + f"a {T}-year zero-coupon bond paying ₹{num(F)}, at an annually compounded yield of {pct(y)}.\n")
    w.say("Price = ")
    P = w.tool(f"QL.zero_bond_price(face={num(F)}, T={T}, ytm={dec(y)}, comp=annual)")
    w.say("\nCheck: face / (1 + y)^T = ")
    w.tool(f"{num(F)}/(1+{dec(y)})^{T}")
    w.say(", the same.\n")
    return P


def ex_convert(R, w, arg=None):
    r, src = R.choice([x / 100 for x in (5, 6, 6.5, 7, 7.5, 8, 9, 10, 12)]), R.choice(["quarterly", "monthly", "semiannual", "annual"])
    w.say(EXAMPLE + f"{pct(r)} compounded {'twice a year' if src == 'semiannual' else src}, turned into a continuously compounded rate.\n")
    w.say("Continuous rate = ")
    rc = w.tool(f"QL.convert_rate({dec(r)}, {src}, continuous)")
    w.say("\nCheck: converting back gives ")
    w.tool(f"QL.convert_rate({rc}, continuous, {src})")
    w.say(f", the {pct(r)} we started with.\n")
    return rc


def ex_forward(R, w, arg=None):
    T1 = R.randint(1, 3)
    T2 = T1 + R.randint(1, 3)
    r1 = R.choice([0.055, 0.06, 0.065, 0.07])
    r2 = r1 + R.choice([-0.005, 0.0025, 0.005, 0.0075, 0.01])
    w.say(EXAMPLE + f"a {T1}-year zero rate of {pct(r1)} and a {T2}-year zero rate of {pct(r2)}, both continuous; "
          f"find the forward rate from year {T1} to year {T2}.\n")
    w.say("Forward rate = ")
    f = w.tool(f"QL.forward_rate(r1={dec(r1)}, T1={T1}, r2={dec(r2)}, T2={T2})")
    w.say(f"\nCheck: r1 * T1 + f * (T2 - T1) = ")
    w.tool(f"{dec(r1)}*{T1}+{f}*{T2 - T1}")
    w.say(" and r2 * T2 = ")
    w.tool(f"{dec(r2)}*{T2}")
    w.say(", the same growth.\n")
    return f


def ex_swap(R, w, arg=None):
    N, T, freq, z = R.choice([1, 5, 10, 25, 50, 100]) * 10**7, R.randint(2, 10), R.choice([1, 2, 4]), R.choice(RATES_INR)
    par = qltools.swap_par_rate(T, freq, z)
    k = round(par + R.choice([-0.006, -0.004, -0.0025, 0.0025, 0.004, 0.006]), 4)
    w.say(EXAMPLE + f"a {T}-year swap on ₹{num(N)} where you pay {pct(k)} fixed {FREQ_WORD[freq]}, with a flat zero curve "
          f"at {pct(z)} (continuous).\n")
    w.say("Par swap rate = ")
    s = w.tool(f"QL.swap_par_rate(T={T}, freq={freq}, rate={dec(z)})")
    w.say("\nValue of paying fixed = ")
    v = w.tool(f"QL.swap_value(notional={num(N)}, fixed={dec(k)}, T={T}, freq={freq}, rate={dec(z)}, side=payer)")
    if (k < float(s)) != (float(v) > 0):
        raise Retry("sign")
    w.say(f"\nCheck: the fixed rate {pct(k)} is {'below' if k < float(s) else 'above'} the par rate, so paying fixed is worth "
          f"{'more' if k < float(s) else 'less'} than zero, as found.\n")
    return v


def ex_vasicek(R, w, model=None):
    model = model or "vasicek"
    a, b, s, r0, T = R.choice([0.1, 0.15, 0.2, 0.3, 0.5]), R.choice([0.05, 0.06, 0.07, 0.08]), R.choice([0.005, 0.01, 0.015, 0.02]), \
        R.choice([0.04, 0.05, 0.06, 0.07, 0.08]), R.randint(1, 10)
    name = "Vasicek" if model == "vasicek" else "CIR"
    w.say(EXAMPLE + f"a {T}-year zero-coupon bond paying ₹100 under the {name} model with a = {num(a)}, b = {pct(b)}, "
          f"sigma = {pct(s)} and a short rate of {pct(r0)} today.\n")
    w.say("Price = ")
    P = w.tool(f"QL.{model}_zcb(a={num(a)}, b={dec(b)}, sigma={dec(s)}, r={dec(r0)}, T={T}, face=100)")
    w.say("\nIts yield is -ln(P / 100) / T = ")
    y = float(w.tool(f"-ln({P}/100)/{T}"))
    lo, hi = min(r0, b) - 0.001, max(r0, b) + 0.001
    w.say(".\nCheck: " + ("the yield lies between today's short rate and the long-run level, as mean reversion suggests.\n"
                         if lo <= y <= hi else "the yield is close to the long-run level; volatility pulls it a little lower.\n"))
    return P


def ex_var(R, w, arg=None):
    v = R.choice([5, 10, 25, 50, 100, 200, 500]) * 10**5
    written, known, expr = big(R, v)
    vol, conf, days = R.choice([0.8, 1, 1.2, 1.5, 1.8, 2, 2.5]) / 100, R.choice([0.95, 0.99]), R.choice([1, 1, 10])
    w.say(EXAMPLE + f"a portfolio worth {written} with a daily volatility of {pct(vol)}, at {pct(conf)} confidence over "
          f"{days} day{'s' if days > 1 else ''}.\n")
    if expr:
        w.say(f"Value = {known} = ")
        w.tool(expr)
        w.say(" rupees.\n")
    w.say("VaR = ")
    x = w.tool(f"QL.var_normal(value={num(v)}, vol={dec(vol)}, conf={dec(conf)}, days={days})")
    w.say("\nExpected shortfall = ")
    w.tool(f"QL.es_normal(value={num(v)}, vol={dec(vol)}, conf={dec(conf)}, days={days})")
    w.say("\nCheck: expected shortfall is larger than VaR, as it must be.\n")
    return x


def fx_spot(R):
    return round(R.uniform(82, 92), 2)


def ex_fx_forward(R, w, arg=None):
    S, rd, rf, m = fx_spot(R), R.choice(RATES_INR), R.choice(RATES_USD), R.choice([1, 3, 6, 12])
    w.say(EXAMPLE + f"USD/INR spot at {num(S)}, an INR rate of {pct(rd)} and a USD rate of {pct(rf)} (both continuous), "
          f"for a {months_adj(m)} forward.\n")
    T = write_T(w, m)
    w.say("Forward = ")
    F = w.tool(f"QL.fx_forward(spot={num(S)}, rd={dec(rd)}, rf={dec(rf)}, T={T})")
    w.say("\nForward points = ")
    w.tool(f"{F}-{num(S)}")
    w.say("\nCheck: the rupee rate is higher than the dollar rate, so the forward is above spot, as it is.\n")
    return F


def ccs_mtm_terms(R):
    Nf, X, S = R.choice([1, 2, 5, 10]) * 10**6, R.choice([74, 76.5, 79, 82, 83.2]), fx_spot(R)
    cd, cf = R.choice([6.5, 6.75, 7, 7.25, 7.5, 8]) / 100, R.choice([3, 3.5, 4, 4.5, 5]) / 100
    T, f, zd, zf = R.randint(1, 5), R.choice([1, 2]), R.choice(RATES_INR), R.choice(RATES_USD)
    return Nf, X, S, cd, cf, T, f, zd, zf


def ccs_mtm_work(w, Nf, X, S, cd, cf, T, f, zd, zf):
    Nd = round(Nf * X)
    w.say("INR leg = ")
    a = w.tool(f"QL.fixed_leg_pv(notional={num(Nd)}, rate={dec(cd)}, T={T}, freq={f}, zero={dec(zd)})")
    w.say("\nUSD leg = ")
    b = w.tool(f"QL.fixed_leg_pv(notional={num(Nf)}, rate={dec(cf)}, T={T}, freq={f}, zero={dec(zf)})")
    w.say(" dollars, which is ")
    c = w.tool(f"{b}*{num(S)}")
    w.say(" rupees at today's spot.\nValue = INR leg - USD leg = ")
    v = w.tool(f"{a}-{c}")
    w.say(" rupees.\nCheck: each leg is close to its notional: INR leg / notional = ")
    w.tool(f"{a}/{num(Nd)}")
    w.say(" and USD leg / notional = ")
    w.tool(f"{b}/{num(Nf)}")
    w.say(".\n")
    return v


def ccs_par_work(w, cf, T, f, zd, zf):
    w.say("Fair INR fixed rate = ")
    p = w.tool(f"QL.ccs_par_rate(rate_for={dec(cf)}, T={T}, freq={f}, zero_dom={dec(zd)}, zero_for={dec(zf)})")
    w.say("\nCheck: it is above the USD rate by ")
    w.tool(f"{p}-{dec(cf)}")
    w.say(", close to the gap between the two zero rates, ")
    w.tool(f"{dec(zd)}-{dec(zf)}")
    w.say(".\n")
    return p


def ex_ccs(R, w, arg=None):
    Nf, X, S, cd, cf, T, f, zd, zf = ccs_mtm_terms(R)
    if R.random() < 0.7:
        w.say(EXAMPLE + f"you receive INR {pct(cd)} and pay USD {pct(cf)} fixed, paid {FREQ_WORD[f]}, with {T} year{'s' if T > 1 else ''} "
              f"left, on USD {num(Nf)} (₹{num(round(Nf * X))} at the trade's rate of {num(X)}); today's spot is {num(S)}, and "
              f"the zero rates are {pct(zd)} for INR and {pct(zf)} for USD (continuous).\n")
        return ccs_mtm_work(w, Nf, X, S, cd, cf, T, f, zd, zf)
    T = R.randint(2, 10)
    w.say(EXAMPLE + f"a new {T}-year swap where you pay USD {pct(cf)} fixed {FREQ_WORD[f]} and receive INR fixed, with zero "
          f"rates of {pct(zd)} for INR and {pct(zf)} for USD (continuous). Find the fair INR rate.\n")
    return ccs_par_work(w, cf, T, f, zd, zf)


def ex_fx_option(R, w, arg=None):
    S, m, rd, rf, vol, kind = fx_spot(R), R.choice([1, 3, 6, 12]), R.choice(RATES_INR), R.choice(RATES_USD), R.randint(3, 9) / 100, \
        R.choice(["call", "put"])
    K = round(S * R.uniform(0.98, 1.03) * 2) / 2
    w.say(EXAMPLE + f"a {months_adj(m)} USD/INR {kind} with strike {num(K)}, spot {num(S)}, INR rate {pct(rd)}, USD rate {pct(rf)} "
          f"(continuous) and volatility {pct(vol)}.\n")
    T = write_T(w, m)
    w.say("Price = ")
    P = w.tool(f"QL.fx_option({kind}, S={num(S)}, K={num(K)}, T={T}, rd={dec(rd)}, rf={dec(rf)}, vol={dec(vol)})")
    w.say(" rupees per dollar.\nCheck: it must be worth at least ")
    if kind == "call":
        lb = w.tool(f"max({num(S)}*exp(-{dec(rf)}*{T})-{num(K)}*exp(-{dec(rd)}*{T}), 0)")
    else:
        lb = w.tool(f"max({num(K)}*exp(-{dec(rd)}*{T})-{num(S)}*exp(-{dec(rf)}*{T}), 0)")
    w.say(f", and {P} is.\n")
    return P


def ex_futures(R, w, arg=None):
    F = R.choice([R.randint(220, 260) * 100, R.randint(60, 80) * 1000, R.randint(50, 75) * 100])
    m, r, vol, kind = R.choice([1, 2, 3, 6]), R.choice(RATES_INR), R.randint(12, 30) / 100, R.choice(["call", "put"])
    K = near(R, F, 0.95, 1.05)
    w.say(EXAMPLE + f"a {months_adj(m)} {kind} on a futures contract at ₹{num(F)} with strike ₹{num(K)}, volatility {pct(vol)} "
          f"and a risk-free rate of {pct(r)} (continuous).\n")
    T = write_T(w, m)
    w.say("Price = ")
    P = w.tool(f"QL.black76_option({kind}, F={num(F)}, K={num(K)}, T={T}, r={dec(r)}, vol={dec(vol)})")
    w.say("\nCheck: it must be worth at least exp(-r * T) * max(" + ("F - K" if kind == "call" else "K - F") + ", 0) = ")
    w.tool(f"exp(-{dec(r)}*{T})*max({num(F)}-{num(K)}, 0)" if kind == "call" else f"exp(-{dec(r)}*{T})*max({num(K)}-{num(F)}, 0)")
    w.say(f", and {P} is.\n")
    return P


# ---------------------------------------------------------------- topics: what Ganit can explain

def inst(*specs):
    """'a|cross-currency swap|cross-currency swaps' -> (with article, bare, plural)."""
    out = []
    for s in specs:
        art, sing, plural = s.split("|")
        out.append((f"{art} {sing}", sing, plural))
    return out


TOPICS = {
    "european_option": dict(
        kind="instrument", goal="a European option", example=ex_european,
        names=inst("a|European option|European options", "a|European call|European calls", "a|European put|European puts",
                   "a|call option|call options", "a|put option|put options", "a|stock option|stock options",
                   "an|equity option|equity options", "an|option on a stock|options on stocks", "an|option|options"),
        what="A European option gives the right, but not the obligation, to buy (a call) or sell (a put) a stock at a fixed "
             "strike price on one expiry date.",
        steps=["Write the time to expiry T in years and turn the risk-free rate into continuous compounding.",
               "Compute d1 = (ln(S / K) + (r + vol^2 / 2) * T) / (vol * sqrt(T)) and d2 = d1 - vol * sqrt(T).",
               "Call = S * N(d1) - K * exp(-r * T) * N(d2); put = K * exp(-r * T) * N(-d2) - S * N(-d1). This is the "
               "Black-Scholes formula.",
               "If the stock pays a dividend yield q, use S * exp(-q * T) in place of S."],
        need="the share price S (live from NSE or BSE), the strike K and expiry (from the contract), the risk-free rate r (a "
             "T-bill or government bond yield for the same maturity) and the volatility (the implied volatility from the option "
             "chain, or the standard deviation of daily returns times sqrt(252))."),
    "greeks": dict(
        kind="measure", example=ex_greek,
        goal=lambda g: f"an option's {g or 'Greeks'}",
        names=[("option Greeks", None), ("the Greeks of an option", None), ("the Greeks", None), ("delta", "delta"),
               ("the delta of an option", "delta"), ("option delta", "delta"), ("gamma", "gamma"), ("the gamma of an option", "gamma"),
               ("vega", "vega"), ("the vega of an option", "vega"), ("theta", "theta"), ("the theta of an option", "theta"),
               ("rho", "rho"), ("the rho of an option", "rho")],
        what="The Greeks measure how an option's price changes: delta for a ₹1 move in the stock, gamma for the change in "
             "delta, vega for a 1% change in volatility, theta for one day passing and rho for a 1% change in the interest rate.",
        steps=["Compute d1 and d2 as in Black-Scholes.",
               "Delta = N(d1) for a call and N(d1) - 1 for a put; gamma = n(d1) / (S * vol * sqrt(T)), where n is the normal density.",
               "Vega = S * n(d1) * sqrt(T) / 100 per 1% of volatility; theta and rho also come from the formula, quoted per day "
               "and per 1% of rate.",
               "Or bump one input a little, reprice the option and divide the change in price by the bump."],
        need="the same inputs as the option price: S, K, T, the risk-free rate and the volatility."),
    "american_option": dict(
        kind="instrument", goal="an American option", example=ex_american,
        names=inst("an|American option|American options", "an|American put|American puts", "an|American call|American calls",
                   "an|American-style option|American-style options", "an|option with early exercise|options with early exercise"),
        what="An American option can be exercised on any day up to expiry, so it is worth at least as much as the European one. "
             "There is no exact formula, so it is priced on a tree.",
        steps=["Split the time to expiry into many small steps dt, for example 500.",
               "Each step the stock moves up by u = exp(vol * sqrt(dt)) or down by d = 1 / u, with risk-neutral probability "
               "p = (exp(r * dt) - d) / (u - d).",
               "At expiry the option is worth its payoff. Step back through the tree, taking at each node the larger of "
               "exercising now and the discounted expected value of waiting.",
               "The value at the first node is the price."],
        need="the same inputs as a European option (S, K, T, the risk-free rate and the volatility) and the number of steps."),
    "implied_vol": dict(
        kind="measure", goal="implied volatility", example=ex_implied,
        names=["implied volatility", "the implied volatility of an option", "implied vol", "the IV of an option", "IV"],
        what="Implied volatility is the volatility that makes the Black-Scholes price equal to the option's market price. "
             "Traders quote and compare options by it.",
        steps=["Take the option's market price and its S, K, T and risk-free rate.",
               "Guess a volatility, price the option with Black-Scholes and compare with the market price.",
               "Adjust the guess (with Newton's method or bisection) until the two prices match.",
               "Check by repricing the option at the volatility you found."],
        need="the option's market price (from the option chain), S, K, T and the risk-free rate."),
    "put_call_parity": dict(
        kind="measure", goal="a put price with put-call parity", example=ex_parity,
        names=["put-call parity", "the put price from a call price", "a put price from the call price", "put call parity"],
        what="Put-call parity links a European call and put with the same strike and expiry: C - P = S - K * exp(-r * T). If it "
             "fails, there is a riskless profit.",
        steps=["Make sure the call and the put have the same stock, strike and expiry.",
               "Discount the strike: K * exp(-r * T).",
               "Put = call - S + K * exp(-r * T); call = put + S - K * exp(-r * T)."],
        need="the price of one of the options, the share price S, the strike K, the time T and the risk-free rate."),
    "bond_price": dict(
        kind="instrument", goal="a coupon bond", example=ex_bond,
        names=inst("a|bond|bonds", "a|coupon bond|coupon bonds", "a|fixed-rate bond|fixed-rate bonds",
                   "a|government bond|government bonds", "a|corporate bond|corporate bonds", "a|G-sec|G-secs"),
        what="A coupon bond pays a fixed coupon every period and its face value at maturity. Its price is the value today of "
             "all those payments.",
        steps=["List the cash flows: a coupon of face * coupon rate / payments per year every period, plus the face value at "
               "maturity.",
               "Discount each one at the yield: divide the k-th payment by (1 + y / m)^k, with m payments a year.",
               "Add them up. If the coupon rate is above the yield the price is above face value, and below it otherwise."],
        need="the face value, coupon rate, payment frequency and maturity (from the bond's terms) and the yield (the market "
             "yield of similar bonds, for example from FBIL or CCIL for G-secs, plus a credit spread for corporate bonds)."),
    "bond_ytm": dict(
        kind="measure", goal="a bond's yield to maturity", example=ex_ytm,
        names=["yield to maturity", "the yield to maturity of a bond", "a bond's yield", "YTM", "the YTM of a bond", "bond yield"],
        what="The yield to maturity is the one discount rate that makes the value of a bond's coupons and face value equal to "
             "its market price: the return you earn if you hold the bond to maturity.",
        steps=["Write the bond's cash flows: the coupons and the face value at maturity.",
               "Find the rate y at which their discounted value equals the price, by trial and error (Newton's method).",
               "Quote y with the bond's compounding, for example twice a year."],
        need="the bond's price, face value, coupon rate, payment frequency and maturity."),
    "duration": dict(
        kind="measure", goal="a bond's duration", example=ex_duration,
        names=["the duration of a bond", "bond duration", "modified duration", "Macaulay duration", "duration and convexity",
               "the interest rate risk of a bond", "duration"],
        what="Duration measures how sensitive a bond's price is to its yield: with modified duration D, the price falls about "
             "D% when the yield rises by 1%. Convexity corrects this for large moves.",
        steps=["Macaulay duration = the average time to the bond's cash flows, weighted by their present values.",
               "Modified duration = Macaulay duration / (1 + y / m), with m payments a year.",
               "Price change = -D * change in yield * price, plus 0.5 * convexity * (change in yield)^2 * price for big moves."],
        need="the bond's face value, coupon, payment frequency, maturity and yield."),
    "zero_coupon_bond": dict(
        kind="instrument", goal="a zero-coupon bond", example=ex_zero,
        names=inst("a|zero-coupon bond|zero-coupon bonds", "a|zero coupon bond|zero coupon bonds", "a|discount bond|discount bonds"),
        what="A zero-coupon bond pays only its face value at maturity, so it trades below face value.",
        steps=["Price = face / (1 + y)^T, with an annually compounded yield y and T years to maturity.",
               "With continuous compounding, price = face * exp(-y * T).",
               "The other way round, the yield is (face / price)^(1 / T) - 1."],
        need="the face value, the time to maturity and the yield (from the zero-coupon curve, for example G-sec STRIPS)."),
    "rate_conversion": dict(
        kind="measure", goal="an equivalent rate with different compounding", example=ex_convert,
        names=["equivalent interest rates", "a continuously compounded rate", "the effective annual rate",
               "a rate with a different compounding frequency", "rate conversion between compounding frequencies"],
        what="The same growth can be quoted with different compounding. Converting finds the rate that grows money by the same "
             "amount under the new convention.",
        steps=["Growth over a year with m compounding periods is (1 + r / m)^m; with continuous compounding it is exp(r).",
               "Set the two growths equal: continuous from m times a year is r_c = m * ln(1 + r_m / m).",
               "And back again: r_m = m * (exp(r_c / m) - 1)."],
        need="the rate and its compounding (annual, twice a year, quarterly, monthly or continuous)."),
    "forward_rate": dict(
        kind="measure", goal="a forward rate", example=ex_forward,
        names=["a forward interest rate", "the forward rate between two dates", "an implied forward rate", "forward rates"],
        what="A forward rate is the interest rate for a future period that today's zero rates already lock in.",
        steps=["Take the zero rate r1 to time T1 and r2 to time T2.",
               "With continuous compounding, the forward rate is f = (r2 * T2 - r1 * T1) / (T2 - T1).",
               "Investing to T2 then grows the same as investing to T1 and rolling over at f, so there is no arbitrage."],
        need="two zero rates and their maturities, from the zero-coupon yield curve."),
    "interest_rate_swap": dict(
        kind="instrument", goal="an interest rate swap", example=ex_swap,
        names=inst("an|interest rate swap|interest rate swaps", "an|IRS|IRS trades", "a|plain vanilla swap|plain vanilla swaps",
                   "a|fixed-for-floating swap|fixed-for-floating swaps", "an|OIS swap|OIS swaps", "a|MIBOR swap|MIBOR swaps",
                   "a|swap|swaps"),
        what="An interest rate swap exchanges fixed interest payments for floating ones on the same notional; only the "
             "interest changes hands, never the notional.",
        steps=["The fixed leg is worth fixed rate * annuity * notional, where the annuity is the sum of the discount factors "
               "times the period length.",
               "The floating leg is worth notional * (1 - DF(T)) on a payment date, where DF(T) is the discount factor to maturity.",
               "The par swap rate makes the two equal: (1 - DF(T)) / annuity.",
               "An existing swap is worth notional * ((1 - DF(T)) - fixed rate * annuity) to the side paying fixed."],
        need="the notional, fixed rate, payment frequency and maturity (from the trade) and a discount curve (the OIS curve: "
             "MIBOR OIS for INR, SOFR for USD)."),
    "vasicek_cir": dict(
        kind="model", example=ex_vasicek,
        goal=lambda m: "the Vasicek model" if m != "cir" else "the CIR model",
        names=[("the Vasicek model", "vasicek"), ("Vasicek", "vasicek"), ("the CIR model", "cir"), ("the Cox-Ingersoll-Ross model", "cir"),
               ("a short-rate model", "vasicek"), ("the Vasicek interest rate model", "vasicek")],
        what="The Vasicek model lets the short interest rate drift back to a long-run level b at speed a, with random shocks "
             "of size sigma: dr = a * (b - r) * dt + sigma * dW. CIR is the same, but the shocks scale with sqrt(r), so rates "
             "stay positive.",
        steps=["Estimate a, b and sigma from past short rates, or calibrate them to today's yield curve.",
               "A zero-coupon bond has a formula: P = A(T) * exp(-B(T) * r), with B(T) = (1 - exp(-a * T)) / a.",
               "Coupon bonds are sums of zero-coupon bonds; use simulation for anything more complex."],
        need="the short rate today, the speed a, the long-run level b, the volatility sigma and the maturity."),
    "var": dict(
        kind="measure", goal="value at risk", example=ex_var,
        names=["value at risk", "VaR", "the VaR of a portfolio", "the value at risk of my portfolio", "expected shortfall",
               "VaR and expected shortfall", "the 99% VaR", "the market risk of a portfolio"],
        what="Value at risk is the loss a portfolio should not exceed with a given confidence over a given horizon, for "
             "example 99% over 1 day. Expected shortfall is the average loss on the days worse than the VaR.",
        steps=["Estimate the daily volatility of the portfolio's returns: the standard deviation of past daily returns.",
               "Normal VaR = z * daily volatility * sqrt(days) * value, with z = 2.326 for 99% and 1.645 for 95%.",
               "Expected shortfall = n(z) / (1 - confidence) * daily volatility * sqrt(days) * value.",
               "Historical VaR instead sorts past daily losses and takes the one at the (1 - confidence) cut-off."],
        need="the portfolio value, its daily volatility (from at least a year of daily returns), the confidence level (95% or "
             "99%) and the horizon (1 or 10 days)."),
    "fx_forward": dict(
        kind="instrument", goal="an FX forward", example=ex_fx_forward,
        names=inst("an|FX forward|FX forwards", "a|currency forward|currency forwards", "a|forward exchange rate|forward exchange rates",
                   "a|USD/INR forward|USD/INR forwards", "a|forward contract on dollars|forward contracts on dollars",
                   "an|FX swap|FX swaps", "a|forward rate for USD/INR|forward rates for USD/INR"),
        what="An FX forward fixes today the exchange rate for a currency deal on a future date. An FX swap is a spot deal plus "
             "the opposite forward deal, so it is priced with the same forward points.",
        steps=["By covered interest parity, forward = spot * exp((domestic rate - foreign rate) * T), with continuous rates.",
               "With simple rates: forward = spot * (1 + rd * T) / (1 + rf * T).",
               "Forward points = forward - spot. The currency with the higher interest rate trades at a forward discount.",
               "An existing forward at rate K is worth (today's forward - K) * notional * DF(T) to the buyer of the foreign currency."],
        need="the spot rate (the RBI reference rate or a live quote), the interest rates of both currencies for the same tenor "
             "(for example MIBOR or T-bill rates for INR and SOFR for USD) and the tenor."),
    "cross_currency_swap": dict(
        kind="instrument", goal="a cross-currency swap", example=ex_ccs,
        names=inst("a|cross-currency swap|cross-currency swaps", "a|cross currency swap|cross currency swaps",
                   "an|FX cross currency swap|FX cross currency swaps", "a|currency swap|currency swaps", "a|CCS|CCS trades",
                   "a|cross-currency basis swap|cross-currency basis swaps", "a|USD/INR cross-currency swap|USD/INR cross-currency swaps",
                   "a|USD INR currency swap|USD INR currency swaps"),
        what="A cross-currency swap exchanges interest payments in two currencies. Usually the notionals are exchanged at the "
             "start at the spot rate and swapped back at maturity, for example to turn a dollar loan into a rupee loan.",
        steps=["Lay out each leg's cash flows in its own currency: the coupons and the notional paid back at the end.",
               "Discount each leg on its own currency's curve, for example SOFR for USD and MIBOR OIS for INR.",
               "Convert the foreign leg's value into rupees at today's spot rate.",
               "Value = the leg you receive minus the leg you pay. A new swap's fixed rate is set so that this is zero.",
               "Banks also add the cross-currency basis, a spread that reflects the demand for dollars."],
        need="both notionals, the two fixed rates (or floating indices), the payment frequency and maturity (from the trade), "
             "a zero curve for each currency and today's spot rate."),
    "fx_option": dict(
        kind="instrument", goal="an FX option", example=ex_fx_option,
        names=inst("an|FX option|FX options", "a|currency option|currency options", "a|USD/INR option|USD/INR options",
                   "an|option on a currency|options on currencies", "a|dollar call option|dollar call options"),
        what="An FX option gives the right to buy (a call) or sell (a put) a currency at a fixed rate on the expiry date. It is "
             "priced with the Garman-Kohlhagen formula: Black-Scholes with the foreign interest rate in the role of a dividend yield.",
        steps=["Compute d1 = (ln(S / K) + (rd - rf + vol^2 / 2) * T) / (vol * sqrt(T)) and d2 = d1 - vol * sqrt(T).",
               "Call = S * exp(-rf * T) * N(d1) - K * exp(-rd * T) * N(d2).",
               "Put = K * exp(-rd * T) * N(-d2) - S * exp(-rf * T) * N(-d1)."],
        need="the spot rate, the strike, the expiry, both interest rates and the implied volatility (USD/INR is usually 3% to 8%)."),
    "futures_option": dict(
        kind="instrument", goal="an option on futures", example=ex_futures,
        names=inst("an|option on futures|options on futures", "a|futures option|futures options", "a|commodity option|commodity options",
                   "an|option on a futures contract|options on futures contracts"),
        what="An option on a futures contract is priced with Black's 1976 model: Black-Scholes with the futures price in place of "
             "the stock price.",
        steps=["Compute d1 = (ln(F / K) + vol^2 / 2 * T) / (vol * sqrt(T)) and d2 = d1 - vol * sqrt(T).",
               "Call = exp(-r * T) * (F * N(d1) - K * N(d2)); put = exp(-r * T) * (K * N(-d2) - F * N(-d1))."],
        need="the futures price F (from the exchange), the strike, the expiry, the risk-free rate and the volatility."),
}
HEADS = {"instrument": "How to price it:", "measure": "How to calculate it:", "model": "How it works:"}
VERB = {"instrument": "price", "measure": "calculate", "model": "use"}

# Questions are built from parts so that the product name, not the exact phrasing, decides the answer.
ASK = {
    "instrument": {
        "q": ["How can I price {a}?", "How do I price {a}?", "How do you price {a}?", "How to price {a}?", "How we can price {a}?",
              "How can we price {a}?", "How should I price {a}?", "How is {a} priced?", "How are {p} priced?",
              "How do banks price {p}?", "How can I value {a}?", "How do I value {a}?", "How to value {a}?",
              "How do I calculate the value of {a}?", "How do I work out the fair value of {a}?", "How do I find the MTM of {a}?",
              "What is the method to price {a}?", "What is the formula for pricing {a}?", "What is {a} and how is it priced?",
              "What is {a}?", "How is the price of {a} calculated?", "What's the right way to value {a}?",
              "I need to price {a}. How do I do it?", "I have {a}. How do I value it?", "Steps to price {a}?",
              "How do I do the valuation of {a}?", "What is the fair value of {a}?", "How is {a} valued?", "How are {p} valued?",
              "How does pricing {a} work?", "How do traders value {p}?", "Where do I start with pricing {a}?"],
        "v": ["explain how to price {a}", "explain the pricing of {p}", "explain {n} valuation", "explain {n} pricing",
              "show me how {p} are priced", "show me how to value {a}", "tell me how to price {a}", "tell me how {p} get priced",
              "walk me through pricing {a}", "help me price {a}", "help me value {a}", "teach me how to price {a}",
              "explain {a} and how it is priced", "show me the valuation of {a}", "describe how to price {a}",
              "give me the steps to value {a}", "explain how {p} are valued", "show me how {p} are valued"],
        "n": ["{n} pricing", "{n} valuation", "the pricing of {p}", "the valuation of {a}", "pricing {p}", "valuing {p}",
              "how {p} are valued", "how {p} get priced", "how to value {a}", "how to price {a}", "the right way to value {a}",
              "the method for pricing {p}", "the formula behind {n} pricing", "{n} pricing method", "{a}"],
        "t": ["{N}: how is it priced?", "{N}: how is it valued?", "{N} - how do I value it?", "{N}? How to price it",
              "{N}, how do I price it?", "{N} valuation method?", "{N} pricing formula?", "{N} price calculation",
              "{N}. How is it valued?", "{N} - pricing steps", "{N} pricing", "{N} valuation"],
        "heldout": ["Any idea how {p} are valued?", "What goes into pricing {a}?", "Need the valuation approach for {p}.",
                    "{N} - what's the pricing approach?", "How would a quant value {a}?", "Break down {n} pricing for me."]},
    "measure": {
        "q": ["How do I calculate {m}?", "How can I calculate {m}?", "How to calculate {m}?", "How we can calculate {m}?",
              "How do you compute {m}?", "How to compute {m}?", "How do I find {m}?", "How do I work out {m}?",
              "How is {m} calculated?", "How is {m} computed?", "What is {m} and how do I calculate it?", "What is {m}?",
              "What is the formula for {m}?", "Formula for {m}?", "How do I get {m}?", "What's the right way to get {m}?",
              "Steps to calculate {m}?", "How does {m} work?", "How do traders calculate {m}?", "Where do I start with {m}?"],
        "v": ["explain {m}", "explain how to calculate {m}", "show me how to compute {m}", "tell me how to work out {m}",
              "walk me through calculating {m}", "help me calculate {m}", "teach me {m}", "show me the calculation of {m}",
              "describe how to calculate {m}", "show me how {m} is computed", "tell me how {m} is calculated"],
        "n": ["{m}", "the formula for {m}", "the calculation of {m}", "how {m} is computed", "how to find {m}",
              "how to calculate {m}", "{m} calculation", "{m} formula", "calculating {m}"],
        "t": ["{M}: how is it computed?", "{M}: how is it calculated?", "{M} - how do I calculate it?", "{M}? formula",
              "{M} calculation method?", "{M} formula please", "{M}, how to calculate?", "{M} calculation", "{M} formula"],
        "heldout": ["Any idea how {m} is computed?", "What goes into {m}?", "Need the approach for {m}.",
                    "{M} - what's the approach?", "How would a quant get {m}?", "Break down {m} for me."]},
    "model": {
        "q": ["How does {m} work?", "What is {m}?", "How do I price a bond with {m}?", "How to use {m} to price bonds?",
              "How do I calculate a bond price under {m}?", "How do I use {m}?", "What's the idea behind {m}?"],
        "v": ["explain {m}", "teach me {m}", "show me how {m} prices a bond", "walk me through {m}", "describe {m}"],
        "n": ["{m}", "{m} bond pricing", "bond pricing with {m}", "how {m} works"],
        "t": ["{M}: how does it work?", "{M} explained", "{M} - how do I use it?", "{M}? bond price"],
        "heldout": ["Any idea how {m} prices bonds?", "What goes into {m}?", "Break down {m} for me."]},
}
OPEN = {"q": ["", "", "", "", "", "Hi, ", "Hello, ", "Quick question: ", "Ganit, ", "Hey, "],
        "v": ["", "", "Please ", "Can you ", "Could you ", "Kindly ", "Pls ", "Would you "],
        "n": ["", "", "I want to know ", "I'd like to understand ", "Tell me about ", "Explain ", "Info on ", "Need help with ",
              "Question about ", "Help with ", "Doubt: "]}
CLOSE = ["", "", "", "", " please", " step by step", " with an example", " in simple words", " for a beginner", " briefly"]


def styled(R, q):
    """People type in many ways: lower case, Title Case, no question mark."""
    u = R.random()
    if u < 0.2:
        q = q.lower()
    elif u < 0.3:
        q = " ".join(x[:1].upper() + x[1:] for x in q.split(" "))
    if q.endswith("?") and R.random() < 0.2:
        q = q[:-1]
    return q


def cap(s):
    return s[:1].upper() + s[1:]


def ask(R, kind, name, wording):
    if kind == "instrument":
        a, n, p = name
        fmt = dict(a=a, n=n, p=p, N=cap(n))
    else:
        fmt = dict(m=name, M=cap(name))
    lists = ASK[kind]
    if wording == "heldout":
        return styled(R, R.choice(lists["heldout"]).format(**fmt))
    fam = R.choices(["q", "v", "n", "t"], weights=[5, 3, 2, 1])[0]
    core, close = R.choice(lists[fam]).format(**fmt), R.choice(CLOSE)
    if fam == "q":
        opener = R.choice(OPEN["q"])
        body, end = (core[:-1], core[-1]) if core[-1] in "?." else (core, "")
        q = (opener + body[:1].lower() + body[1:] if opener else body) + close + end
    elif fam == "v":
        opener = R.choice(OPEN["v"])
        end = "?" if opener in ("Can you ", "Could you ", "Would you ") else R.choice(["", ".", "."])
        q = (opener + core if opener else cap(core)) + close + end
    elif fam == "n":
        opener = R.choice(OPEN["n"])
        q = (opener + core if opener else cap(core)) + close + R.choice(["", ".", "?"])
    else:
        q = core
    return styled(R, q)


# ---------------------------------------------------------------- the five kinds

def think(goal, known, plan, missing=None, assume=None, need=None):
    lines = [f"Goal: {goal}.", f"Known: {known}."]
    if missing:
        lines.append(f"Missing: {missing}.")
    if assume:
        lines.append(f"Assume: {assume}.")
    if need:
        lines.append(f"Need: {need}.")
    lines.append("Plan: " + " ".join(f"{i}) {p}" for i, p in enumerate(plan, 1)))
    return "<think>\n" + "\n".join(lines) + "\n</think>\n"


def method(R, wording, topic=None):
    topic = topic or R.choice(list(TOPICS))
    t = TOPICS[topic]
    entry = R.choice(t["names"])
    if t["kind"] == "instrument":
        name, arg = entry, None
    else:
        name, arg = (entry if isinstance(entry, tuple) else (entry, None))
    goal_name = t["goal"](arg) if callable(t["goal"]) else t["goal"]
    question = ask(R, t["kind"], name, wording)
    w = Work()
    w.say(f"What it is: {t['what']}\n{HEADS[t['kind']]}\n" + "".join(f"{i}) {s}\n" for i, s in enumerate(t["steps"], 1))
          + f"What you need: {t['need']}\n")
    answer = t["example"](R, w, arg)
    goal = f"explain how to {VERB[t['kind']]} {goal_name}, then work an example"
    plan = ["say what it is", f"how to {VERB[t['kind']]} it", "the inputs and where to get them",
            "work an example with typical numbers", "check the example"]
    return dict(kind="method", topic=topic, question=question, answer=answer, check={"goal": goal},
                solution=think(goal, "no numbers given", plan) + w.text() + f"#### {answer}")


def option_question(R, cur, S, K, m, kind, style, extra, what):
    facts = [R.choice([f"The stock trades at {money(R, S, cur)}.", f"The share price is {money(R, S, cur)}.",
                       f"A share costs {money(R, S, cur)}."])] + extra
    R.shuffle(facts)
    style_asks = {
        "price": [f"What is a {months_adj(m)} European {kind} with strike {money(R, K, cur)} worth?",
                  f"Price a {months_adj(m)} European {kind} with a strike of {money(R, K, cur)}.",
                  f"How much is a {months_adj(m)} {kind} option struck at {money(R, K, cur)} worth?"],
        "delta": [f"What is the delta of a {months_adj(m)} European {kind} with strike {money(R, K, cur)}?",
                  f"Find the delta of a {months_adj(m)} {kind} struck at {money(R, K, cur)}."],
        "american": [f"What is a {months_adj(m)} American put with strike {money(R, K, cur)} worth?",
                     f"Price a {months_adj(m)} American put struck at {money(R, K, cur)}."]}
    if style == "short" and not extra:      # everything in one sentence
        noun = {"price": f"a {months_adj(m)} {kind}", "delta": f"the delta of a {months_adj(m)} {kind}",
                "american": f"a {months_adj(m)} American put"}[what]
        return R.choice([f"Price {noun} on a {money(R, S, cur)} stock with strike {money(R, K, cur)}.",
                         f"What is {noun} worth on a stock at {money(R, S, cur)} with strike {money(R, K, cur)}?"
                         if what != "delta" else f"What is {noun} on a stock at {money(R, S, cur)} with strike {money(R, K, cur)}?"])
    return " ".join(facts + [R.choice(style_asks[what])])


def assume_option(R):
    cur = "$" if R.random() < 0.15 else "₹"
    S, m, kind = stock(R), R.choice([1, 3, 6, 9, 12]), R.choice(["call", "put"])
    K = near(R, S)
    what = R.choices(["price", "delta", "american"], weights=[6, 2, 2])[0]
    kind = "put" if what == "american" else kind
    missing = R.choice([["vol", "r"], ["vol", "r"], ["vol"], ["r"]])
    vol = DEFAULT["vol"][0] if "vol" in missing else R.randint(15, 45) / 100
    rkey = "r_usd" if cur == "$" else "r_inr"
    r = DEFAULT[rkey][0] if "r" in missing else R.choice(RATES_USD if cur == "$" else RATES_INR)
    extra = []
    if "vol" not in missing:
        extra.append(R.choice([f"Its volatility is {pct(vol)} a year.", f"The volatility is {pct(vol)}."]))
    if "r" not in missing:
        extra.append(f"The risk-free rate is {pct(r)} a year, continuously compounded.")
    q = option_question(R, cur, S, K, m, kind, R.choice(["short", "facts"]), extra, what)
    known = [f"S = {num(S)}", f"K = {num(K)}", f"T = {months_noun(m)}"]
    if "vol" not in missing:
        known.append(f"vol = {pct(vol)}")
    if "r" not in missing:
        known.append(f"r = {pct(r)} (continuous)")
    miss_words = {("vol", "r"): "the volatility and the risk-free rate", ("vol",): "the volatility", ("r",): "the risk-free rate"}
    assume = ", ".join(DEFAULT[k][1] for k in (["vol"] if "vol" in missing else []) + ([rkey] if "r" in missing else []))
    goal = {"price": f"the price of a European {kind}", "delta": f"the delta of a European {kind}",
            "american": "the price of an American put"}[what]
    plan = {"price": [f"price the {kind} with Black-Scholes, using the assumed inputs", "check the no-arbitrage bounds"],
            "delta": [f"compute the delta with Black-Scholes, using the assumed inputs", "check its range"],
            "american": ["price the put on a 500-step tree, using the assumed inputs", "check it against the European put"]}[what]
    w = Work()
    T = write_T(w, m)
    if what == "price":
        w.say("Price = ")
        ans = w.tool(f"QL.european_option({opt(kind, S, K, T, r, vol)})")
        w.say("\n")
        bounds(w, kind, S, K, T, r, ans)
    elif what == "delta":
        w.say("Delta = ")
        ans = w.tool(f"QL.delta({opt(kind, S, K, T, r, vol)})")
        lo, hi = ("0", "1") if kind == "call" else ("-1", "0")
        w.say(f"\nCheck: a {kind}'s delta lies between {lo} and {hi}, and {ans} does.\n")
    else:
        w.say("American put = ")
        ans = w.tool(f"QL.american_option({opt('put', S, K, T, r, vol)}, steps=500)")
        w.say("\nEuropean put = ")
        E = w.tool(f"QL.european_option({opt('put', S, K, T, r, vol)})")
        w.say("\nCheck: the American put is worth at least the European one, and early exercise adds ")
        w.tool(f"{ans}-{E}")
        w.say(".\n")
    w.say("This uses the assumed " + {("vol", "r"): "volatility and rate", ("vol",): "volatility", ("r",): "rate"}[tuple(missing)]
          + "; put in your own for an exact answer.\n")
    return dict(kind="assume", topic=f"option_{what}", question=q, answer=ans,
                solution=think(goal, ", ".join(known), plan, miss_words[tuple(missing)], assume) + w.text() + f"#### {ans}")


def assume_fx_forward(R):
    S, m = fx_spot(R), R.choice([1, 3, 6, 12])
    q = R.choice([f"What is the {months_adj(m)} USD/INR forward rate if spot is {num(S)}?",
                  f"USD/INR spot is {num(S)}. What is the {months_adj(m)} forward?",
                  f"Find the {months_adj(m)} forward exchange rate for USD/INR with spot at {num(S)}.",
                  f"What will the {months_adj(m)} dollar forward be if the spot rate is {num(S)} rupees?"])
    rd, rf = DEFAULT["rd"][0], DEFAULT["rf"][0]
    w = Work()
    T = write_T(w, m)
    w.say("Forward = ")
    F = w.tool(f"QL.fx_forward(spot={num(S)}, rd={dec(rd)}, rf={dec(rf)}, T={T})")
    w.say("\nCheck: the rupee rate is higher than the dollar rate, so the forward is above spot, as it is.\n"
          "This uses the assumed interest rates; put in today's rates for an exact forward.\n")
    return dict(kind="assume", topic="fx_forward", question=styled(R, q), answer=F,
                solution=think("the USD/INR forward rate", f"spot = {num(S)}, T = {months_noun(m)}",
                               ["forward = spot * exp((rd - rf) * T) by covered interest parity", "check the direction"],
                               "the INR and USD interest rates", f"{DEFAULT['rd'][1]}, {DEFAULT['rf'][1]}") + w.text() + f"#### {F}")


def assume_var(R):
    v = R.choice([5, 10, 25, 50, 100, 200, 500]) * 10**5
    written, known_v, expr = big(R, v)
    vol = R.choice([0.8, 1, 1.2, 1.5, 1.8, 2, 2.5]) / 100
    missing = R.choice([["conf", "days"], ["days"], ["conf"]])
    conf = DEFAULT["conf"][0] if "conf" in missing else R.choice([0.95, 0.99])
    days = DEFAULT["days"][0] if "days" in missing else R.choice([1, 10])
    parts = [f"My portfolio is worth {written} and its daily volatility is {pct(vol)}.",
             f"A portfolio of {written} has a daily volatility of {pct(vol)}."]
    asks = {("conf", "days"): ["What is its VaR?", "What is the value at risk?", "How much could I lose (VaR)?"],
            ("days",): [f"What is its {pct(conf)} VaR?", f"What is the {pct(conf)} value at risk?"],
            ("conf",): [f"What is its {days}-day VaR?", f"What is the {days}-day value at risk?"]}
    q = f"{R.choice(parts)} {R.choice(asks[tuple(missing)])}"
    known = [f"value = {known_v}", f"daily vol = {pct(vol)}"] + ([] if "conf" in missing else [f"confidence = {pct(conf)}"]) + \
        ([] if "days" in missing else [f"horizon = {days} days"])
    miss = {("conf", "days"): "the confidence level and the horizon", ("days",): "the horizon", ("conf",): "the confidence level"}
    w = Work()
    if expr:
        w.say(f"Value = {known_v} = ")
        w.tool(expr)
        w.say(" rupees.\n")
    w.say("VaR = ")
    x = w.tool(f"QL.var_normal(value={num(v)}, vol={dec(vol)}, conf={dec(conf)}, days={days})")
    w.say("\nCheck: it is a small share of the portfolio, ")
    w.tool(f"{x}/{num(v)}")
    w.say(" of its value, as expected for a short horizon.\nThis uses the assumed " +
          {("conf", "days"): "confidence and horizon", ("days",): "horizon", ("conf",): "confidence"}[tuple(missing)] +
          "; change them if your rules differ.\n")
    return dict(kind="assume", topic="var", question=styled(R, q), answer=x,
                solution=think("the portfolio's value at risk", ", ".join(known), ["normal VaR = z * vol * sqrt(days) * value",
                               "check its size"], miss[tuple(missing)],
                               ", ".join(DEFAULT[k][1] for k in missing)) + w.text() + f"#### {x}")


def assume_ccs(R):
    cf, T, f = R.choice([3, 3.5, 4, 4.5, 5]) / 100, R.randint(2, 10), R.choice([1, 2])
    q = R.choice([f"What fixed INR rate should a new {T}-year USD/INR cross-currency swap pay against USD {pct(cf)} fixed, paid {FREQ_WORD[f]}?",
                  f"I pay USD {pct(cf)} fixed {FREQ_WORD[f]} in a {T}-year cross currency swap. What INR fixed rate should I receive?",
                  f"Fair INR rate for a {T}-year currency swap against USD {pct(cf)} fixed ({FREQ_WORD[f]})?"])
    zd, zf = DEFAULT["zd"][0], DEFAULT["zf"][0]
    w = Work()
    p = ccs_par_work(w, cf, T, f, zd, zf)
    w.say("This uses the assumed zero rates; read today's INR and USD curves for an exact rate.\n")
    return dict(kind="assume", topic="ccs_par", question=styled(R, q), answer=p,
                solution=think("the fair INR fixed rate of a new cross-currency swap",
                               f"USD fixed rate = {pct(cf)}, T = {T} years, payments {FREQ_WORD[f]}",
                               ["solve for the INR rate that makes both legs equal in value", "check it against the rate gap"],
                               "the INR and USD zero rates", f"{DEFAULT['zd'][1]}, {DEFAULT['zf'][1]}") + w.text() + f"#### {p}")


def full_fx_forward(R):
    S, rd, rf, m = fx_spot(R), R.choice(RATES_INR), R.choice(RATES_USD), R.choice([1, 3, 6, 12])
    points = R.random() < 0.3
    facts = [f"USD/INR spot is {num(S)}.", f"The INR interest rate is {pct(rd)} and the USD rate is {pct(rf)}, both continuously compounded."]
    askq = (f"How many forward points is the {months_adj(m)} forward above spot?" if points else
            R.choice([f"What is the {months_adj(m)} forward rate?", f"Find the {months_adj(m)} USD/INR forward.",
                      f"What should the {months_adj(m)} forward exchange rate be?"]))
    w = Work()
    T = write_T(w, m)
    w.say("Forward = ")
    F = w.tool(f"QL.fx_forward(spot={num(S)}, rd={dec(rd)}, rf={dec(rf)}, T={T})")
    ans = F
    if points:
        w.say("\nForward points = ")
        ans = w.tool(f"{F}-{num(S)}")
    w.say("\nCheck: the rupee rate is higher, so the forward is above spot, as it is.\n")
    return dict(kind="full", topic="fx_forward", question=" ".join(facts + [askq]), answer=ans,
                solution=think("the forward points" if points else "the USD/INR forward rate",
                               f"spot = {num(S)}, INR rate = {pct(rd)} (continuous), USD rate = {pct(rf)} (continuous), "
                               f"T = {months_noun(m)}",
                               ["forward = spot * exp((rd - rf) * T) by covered interest parity"] +
                               (["points = forward - spot"] if points else []) + ["check the direction"]) + w.text() + f"#### {ans}")


def full_ccs(R):
    Nf, X, S, cd, cf, T, f, zd, zf = ccs_mtm_terms(R)
    w = Work()
    if R.random() < 0.55:
        q = (f"I receive INR {pct(cd)} and pay USD {pct(cf)} fixed, {FREQ_WORD[f]}, on a cross-currency swap with {T} year{'s' if T > 1 else ''} "
             f"left. The notionals are USD {num(Nf)} and ₹{num(round(Nf * X))}. Spot is {num(S)}, the INR zero rate is {pct(zd)} and "
             f"the USD zero rate is {pct(zf)} (continuous). What is the swap worth to me?")
        v = ccs_mtm_work(w, Nf, X, S, cd, cf, T, f, zd, zf)
        return dict(kind="full", topic="ccs_mtm", question=q, answer=v,
                    solution=think("the value of the cross-currency swap to me",
                                   f"receive INR {pct(cd)}, pay USD {pct(cf)}, {FREQ_WORD[f]}, T = {T} years, USD notional = {num(Nf)}, "
                                   f"INR notional = {num(round(Nf * X))}, spot = {num(S)}, INR zero = {pct(zd)}, USD zero = {pct(zf)}",
                                   ["value each leg on its own curve", "convert the USD leg at spot", "value = INR leg - USD leg",
                                    "check each leg against its notional"]) + w.text() + f"#### {v}")
    T = R.randint(2, 10)
    q = (f"A new {T}-year cross-currency swap pays USD {pct(cf)} fixed {FREQ_WORD[f]}. The INR zero rate is {pct(zd)} and the USD "
         f"zero rate is {pct(zf)}, continuously compounded. What INR fixed rate makes the swap fair?")
    p = ccs_par_work(w, cf, T, f, zd, zf)
    return dict(kind="full", topic="ccs_par", question=q, answer=p,
                solution=think("the fair INR fixed rate of a new cross-currency swap",
                               f"USD fixed rate = {pct(cf)}, T = {T} years, payments {FREQ_WORD[f]}, INR zero = {pct(zd)}, "
                               f"USD zero = {pct(zf)}", ["solve for the INR rate that makes both legs equal in value",
                                                         "check it against the rate gap"]) + w.text() + f"#### {p}")


def full_fx_option(R):
    S, m, rd, rf, vol, kind = fx_spot(R), R.choice([1, 3, 6, 12]), R.choice(RATES_INR), R.choice(RATES_USD), R.randint(3, 9) / 100, \
        R.choice(["call", "put"])
    K = round(S * R.uniform(0.98, 1.03) * 2) / 2
    q = (f"USD/INR spot is {num(S)}. The INR rate is {pct(rd)} and the USD rate is {pct(rf)} (continuous), and volatility is {pct(vol)}. "
         f"What is a {months_adj(m)} USD {kind} with strike {num(K)} worth?")
    w = Work()
    T = write_T(w, m)
    w.say("Price = ")
    P = w.tool(f"QL.fx_option({kind}, S={num(S)}, K={num(K)}, T={T}, rd={dec(rd)}, rf={dec(rf)}, vol={dec(vol)})")
    w.say(" rupees per dollar.\n")
    return dict(kind="full", topic="fx_option", question=q, answer=P,
                solution=think(f"the price of a USD/INR {kind}", f"S = {num(S)}, K = {num(K)}, T = {months_noun(m)}, "
                               f"INR rate = {pct(rd)}, USD rate = {pct(rf)}, vol = {pct(vol)}",
                               ["price it with Garman-Kohlhagen"]) + w.text() + f"#### {P}")


def full_futures(R):
    F = R.choice([R.randint(220, 260) * 100, R.randint(60, 80) * 1000, R.randint(50, 75) * 100])
    m, r, vol, kind = R.choice([1, 2, 3, 6]), R.choice(RATES_INR), R.randint(12, 30) / 100, R.choice(["call", "put"])
    K = near(R, F, 0.95, 1.05)
    q = (f"A futures contract trades at ₹{num(F)}. Its volatility is {pct(vol)} and the risk-free rate is {pct(r)} (continuous). "
         f"Price a {months_adj(m)} {kind} on the futures with strike ₹{num(K)}.")
    w = Work()
    T = write_T(w, m)
    w.say("Price = ")
    P = w.tool(f"QL.black76_option({kind}, F={num(F)}, K={num(K)}, T={T}, r={dec(r)}, vol={dec(vol)})")
    w.say("\n")
    return dict(kind="full", topic="futures_option", question=q, answer=P,
                solution=think(f"the price of a {kind} on futures", f"F = {num(F)}, K = {num(K)}, T = {months_noun(m)}, "
                               f"r = {pct(r)} (continuous), vol = {pct(vol)}", ["price it with Black's 1976 formula"]) + w.text() + f"#### {P}")


UNKNOWN = {
    "train": inst("a|credit default swap|credit default swaps", "a|CDS|CDS contracts", "a|swaption|swaptions",
                  "an|interest rate cap|interest rate caps", "an|interest rate floor|interest rate floors", "a|collar|collars",
                  "a|barrier option|barrier options", "a|knock-out option|knock-out options", "an|Asian option|Asian options",
                  "a|lookback option|lookback options", "a|digital option|digital options", "a|binary option|binary options",
                  "a|convertible bond|convertible bonds", "a|callable bond|callable bonds", "a|puttable bond|puttable bonds",
                  "a|mortgage-backed security|mortgage-backed securities", "a|CDO|CDOs", "a|variance swap|variance swaps",
                  "a|total return swap|total return swaps", "an|inflation swap|inflation swaps", "a|commodity swap|commodity swaps",
                  "an|equity swap|equity swaps", "a|quanto option|quanto options", "a|basket option|basket options",
                  "a|spread option|spread options", "a|Bermudan swaption|Bermudan swaptions", "a|forward rate agreement|forward rate agreements",
                  "an|FRA|FRAs", "a|repo|repos", "an|autocallable note|autocallable notes", "a|structured note|structured notes",
                  "a|warrant|warrants", "an|employee stock option|employee stock options", "a|chooser option|chooser options",
                  "a|cliquet option|cliquet options", "a|rainbow option|rainbow options", "an|inflation-linked bond|inflation-linked bonds",
                  "a|catastrophe bond|catastrophe bonds", "a|credit-linked note|credit-linked notes", "a|CVA charge|CVA charges",
                  "a|Heston model price|Heston model prices", "a|SABR volatility|SABR volatilities",
                  "an|asset swap|asset swaps", "a|constant maturity swap|constant maturity swaps", "a|weather swap|weather swaps",
                  "a|freight swap|freight swaps", "a|basket default swap|basket default swaps", "a|gap option|gap options",
                  "an|exchange option|exchange options", "a|shout option|shout options", "a|ladder option|ladder options",
                  "a|forward start option|forward start options", "a|Bermudan option|Bermudan options",
                  "a|reverse convertible note|reverse convertible notes", "a|bonus certificate|bonus certificates",
                  "a|perpetual bond|perpetual bonds", "a|floating rate note|floating rate notes", "a|step-up bond|step-up bonds"),
    "heldout": inst("a|volatility swap|volatility swaps", "a|power option|power options", "a|compound option|compound options",
                    "a|Parisian option|Parisian options", "a|range accrual note|range accrual notes", "a|CMS swap|CMS swaps",
                    "a|dividend swap|dividend swaps", "a|correlation swap|correlation swaps"),
}
OFF_TOPIC = ["What is the capital of France?", "Write me a poem about the sea.", "Who won the last cricket world cup?",
             "Tell me a joke.", "What's the weather today?", "Translate hello into French.", "Which phone should I buy?",
             "Should I buy Reliance shares?", "Will the market go up tomorrow?", "What is the best mutual fund?",
             "Give me a stock tip.", "How do I lose weight?", "Who is the prime minister of India?", "Write an email to my boss."]
HELLO = ["hi", "hello", "hey", "hi Ganit", "hello Ganit", "good morning", "who are you?", "what can you do?", "help",
         "what are you?", "how can you help me?", "what is Ganit?", "what do you know?", "hey there", "namaste"]


SYL = ["zor", "ket", "vex", "lum", "tra", "bix", "quo", "nim", "fal", "dra", "pel", "gor", "sin", "mar", "tev", "ul", "ax", "ron"]
MADE_UP_HEADS = [("swap", "swaps"), ("option", "options"), ("note", "notes"), ("bond", "bonds"), ("certificate", "certificates"),
                 ("warrant", "warrants"), ("spread", "spreads"), ("future", "futures"), ("forward", "forwards")]


def made_up(R):
    """A product name that does not exist, so the reply must copy the name from the question."""
    word = "".join(R.choice(SYL) for _ in range(R.choice([2, 2, 3]))).capitalize()
    head, plural = R.choice(MADE_UP_HEADS)
    return (f"{'an' if word[0] in 'AEIOU' else 'a'} {word} {head}", f"{word} {head}", f"{word} {plural}")


def unknown(R, wording):
    if wording == "train" and R.random() < 0.15:
        q = R.choice(OFF_TOPIC)
        text = (f"I only know quant finance, so I can't help with that. I can explain and price: {CAN}. "
                "I don't give investment advice or market predictions.\n")
        return dict(kind="unknown", topic="off_topic", question=styled(R, q), answer=None, check={"contains": "I only know quant finance"},
                    solution=think("answer a question outside quant finance", "the question is not about pricing or risk",
                                   ["say what I can help with"]) + text)
    a, n, p = made_up(R) if wording == "train" and R.random() < 0.4 else R.choice(UNKNOWN[wording])
    if R.random() < 0.25:                       # with numbers: still not something Ganit has learned
        N = R.choice([1, 5, 10, 25, 100])
        q = R.choice([f"Price {a} on a notional of ₹{N} crore with a maturity of {R.randint(1, 10)} years.",
                      f"What is {a} worth if the notional is ₹{N} crore and it matures in {R.randint(1, 10)} years?"])
    else:
        q = ask(R, "instrument", (a, n, p), "train")
    text = f"I haven't learned {p} yet, so I can't explain or price them reliably. I can explain and price: {CAN}.\n"
    return dict(kind="unknown", topic="not_learned", question=styled(R, q), answer=None, check={"contains": "I haven't learned"},
                solution=think(f"explain or price {a}", f"a question about {p}", ["say that I have not learned them",
                                                                                 "list what I can do"]) + text)


def hello(R):
    q = styled(R, R.choice(HELLO))
    text = (f"Hi! I'm Ganit, a small quant model built from scratch. I can explain and price {CAN}. Ask how to price something, "
            "or give me the numbers and I'll work it out; every exact number comes from my calculator and QuantLib tools. "
            "Try: \"How do I price a cross-currency swap?\"\n")
    return dict(kind="hello", topic="hello", question=q, answer=None, check={"contains": "I'm Ganit"}, solution=text)


KINDS = {"method": 50, "assume": 22, "full": 13, "unknown": 12, "hello": 3}


def problem(R, split="train", kind=None):
    """One example as a dict like quantgen.problem's. split: train or heldout (new question wordings)."""
    wording = "heldout" if split == "heldout" else "train"
    for _ in range(100):
        k = kind or R.choices(list(KINDS), weights=list(KINDS.values()))[0]
        try:
            if k == "method":
                p = method(R, wording)
            elif k == "assume":
                p = R.choices([assume_option, assume_fx_forward, assume_var, assume_ccs], weights=[5, 2, 2, 1])[0](R)
            elif k == "full":
                p = R.choices([full_fx_forward, full_ccs, full_fx_option, full_futures], weights=[3, 4, 2, 1])[0](R)
            elif k == "unknown":
                p = unknown(R, wording)
            else:
                p = hello(R)
        except Retry:
            continue
        p["split"] = f"explain_{k}_{wording}"
        return p
    raise RuntimeError("could not build an example")


def to_text(p):
    return f"Q: {p['question']}\nA: {p['solution']}"


def grade(check, text, pred):
    """Grading for rows whose answer is not a number to match."""
    if "goal" in check:
        m = re.search(r"^Goal: (.*)$", text, re.M)
        return bool(m) and m.group(1).strip() == check["goal"] + "." and pred is not None
    return check.get("contains", "\u0000") in text


def check_all(n=200):
    R = random.Random(1)
    lengths = {}
    for kind in KINDS:
        for split in ("train", "heldout"):
            if split == "heldout" and kind not in ("method", "unknown"):
                continue
            for _ in range(n):
                p = problem(R, split, kind)
                assert "{" not in p["question"] and "}" not in p["question"], p["question"]
                if kind in ("method", "assume", "full"):
                    assert p["answer"] is not None and p["solution"].rstrip().endswith(f"#### {p['answer']}"), p
                    float(p["answer"])
                lengths.setdefault(kind, []).append(len(to_text(p)))
    seen = {method(R, "train", t)["topic"] for t in TOPICS}
    assert seen == set(TOPICS)
    for k, v in lengths.items():
        print(f"{k:8s} {len(v):4d} built, longest {max(v)} characters, average {sum(v) // len(v)}")
    print("every tool call ran; every topic builds")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.check:
        check_all()
    else:
        R = random.Random(2)
        for k in KINDS:
            print("=" * 30, k)
            print(to_text(problem(R, "train", k)))
