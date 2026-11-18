"""A hand-written quant exam for benchmarking: 40 questions in natural textbook wording.

None of these come from quantgen's templates, so our model gets no help from familiar
phrasing. 27 are task types our model practised (worded differently); 13 are tasks it never
practised at all (Black-76, FX options, convexity, swap value, DV01, dividends, forward
prices, probabilities...). Every answer is computed with QuantLib or an exact formula.

    python quantexam.py      # print the exam with answers
"""
import math
from statistics import NormalDist

import qltools as Q
from calc import fmt

EXAM = []


def add(topic, practised, question, answer):
    EXAM.append({"topic": topic, "practised": practised, "question": question, "answer": fmt(answer)})


N = NormalDist().cdf

add("option price", True, "What is the Black–Scholes price of a European call on a stock at 120 with strike 115, nine months to expiry, a 5% continuously compounded risk-free rate and 22% volatility?",
    Q.european_option("call", 120, 115, 0.75, 0.05, 0.22))
add("option price", True, "A stock trades at ₹2,450. What should a three-month European put struck at ₹2,450 cost if volatility is 18% and the continuously compounded rate is 6.5%?",
    Q.european_option("put", 2450, 2450, 0.25, 0.065, 0.18))
add("greek", True, "Compute the delta of a one-year European call when the stock and strike are both 100, the risk-free rate is 4% (continuous) and volatility is 25%.",
    Q.delta("call", 100, 100, 1, 0.04, 0.25))
add("greek", True, "What is the gamma of a six-month European put with S = 50, K = 55, r = 3% (continuous) and σ = 40%?",
    Q.gamma("put", 50, 55, 0.5, 0.03, 0.40))
add("greek", True, "Find the vega, per one percentage point of volatility, of a two-year European call with spot 200, strike 220, rate 5% continuous and volatility 30%.",
    Q.vega("call", 200, 220, 2, 0.05, 0.30))
add("greek", True, "What is the daily theta of a three-month at-the-money European call on a ₹1,000 stock with 15% volatility and a 6% continuously compounded rate?",
    Q.theta("call", 1000, 1000, 0.25, 0.06, 0.15))
add("greek", True, "Give the rho, per 1% change in rates, of a one-year European put with S = 100, K = 110, r = 5% (continuous) and σ = 20%.",
    Q.rho("put", 100, 110, 1, 0.05, 0.20))
add("american", True, "Use a binomial tree to value a nine-month American put on a ₹80 stock with strike ₹85, 35% volatility and a 7% continuously compounded rate.",
    Q.american_option("put", 80, 85, 0.75, 0.07, 0.35))
add("implied vol", True, "A six-month European call with spot 100 and strike 100 trades at 7.50. If the continuously compounded rate is 5%, what volatility does the market imply?",
    Q.implied_vol("call", 7.5, 100, 100, 0.5, 0.05))
add("parity", True, "A one-year European call with strike ₹50 on a ₹48 stock costs ₹4.20 and the continuously compounded rate is 5%. Using put–call parity, what is the one-year put with the same strike worth?",
    4.20 - 48 + 50 * math.exp(-0.05))
add("bond price", True, "Price a 10-year bond with ₹1,000 face value and a 7% annual coupon when the market yield is 8%.",
    Q.bond_price(1000, 0.07, 10, 1, 0.08))
add("bond yield", True, "A 3-year bond paying a 6% coupon twice a year on ₹100 face trades at ₹97.50. What is its yield to maturity?",
    Q.bond_ytm(100, 0.06, 3, 2, 97.5))
add("duration", True, "Find the modified duration of a 5-year bond with a 9% annual coupon priced to yield 9%. Face value is ₹100.",
    Q.bond_duration(100, 0.09, 5, 1, 0.09, "modified"))
add("duration", True, "What is the Macaulay duration of a 4-year ₹1,000 bond with a 5% coupon paid semiannually, yielding 6%?",
    Q.bond_duration(1000, 0.05, 4, 2, 0.06, "macaulay"))
add("zero bond", True, "How much does a zero-coupon bond that pays ₹50,000 in 6 years cost if the yield is 7.25% compounded annually?",
    Q.zero_bond_price(50000, 6, 0.0725, "annual"))
add("rate conversion", True, "Convert a 12% annual rate compounded monthly into the equivalent continuously compounded rate.",
    Q.convert_rate(0.12, "monthly", "continuous"))
add("rate conversion", True, "A bank quotes 8% compounded semiannually. What is the equivalent rate with annual compounding?",
    Q.convert_rate(0.08, "semiannual", "annual"))
add("forward rate", True, "The 2-year zero rate is 5% and the 3-year zero rate is 5.6%, both continuously compounded. What forward rate applies to the third year?",
    Q.forward_rate(0.05, 2, 0.056, 3))
add("vasicek", True, "In the Vasicek model with a = 0.2, b = 5%, σ = 1.5% and a current short rate of 3.5%, what is a 4-year zero-coupon bond with face value 100 worth?",
    Q.vasicek_zcb(0.2, 0.05, 0.015, 0.035, 4))
add("cir", True, "Under Cox–Ingersoll–Ross with a = 0.3, b = 6%, σ = 0.08 and r0 = 4%, price a 5-year zero-coupon bond paying ₹1,000.",
    Q.cir_zcb(0.3, 0.06, 0.08, 0.04, 5, 1000))
