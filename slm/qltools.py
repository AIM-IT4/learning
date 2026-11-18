"""QuantLib tools the model can call, one line each:

    QL.european_option(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)

Every tool returns one number. Rates, yields and volatilities are decimals (0.07 = 7%),
times are in years (T=0.5 is six months). The wrapper does QuantLib's setup (dates,
curves, processes, engines) so the model only has to choose the tool and fill in inputs.
Calls are parsed with Python's `ast`: only numbers, lists of numbers, date strings and a
fixed set of words (call, put, annual, ...) are accepted as arguments.
"""
import ast
import math
import random

import QuantLib as ql

TODAY = ql.Date(15, 1, 2026)
ql.Settings.instance().evaluationDate = TODAY
BOND_DC = ql.Thirty360(ql.Thirty360.BondBasis)
WORDS = {"call", "put", "modified", "macaulay", "vasicek", "payer", "receiver",
         "annual", "semiannual", "quarterly", "monthly", "continuous", "simple",
         "act365", "act360", "thirty360"}
COMP = {"annual": (ql.Compounded, ql.Annual), "semiannual": (ql.Compounded, ql.Semiannual),
        "quarterly": (ql.Compounded, ql.Quarterly), "monthly": (ql.Compounded, ql.Monthly),
        "continuous": (ql.Continuous, ql.Annual), "simple": (ql.Simple, ql.Annual)}
FREQ = {1: ql.Annual, 2: ql.Semiannual, 4: ql.Quarterly, 12: ql.Monthly}
TOOLS = {}


def tool(fn):
    TOOLS[fn.__name__] = fn
    return fn


def _need(cond, message):
    if not cond:
        raise ValueError(message)


def _option_type(kind):
    _need(kind in ("call", "put"), "kind must be call or put")
    return ql.Option.Call if kind == "call" else ql.Option.Put


def _comp(name):
    _need(name in COMP, f"compounding must be one of {', '.join(COMP)}")
    return COMP[name]


def _maturity(T):
    """Expiry date and day counter that give exactly T years for whole months."""
    _need(T > 0, "T must be positive")
    months = T * 12
    if abs(months - round(months)) < 1e-9:
        return TODAY + ql.Period(int(round(months)), ql.Months), ql.SimpleDayCounter()
    return TODAY + max(1, int(round(T * 365))), ql.Actual365Fixed()


# ------------------------------------------------------------------ options

def _black(kind, S, K, T, r, vol, q):
    _need(S > 0 and K > 0 and T > 0 and vol > 0, "S, K, T and vol must be positive")
    forward = S * math.exp((r - q) * T)
    return ql.BlackCalculator(ql.PlainVanillaPayoff(_option_type(kind), K), forward,
                              vol * math.sqrt(T), math.exp(-r * T))


@tool
def european_option(kind, S, K, T, r, vol, q=0.0):
    """Black-Scholes(-Merton) price; q is a continuous dividend yield."""
    return _black(kind, S, K, T, r, vol, q).value()


@tool
def delta(kind, S, K, T, r, vol, q=0.0):
    return _black(kind, S, K, T, r, vol, q).delta(S)


@tool
def gamma(kind, S, K, T, r, vol, q=0.0):
    return _black(kind, S, K, T, r, vol, q).gamma(S)


@tool
def vega(kind, S, K, T, r, vol, q=0.0):
    """Price change for a 1 percentage point rise in volatility."""
    return _black(kind, S, K, T, r, vol, q).vega(T) / 100


@tool
def theta(kind, S, K, T, r, vol, q=0.0):
    """Price change per calendar day."""
    return _black(kind, S, K, T, r, vol, q).thetaPerDay(S, T)


@tool
def rho(kind, S, K, T, r, vol, q=0.0):
    """Price change for a 1 percentage point rise in the interest rate."""
    return _black(kind, S, K, T, r, vol, q).rho(T) / 100


