"""The model's calculator tool: numbers and + - * / ^ ( ) only.

The model writes a calculation like `<<7*12=`; this evaluates it so the model never has
to do arithmetic itself. It parses with Python's `ast` and allows only safe arithmetic,
never `eval()`.
"""
import ast
import math
import operator

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow}


def evaluate(expr: str) -> float:
    """'7*12' -> 84.0. Raises ValueError (or SyntaxError) on anything else."""
    tree = ast.parse(expr.replace("^", "**"), mode="eval")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return float(node.value)
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
        raise ValueError("only numbers and + - * / ^ ( ) are allowed")

    value = walk(tree)
    if not math.isfinite(value):
        raise ValueError("result is not a finite number")
    return value


def fmt(value: float) -> str:
    """84.0 -> '84', 3.3333 -> '3.33': how results are written in solutions."""
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.2f}".rstrip("0").rstrip(".")