add("swap rate", True, "On a flat 6% continuously compounded zero curve, what is the 5-year par swap rate with annual fixed payments?",
    Q.swap_par_rate(5, 1, 0.06))
add("var", True, "A ₹25,00,000 portfolio has a daily volatility of 1.8%. Assuming normal returns, what is its 10-day 99% value at risk?",
    Q.var_normal(2500000, 0.018, 0.99, 10))
add("var", True, "A ₹50,00,000 position has 24% annual volatility. What is its 1-day 95% value at risk, using 252 trading days a year and normal returns?",
    Q.var_normal(5000000, 0.24 / math.sqrt(252), 0.95, 1))
add("expected shortfall", True, "What is the 1-day 99% expected shortfall of a ₹10,00,000 position whose daily volatility is 1.1%, with normal returns?",
    Q.es_normal(1000000, 0.011, 0.99, 1))
add("combination", True, "A 6-month Treasury bill with ₹100 face value costs ₹96.90. Using its continuously compounded yield as the risk-free rate, price a 6-month European call on a ₹500 stock with strike ₹520 and 28% volatility.",
    Q.european_option("call", 500, 520, 0.5, -math.log(0.969) / 0.5, 0.28))
add("combination", True, "The 3-month futures price of a non-dividend stock is ₹1,212 and the continuously compounded rate is 6%. Price a 3-month European put on the stock with strike ₹1,200 and 25% volatility.",
    Q.european_option("put", 1212 * math.exp(-0.06 * 0.25), 1200, 0.25, 0.06, 0.25))
add("bond price", True, "A 2-year bond pays a 4% coupon twice a year on ₹1,000 face. What is its price if the yield is 4%?",
    Q.bond_price(1000, 0.04, 2, 2, 0.04))
add("black-76", False, "Using Black's model, price a 6-month call on a futures contract trading at 1,500 with strike 1,550, a 6% continuously compounded rate and 20% volatility.",
    Q.black76_option("call", 1500, 1550, 0.5, 0.06, 0.20))
add("fx option", False, "USD/INR spot is 83.20. Price a 3-month European call on USD with strike 84, an INR rate of 6.5%, a USD rate of 5% (both continuous) and 6% volatility.",
    Q.fx_option("call", 83.2, 84, 0.25, 0.065, 0.05, 0.06))
add("convexity", False, "What is the convexity of a 7-year bond with a 6% annual coupon yielding 7%? Face value ₹100.",
    Q.bond_convexity(100, 0.06, 7, 1, 0.07))
add("swap value", False, "You receive 5% fixed annually on a 4-year swap with ₹1,00,00,000 notional. The zero curve is flat at 6% continuously compounded. What is the swap worth to you?",
    Q.swap_value(1e7, 0.05, 4, 1, 0.06, "receiver"))
add("dv01", False, "What is the DV01 of the fixed leg of a 5-year annual-pay swap with ₹10,00,00,000 notional on a flat 5% continuously compounded curve?",
    Q.swap_dv01(1e8, 5, 1, 0.05))
add("dividend option", False, "Price a 9-month European put on a stock paying a 2% continuous dividend yield, with S = 75, K = 80, r = 6% continuous and σ = 30%.",
    Q.european_option("put", 75, 80, 0.75, 0.06, 0.30, 0.02))
add("discount factor", False, "What is the 3-year discount factor at a 6.5% continuously compounded rate?",
    Q.discount_factor(0.065, 3, "continuous"))
add("present value", False, "What is the present value of ₹2,00,000 received in 4 years at 9% compounded quarterly?",
    200000 / (1 + 0.09 / 4) ** 16)
add("forward price", False, "What is the 6-month forward price of a ₹900 stock that pays no dividends, if the continuously compounded rate is 7%?",
    900 * math.exp(0.07 * 0.5))
add("probability", False, "Under Black–Scholes, what is the risk-neutral probability that a 1-year call with S = 100, K = 110, r = 5% (continuous) and σ = 20% finishes in the money?",
    N((math.log(100 / 110) + (0.05 - 0.02) * 1) / 0.2))
add("historical var", False, "Daily returns over 10 days were +1.0%, −2.0%, +0.5%, −4.0%, +3.0%, −1.0%, +2.0%, −3.0%, 0.0% and +1.5%. What is the 1-day 90% historical VaR of a ₹1,00,000 position?",
    Q.var_historical([0.01, -0.02, 0.005, -0.04, 0.03, -0.01, 0.02, -0.03, 0.0, 0.015], 0.9, 100000))
add("volatility scaling", False, "A stock's annual volatility is 32%. What is its daily volatility, assuming 252 trading days?",
    0.32 / math.sqrt(252))
add("break-even", False, "A trader pays ₹12.40 for a call with strike ₹300. At what stock price at expiry does the trader break even?",
    300 + 12.40)


def rows():
    return [dict(e, split="quant_exam", target=e["topic"]) for e in EXAM]


if __name__ == "__main__":
    assert len(EXAM) == 40, len(EXAM)
    for i, e in enumerate(EXAM, 1):
        print(f"{i:2d}. [{'practised' if e['practised'] else 'NEW TASK '}] {e['question']}\n    answer: {e['answer']}")
    print(f"\n{sum(e['practised'] for e in EXAM)} practised task types, {sum(not e['practised'] for e in EXAM)} new tasks")