@tool
def implied_vol(kind, price, S, K, T, r, q=0.0):
    _need(price > 0 and S > 0 and K > 0 and T > 0, "price, S, K and T must be positive")
    forward, discount = S * math.exp((r - q) * T), math.exp(-r * T)
    try:
        sd = ql.blackFormulaImpliedStdDev(_option_type(kind), K, forward, price, discount)
    except RuntimeError as e:
        raise ValueError(f"no volatility gives that price ({str(e).splitlines()[0][:80]})")
    return sd / math.sqrt(T)


@tool
def black76_option(kind, F, K, T, r, vol):
    """Option on a futures or forward price F."""
    _need(F > 0 and K > 0 and T > 0 and vol > 0, "F, K, T and vol must be positive")
    return ql.BlackCalculator(ql.PlainVanillaPayoff(_option_type(kind), K), F, vol * math.sqrt(T),
                              math.exp(-r * T)).value()


@tool
def fx_option(kind, S, K, T, rd, rf, vol):
    """Garman-Kohlhagen: S is the spot exchange rate, rd and rf the domestic and foreign rates."""
    return european_option(kind, S, K, T, rd, vol, q=rf)


@tool
def american_option(kind, S, K, T, r, vol, q=0.0, steps=500):
    """Binomial (Cox-Ross-Rubinstein) tree."""
    _need(S > 0 and K > 0 and vol > 0 and 10 <= steps <= 5000, "S, K, vol must be positive; steps 10 to 5000")
    expiry, dc = _maturity(T)
    process = ql.BlackScholesMertonProcess(
        ql.QuoteHandle(ql.SimpleQuote(S)),
        ql.YieldTermStructureHandle(ql.FlatForward(TODAY, q, dc)),
        ql.YieldTermStructureHandle(ql.FlatForward(TODAY, r, dc)),
        ql.BlackVolTermStructureHandle(ql.BlackConstantVol(TODAY, ql.NullCalendar(), vol, dc)))
    option = ql.VanillaOption(ql.PlainVanillaPayoff(_option_type(kind), K), ql.AmericanExercise(TODAY, expiry))
    option.setPricingEngine(ql.BinomialVanillaEngine(process, "crr", int(steps)))
    return option.NPV()


# ------------------------------------------------------------------ rates

@tool
def convert_rate(rate, source, target):
    """Same growth, different compounding, e.g. QL.convert_rate(0.08, quarterly, continuous)."""
    r = ql.InterestRate(rate, ql.SimpleDayCounter(), *_comp(source))
    return r.equivalentRate(*_comp(target), 1.0).rate()


@tool
def discount_factor(rate, T, comp="continuous"):
    _need(T >= 0, "T must not be negative")
    return ql.InterestRate(rate, ql.SimpleDayCounter(), *_comp(comp)).discountFactor(T)


@tool
def forward_rate(r1, T1, r2, T2, comp="continuous"):
    """Forward rate between T1 and T2 implied by zero rates r1 (to T1) and r2 (to T2)."""
    _need(0 <= T1 < T2, "need 0 <= T1 < T2")
    growth = discount_factor(r1, T1, comp) / discount_factor(r2, T2, comp)
    return ql.InterestRate.impliedRate(growth, ql.SimpleDayCounter(), *_comp(comp), T2 - T1).rate()


@tool
def year_fraction(start, end, basis="act365"):
    """Dates as 'YYYY-MM-DD' strings."""
    counters = {"act365": ql.Actual365Fixed(), "act360": ql.Actual360(), "thirty360": BOND_DC}
    _need(basis in counters, "basis must be act365, act360 or thirty360")
    d1, d2 = (ql.DateParser.parseISO(d) for d in (start, end))
    return counters[basis].yearFraction(d1, d2)


# ------------------------------------------------------------------ bonds

