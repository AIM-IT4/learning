"""The film's formulas as TeX, with every number taken from work/numbers.json (so the typeset maths and the data cannot
disagree). Writes work/formulas.tex.json; tools/tex2svg.mjs then typesets them to SVG (work/formulas.json).
\\class{acc}{..} marks what locks in the accent colour, \\class{blu}{..} what is drawn in the line blue.
usage: python3 tools/formulas.py && node tools/tex2svg.mjs"""
import json, os
from math import floor, log10

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = json.load(open(os.path.join(HERE, "work/numbers.json")))
nm, cr, b, md, p90 = N["normal"], N["crash"], N["bscurve"], N["model"], N["put90"]


def sci(x, nd=1):
    e = floor(log10(abs(x))); m = x / 10 ** e
    return (f"{m:.{nd}f}" if nd else f"{m:.0f}") + r"\times10^{" + str(e) + "}"


exp_bb = 10 ** nm["log10_expected_since_big_bang"]
F = {
    # s1: Black-Scholes for a put, one sigma in it
    "bs_put": r"P = K e^{-rT} N(-d_2) - S\,N(-d_1)",
    "bs_d": r"d_{1,2} = \frac{\ln(S/K) + \left(r \pm \tfrac12\class{acc}{\sigma}^2\right)T}{\class{acc}{\sigma}\sqrt{T}}",
    # s4: a typical day, and the crash in those units
    "sigma_day": r"\sigma_{\text{day}} = \frac{" + f"{100 * nm['sigma_annual']:.0f}" + r"\%}{\sqrt{252}} = \class{acc}{"
                 + f"{nm['sd_day_pct']:.2f}" + r"\%}",
    "z_crash": r"z = \frac{" + f"{cr['ret_pct']:.2f}" + r"\%}{" + f"{nm['sd_day_pct']:.2f}" + r"\%} = \class{acc}{"
               + f"{-nm['z_round']:.1f}" + "}",
    # s5: its chance under the normal curve, and since the Big Bang
    "p_tail": r"P(Z \le " + f"{-nm['z_round']:.1f}" + r") \approx \class{acc}{" + sci(nm["p_mantissa"] * 10 ** nm["p_exp"]) + "}",
    "big_bang": r"13.8\ \text{bn years} \times 252 = " + sci(nm["days_since_big_bang"]) + r"\ \text{days}",
    "expected": r"\text{expected} \approx " + sci(exp_bb, 0).replace("4" + r"\times", "4" + r"\times") + r"\ \text{days}",
    # s7: what a put pays
    "payoff": r"\text{payoff} = \max(K - S_T,\ 0)",
    # s8: implied volatility, and Newton's step that finds it
    "iv_def": r"P_{\text{BS}}(\class{acc}{\sigma}) = " + f"{p90['price_model']:.3f}" + r"\ \Rightarrow\ \class{acc}{\sigma_{\text{imp}} = "
              + f"{p90['iv_pct']:.1f}" + r"\%}",
    "newton": r"\sigma_{n+1} = \sigma_n - \frac{P_{\text{BS}}(\sigma_n) - P_{\text{mkt}}}{\text{vega}(\sigma_n)}",
    # s9: the model
    "model": r"\frac{dS}{S} = \class{blu}{\sigma\,dW} \class{acc}{{}- " + f"{-100 * md['crash']:.0f}" + r"\%\,dN}",
    "model_par": r"\sigma = " + f"{100 * md['sigma']:.0f}" + r"\%,\quad \lambda = " + f"{md['crash_rate']:.1f}"
                 + r"\ \text{a year}",
    # s10: Monte Carlo price of a put
    "mc_price": r"P(K) = \frac{1}{N}\sum_{i=1}^{N} \max\!\left(K - S_T^{(i)},\ 0\right)",
    # s4-s6 extras: the normal density, and how much more often the fat-tailed curve gives a bad day
    "normal_pdf": r"\varphi(x) = \frac{1}{\sigma\sqrt{2\pi}}\,e^{-x^2/2\sigma^2}",
    "fat_ratio": r"\frac{P_{\text{fat}}(\text{day} < -4\sigma)}{P_{\text{normal}}(\text{day} < -4\sigma)} \approx \class{acc}{"
                 + f"{N['bell']['ratio_4sd']:.0f}" + "}",
    # s12-s13: the answer
    "flat": r"\sigma_{\text{imp}}(K) = \sigma\ \ \text{for every } K",
    "skew": r"K \downarrow\ \ \Rightarrow\ \ \class{acc}{\sigma_{\text{imp}} \uparrow}",
}
assert "1.2" in F["p_tail"] and "10^{-59}" in F["p_tail"] and "3.5" in F["big_bang"] and "10^{-47}" in F["expected"]
assert "0.090" in F["iv_def"] and "20.7" in F["iv_def"] and "-16.2" in F["z_crash"] and "1.26" in F["sigma_day"]
json.dump(F, open(os.path.join(HERE, "work/formulas.tex.json"), "w"), indent=1, ensure_ascii=False)
print("\n".join(f"{k}: {v}" for k, v in F.items()))
