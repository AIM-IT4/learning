"""How the model uses its tools while it writes.

The model writes a tool call as `<<expression=`. As soon as a call is complete, our code
runs it and writes `result>>result` for the model, which then carries on writing.

    <<6/12=                                 -> calculator          -> 0.5>>0.5
    <<QL.vega(call, S=100, K=100, T=1, r=0.05, vol=0.2)=   -> QuantLib  -> 0.3752>>0.3752

A call is complete when the text ends with '=', the last '<<' comes after the last '>>',
and the parentheses inside are balanced, so the '=' in `S=100` never triggers a call.
"""
import calc

try:
    import qltools
except ImportError:            # QuantLib not installed: the calculator still works
    qltools = None


def pending_call(text: str):
    """The expression of a complete, not yet answered tool call at the end of text, else None."""
    if not text.endswith("="):
        return None
    start, end = text.rfind("<<"), text.rfind(">>")
    if start == -1 or start < end:
        return None
    expr = text[start + 2:-1]
    if not expr or "\n" in expr or expr.count("(") != expr.count(")"):
        return None
    return expr


def run_tool(expr: str) -> str:
    """Run one tool call and return the text our code writes for the model."""
    expr = expr.strip()
    if expr.startswith("QL."):
        if qltools is None:
            raise ValueError("QuantLib is not installed")
        value = qltools.call(expr)
    else:
        value = calc.evaluate(expr)
    result = calc.fmt(value)
    return f"{result}>>{result}"


if __name__ == "__main__":
    assert pending_call("T = 6 / 12 = <<6/12=") == "6/12"
    assert pending_call("Price = <<QL.european_option(call, S=") is None            # inside the call
    assert pending_call("x = <<QL.delta(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)=") == \
        "QL.delta(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)"
    assert pending_call("<<2*3=6>>6 and so x =") is None                             # already answered
    assert run_tool("6/12") == "0.5>>0.5"
    if qltools:
        assert run_tool("QL.european_option(call, S=100, K=105, T=0.5, r=0.07, vol=0.2)") == "5.009>>5.009"
    print("tool calls: trigger rule and dispatch work")
