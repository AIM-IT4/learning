"""The model's calculator tool.

The model writes a calculation like `<<7*12=`; this evaluates it so the model never has
to do arithmetic itself. It parses with Python's `ast` and allows only numbers,
+ - * / ^ ( ), the constant pi and a few functions, never `eval()`:

    ln  exp  sqrt  abs  max  min  N (standard normal CDF)  invN (its inverse)
"""
import ast
import math
import operator
from statistics import NormalDist

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow}
_STD_NORMAL = NormalDist()


def _inv_n(p):
    if not 0 < p < 1:
        raise ValueError("invN needs a probability strictly between 0 and 1")
    return _STD_NORMAL.inv_cdf(p)


def _ln(x):
    if x <= 0:
        raise ValueError("ln needs a positive number")
    return math.log(x)


def _sqrt(x):
    if x < 0:
        raise ValueError("sqrt needs a number that is not negative")
    return math.sqrt(x)


FUNCTIONS = {  # name: (function, min args, max args)
    "ln": (_ln, 1, 1), "exp": (math.exp, 1, 1), "sqrt": (_sqrt, 1, 1), "abs": (abs, 1, 1),
    "N": (_STD_NORMAL.cdf, 1, 1), "invN": (_inv_n, 1, 1), "max": (max, 2, 8), "min": (min, 2, 8),
}
CONSTANTS = {"pi": math.pi}


def evaluate(expr: str) -> float:
    """'7*12' -> 84.0, 'N(0)' -> 0.5. Raises ValueError (or SyntaxError) on anything else."""
    tree = ast.parse(expr.replace("^", "**"), mode="eval")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return float(node.value)
        if isinstance(node, ast.Name) and node.id in CONSTANTS:
            return CONSTANTS[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            v = walk(node.operand)
            return -v if isinstance(node.op, ast.USub) else v
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            a, b = walk(node.left), walk(node.right)
            if isinstance(node.op, ast.Pow) and (abs(b) > 64 or abs(a) > 1e9):
                raise ValueError("power too large")
            if isinstance(node.op, ast.Div) and b == 0:
                raise ValueError("division by zero")
            return _OPS[type(node.op)](a, b)
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS
                and not node.keywords):
            fn, lo, hi = FUNCTIONS[node.func.id]
            if not lo <= len(node.args) <= hi:
                raise ValueError(f"{node.func.id} takes {lo} to {hi} arguments")
            return float(fn(*[walk(arg) for arg in node.args]))
        raise ValueError("only numbers, + - * / ^ ( ), pi and ln exp sqrt abs max min N invN are allowed")

    value = walk(tree)
    if not math.isfinite(value):
        raise ValueError("result is not a finite number")
    return value


def fmt(value: float) -> str:
    """How results are written: 84.0 -> '84', 1020.2349 -> '1020.23', -0.026801 -> '-0.0268'."""
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    text = f"{value:.{2 if abs(value) >= 10 else 4}f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


if __name__ == "__main__":
    checks = {"7*12": "84", "(ln(100/105)+(0.07+0.2^2/2)*0.5)/(0.2*sqrt(0.5))": "-0.0268",
              "invN(0.99)": "2.3263", "N(0)": "0.5", "max(105-100, 0)": "5", "2*pi": "6.2832",
              "15/24": "0.625", "1000*(1+0.08/2)^4": "1169.86"}
    for expr, want in checks.items():
        got = fmt(evaluate(expr))
        assert got == want, (expr, got, want)
    for bad in ["__import__('os')", "open('x')", "ln(-1)", "invN(1)", "1/0", "a+1", "max(1)"]:
        try:
            evaluate(bad)
            raise AssertionError(f"should have failed: {bad}")
        except (ValueError, SyntaxError):
            pass
    print(f"calculator: {len(checks)} results correct, 7 unsafe or invalid inputs refused")