def _bond(face, coupon, years, freq):
    _need(int(freq) in FREQ, "freq must be 1, 2, 4 or 12 payments a year")
    months = years * 12
    _need(face > 0 and months > 0 and abs(months - round(months)) < 1e-9, "years must be whole months")
    _need(round(months) % (12 // int(freq)) == 0, "years must be a whole number of coupon periods")
    schedule = ql.Schedule(TODAY, TODAY + ql.Period(int(round(months)), ql.Months), ql.Period(FREQ[int(freq)]),
                           ql.NullCalendar(), ql.Unadjusted, ql.Unadjusted, ql.DateGeneration.Backward, False)
    return ql.FixedRateBond(0, face, schedule, [coupon], BOND_DC)


def _yield(ytm, freq):
    return ql.InterestRate(ytm, BOND_DC, ql.Compounded, FREQ[int(freq)])


@tool
def bond_price(face, coupon, years, freq, ytm):
    """Price on a coupon date (no accrued interest); the yield compounds freq times a year."""
    return ql.BondFunctions.cleanPrice(_bond(face, coupon, years, freq), _yield(ytm, freq), TODAY) * face / 100


@tool
def bond_ytm(face, coupon, years, freq, price):
    bond, clean = _bond(face, coupon, years, freq), price * 100 / face
    try:
        return ql.BondFunctions.bondYield(bond, ql.BondPrice(clean, ql.BondPrice.Clean), BOND_DC,
                                          ql.Compounded, FREQ[int(freq)], TODAY)
    except (AttributeError, TypeError):                     # older QuantLib signature
        return ql.BondFunctions.bondYield(bond, clean, BOND_DC, ql.Compounded, FREQ[int(freq)], TODAY)


@tool
def bond_duration(face, coupon, years, freq, ytm, kind="modified"):
    _need(kind in ("modified", "macaulay"), "kind must be modified or macaulay")
    kind = ql.Duration.Modified if kind == "modified" else ql.Duration.Macaulay
    return ql.BondFunctions.duration(_bond(face, coupon, years, freq), _yield(ytm, freq), kind, TODAY)


@tool
def bond_convexity(face, coupon, years, freq, ytm):
    return ql.BondFunctions.convexity(_bond(face, coupon, years, freq), _yield(ytm, freq), TODAY)


@tool
def zero_bond_price(face, T, ytm, comp="annual"):
    return face * discount_factor(ytm, T, comp)


# ------------------------------------------------------------------ short-rate models

@tool
def vasicek_zcb(a, b, sigma, r, T, face=100):
    """Zero-coupon bond with T years left when the short rate is r. dr = a(b - r)dt + sigma dW."""
    _need(a > 0 and sigma > 0 and T > 0, "a, sigma and T must be positive")
    return face * ql.Vasicek(r, a, b, sigma).discountBond(0.0, T, r)


@tool
def cir_zcb(a, b, sigma, r, T, face=100):
    """Cox-Ingersoll-Ross: dr = a(b - r)dt + sigma sqrt(r) dW."""
    _need(a > 0 and b > 0 and sigma > 0 and r >= 0 and T > 0, "a, b, sigma, T positive and r not negative")
    return face * ql.CoxIngersollRoss(r, b, a, sigma).discountBond(0.0, T, r)


@tool
def simulate_quantile(model, a, b, sigma, r0, t, T, q, paths=100000, face=100, seed=7):
    """Monte Carlo: the q-quantile, at time t, of a zero-coupon bond maturing at T."""
    _need(model == "vasicek", "only the vasicek model can be simulated so far")
    _need(0 < t < T and 0 < q < 1 and 1000 <= paths <= 200000, "need 0 < t < T, 0 < q < 1, 1000 to 200000 paths")
    process, vas = ql.OrnsteinUhlenbeckProcess(a, sigma, r0, b), ql.Vasicek(r0, a, b, sigma)
    rng = random.Random(int(seed))
    prices = sorted(face * vas.discountBond(0.0, T - t, process.evolve(0.0, r0, t, rng.gauss(0, 1)))
                    for _ in range(int(paths)))
    return prices[int(q * len(prices))]


# ------------------------------------------------------------------ swaps on a flat curve

def _annuity(T, freq, rate, comp):
    n = T * freq
    _need(abs(n - round(n)) < 1e-9 and round(n) > 0, "T must be a whole number of payment periods")
    dfs = [discount_factor(rate, (i + 1) / freq, comp) for i in range(int(round(n)))]
    return sum(dfs) / freq, dfs[-1]


@tool
def swap_par_rate(T, freq, rate, comp="continuous"):
    annuity, last = _annuity(T, freq, rate, comp)
    return (1 - last) / annuity


@tool
def swap_value(notional, fixed, T, freq, rate, side="payer", comp="continuous"):
    """Value of a swap paying (payer) or receiving (receiver) the fixed rate, on a flat zero curve."""
    _need(side in ("payer", "receiver"), "side must be payer or receiver")
    annuity, last = _annuity(T, freq, rate, comp)
    value = notional * ((1 - last) - fixed * annuity)
    return value if side == "payer" else -value


@tool
def swap_dv01(notional, T, freq, rate, comp="continuous"):
    """Value change of the fixed leg for a 0.01% (1 basis point) change in the fixed rate."""
    return notional * _annuity(T, freq, rate, comp)[0] * 0.0001


# ------------------------------------------------------------------ risk

@tool
def var_normal(value, vol, conf, days=1):
    _need(0.5 < conf < 1 and vol > 0 and days > 0, "need 0.5 < conf < 1, vol > 0, days > 0")
    return value * vol * math.sqrt(days) * ql.InverseCumulativeNormal()(conf)


@tool
def es_normal(value, vol, conf, days=1):
    _need(0.5 < conf < 1 and vol > 0 and days > 0, "need 0.5 < conf < 1, vol > 0, days > 0")
    z = ql.InverseCumulativeNormal()(conf)
    return value * vol * math.sqrt(days) * ql.NormalDistribution()(z) / (1 - conf)


@tool
def var_historical(returns, conf, value=1):
    """The k-th worst loss, k = ceil((1 - conf) * n), scaled by the position value."""
    _need(isinstance(returns, list) and len(returns) >= 5, "returns must be a list of at least 5 numbers")
    _need(0.5 < conf < 1, "need 0.5 < conf < 1")
    losses = sorted((-x for x in returns), reverse=True)
    k = max(1, math.ceil((1 - conf) * len(losses) - 1e-9))
    return value * losses[k - 1]


# ------------------------------------------------------------------ the parser

def _arg(node):
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return float(node.value)
    if isinstance(node, ast.Constant) and isinstance(node.value, str) and len(node.value) <= 10:
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        v = _arg(node.operand)
        _need(isinstance(v, float), "only numbers can be negative")
        return -v
    if isinstance(node, ast.Name) and node.id in WORDS:
        return node.id
    if isinstance(node, ast.List) and len(node.elts) <= 400:
        values = [_arg(e) for e in node.elts]
        _need(all(isinstance(v, float) for v in values), "lists may only hold numbers")
        return values
    raise ValueError("arguments must be numbers, lists of numbers, dates or words such as call and put")


def call(expr: str) -> float:
    """Run one tool call written as text, e.g. 'QL.vega(call, S=100, K=100, T=1, r=0.05, vol=0.2)'."""
    node = ast.parse(expr.strip(), mode="eval").body
    _need(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
          and isinstance(node.func.value, ast.Name) and node.func.value.id == "QL", "expected QL.tool_name(...)")
    _need(node.func.attr in TOOLS, f"unknown QuantLib tool: {node.func.attr}")
    args = [_arg(x) for x in node.args]
    kwargs = {k.arg: _arg(k.value) for k in node.keywords}
    _need(None not in kwargs, "**arguments are not allowed")
    try:
        value = TOOLS[node.func.attr](*args, **kwargs)
    except TypeError as e:
        raise ValueError(f"wrong arguments for {node.func.attr}: {e}")
    except RuntimeError as e:                                  # QuantLib's own errors
        raise ValueError(f"QuantLib could not compute this: {str(e).splitlines()[0][:100]}")
    value = float(value)
    _need(math.isfinite(value), "result is not a finite number")
    return value


if __name__ == "__main__":
    def near(x, want, tol):
        assert abs(x - want) <= tol, (x, want)

    near(call("QL.european_option(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)"), 5.0090, 5e-4)
    near(call("QL.american_option(put, S=50, K=52, T=1, r=0.06, vol=0.3, steps=500)"), 5.819, 5e-4)
    near(call("QL.european_option(put, S=50, K=52, T=1, r=0.06, vol=0.3)"), 5.4004, 5e-4)
    c = european_option("call", 100, 95, 0.75, 0.05, 0.25, 0.01)
    p = european_option("put", 100, 95, 0.75, 0.05, 0.25, 0.01)
    near(c - p, 100 * math.exp(-0.01 * 0.75) - 95 * math.exp(-0.05 * 0.75), 1e-9)          # put-call parity
    near(implied_vol("call", european_option("call", 100, 105, 0.5, 0.07, 0.2), 100, 105, 0.5, 0.07), 0.2, 1e-6)
    h = 1e-4                                                                                  # Greeks vs finite differences
    up, down = (european_option("call", 100, 105, 0.5, 0.07, 0.2 + s) for s in (h, -h))
    near(vega("call", 100, 105, 0.5, 0.07, 0.2), (up - down) / (2 * h) / 100, 1e-6)
    up, down = (european_option("call", 100 + s, 105, 0.5, 0.07, 0.2) for s in (h, -h))
    near(delta("call", 100, 105, 0.5, 0.07, 0.2), (up - down) / (2 * h), 1e-6)
    near(call("QL.bond_price(face=1000, coupon=0.08, years=5, freq=1, ytm=0.075)"), 1020.2294, 1e-3)
    near(call("QL.bond_duration(face=1000, coupon=0.08, years=5, freq=1, ytm=0.075, kind=modified)"), 4.0183, 1e-4)
    near(bond_ytm(1000, 0.08, 5, 1, 1020.2294), 0.075, 1e-6)
    near(bond_price(100, 0.06, 2, 2, 0.06), 100.0, 1e-9)                                     # priced at par
    near(call("QL.vasicek_zcb(a=0.15, b=0.06, sigma=0.01, r=0.05, T=3)"), 85.5973, 1e-3)
    near(call("QL.simulate_quantile(vasicek, a=0.15, b=0.06, sigma=0.01, r0=0.05, t=1, T=3, q=0.01)"), 86.73, 0.05)
    near(call("QL.convert_rate(0.08, quarterly, continuous)"), 4 * math.log(1.02), 1e-9)
    near(call("QL.forward_rate(0.05, 1, 0.06, 2)"), 0.07, 1e-9)
    near(swap_par_rate(5, 1, 0.05), (1 - math.exp(-0.25)) / sum(math.exp(-0.05 * i) for i in range(1, 6)), 1e-12)
    near(swap_value(1e6, swap_par_rate(5, 1, 0.05), 5, 1, 0.05), 0.0, 1e-6)                 # par swap is worth 0
    near(call("QL.var_normal(value=1000000, vol=0.012, conf=0.99)"), 27916.2, 0.1)
    near(call("QL.var_historical([0.01, -0.02, 0.005, -0.04, 0.03, -0.01, 0.02, -0.03, 0.0, 0.015], 0.9, 100000)"),
         4000, 1e-6)                                                                        # worst of 10 at 90% (Hull: k = (1 - conf) n)
    near(call("QL.year_fraction('2026-01-15', '2026-07-15', act360)"), 181 / 360, 1e-12)
    a_, b_, s_, r_, T_ = 0.2, 0.05, 0.1, 0.04, 2.0                                           # CIR closed form
    h = math.sqrt(a_ ** 2 + 2 * s_ ** 2)
    den = (h + a_) * (math.exp(h * T_) - 1) + 2 * h
    A = (2 * h * math.exp((a_ + h) * T_ / 2) / den) ** (2 * a_ * b_ / s_ ** 2)
    near(cir_zcb(a_, b_, s_, r_, T_), 100 * A * math.exp(-2 * (math.exp(h * T_) - 1) / den * r_), 1e-8)
    refused = 0
    for bad in ["__import__('os')", "QL.system('ls')", "QL.european_option(call, S=__import__('os'))",
                "QL.european_option(kind, S=1, K=1, T=1, r=0, vol=0.2)", "QL.bond_price(**{})",
                "QL.european_option(call, S=-100, K=105, T=0.5, r=0.07, vol=0.2)"]:
        try:
            call(bad)
        except (ValueError, SyntaxError):
            refused += 1
    assert refused == 6, refused
    print(f"QuantLib tools: {len(TOOLS)} tools, all checks passed, {refused} bad calls refused")
