"""Tokenizer, input clean-up and a safe calculator for a small maths model.

The idea: the model never does arithmetic. It writes a short program such as

    formula circle_area ; radius = 5 ; ans area = pi * radius ^ 2

and this file runs it. The calculator only knows + - * / ^ and a few
functions; it has no maths knowledge of its own, and it never calls eval().

Run this file directly to self-test it:  python calc.py
"""
import math
import re

TOK = re.compile(r"[a-z_]+|\d|[^\sa-z_\d]")
_REPL = [("’", "'"), ("‘", "'"), ("what's", "what is"), ("whats", "what is"), ("×", " * "), ("÷", " / "),
         ("−", " - "), ("–", " - "), ("—", " - "), ("²", " ^ 2 "), ("³", " ^ 3 "), ("√", " sqrt "),
         ("π", " pi "), ("°", " degrees "), ("%", " percent "), ("**", " ^ "), ("'", ""), ("?", " "),
         ('"', " "), ("“", " "), ("”", " ")]


def normalize(text):
    """Lower-case and map look-alike symbols to one form, so the model sees less variety."""
    s = text.lower()
    for a, b in _REPL:
        s = s.replace(a, b)
    return re.sub(r"(\d),(?=\d\d\d(?!\d))", r"\1", s)        # 1,000 -> 1000


def tokenize(text):
    return TOK.findall(normalize(text))


def detok(tokens):
    """Join tokens back into text, gluing digits together: '1 2 . 5' -> '12.5'."""
    return re.sub(r"(?<=[\d.]) (?=[\d.])", "", " ".join(tokens))


class CalcError(Exception):
    pass


def _whole(x, what):
    if x != int(x):
        raise CalcError(what + " needs whole numbers")
    return int(x)


def _fact(x):
    if x < 0 or x != int(x) or x > 170:
        raise CalcError("factorial needs a whole number from 0 to 170")
    return float(math.factorial(int(x)))


def _gcd(a, b):
    return float(math.gcd(_whole(a, "gcd"), _whole(b, "gcd")))


