"""Quant problems built from parts, with written-out thinking.

Each problem has a target task (price a European put, a bond's duration, a Vasicek bond...)
whose inputs can be *disguised*: instead of the volatility, the question gives the price of
another option on the same stock, so the solver must first back out the implied volatility.
Disguises are the parts. Combining them in new ways makes problem structures the model has
never seen, which tests reasoning (level 3) rather than memory.

Every solution is written the way the model should think:
    <think> Goal / Known / Need / Plan </think>, the work with tool calls, a Check, #### answer
Every number comes from running the real tools (our calculator and QuantLib) while the
solution is written, so no answer can be wrong.

Splits:
    train   training wordings, up to 2 disguises, never a held-out (target, disguise) pair;
            about 12% contain a deliberate slip that the solver notices and fixes
    level1  new numbers, no disguises, training wordings
    level2  the held-out wording of every sentence, at most 1 disguise
    level3  a held-out (target, disguise) pair, or three disguises at once

    python quantgen.py            # print examples
    python quantgen.py --check    # generate and verify every split
"""
import math
import random
import sys

import tools

HELD_OUT_PAIRS = {("american", "vol_implied"), ("greek", "S_futures"), ("swap_par", "r_zero_bond"),
                  ("bond_duration", "ytm_continuous"), ("option_price", "T_calendar_days")}
COMP_WORDS = {"annual": "once a year", "semiannual": "twice a year", "quarterly": "quarterly", "monthly": "monthly"}
FREQ_COMP = {1: "annual", 2: "semiannual", 4: "quarterly", 12: "monthly"}


class Retry(Exception):
    """Raised when random inputs give an unusable problem; the builder draws again."""


# ------------------------------------------------------------------ number formatting

def num(x):
    """How numbers appear in questions: at most 2 decimals."""
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.2f}".rstrip("0").rstrip(".")


def dec(x):
    """How rates appear inside tool calls: 0.075, 0.0126."""
    return f"{x:.6f}".rstrip("0").rstrip(".")


def pct(x):
    return num(x * 100) + "%"


def indian(s):
    whole, _, frac = s.partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        whole = ",".join(([head] if head else []) + groups + [tail])
    return whole + ("." + frac if frac else "")


def months_adj(m):
    return f"{m // 12}-year" if m % 12 == 0 else f"{m}-month"


def months_noun(m):
    if m % 12 == 0:
        y = m // 12
        return f"{y} year" + ("s" if y > 1 else "")
    return "1 month" if m == 1 else f"{m} months"


class Work:
    """The solution's working: text plus tool calls that really run."""

    def __init__(self):
        self.out = []

    def say(self, s):
        self.out.append(s)

    def tool(self, expr):
        try:
            res = tools.run_tool(expr)
        except (ValueError, SyntaxError, ZeroDivisionError, OverflowError) as e:
            raise Retry(str(e))
        self.out.append(f"<<{expr}={res}")
        return res.split(">>")[0]

    def text(self):
        return "".join(self.out)