def _lcm(a, b):
    a, b = _whole(a, "lcm"), _whole(b, "lcm")
    if a == 0 or b == 0:
        raise CalcError("lcm needs numbers other than zero")
    return float(abs(a * b) // math.gcd(a, b))


def _sqrt(x):
    if x < 0:
        raise CalcError("square root of a negative number")
    return math.sqrt(x)


def _log(x):
    if x <= 0:
        raise CalcError("logarithm needs a positive number")
    return math.log(x)


def _mod(a, b):
    if b == 0:
        raise CalcError("division by zero")
    return math.fmod(a, b)


def _round(x, places):
    p = 10.0 ** _whole(places, "round")
    return math.floor(x * p + 0.5) / p


def _isprime(x):
    if x != int(x) or x < 0 or x > 1e12:
        raise CalcError("prime check needs a whole number from 0 to 1,000,000,000,000")
    n = int(x)
    if n < 2:
        return 0.0
    i = 2
    while i * i <= n:
        if n % i == 0:
            return 0.0
        i += 1
    return 1.0


def _median(*xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


FUNCS = {"sqrt": (_sqrt, 1), "exp": (math.exp, 1), "log": (_log, 1), "sin": (math.sin, 1), "cos": (math.cos, 1),
         "tan": (math.tan, 1), "abs": (abs, 1), "fact": (_fact, 1), "gcd": (_gcd, 2), "lcm": (_lcm, 2), "mod": (_mod, 2), "round": (_round, 2),
         "isprime": (_isprime, 1), "max": (max, None), "min": (min, None), "median": (_median, None)}   # None = any number of values
CONSTS = {"pi": math.pi}
_LEX = re.compile(r"\s*(\d+\.\d+|\d+|[a-z_]+|[-+*/^(),])")
_BAD = "cannot read the calculation"


class _Parser:
    def __init__(self, text, env):
        self.t, pos, text = [], 0, text.strip()
        while pos < len(text):
            m = _LEX.match(text, pos)
            if not m:
                raise CalcError(_BAD)
            self.t.append(m.group(1))
            pos = m.end()
        self.i, self.env = 0, env

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def eat(self, tok=None):
        cur = self.peek()
        if cur is None or (tok is not None and cur != tok):
            raise CalcError(_BAD)
        self.i += 1
        return cur

    def expr(self):
        v = self.term()
        while self.peek() in ("+", "-"):
            v = v + self.term() if self.eat() == "+" else v - self.term()
        return v

    def term(self):
        v = self.unary()
        while self.peek() in ("*", "/"):
            op, r = self.eat(), self.unary()
            if op == "/":
                if r == 0:
                    raise CalcError("division by zero")
                v = v / r
            else:
                v = v * r
        return v

    def unary(self):
        if self.peek() == "-":
            self.eat()
            return -self.unary()
        return self.power()

    def power(self):
        b = self.atom()
        if self.peek() == "^":
            self.eat()
            e = self.unary()
            try:
                return math.pow(b, e)
            except (ValueError, OverflowError, ZeroDivisionError):
                raise CalcError("that power is not a real number")
        return b

    def atom(self):
        t = self.eat()
        if t == "(":
            v = self.expr()
            self.eat(")")
            return v
        if t[0].isdigit():
            return float(t)
        if re.fullmatch(r"[a-z_]+", t):
            if self.peek() == "(" and t in FUNCS:
                self.eat("(")
                args = [self.expr()]
                while self.peek() == ",":
                    self.eat()
                    args.append(self.expr())
                self.eat(")")
                f, n = FUNCS[t]
                if n is not None and len(args) != n:
                    raise CalcError("wrong number of values for " + t)
                try:
                    return float(f(*args))
                except (ValueError, OverflowError):
                    raise CalcError("the result is not a real number")
            if t in self.env:
                return self.env[t]
            if t in CONSTS:
                return CONSTS[t]
            raise CalcError("unknown name " + t)
        raise CalcError(_BAD)


def evaluate(expr, env=None):
    p = _Parser(expr, env or {})
    v = p.expr()
    if p.i != len(p.t):
        raise CalcError(_BAD)
    if not math.isfinite(v):
        raise CalcError("the result is not a finite number")
    return v


def run_program(text):
    """Run a model-written program. Returns {'name', 'steps', 'answers'}; raises CalcError."""
    parts = [p.strip() for p in text.split(";")]
    head = parts[0].split()
    if len(head) != 2 or head[0] != "formula":
        raise CalcError("the model did not name a formula")
    env, steps = {}, []
    for p in parts[1:]:
        is_ans = p.startswith("ans ")
        m = re.fullmatch(r"([a-z_]+) = (.+)", p[4:] if is_ans else p)
        if not m:
            raise CalcError(_BAD)
        var, expr = m.group(1), m.group(2)
        val = evaluate(expr, env)
        env[var] = val
        steps.append(dict(var=var, expr=expr, value=val, ans=is_ans, given=bool(re.fullmatch(r"(- )?\d+(\.\d+)?", expr))))
    return dict(name=head[1], steps=steps, answers=[s["value"] for s in steps if s["ans"]])


def outcome(text):
    """Collapse a program to something comparable: (formula name, answers) or (formula name, error text)."""
    try:
        r = run_program(text)
        return r["name"], tuple(r["answers"])
    except CalcError as e:
        name = text.split(";")[0].split()
        return (name[1] if len(name) == 2 else "?"), "error: " + str(e)


def same_outcome(a, b, tol=1e-6):
    if a[0] != b[0] or isinstance(a[1], str) != isinstance(b[1], str):
        return False
    if isinstance(a[1], str):
        return a[1] == b[1]
    return len(a[1]) == len(b[1]) and all(abs(x - y) <= tol * max(1.0, abs(y)) for x, y in zip(a[1], b[1]))


if __name__ == "__main__":
    tests = {"2 + 3 * 4": 14, "( 2 + 3 ) * 4": 20, "- 2 ^ 2": -4, "2 ^ - 1": 0.5, "2 ^ 3 ^ 2": 512, "fact ( 5 ) / fact ( 3 )": 20,
             "sqrt ( 16 ) + abs ( - 3 )": 7, "gcd ( 12 , 18 ) + lcm ( 4 , 6 )": 18, "mod ( 17 , 5 )": 2, "10 - 2 - 3": 5, "8 / 4 / 2": 1,
             "pi * 2": 2 * math.pi, "sin ( 30 * pi / 180 )": 0.5, "log ( 8 ) / log ( 2 )": 3, "4 / 3 * pi * 6 ^ 3": 4 / 3 * math.pi * 216, "round ( 3.14159 , 2 )": 3.14, "round ( 1250 , - 2 )": 1300, "round ( 47.5 , 0 )": 48,
             "isprime ( 17 ) + isprime ( 21 )": 1, "max ( 4 , 9 , 2 ) - min ( 4 , 9 , 2 )": 7, "median ( 5 , 1 , 3 , 4 )": 3.5, "median ( 9 , 1 , 5 )": 5}
    for e, want in tests.items():
        got = evaluate(e)
        assert abs(got - want) < 1e-9, (e, got, want)
    for bad in ["1 / 0", "sqrt ( - 4 )", "2 +", "foo + 1", "fact ( 2.5 )", "( 2", "2 3"]:
        try:
            evaluate(bad)
            raise AssertionError(bad)
        except CalcError:
            pass
    r = run_program("formula quadratic ; a = 1 ; b = - 5 ; c = 6 ; d = b ^ 2 - 4 * a * c ; ans root_one = ( - b + sqrt ( d ) ) / ( 2 * a ) ; ans root_two = ( - b - sqrt ( d ) ) / ( 2 * a )")
    assert r["answers"] == [3.0, 2.0] and r["steps"][1]["given"] and not r["steps"][3]["given"], r
    assert tokenize("What's 15% of 1,200?") == ["what", "is", "1", "5", "percent", "of", "1", "2", "0", "0"], tokenize("What's 15% of 1,200?")
    assert tokenize("3x² − 5 = 2**3") == ["3", "x", "^", "2", "-", "5", "=", "2", "^", "3"]
    assert detok(["a", "=", "1", "2", ".", "5", ";", "b", "=", "-", "3"]) == "a = 12.5 ; b = - 3"
    print("calc ok")