class Gen:
    """State for one problem: chosen disguises, the question's facts, and the thinking."""

    def __init__(self, R, wording, want, slip):
        self.R, self.wording, self.want, self.slip = R, wording, set(want), slip
        self.facts, self.known, self.need, self.plan = [], [], [], []
        self.used, self.w = [], Work()
        self.vals = {}
        self.slipped = None

    def pick(self, phrases):
        return phrases[-1] if self.wording == "heldout" else self.R.choice(phrases[:-1])

    def rupees(self, x):
        s = num(x)
        return "₹" + (indian(s) if x >= 10000 and self.R.random() < 0.4 else s)

    def uses(self, name):
        if name in self.want:
            self.used.append(name)
            return True
        return False

    # -------------------------------------------------------------- slots: inputs that may be disguised

    def slot_T(self, months):
        """Returns (adjective for the question, clause for the question). Sets vals['T']."""
        R, w = self.R, self.w
        if self.uses("T_trading_days"):
            days = months * 21
            self.known.append(f"{days} trading days to expiry")
            self.plan.append("turn trading days into years (252 a year)")
            w.say(f"T = {days} / 252 = ")
            self.vals["T"] = w.tool(f"{days}/252")
            w.say(" years.\n")
            return "", self.pick([f" expiring in {days} trading days (252 trading days a year)",
                                  f" with {days} trading days to expiry (a year has 252)",
                                  f" that expires after {days} trading days, out of 252 a year",
                                  f" lasting {days} trading days (252 per year)"])
        if self.uses("T_calendar_days"):
            days = round(months / 12 * 365) + R.choice([-1, 0, 1])
            self.known.append(f"{days} days to expiry")
            self.plan.append("turn calendar days into years (365 a year)")
            w.say(f"T = {days} / 365 = ")
            self.vals["T"] = w.tool(f"{days}/365")
            w.say(" years.\n")
            return "", self.pick([f" expiring in {days} days", f" with {days} days to expiry",
                                  f" that expires {days} days from today", f" maturing in {days} days"])
        self.known.append(f"T = {months_noun(months)}")
        if self.slip == "months_as_years" and months % 12:
            self.vals["T"] = tools.run_tool(f"{months}/12").split(">>")[0]
            self.slipped = ("months_as_years", str(months), f"{months}/12")
            return months_adj(months) + " ", ""
        if months % 12 == 0:
            self.vals["T"] = str(months // 12)
        else:
            w.say(f"T = {months} / 12 = ")
            self.vals["T"] = w.tool(f"{months}/12")
            w.say(" years.\n")
        return months_adj(months) + " ", ""

    def slot_r(self, label="risk-free rate"):
        R, w = self.R, self.w
        if self.uses("r_compounded"):
            nominal = R.randrange(8, 41) / 400                       # 2% to 10% in steps of 0.25%
            comp = R.choice(list(COMP_WORDS))
            self.facts.append(self.pick([f"The {label} is {pct(nominal)} a year, compounded {COMP_WORDS[comp]}.",
                                         f"Money earns {pct(nominal)} a year risk-free, compounded {COMP_WORDS[comp]}.",
                                         f"Use a {label} of {pct(nominal)}, compounded {COMP_WORDS[comp]}.",
                                         f"Interest is {pct(nominal)} per year with {comp} compounding.",
                                         f"Risk-free money grows at {pct(nominal)} a year, compounded {COMP_WORDS[comp]}."]))
            self.known.append(f"r = {pct(nominal)} compounded {COMP_WORDS[comp]}")
            self.need.append("a continuously compounded rate")
            self.plan.append("convert the rate to continuous compounding")
            if self.slip == "rate_not_converted":
                expr = f"QL.convert_rate({dec(nominal)}, {comp}, continuous)"
                self.vals["r"] = tools.run_tool(expr).split(">>")[0]
                self.slipped = ("rate_not_converted", dec(nominal), comp, expr)
                return
            w.say("r = ")
            self.vals["r"] = w.tool(f"QL.convert_rate({dec(nominal)}, {comp}, continuous)")
            w.say(" (continuous).\n")
            return
        if self.uses("r_zero_bond"):
            r = R.randrange(8, 41) / 400
            tz = R.choice([0.5, 1, 2])
            price = round(100 * math.exp(-r * tz), 2)
            tz_text = {0.5: "6-month", 1: "1-year", 2: "2-year"}[tz]
            self.facts.append(self.pick([f"A {tz_text} zero-coupon government bond paying ₹100 costs ₹{num(price)}.",
                                         f"A {tz_text} risk-free zero-coupon bond with face value ₹100 trades at ₹{num(price)}.",
                                         f"Risk-free zero-coupon bonds paying ₹100 in {months_noun(int(tz * 12))} cost ₹{num(price)}.",
                                         f"₹{num(price)} buys a {tz_text} government zero-coupon bond that pays ₹100.",
                                         f"The {tz_text} government zero-coupon bond (₹100 face) is priced at ₹{num(price)}."]))
            self.known.append(f"a {tz_text} zero-coupon bond costs {num(price)} per 100")
            self.need.append("the risk-free rate, hidden in the zero-coupon bond's price")
            self.plan.append("get the continuous rate from the zero-coupon bond")
            w.say("r = -ln(P / 100) / T = ")
            self.vals["r"] = w.tool(f"-ln({num(price)}/100)/{num(tz)}")
            w.say(" (continuous).\n")
            return
        r = R.randrange(8, 41) / 400
        self.facts.append(self.pick([f"The {label} is {pct(r)} a year, continuously compounded.",
                                     f"The continuously compounded {label} is {pct(r)}.",
                                     f"Use a {label} of {pct(r)} with continuous compounding.",
                                     f"Risk-free money earns {pct(r)} a year, compounded continuously.",
                                     f"Take {pct(r)} a year (continuous compounding) as the {label}."]))
        self.known.append(f"r = {pct(r)} (continuous)")
        self.vals["r"] = dec(r)

    def slot_S(self):
        R, w = self.R, self.w
        if self.uses("S_move"):
            s0 = R.randrange(20, 1500)
            g = R.randrange(5, 51) / 1000 * R.choice([1, -1])
            moved = "rose" if g > 0 else "fell"
            moved_pp = "risen" if g > 0 else "fallen"
            self.facts.append(self.pick([f"The stock closed at ₹{s0} yesterday and {moved} {pct(abs(g))} today.",
                                         f"Yesterday the stock ended at ₹{s0}; today it {moved} {pct(abs(g))}.",
                                         f"After closing at ₹{s0}, the stock {moved} {pct(abs(g))} this morning.",
                                         f"The share price was ₹{s0} at yesterday's close and has {moved_pp} {pct(abs(g))} since.",
                                         f"From ₹{s0} at yesterday's close, the share {moved} by {pct(abs(g))}."]))
            self.known.append(f"yesterday's price {s0}, then {'+' if g > 0 else '-'}{pct(abs(g))}")
            self.plan.append("find today's stock price")
            w.say(f"S = {s0} * (1 {'+' if g > 0 else '-'} {dec(abs(g))}) = ")
            self.vals["S"] = w.tool(f"{s0}*(1{'+' if g > 0 else '-'}{dec(abs(g))})")
            w.say(".\n")
            return
        if self.uses("S_futures"):
            s_true = R.randrange(20, 1500)
            fm = R.choice([1, 2, 3, 6])
            F = round(s_true * math.exp(float(self.vals["r"]) * fm / 12), 2)
            self.facts.append(self.pick([f"Its {fm}-month futures price is ₹{num(F)}, and the stock pays no dividends.",
                                         f"The {fm}-month futures contract on the stock trades at ₹{num(F)} (no dividends).",
                                         f"Futures on the stock for delivery in {fm} months cost ₹{num(F)}; there are no dividends.",
                                         f"The stock pays no dividends, and its {fm}-month futures price is ₹{num(F)}.",
                                         f"A {fm}-month futures on this non-dividend stock is quoted at ₹{num(F)}."]))
            self.known.append(f"{fm}-month futures price {num(F)}")
            self.need.append("today's stock price, hidden in the futures price")
            self.plan.append("get the stock price from the futures price")
            w.say(f"S = F * exp(-r * T) = ")
            self.vals["S"] = w.tool(f"{num(F)}*exp(-{self.vals['r']}*{fm}/12)")
            w.say(".\n")
            return
        S = R.randrange(20, 1500)
        self.facts.append(self.pick([f"A stock trades at ₹{S}.", f"The share price is ₹{S}.",
                                     f"A share currently costs ₹{S}.", f"The stock is at ₹{S} today.",
                                     f"Shares of the company sell for ₹{S}."]))
        self.known.append(f"S = {S}")
        self.vals["S"] = str(S)

    def slot_K(self):
        """Returns the strike phrase for the question. Sets vals['K']."""
        R, w = self.R, self.w
        S = float(self.vals["S"])
        if self.uses("K_moneyness"):
            m = R.choice([-0.1, -0.05, -0.02, 0.02, 0.05, 0.1])
            side = "above" if m > 0 else "below"
            self.known.append(f"K = {pct(abs(m))} {side} S")
            self.plan.append("work out the strike from the stock price")
            w.say(f"K = S * (1 {'+' if m > 0 else '-'} {dec(abs(m))}) = ")
            self.vals["K"] = w.tool(f"{self.vals['S']}*(1{'+' if m > 0 else '-'}{dec(abs(m))})")
            w.say(".\n")
            return self.pick([f"with a strike {pct(abs(m))} {side} today's stock price",
                              f"struck {pct(abs(m))} {side} the current share price",
                              f"whose strike is {pct(abs(m))} {side} the stock price",
                              f"with its strike set {pct(abs(m))} {side} the spot price",
                              f"with a strike price {pct(abs(m))} {side} where the stock is now"])
        K = max(5, round(S * R.uniform(0.8, 1.2) / 5) * 5) if S >= 50 else round(S * R.uniform(0.8, 1.2))
        self.known.append(f"K = {num(K)}")
        self.vals["K"] = num(K)
        return self.pick([f"with strike ₹{num(K)}", f"struck at ₹{num(K)}", f"with a strike price of ₹{num(K)}",
                          f"at a strike of ₹{num(K)}", f"whose strike is ₹{num(K)}"])

    def slot_vol(self):
        R, w = self.R, self.w
        vol = R.randrange(10, 61) / 100
        if self.uses("vol_daily"):
            daily = round(vol / math.sqrt(252), 4)
            self.facts.append(self.pick([f"Its daily volatility is {pct(daily)}.", f"The stock's volatility is {pct(daily)} per day.",
                                         f"Daily returns have a volatility of {pct(daily)}.", f"It moves with {pct(daily)} daily volatility.",
                                         f"The standard deviation of its daily returns is {pct(daily)}."]))
            self.known.append(f"daily vol = {pct(daily)}")
            self.need.append("the yearly volatility")
            self.plan.append("annualize the daily volatility (252 trading days)")
            if self.slip == "daily_vol":
                expr = f"{dec(daily)}*sqrt(252)"
                self.vals["vol"] = tools.run_tool(expr).split(">>")[0]
                self.slipped = ("daily_vol", dec(daily), expr)
                return
            w.say("vol = daily vol * sqrt(252) = ")
            self.vals["vol"] = w.tool(f"{dec(daily)}*sqrt(252)")
            w.say(".\n")
            return
        if self.uses("vol_variance"):
            var = round(vol * vol, 4)
            self.facts.append(self.pick([f"The variance of its yearly returns is {dec(var)}.",
                                         f"Its annual return variance is {dec(var)}.",
                                         f"Yearly returns on the stock have a variance of {dec(var)}.",
                                         f"The stock's returns have variance {dec(var)} per year.",
                                         f"Measured yearly, the variance of its returns is {dec(var)}."]))
            self.known.append(f"variance = {dec(var)}")
            self.need.append("the volatility, which is the square root of the variance")
            self.plan.append("take the square root of the variance")
            w.say("vol = sqrt(variance) = ")
            self.vals["vol"] = w.tool(f"sqrt({dec(var)})")
            w.say(".\n")
            return
        if self.uses("vol_implied"):
            S = float(self.vals["S"])
            kind2 = R.choice(["call", "put"])
            K2 = max(5, round(S * R.uniform(0.9, 1.1) / 5) * 5) if S >= 50 else round(S * R.uniform(0.9, 1.1))
            import qltools
            p2 = round(qltools.european_option(kind2, S, K2, float(self.vals["T"]), float(self.vals["r"]), vol), 2)
            if p2 < 0.5:
                raise Retry("market price too small")
            self.facts.append(self.pick([f"A European {kind2} on the same stock, same expiry, strike ₹{num(K2)}, trades at ₹{num(p2)}.",
                                         f"The market prices a European {kind2} with the same expiry and strike ₹{num(K2)} at ₹{num(p2)}.",
                                         f"With the same expiry, a European {kind2} struck at ₹{num(K2)} costs ₹{num(p2)}.",
                                         f"A same-expiry European {kind2} with strike ₹{num(K2)} is quoted at ₹{num(p2)}.",
                                         f"On the same stock and expiry, the ₹{num(K2)} European {kind2} sells for ₹{num(p2)}."]))
            self.known.append(f"a {kind2} with K = {num(K2)} costs {num(p2)}")
            self.need.append("the volatility, hidden in the market price of the other option")
            self.plan.append(f"back out the implied volatility from the {kind2}'s price")
            w.say("vol = ")
            self.vals["vol"] = w.tool(f"QL.implied_vol({kind2}, price={num(p2)}, S={self.vals['S']}, K={num(K2)}, "
                                      f"T={self.vals['T']}, r={self.vals['r']})")
            w.say(" (implied).\n")
            return
        self.facts.append(self.pick([f"Its volatility is {pct(vol)} a year.", f"The stock's annual volatility is {pct(vol)}.",
                                     f"Volatility is {pct(vol)} per year.", f"Take the volatility as {pct(vol)} a year.",
                                     f"The stock has a yearly volatility of {pct(vol)}."]))
        self.known.append(f"vol = {pct(vol)}")
        self.vals["vol"] = dec(vol)


def neg(x):
    """The negative of a number written as text: '-0.12' -> '0.12', '0.3' -> '-0.3'."""
    return x[1:] if x.startswith("-") else "-" + x


def think(g, goal):
    lines = [f"Goal: {goal}.", "Known: " + ", ".join(g.known) + "."]
    if g.need:
        lines.append("Need: " + "; ".join(g.need) + ".")
    lines.append("Plan: " + " ".join(f"{i}) {p}" for i, p in enumerate(g.plan, 1)))
    return "<think>\n" + "\n".join(lines) + "\n</think>\n"


def option_args(g, kind, **override):
    v = dict(g.vals, **override)
    return f"{kind}, S={v['S']}, K={v['K']}, T={v['T']}, r={v['r']}, vol={v['vol']}"


def apply_slip(g, kind):
    """Write a wrong first attempt, notice the mistake and say how to fix it. Returns True if written."""
    if not g.slipped:
        return False
    w, s = g.w, g.slipped
    if s[0] == "rate_not_converted":
        w.say("Price = ")
        w.tool(f"QL.european_option({option_args(g, kind, r=s[1])})")
        w.say(f"\nWait: {s[1]} is compounded {COMP_WORDS[s[2]]}, but Black-Scholes needs a continuous rate.\nr = ")
        w.tool(s[3])
        w.say(" (continuous). Redo with it.\n")
    elif s[0] == "daily_vol":
        w.say("Price = ")
        w.tool(f"QL.european_option({option_args(g, kind, vol=s[1])})")
        w.say(f"\nWait: {s[1]} is the daily volatility, and the formula needs the yearly one.\nvol = daily vol * sqrt(252) = ")
        w.tool(s[2])
        w.say(". Redo.\n")
    elif s[0] == "months_as_years":
        w.say("Price = ")
        w.tool(f"QL.european_option({option_args(g, kind, T=s[1])})")
        w.say(f"\nWait: T must be in years.\nT = {s[1]} / 12 = ")
        w.tool(s[2])
        w.say(" years. Redo.\n")
    elif s[0] == "swap_SK":
        w.say("Price = ")
        w.tool(f"QL.european_option({option_args(g, kind, S=g.vals['K'], K=g.vals['S'])})")
        w.say(f"\nWait: I swapped S and K. The stock is at {g.vals['S']} and the strike is {g.vals['K']}. Redo.\n")
    else:
        return False
    return True


def option_bounds_check(g, kind, price):
    w, v = g.w, g.vals
    w.say("Check: K * exp(-r * T) = ")
    pv = w.tool(f"{v['K']}*exp(-{v['r']}*{v['T']})")
    if kind == "call":
        w.say(". A call is worth between max(S - K * exp(-r * T), 0) = ")
        lo = w.tool(f"max({v['S']}-{pv}, 0)")
        w.say(f" and S = {v['S']}")
        ok = float(lo) - 0.01 <= float(price) <= float(v["S"]) + 0.01
    else:
        w.say(". A put is worth between max(K * exp(-r * T) - S, 0) = ")
        lo = w.tool(f"max({pv}-{v['S']}, 0)")
        w.say(f" and K * exp(-r * T) = {pv}")
        ok = float(lo) - 0.01 <= float(price) <= float(pv) + 0.01
    if not ok:
        raise Retry("price outside bounds")
    w.say(f"; {price} is inside.\n")


# ------------------------------------------------------------------ targets: options

def option_inputs(g, months, with_vol=True):
    g.slot_r()
    tadj, tcl = g.slot_T(months)
    g.slot_S()
    kphrase = g.slot_K()
    if with_vol:
        g.slot_vol()
    return tadj, tcl, kphrase


def t_option_price(g):
    R, w = g.R, g.w
    kind = R.choice(["call", "put"])
    months = R.choice([1, 2, 3, 6, 9, 12, 18, 24])
    if g.slip == "swap_SK":
        g.slipped = ("swap_SK",)
    tadj, tcl, kph = option_inputs(g, months)
    g.plan.append(f"price the European {kind} with Black-Scholes (no dividends)")
    g.plan.append("check the no-arbitrage bounds")
    apply_slip(g, kind)
    if not g.used and R.random() < 0.3:                        # sometimes show the formula itself
        v = g.vals
        w.say("d1 = (ln(S/K) + (r + vol^2/2) * T) / (vol * sqrt(T)) = ")
        d1 = w.tool(f"(ln({v['S']}/{v['K']})+({v['r']}+{v['vol']}^2/2)*{v['T']})/({v['vol']}*sqrt({v['T']}))")
        w.say("\nd2 = d1 - vol * sqrt(T) = ")
        d2 = w.tool(f"{d1}-{v['vol']}*sqrt({v['T']})")
        if kind == "call":
            w.say("\nPrice = S * N(d1) - K * exp(-r * T) * N(d2) = ")
            w.tool(f"{v['S']}*N({d1})-{v['K']}*exp(-{v['r']}*{v['T']})*N({d2})")
        else:
            w.say("\nPrice = K * exp(-r * T) * N(-d2) - S * N(-d1) = ")
            w.tool(f"{v['K']}*exp(-{v['r']}*{v['T']})*N({neg(d2)})-{v['S']}*N({neg(d1)})")
        w.say("\nWith QuantLib: ")
    else:
        w.say("Price = ")
    price = w.tool(f"QL.european_option({option_args(g, kind)})")
    w.say("\n")
    ask = g.pick([f"What is a {tadj}European {kind}{tcl} {kph} worth?",
                  f"Find the price of a {tadj}European {kind} option{tcl} {kph}.",
                  f"How much should a {tadj}European {kind}{tcl} {kph} cost?",
                  f"Price a {tadj}European {kind}{tcl} {kph}.",
                  f"What premium would you pay for a {tadj}European {kind}{tcl} {kph}?"])
    answer, goal = price, f"the price of a European {kind}"
    extra = R.random()
    if extra < 0.12:
        n = R.choice([25, 50, 75, 100, 500])
        ask += g.pick([f" What do {n} of these options cost?", f" How much do {n} such options cost in total?",
                       f" Then find the cost of {n} options.", f" What is the total for {n} options?",
                       f" And what would a lot of {n} options cost?"])
        g.plan.insert(-1, f"multiply by {n} options")
        w.say(f"Cost of {n} = ")
        answer = w.tool(f"{n}*{price}")
        w.say(".\n")
        goal = f"the cost of {n} European {kind}s"
    elif extra < 0.22:
        sign = "+" if kind == "call" else "-"
        ask += g.pick([" At what stock price at expiry does the buyer break even?",
                       " What stock price at expiry makes the buyer break even?",
                       " Where must the stock end for the buyer to break even?",
                       " Find the break-even stock price at expiry.",
                       " Which expiry price lets the buyer recover the premium exactly?"])
        g.plan.insert(-1, f"break-even = K {sign} premium")
        w.say(f"Break-even = K {sign} premium = ")
        answer = w.tool(f"{g.vals['K']}{sign}{price}")
        w.say(".\n")
        goal = f"the break-even price for a bought European {kind}"
    option_bounds_check(g, kind, price)
    return goal, ask, answer


def t_greek(g):
    R, w = g.R, g.w
    kind = R.choice(["call", "put"])
    greek = R.choice(["delta", "gamma", "vega", "theta", "rho"])
    unit = {"vega": " (per 1% change in volatility)", "theta": " (per day)", "rho": " (per 1% change in the rate)"}.get(greek, "")
    months = R.choice([1, 3, 6, 9, 12, 24])
    tadj, tcl, kph = option_inputs(g, months)
    g.plan.append(f"compute the {greek} with Black-Scholes")
    g.plan.append("check it")
    w.say(f"{greek.capitalize()} = ")
    val = w.tool(f"QL.{greek}({option_args(g, kind)})")
    w.say("\n")
    x = float(val)
    if greek == "delta":
        lo, hi = (0, 1) if kind == "call" else (-1, 0)
        w.say(f"Check: a {kind}'s delta lies between {lo} and {hi}; {val} does.\n")
        ok = lo <= x <= hi
    elif greek in ("gamma", "vega"):
        w.say(f"Check: {greek} is positive for any bought option; {val} is.\n")
        ok = x > 0
    elif greek == "rho":
        w.say(f"Check: a {kind}'s rho is {'positive' if kind == 'call' else 'negative'}; {val} is.\n")
        ok = (x > 0) == (kind == "call")
    else:
        if float(g.vals["T"]) <= 1 / 365 + 1e-9:
            raise Retry("too short for a one-day check")
        w.say("Check: price with one day less, minus today's price = ")
        a = w.tool(f"QL.european_option({option_args(g, kind, T=dec(float(g.vals['T']) - 1 / 365))})")
        w.say(" - ")
        b = w.tool(f"QL.european_option({option_args(g, kind)})")
        w.say(" = ")
        diff = w.tool(f"{a}-{b}")
        w.say(f", close to {val}.\n")
        ok = abs(float(diff) - x) <= max(0.02, abs(x) * 0.2)
    if not ok:
        raise Retry("greek check failed")
    ask = g.pick([f"What is the {greek}{unit} of a {tadj}European {kind}{tcl} {kph}?",
                  f"Find the {greek}{unit} of a {tadj}European {kind} option{tcl} {kph}.",
                  f"Compute the {greek}{unit} for a {tadj}European {kind}{tcl} {kph}.",
                  f"How large is the {greek}{unit} of a {tadj}European {kind}{tcl} {kph}?",
                  f"Work out the {greek}{unit} of a {tadj}European {kind}{tcl} {kph}."])
    return f"the {greek} of a European {kind}", ask, val


def t_american(g):
    R, w = g.R, g.w
    kind = R.choice(["put", "put", "call"])
    months = R.choice([3, 6, 9, 12, 18, 24])
    q = R.choice([0, 0, 0.02, 0.03, 0.05]) if kind == "call" else R.choice([0, 0, 0, 0.02])
    tadj, tcl, kph = option_inputs(g, months)
    if q:
        g.facts.append(g.pick([f"The stock pays a continuous dividend yield of {pct(q)}.",
                               f"Its dividend yield is {pct(q)} a year, paid continuously.",
                               f"Assume a {pct(q)} continuous dividend yield.",
                               f"Dividends: {pct(q)} a year as a continuous yield.",
                               f"The shares yield {pct(q)} a year in dividends, continuously."]))
        g.known.append(f"q = {pct(q)}")
    qa = f", q={dec(q)}" if q else ""
    if kind == "call" and not q:
        g.plan.append("an American call on a stock without dividends is never exercised early, "
                      "so it is worth the European call")
        g.plan.append("check that the price is at least the exercise value")
        w.say("No dividends, so early exercise never pays: American call = European call = ")
        price = w.tool(f"QL.european_option({option_args(g, kind)})")
        w.say("\nCheck: a tree gives ")
        tree = w.tool(f"QL.american_option({option_args(g, kind)}, steps=500)")
        w.say(f", the same to about two decimals.\n")
        if abs(float(tree) - float(price)) > 0.02 + 0.002 * float(price):
            raise Retry("tree mismatch")
    else:
        g.plan.append("an American option can be exercised early, so use a binomial tree")
        g.plan.append("check it against the European price")
        w.say("American price (binomial tree, 500 steps) = ")
        price = w.tool(f"QL.american_option({option_args(g, kind)}{qa}, steps=500)")
        w.say("\nCheck: European price = ")
        eu = w.tool(f"QL.european_option({option_args(g, kind)}{qa})")
        w.say(f". The American price must be at least this; the early-exercise value is ")
        prem = w.tool(f"{price}-{eu}")
        w.say(".\n")
        if float(prem) < -0.01:
            raise Retry("american below european")
    ask = g.pick([f"What is a {tadj}American {kind}{tcl} {kph} worth?",
                  f"Find the price of a {tadj}American {kind} option{tcl} {kph}.",
                  f"How much is a {tadj}American {kind}{tcl} {kph} worth today?",
                  f"Price a {tadj}American {kind}{tcl} {kph}.",
                  f"What should a {tadj}American-style {kind}{tcl} {kph} cost?"])
    return f"the price of an American {kind}", ask, price


def t_implied_vol(g):
    R, w = g.R, g.w
    kind = R.choice(["call", "put"])
    months = R.choice([1, 3, 6, 9, 12])
    tadj, tcl, kph = option_inputs(g, months, with_vol=False)
    import qltools
    vol = R.randrange(10, 61) / 100
    price = round(qltools.european_option(kind, float(g.vals["S"]), float(g.vals["K"]), float(g.vals["T"]),
                                          float(g.vals["r"]), vol), 2)
    if price < 0.5:
        raise Retry("price too small")
    g.known.append(f"market price = {num(price)}")
    g.plan.append("solve Black-Scholes for the volatility that gives the market price")
    g.plan.append("reprice with it")
    w.say("Implied vol = ")
    iv = w.tool(f"QL.implied_vol({kind}, price={num(price)}, S={g.vals['S']}, K={g.vals['K']}, T={g.vals['T']}, r={g.vals['r']})")
    w.say("\nCheck: repricing with it gives ")
    back = w.tool(f"QL.european_option({option_args(g, kind, vol=iv)})")
    w.say(f", the market price {num(price)}.\n")
    if abs(float(back) - price) > 0.02 + 0.002 * price:
        raise Retry("reprice mismatch")
    ask = g.pick([f"A {tadj}European {kind}{tcl} {kph} trades at ₹{num(price)}. What volatility does that price imply?",
                  f"What is the implied volatility of a {tadj}European {kind}{tcl} {kph} priced at ₹{num(price)}?",
                  f"Find the implied volatility if a {tadj}European {kind}{tcl} {kph} costs ₹{num(price)}.",
                  f"The market price of a {tadj}European {kind}{tcl} {kph} is ₹{num(price)}. Find its implied volatility.",
                  f"Which volatility makes a {tadj}European {kind}{tcl} {kph} worth exactly ₹{num(price)}?"])
    return f"the implied volatility of a European {kind}", ask, iv


def t_parity(g):
    R, w = g.R, g.w
    months = R.choice([1, 3, 6, 9, 12])
    tadj, tcl, kph = option_inputs(g, months, with_vol=False)
    import qltools
    vol = R.randrange(10, 61) / 100
    c = round(qltools.european_option("call", float(g.vals["S"]), float(g.vals["K"]), float(g.vals["T"]),
                                      float(g.vals["r"]), vol), 2)
    if c < 0.5:
        raise Retry("call too cheap")
    g.known.append(f"call price = {num(c)}")
    g.plan.append("use put-call parity: P = C - S + K * exp(-r * T)")
    g.plan.append("check with the implied volatility")
    v = g.vals
    w.say("Put = C - S + K * exp(-r * T) = ")
    put = w.tool(f"{num(c)}-{v['S']}+{v['K']}*exp(-{v['r']}*{v['T']})")
    if float(put) < 0.01:
        raise Retry("put too cheap")
    w.say("\nCheck: the call's implied volatility is ")
    iv = w.tool(f"QL.implied_vol(call, price={num(c)}, S={v['S']}, K={v['K']}, T={v['T']}, r={v['r']})")
    w.say(", and a put at that volatility costs ")
    p2 = w.tool(f"QL.european_option({option_args(g, 'put', vol=iv)})")
    w.say(", the same.\n")
    if abs(float(p2) - float(put)) > 0.03 + 0.002 * float(put):
        raise Retry("parity mismatch")
    ask = g.pick([f"A {tadj}European call{tcl} {kph} costs ₹{num(c)}. What is the matching European put worth?",
                  f"If a {tadj}European call{tcl} {kph} is priced at ₹{num(c)}, what is the price of the European put with the same strike and expiry?",
                  f"Use put-call parity: a {tadj}European call{tcl} {kph} trades at ₹{num(c)}. Price the same-strike put.",
                  f"Given a ₹{num(c)} price for a {tadj}European call{tcl} {kph}, find the price of the corresponding put.",
                  f"What must a {tadj}European put{tcl} {kph} cost if the same call costs ₹{num(c)}?"])
    return "the price of the matching European put", ask, put


# ------------------------------------------------------------------ targets: bonds

def bond_inputs(g):
    R = g.R
    face = R.choice([100, 1000])
    freq = R.choice([1, 2])
    years = R.choice([1, 2, 3, 4, 5, 7, 10])
    coupon = R.randrange(12, 49) / 400                          # 3% to 12%
    g.known += [f"face = {face}", f"coupon = {pct(coupon)} paid {COMP_WORDS[FREQ_COMP[freq]]}", f"{years} years"]
    g.vals.update(face=str(face), freq=str(freq), years=str(years), coupon=dec(coupon))
    desc = g.pick([f"a {years}-year bond with face value ₹{face} paying a {pct(coupon)} coupon {COMP_WORDS[FREQ_COMP[freq]]}",
                   f"a ₹{face} face-value bond maturing in {months_noun(years * 12)} with a {pct(coupon)} coupon paid {COMP_WORDS[FREQ_COMP[freq]]}",
                   f"a bond of face value ₹{face}, {months_noun(years * 12)} to maturity, coupon {pct(coupon)} paid {COMP_WORDS[FREQ_COMP[freq]]}",
                   f"a {pct(coupon)} coupon bond (paid {COMP_WORDS[FREQ_COMP[freq]]}) with ₹{face} face value and {years} years left",
                   f"a {years}-year, ₹{face} bond whose {pct(coupon)} coupon is paid {COMP_WORDS[FREQ_COMP[freq]]}"])
    return desc


def slot_ytm(g):
    R, w = g.R, g.w
    y = R.randrange(12, 49) / 400
    freq = int(g.vals["freq"])
    if g.uses("ytm_continuous"):
        yc = R.randrange(12, 49) / 400
        g.known.append(f"yield = {pct(yc)} continuously compounded")
        g.need.append(f"the yield compounded {COMP_WORDS[FREQ_COMP[freq]]}, like the coupons")
        g.plan.append(f"convert the yield to {FREQ_COMP[freq]} compounding")
        w.say("Yield = ")
        g.vals["ytm"] = w.tool(f"QL.convert_rate({dec(yc)}, continuous, {FREQ_COMP[freq]})")
        w.say(f" ({FREQ_COMP[freq]} compounding).\n")
        return g.pick([f"its yield is {pct(yc)} with continuous compounding",
                       f"its continuously compounded yield is {pct(yc)}",
                       f"the market yield is {pct(yc)}, compounded continuously",
                       f"it yields {pct(yc)} a year on a continuous basis",
                       f"its yield, quoted with continuous compounding, is {pct(yc)}"])
    g.known.append(f"yield = {pct(y)}")
    g.vals["ytm"] = dec(y)
    return g.pick([f"its yield is {pct(y)}", f"it yields {pct(y)}", f"the market yield is {pct(y)}",
                   f"its yield to maturity is {pct(y)}", f"investors demand a yield of {pct(y)}"])


def bond_args(g, **override):
    v = dict(g.vals, **override)
    return f"face={v['face']}, coupon={v['coupon']}, years={v['years']}, freq={v['freq']}"


def t_bond_price(g):
    R, w = g.R, g.w
    desc = bond_inputs(g)
    yphrase = slot_ytm(g)
    v = g.vals
    n, f = int(v["years"]) * int(v["freq"]), int(v["freq"])
    g.plan.append("discount every coupon and the face value at the yield")
    g.plan.append("check against the coupon-versus-yield rule")
    if n <= 4 and R.random() < 0.6:
        w.say("Each coupon is face * coupon / payments a year = ")
        c = w.tool(f"{v['face']}*{v['coupon']}/{f}")
        w.say(".\nPrice = ")
        per = f"(1+{v['ytm']}/{f})" if f > 1 else f"(1+{v['ytm']})"
        terms = [f"{c}/{per}^{i}" for i in range(1, n)] + [f"({v['face']}+{c})/{per}^{n}"]
        w.tool("+".join(terms))
        w.say("\nWith QuantLib: ")
    else:
        w.say("Price = ")
    price = w.tool(f"QL.bond_price({bond_args(g)}, ytm={v['ytm']})")
    w.say("\n")
    cpn, ytm, face = float(v["coupon"]), float(v["ytm"]), float(v["face"])
    rel = "above" if cpn > ytm + 1e-9 else "below" if cpn < ytm - 1e-9 else "at"
    w.say(f"Check: the coupon {pct(cpn)} is {'higher than' if rel == 'above' else 'lower than' if rel == 'below' else 'equal to'} "
          f"the yield {pct(ytm)}, so the price should be {rel} face value {v['face']}; it is.\n")
    p = float(price)
    if (rel == "above" and p <= face) or (rel == "below" and p >= face) or (rel == "at" and abs(p - face) > 0.01):
        raise Retry("price rule failed")
    ask = g.pick([f"What is the price of {desc}, if {yphrase}?", f"Price {desc}, given that {yphrase}.",
                  f"Find the fair price of {desc} when {yphrase}.", f"How much is {desc} worth if {yphrase}?",
                  f"What should {desc} trade at, knowing that {yphrase}?"])
    answer, goal = price, "the bond's price"
    if R.random() < 0.15:
        k = R.choice([10, 50, 100, 250])
        ask += g.pick([f" What are {k} of these bonds worth?", f" And what do {k} bonds cost?",
                       f" Find the value of a holding of {k} bonds.", f" What would {k} such bonds cost in total?",
                       f" How much is a position of {k} bonds worth?"])
        g.plan.insert(-1, f"multiply by {k} bonds")
        w.say(f"Value of {k} bonds = ")
        answer = w.tool(f"{k}*{price}")
        w.say(".\n")
        goal = f"the value of {k} bonds"
    return goal, ask, answer


def t_bond_ytm(g):
    R, w = g.R, g.w
    desc = bond_inputs(g)
    import qltools
    v = g.vals
    y_true = R.randrange(12, 49) / 400
    price = round(qltools.bond_price(float(v["face"]), float(v["coupon"]), float(v["years"]), int(v["freq"]), y_true), 2)
    if g.uses("price_pct_face"):
        pct_face = round(price / float(v["face"]) * 100, 2)
        g.known.append(f"price = {num(pct_face)}% of face")
        g.plan.append("turn the quoted price into rupees")
        w.say(f"Price = {num(pct_face)}% of {v['face']} = ")
        price_s = w.tool(f"{dec(pct_face / 100)}*{v['face']}")
        w.say(".\n")
        pphrase = g.pick([f"it trades at {num(pct_face)}% of face value", f"it is quoted at {num(pct_face)} per 100 of face",
                          f"its price is {num(pct_face)}% of par", f"the market quotes it at {num(pct_face)}% of face",
                          f"it changes hands at {num(pct_face)}% of its face value"])
    else:
        price_s = num(price)
        g.known.append(f"price = {price_s}")
        pphrase = g.pick([f"it costs ₹{price_s}", f"its price is ₹{price_s}", f"it trades at ₹{price_s}",
                          f"the market price is ₹{price_s}", f"it sells for ₹{price_s}"])
    g.plan.append("solve for the yield that discounts the cash flows to the price")
    g.plan.append("reprice at that yield")
    w.say("Yield to maturity = ")
    y = w.tool(f"QL.bond_ytm({bond_args(g)}, price={price_s})")
    w.say("\nCheck: repricing at that yield gives ")
    back = w.tool(f"QL.bond_price({bond_args(g)}, ytm={y})")
    w.say(f", the price {price_s}.\n")
    if abs(float(back) - float(price_s)) > 0.05 + 1e-4 * float(price_s):
        raise Retry("ytm reprice mismatch")
    ask = g.pick([f"What is the yield to maturity of {desc}, if {pphrase}?", f"Find the yield of {desc} when {pphrase}.",
                  f"{desc[0].upper() + desc[1:]}: {pphrase}. What is its yield?",
                  f"Work out the yield to maturity of {desc}, given that {pphrase}.",
                  f"Which yield makes {desc} worth what it costs, if {pphrase}?"])
    return "the bond's yield to maturity", ask, y


def t_bond_duration(g):
    R, w = g.R, g.w
    desc = bond_inputs(g)
    yphrase = slot_ytm(g)
    kind = R.choice(["modified", "macaulay"])
    v = g.vals
    shock = R.random() < 0.4 and kind == "modified"
    g.plan.append(f"compute the {kind} duration")
    if shock:
        bp = R.choice([25, 50, 75, 100, -25, -50, -100])
        g.plan.append(f"estimate the price change for a {abs(bp)} basis point {'rise' if bp > 0 else 'fall'}: -D * dy * P")
        g.plan.append("compare with exact repricing")
    else:
        g.plan.append("check that it is below the maturity")
    w.say(f"{kind.capitalize()} duration = ")
    D = w.tool(f"QL.bond_duration({bond_args(g)}, ytm={v['ytm']}, kind={kind})")
    w.say(" years.\n")
    if float(D) >= float(v["years"]) + 1e-9:
        raise Retry("duration above maturity")
    answer, goal = D, f"the {kind} duration"
    if shock:
        dy = bp / 10000
        w.say("Price = ")
        P = w.tool(f"QL.bond_price({bond_args(g)}, ytm={v['ytm']})")
        w.say("\nChange = -D * dy * P = ")
        answer = w.tool(f"-{D}*{dec(dy)}*{P}")
        w.say("\nCheck: exact new price = ")
        P2 = w.tool(f"QL.bond_price({bond_args(g)}, ytm={dec(float(v['ytm']) + dy)})")
        w.say(", a change of ")
        exact = w.tool(f"{P2}-{P}")
        w.say(", close to the estimate.\n")
        if abs(float(exact) - float(answer)) > 0.15 * abs(float(exact)) + 0.05:
            raise Retry("duration estimate too far")
        goal = f"the price change for a {abs(bp)} bp {'rise' if bp > 0 else 'fall'} in the yield, using duration"
        ask_tail = g.pick([f" Using duration, by how much does its price change if the yield {'rises' if bp > 0 else 'falls'} by {abs(bp)} basis points?",
                           f" Estimate with duration the price change for a {abs(bp)} bp {'rise' if bp > 0 else 'fall'} in the yield.",
                           f" What price change does duration predict for a {abs(bp)} basis point {'increase' if bp > 0 else 'decrease'} in yield?",
                           f" Use its duration to estimate the price change if yields {'go up' if bp > 0 else 'go down'} {abs(bp)} bp.",
                           f" How much would its price move, by the duration rule, if the yield {'rose' if bp > 0 else 'fell'} {abs(bp)} bp?"])
    else:
        w.say(f"Check: duration is below the {v['years']}-year maturity, as it must be for a coupon bond.\n")
        ask_tail = ""
    ask = g.pick([f"What is the {kind} duration of {desc}, if {yphrase}?", f"Find the {kind} duration of {desc} when {yphrase}.",
                  f"Compute the {kind} duration for {desc}, given that {yphrase}.", f"How long is the {kind} duration of {desc} if {yphrase}?",
                  f"Work out the {kind} duration of {desc} knowing that {yphrase}."]) + ask_tail
    return goal, ask, answer


def t_zero_bond(g):
    R, w = g.R, g.w
    face = R.choice([100, 1000, 10000])
    years = R.choice([1, 2, 3, 5, 7, 10])
    comp = R.choice(["annual", "semiannual", "continuous"])
    y = R.randrange(12, 49) / 400
    g.known += [f"face = {face}", f"T = {years} years", f"yield = {pct(y)} compounded {comp}"]
    g.plan.append("discount the face value at the yield")
    g.plan.append("check with the formula")
    w.say("Price = ")
    price = w.tool(f"QL.zero_bond_price(face={face}, T={years}, ytm={dec(y)}, comp={comp})")
    w.say("\nCheck: ")
    if comp == "continuous":
        w.say("face * exp(-y * T) = ")
        chk = w.tool(f"{face}*exp(-{dec(y)}*{years})")
    elif comp == "annual":
        w.say("face / (1 + y)^T = ")
        chk = w.tool(f"{face}/(1+{dec(y)})^{years}")
    else:
        w.say("face / (1 + y/2)^(2T) = ")
        chk = w.tool(f"{face}/(1+{dec(y)}/2)^{2 * years}")
    w.say(", the same.\n")
    comp_txt = {"annual": "compounded annually", "semiannual": "compounded twice a year", "continuous": "compounded continuously"}[comp]
    ask = g.pick([f"A zero-coupon bond pays ₹{face} in {months_noun(years * 12)}. What is it worth at a yield of {pct(y)} {comp_txt}?",
                  f"Price a {years}-year zero-coupon bond with face value ₹{face} if the yield is {pct(y)} {comp_txt}.",
                  f"What does a zero-coupon bond paying ₹{face} after {years} years cost when yields are {pct(y)} {comp_txt}?",
                  f"Find the price of a ₹{face} zero-coupon bond maturing in {years} years at a {pct(y)} yield {comp_txt}.",
                  f"How much would you pay today for ₹{face} in {months_noun(years * 12)}, discounting at {pct(y)} {comp_txt}?"])
    if abs(float(chk) - float(price)) > 0.01 + 1e-6 * face:
        raise Retry("zero bond mismatch")
    return "the zero-coupon bond's price", ask, price


# ------------------------------------------------------------------ targets: rates, short-rate models, swaps, risk

def t_convert(g):
    R, w = g.R, g.w
    r = R.randrange(8, 49) / 400
    src, dst = R.sample(["annual", "semiannual", "quarterly", "monthly", "continuous"], 2)
    words = {"annual": "compounded annually", "semiannual": "compounded semiannually", "quarterly": "compounded quarterly",
             "monthly": "compounded monthly", "continuous": "continuously compounded"}
    g.known.append(f"{pct(r)} {words[src]}")
    g.plan.append(f"convert from {src} to {dst} compounding")
    g.plan.append("check that one year's growth matches")
    w.say("Rate = ")
    out = w.tool(f"QL.convert_rate({dec(r)}, {src}, {dst})")
    w.say(f"\nCheck: one year's growth at {pct(r)} {words[src]} is ")

    def growth(rate, comp):
        if comp == "continuous":
            return w.tool(f"exp({rate})")
        f = {"annual": 1, "semiannual": 2, "quarterly": 4, "monthly": 12}[comp]
        return w.tool(f"(1+{rate}/{f})^{f}" if f > 1 else f"1+{rate}")
    a = growth(dec(r), src)
    w.say(", and at the new rate it is ")
    b = growth(out, dst)
    w.say(", the same.\n")
    if abs(float(a) - float(b)) > 2e-4:
        raise Retry("growth mismatch")
    ask = g.pick([f"Convert {pct(r)} {words[src]} into the equivalent rate {words[dst]}.",
                  f"What rate {words[dst]} matches {pct(r)} {words[src]}?",
                  f"A deposit pays {pct(r)} {words[src]}. What is the equivalent rate {words[dst]}?",
                  f"Express {pct(r)} {words[src]} as a rate {words[dst]}.",
                  f"Which {dst} rate gives the same growth as {pct(r)} {words[src]}?"])
    return f"the equivalent {dst} rate", ask, out


def t_forward(g):
    R, w = g.R, g.w
    T1 = R.choice([1, 2, 3])
    T2 = T1 + R.choice([1, 2])
    r1 = R.randrange(8, 41) / 400
    r2 = r1 + R.randrange(-4, 9) / 400
    if g.uses("zero_prices"):
        p1, p2 = round(100 * math.exp(-r1 * T1), 2), round(100 * math.exp(-r2 * T2), 2)
        g.known += [f"{T1}-year zero bond = {num(p1)}", f"{T2}-year zero bond = {num(p2)}"]
        g.need.append("the zero rates, hidden in the zero-coupon bond prices")
        g.plan.append("get both continuous zero rates from the bond prices")
        w.say(f"r{T1} = -ln(P / 100) / T = ")
        r1s = w.tool(f"-ln({num(p1)}/100)/{T1}")
        w.say(f"\nr{T2} = ")
        r2s = w.tool(f"-ln({num(p2)}/100)/{T2}")
        w.say("\n")
        info = g.pick([f"Zero-coupon bonds paying ₹100 cost ₹{num(p1)} for {T1} year{'s' if T1 > 1 else ''} and ₹{num(p2)} for {T2} years.",
                       f"A {T1}-year zero-coupon bond (₹100 face) costs ₹{num(p1)}, and a {T2}-year one costs ₹{num(p2)}.",
                       f"₹100 zero-coupon bonds trade at ₹{num(p1)} ({T1}-year) and ₹{num(p2)} ({T2}-year).",
                       f"The {T1}-year and {T2}-year zero-coupon bonds with ₹100 face cost ₹{num(p1)} and ₹{num(p2)}.",
                       f"Prices of ₹100 zero-coupon bonds: {T1} year{'s' if T1 > 1 else ''} ₹{num(p1)}, {T2} years ₹{num(p2)}."])
    else:
        r1s, r2s = dec(r1), dec(r2)
        g.known += [f"r{T1} = {pct(r1)}", f"r{T2} = {pct(r2)}"]
        info = g.pick([f"The {T1}-year zero rate is {pct(r1)} and the {T2}-year zero rate is {pct(r2)}, both continuously compounded.",
                       f"Continuously compounded zero rates are {pct(r1)} for {T1} year{'s' if T1 > 1 else ''} and {pct(r2)} for {T2} years.",
                       f"Zero rates (continuous): {T1} year{'s' if T1 > 1 else ''} {pct(r1)}, {T2} years {pct(r2)}.",
                       f"The curve gives {pct(r1)} to year {T1} and {pct(r2)} to year {T2}, continuously compounded.",
                       f"With continuous compounding, the {T1}-year rate is {pct(r1)} and the {T2}-year rate {pct(r2)}."])
    g.plan.append(f"forward rate from year {T1} to year {T2}")
    g.plan.append("check with (r2 * T2 - r1 * T1) / (T2 - T1)")
    w.say("Forward rate = ")
    fwd = w.tool(f"QL.forward_rate({r1s}, {T1}, {r2s}, {T2})")
    w.say("\nCheck: (r2 * T2 - r1 * T1) / (T2 - T1) = ")
    chk = w.tool(f"({r2s}*{T2}-{r1s}*{T1})/({T2}-{T1})")
    w.say(", the same.\n")
    if abs(float(chk) - float(fwd)) > 2e-4:
        raise Retry("forward mismatch")
    ask = info + " " + g.pick([f"What is the forward rate from year {T1} to year {T2}?",
                               f"Find the continuously compounded forward rate between years {T1} and {T2}.",
                               f"Which rate applies from year {T1} to year {T2}, as a forward rate?",
                               f"Work out the {T1}-to-{T2}-year forward rate.",
                               f"What rate can be locked in today for borrowing from year {T1} to year {T2}?"])
    return f"the forward rate from year {T1} to year {T2}", ask, fwd


def vasicek_params(g):
    R = g.R
    a = R.choice([0.05, 0.1, 0.15, 0.2, 0.3, 0.5])
    b = R.randrange(8, 33) / 400
    sigma = R.choice([0.005, 0.01, 0.015, 0.02])
    r0 = R.randrange(8, 33) / 400
    return a, b, sigma, r0


def t_vasicek(g):
    R, w = g.R, g.w
    a, b, sigma, r0 = vasicek_params(g)
    face = R.choice([100, 1000])
    model = R.choice(["vasicek", "vasicek", "cir"])
    params = (f"mean reversion a = {num(a)}, long-run rate b = {pct(b)}, volatility σ = {pct(sigma)}" if model == "vasicek"
              else f"mean reversion a = {num(a)}, long-run rate b = {pct(b)}, volatility σ = {num(sigma * 10)}")
    if model == "cir":
        sigma = sigma * 10                                          # CIR sigma multiplies sqrt(r)
    name = "Vasicek" if model == "vasicek" else "Cox-Ingersoll-Ross"
    g.known += [f"a = {num(a)}", f"b = {pct(b)}", f"σ = {dec(sigma)}"]
    tool = "vasicek_zcb" if model == "vasicek" else "cir_zcb"
    if model == "vasicek" and g.uses("r0_quantile"):
        t, left = R.choice([1, 2]), R.choice([1, 2, 3, 5])
        q = R.choice([0.95, 0.99])
        g.known += [f"r0 = {pct(r0)}"]
        g.need.append(f"the rate in {t} year{'s' if t > 1 else ''} that is exceeded only {num((1 - q) * 100)}% of the time")
        g.plan += [f"the rate's mean and standard deviation in {t} year{'s' if t > 1 else ''}",
                   f"its {num(q * 100)}th percentile", f"price the {left}-year bond at that rate (a higher rate means a lower price)",
                   "check that it is below the price at the mean rate"]
        w.say("Mean rate = b + (r0 - b) * exp(-a * t) = ")
        mean = w.tool(f"{dec(b)}+({dec(r0)}-{dec(b)})*exp(-{num(a)}*{t})")
        w.say("\nStd dev = σ * sqrt((1 - exp(-2 * a * t)) / (2 * a)) = ")
        sd = w.tool(f"{dec(sigma)}*sqrt((1-exp(-2*{num(a)}*{t}))/(2*{num(a)}))")
        w.say(f"\n{num(q * 100)}th percentile rate = mean + z * sd = ")
        rq = w.tool(f"{mean}+invN({num(q)})*{sd}")
        w.say("\nWorst price = ")
        price = w.tool(f"QL.vasicek_zcb(a={num(a)}, b={dec(b)}, sigma={dec(sigma)}, r={rq}, T={left}, face={face})")
        w.say("\nCheck: at the mean rate the price is ")
        pm = w.tool(f"QL.vasicek_zcb(a={num(a)}, b={dec(b)}, sigma={dec(sigma)}, r={mean}, T={left}, face={face})")
        w.say(", higher, as it should be.\n")
        if float(pm) <= float(price):
            raise Retry("quantile check failed")
        ask = g.pick([f"Under the Vasicek model ({params}, r0 = {pct(r0)}), what is the {num(q * 100)}% worst-case price, {t} year{'s' if t > 1 else ''} from now, of a zero-coupon bond that will then have {left} year{'s' if left > 1 else ''} left? Face value ₹{face}.",
                      f"Take a Vasicek short rate with {params} and r0 = {pct(r0)}. In {t} year{'s' if t > 1 else ''}, a zero-coupon bond paying ₹{face} will have {left} year{'s' if left > 1 else ''} to maturity. Find its price at the {num(q * 100)}% worst case.",
                      f"With Vasicek parameters {params} and today's rate {pct(r0)}, what price will a ₹{face} zero-coupon bond with {left} year{'s' if left > 1 else ''} left have {t} year{'s' if t > 1 else ''} ahead, in the worst {num((1 - q) * 100)}% of cases?",
                      f"Vasicek model: {params}, r0 = {pct(r0)}. Find the {num(q * 100)}% worst-case value, {t} year{'s' if t > 1 else ''} from today, of a ₹{face} zero-coupon bond that then has {left} year{'s' if left > 1 else ''} left.",
                      f"A ₹{face} zero-coupon bond will have {left} year{'s' if left > 1 else ''} left in {t} year{'s' if t > 1 else ''}. If the short rate follows Vasicek with {params} and starts at {pct(r0)}, what is its {num(q * 100)}% worst-case price then?"])
        return f"the {num(q * 100)}% worst-case bond price in {t} year{'s' if t > 1 else ''}", ask, price
    T = R.choice([1, 2, 3, 5, 10])
    g.known += [f"r0 = {pct(r0)}", f"T = {T} years"]
    g.plan.append(f"price the zero-coupon bond with the {name} formula")
    w.say("Price = ")
    price = w.tool(f"QL.{tool}(a={num(a)}, b={dec(b)}, sigma={dec(sigma)}, r={dec(r0)}, T={T}, face={face})")
    w.say("\n")
    answer, goal = price, f"the {name} zero-coupon bond price"
    if R.random() < 0.35:
        g.plan.append("turn the price into a continuous yield: -ln(P / face) / T")
        w.say("Yield = -ln(P / face) / T = ")
        answer = w.tool(f"-ln({price}/{face})/{T}")
        w.say("\n")
        goal = f"the {T}-year yield implied by the {name} model"
        tail = g.pick([" What continuously compounded yield does that price imply?", " Also give the implied continuous yield.",
                       " Then convert the price to a continuous yield.", " What yield (continuous) does it correspond to?",
                       " Express the answer as a continuously compounded yield."])
    else:
        tail = ""
    g.plan.append("check that the price is below face value")
    w.say(f"Check: the price is below the face value {face}, as it must be with positive rates.\n")
    if float(price) >= face:
        raise Retry("zcb above face")
    ask = g.pick([f"Under the {name} model with {params} and a current short rate of {pct(r0)}, what is a {T}-year zero-coupon bond paying ₹{face} worth?",
                  f"Price a ₹{face} zero-coupon bond maturing in {T} years in the {name} model: {params}, r0 = {pct(r0)}.",
                  f"The short rate follows {name} with {params}; today it is {pct(r0)}. Find the price of a {T}-year zero-coupon bond with face ₹{face}.",
                  f"Using {name} ({params}, r0 = {pct(r0)}), what does a zero-coupon bond paying ₹{face} in {T} years cost?",
                  f"What is the {name} price of a {T}-year, ₹{face} zero-coupon bond when {params} and the short rate is {pct(r0)}?"]) + tail
    return goal, ask, answer


def t_swap_par(g):
    R, w = g.R, g.w
    T = R.choice([2, 3, 5, 7, 10])
    freq = R.choice([1, 2, 4])
    g.slot_r(label="flat zero rate")
    g.known += [f"swap tenor {T} years", f"fixed payments {COMP_WORDS[FREQ_COMP[freq]]}"]
    g.plan.append("par rate = (1 - last discount factor) / annuity")
    g.plan.append(f"check: on a flat curve it equals the {FREQ_COMP[freq]}-compounded version of the zero rate")
    w.say("Par swap rate = ")
    par = w.tool(f"QL.swap_par_rate(T={T}, freq={freq}, rate={g.vals['r']})")
    w.say("\nCheck: the same rate with " + FREQ_COMP[freq] + " compounding is ")
    chk = w.tool(f"QL.convert_rate({g.vals['r']}, continuous, {FREQ_COMP[freq]})")
    w.say(", equal, as it must be on a flat curve.\n")
    if abs(float(chk) - float(par)) > 2e-4:
        raise Retry("par mismatch")
    ask = g.pick([f"What is the par rate of a {T}-year swap with fixed payments {COMP_WORDS[FREQ_COMP[freq]]}?",
                  f"Find the fixed rate that makes a {T}-year swap, paying {COMP_WORDS[FREQ_COMP[freq]]}, worth zero.",
                  f"Compute the par swap rate for {T} years with {FREQ_COMP[freq]} fixed payments.",
                  f"Which fixed rate should a new {T}-year swap with {FREQ_COMP[freq]} payments carry?",
                  f"Set the fair fixed rate for a {T}-year interest-rate swap paying {COMP_WORDS[FREQ_COMP[freq]]}."])
    return f"the {T}-year par swap rate", ask, par


def t_var(g):
    R, w = g.R, g.w
    conf = R.choice([0.95, 0.99])
    days = R.choice([1, 1, 5, 10])
    vol_a = R.randrange(10, 51) / 100
    if g.uses("value_shares"):
        n, px = R.choice([100, 200, 500, 1000, 2500]), R.randrange(50, 3000)
        g.known.append(f"{n} shares at {px}")
        g.plan.append("position value = shares * price")
        w.say("Value = ")
        value = w.tool(f"{n}*{px}")
        w.say(".\n")
        pos = g.pick([f"You hold {n} shares priced at ₹{px}.", f"A portfolio holds {n} shares worth ₹{px} each.",
                      f"The position is {n} shares at ₹{px} a share.", f"An investor owns {n} shares trading at ₹{px}.",
                      f"There are {n} shares in the account, each at ₹{px}."])
    else:
        value = str(R.choice([100000, 250000, 500000, 1000000, 2500000, 5000000]))
        g.known.append(f"value = {value}")
        pos = g.pick([f"A portfolio is worth {g.rupees(int(value))}.", f"The position is worth {g.rupees(int(value))}.",
                      f"An investor holds {g.rupees(int(value))} in a stock.", f"The fund has {g.rupees(int(value))} invested.",
                      f"A trader's position has a value of {g.rupees(int(value))}."])
    if g.uses("vol_annual"):
        g.known.append(f"yearly vol = {pct(vol_a)}")
        g.need.append("the daily volatility")
        g.plan.append("daily vol = yearly vol / sqrt(252)")
        w.say("Daily vol = ")
        dvol = w.tool(f"{dec(vol_a)}/sqrt(252)")
        w.say(".\n")
        vtext = g.pick([f"Its yearly volatility is {pct(vol_a)}.", f"Annual volatility is {pct(vol_a)}.",
                        f"The volatility is {pct(vol_a)} a year.", f"Returns have {pct(vol_a)} annual volatility.",
                        f"It has a volatility of {pct(vol_a)} per year."])
    else:
        d = round(vol_a / math.sqrt(252), 4)
        dvol = dec(d)
        g.known.append(f"daily vol = {pct(d)}")
        vtext = g.pick([f"Its daily volatility is {pct(d)}.", f"Daily volatility is {pct(d)}.",
                        f"The value moves with {pct(d)} daily volatility.", f"Daily returns have a volatility of {pct(d)}.",
                        f"The standard deviation of daily returns is {pct(d)}."])
    es = R.random() < 0.3
    g.known += [f"confidence {num(conf * 100)}%", f"{days}-day horizon"]
    g.plan.append("VaR = z * daily vol * value * sqrt(days), assuming normal returns")
    if es:
        g.plan.append("expected shortfall for the same confidence")
    g.plan.append("check" + (" that ES exceeds VaR" if es else " with the formula"))
    w.say("VaR = ")
    var = w.tool(f"QL.var_normal(value={value}, vol={dvol}, conf={num(conf)}, days={days})")
    w.say("\n")
    answer, goal = var, f"the {days}-day {num(conf * 100)}% VaR"
    if es:
        w.say("Expected shortfall = ")
        answer = w.tool(f"QL.es_normal(value={value}, vol={dvol}, conf={num(conf)}, days={days})")
        w.say(f"\nCheck: the expected shortfall is larger than the VaR {var}, as it must be.\n")
        if float(answer) <= float(var):
            raise Retry("es below var")
        goal = f"the {days}-day {num(conf * 100)}% expected shortfall"
    else:
        w.say("Check: z * daily vol * value * sqrt(days) = ")
        chk = w.tool(f"invN({num(conf)})*{dvol}*{value}*sqrt({days})")
        w.say(", the same.\n")
        if abs(float(chk) - float(var)) > 0.01 * float(var):
            raise Retry("var mismatch")
    horizon = "1-day" if days == 1 else f"{days}-day"
    measure = "expected shortfall" if es else "value at risk"
    ask = pos + " " + vtext + " " + g.pick([f"What is its {horizon} {num(conf * 100)}% {measure}, assuming normal returns?",
                                            f"Find the {horizon} {measure} at {num(conf * 100)}% confidence (normal returns).",
                                            f"Assuming normally distributed returns, compute the {num(conf * 100)}% {horizon} {measure}.",
                                            f"How large is the {horizon} {measure} at the {num(conf * 100)}% level, with normal returns?",
                                            f"With normal returns, what {horizon} {measure} applies at {num(conf * 100)}%?"])
    return goal, ask, answer


TARGETS = {  # name: (function, disguises it accepts, subject)
    "option_price": (t_option_price, ["T_trading_days", "T_calendar_days", "r_compounded", "r_zero_bond", "S_move",
                                      "S_futures", "K_moneyness", "vol_daily", "vol_variance", "vol_implied"], "options"),
    "greek": (t_greek, ["T_trading_days", "T_calendar_days", "r_compounded", "r_zero_bond", "S_move", "S_futures",
                        "K_moneyness", "vol_daily", "vol_variance", "vol_implied"], "options"),
    "american": (t_american, ["T_trading_days", "r_compounded", "r_zero_bond", "S_move", "S_futures", "K_moneyness",
                              "vol_daily", "vol_variance", "vol_implied"], "options"),
    "implied_vol": (t_implied_vol, ["T_trading_days", "T_calendar_days", "r_compounded", "r_zero_bond", "S_move",
                                    "S_futures", "K_moneyness"], "options"),
    "parity": (t_parity, ["T_trading_days", "r_compounded", "r_zero_bond", "S_move", "K_moneyness"], "options"),
    "bond_price": (t_bond_price, ["ytm_continuous"], "bonds"),
    "bond_ytm": (t_bond_ytm, ["price_pct_face"], "bonds"),
    "bond_duration": (t_bond_duration, ["ytm_continuous"], "bonds"),
    "zero_bond": (t_zero_bond, [], "bonds"),
    "convert": (t_convert, [], "rates"),
    "forward": (t_forward, ["zero_prices"], "rates"),
    "vasicek": (t_vasicek, ["r0_quantile"], "rate models"),
    "swap_par": (t_swap_par, ["r_compounded", "r_zero_bond"], "swaps"),
    "var": (t_var, ["value_shares", "vol_annual"], "risk"),
}
WEIGHTS = {"option_price": 4, "greek": 3, "american": 2, "implied_vol": 2, "parity": 1, "bond_price": 2, "bond_ytm": 1,
           "bond_duration": 2, "zero_bond": 1, "convert": 1, "forward": 1, "vasicek": 2, "swap_par": 1, "var": 2}
SLOT_OF = {"T_trading_days": "T", "T_calendar_days": "T", "r_compounded": "r", "r_zero_bond": "r", "S_move": "S",
           "S_futures": "S", "K_moneyness": "K", "vol_daily": "vol", "vol_variance": "vol", "vol_implied": "vol",
           "ytm_continuous": "ytm", "price_pct_face": "price", "zero_prices": "zero", "r0_quantile": "r0",
           "value_shares": "value", "vol_annual": "dvol"}
SLIPS = {"r_compounded": "rate_not_converted", "vol_daily": "daily_vol"}


def choose_disguises(R, target, k, allow_heldout):
    options = [d for d in TARGETS[target][1] if allow_heldout or (target, d) not in HELD_OUT_PAIRS]
    chosen, slots = [], set()
    for d in R.sample(options, len(options)):
        if len(chosen) == k:
            break
        if SLOT_OF[d] not in slots:
            chosen.append(d)
            slots.add(SLOT_OF[d])
    return chosen if len(chosen) == k else None


def problem(R, split="train", target=None):
    """One problem as a dict: question, solution, answer and metadata."""
    for _ in range(200):
        tgt = target or R.choices(list(WEIGHTS), weights=list(WEIGHTS.values()))[0]
        wording = "heldout" if split == "level2" else "train"
        if split == "train":
            want = choose_disguises(R, tgt, R.choice([0, 0, 1, 1, 2]), allow_heldout=False)
        elif split == "level1":
            want = []
        elif split == "level2":
            want = choose_disguises(R, tgt, R.choice([0, 1]), allow_heldout=False)
        else:                                                         # level3
            pairs = [d for (t, d) in HELD_OUT_PAIRS if t == tgt]
            if pairs and R.random() < 0.5:
                rest = choose_disguises(R, tgt, 1, allow_heldout=False) or []
                want = [pairs[0]] + [d for d in rest if SLOT_OF[d] != SLOT_OF[pairs[0]]]
            else:
                want = choose_disguises(R, tgt, 3, allow_heldout=False)
        if want is None:
            if target:
                return None
            continue
        slip = None
        if split == "train" and R.random() < 0.3 and TARGETS[tgt][0] is t_option_price:
            options = [SLIPS[d] for d in want if d in SLIPS] + ["swap_SK", "months_as_years"]
            slip = R.choice(options)
        g = Gen(R, wording, want, slip)
        try:
            out = TARGETS[tgt][0](g)
        except Retry:
            continue
        goal, ask, answer = out
        if isinstance(answer, tuple):                                 # targets whose ask is built with the facts
            ask, answer = answer
        if sorted(g.used) != sorted(want):
            continue
        facts = g.facts[:]
        R.shuffle(facts)
        question = " ".join(facts + [ask]).strip()
        solution = think(g, goal) + g.w.text() + f"#### {answer}"
        return {"target": tgt, "subject": TARGETS[tgt][2], "split": split, "disguises": want, "slip": g.slipped is not None and slip is not None,
                "question": question, "solution": solution, "answer": answer}
    raise RuntimeError(f"could not build a problem for {target or 'any target'}")


def to_text(p):
    return f"Q: {p['question']}\nA: {p['solution']}"


def check(n=60):
    """Every tool call in every solution must reproduce its result, and splits must be clean."""
    import re
    R = random.Random(3)
    note = re.compile(r"<<(.+?)=([^=<>]+?)>>")
    counts, bad, slips = {}, 0, 0
    for split in ["train", "level1", "level2", "level3"]:
        for i in range(n * len(TARGETS)):
            tgt = list(TARGETS)[i % len(TARGETS)]
            p = problem(R, split, target=tgt)
            if p is None:
                continue
            counts[split] = counts.get(split, 0) + 1
            slips += p["slip"]
            assert "{" not in p["question"] and "}" not in p["question"], p["question"]
            float(p["answer"])
            if split == "train":
                assert not any((tgt, d) in HELD_OUT_PAIRS for d in p["disguises"]), p
            for expr, res in note.findall(p["solution"]):
                if tools.run_tool(expr).split(">>")[0] != res:
                    bad += 1
    print("problems per split:", counts, "| wrong tool results:", bad, "| training problems with a slip:", slips)
    return bad == 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(0 if check() else 1)
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for split in ["train", "train", "train", "level3"]:
        print(f"--- {split}\n" + to_text(problem(R, split)) + "\n")
