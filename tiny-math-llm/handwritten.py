"""Maths questions written by hand, in everyday wording, to test a model the way a person would.

They are for testing only and must never be used as training data.
Each entry is (question, expected). Expected is a list of numbers (any order),
or the name of a reply the model should give instead of a calculation
(a tuple means any of those replies is acceptable).
"""
from math import pi, sqrt, log, sin, cos, tan, radians

CORE = [
    # arithmetic
    ("What is 25 * 4?", [100]), ("2+2", [4]), ("calculate 144 / 12", [12]), ("what's 15 plus 27", [42]),
    ("100 minus 37", [63]), ("7 times 8", [56]), ("divide 81 by 9", [9]), ("what is 3 * (4 + 5)?", [27]),
    ("12.5 + 7.25", [19.75]), ("square root of 144", [12]), ("sqrt(2)", [sqrt(2)]), ("what is 5 squared", [25]),
    ("2 to the power of 10", [1024]), ("2^8", [256]), ("what is 6 factorial", [720]), ("5!", [120]),
    ("cube root of 27", [3]), ("what is the sum of 45 and 55", [100]), ("product of 6 and 7", [42]),
    ("subtract 15 from 40", [25]), ("what is half of 90", [45]), ("(8 + 2) * (7 - 3)", [40]), ("1000 / 8", [125]),
    ("how much is 3.5 times 4", [14]), ("what is 3/4 + 1/2", [1.25]), ("10 - 2 * 3", [4]),
    ("What do I get if I multiply 13 by 12?", [156]), ("17 mod 5", [2]), ("what is 9 cubed", [729]),
    ("add 12, 15 and 18", [45]),
    # percentages and money
    ("what is 15% of 200", [30]), ("20 percent of 50", [10]), ("find 7.5% of 1200", [90]),
    ("30 is what percent of 120?", [25]), ("what percent of 80 is 20", [25]),
    ("I got 45 out of 60, what is my percentage?", [75]), ("percentage increase from 50 to 65", [30]),
    ("a price drops from 80 to 60. what is the percent change?", [-25]), ("increase 200 by 15%", [230]),
    ("what is 500 after a 20% discount", [400]), ("decrease 80 by 25 percent", [60]),
    ("Can you tell me 18% of 250 please", [45]), ("12 is 30% of what number?", [40]),
    ("simple interest on 1000 at 5% for 2 years", [100]),
    ("find the simple interest if principal is 5000, rate is 8 percent and time is 3 years", [1200]),
    ("1000 is invested at 10% compound interest for 2 years. what is the amount?", [1210]),
    ("cost price is 80 and selling price is 100, find the profit percent", [25]),
    # proportion, speed, work
    ("if 5 pens cost 60, how much do 8 pens cost?", [96]), ("3 kg of apples cost 150. what is the cost of 7 kg?", [350]),
    ("a car travels 150 km in 3 hours. what is its speed?", [50]),
    ("how far does a train go in 4 hours at 60 km per hour", [240]),
    ("how long does it take to travel 300 km at 75 km/h?", [4]),
    ("divide 120 in the ratio 2:3", [48, 72]),
    ("A can finish a job in 6 days and B in 3 days. how long working together?", [2]),
    # lists and whole numbers
    ("average of 4, 8, 15, 16 and 23", [13.2]), ("find the mean of 10, 20, 30", [20]),
    ("what is the average of 5 and 9?", [7]), ("median of 3, 9, 4, 7, 1", [4]), ("range of 12, 5, 19, 8", [14]),
    ("gcd of 12 and 18", [6]), ("what is the HCF of 24 and 36", [12]), ("lcm of 4 and 6", [12]),
    ("least common multiple of 8 and 12", [24]), ("is 17 a prime number?", [1]), ("is 21 prime", [0]),
    ("round 3.14159 to 2 decimal places", [3.14]), ("round 47.6 to the nearest whole number", [48]),
    # algebra
    ("solve 2x + 5 = 15", [5]), ("3x - 7 = 11, find x", [6]), ("solve for x: 4x = 28", [7]), ("x + 9 = 20", [11]),
    ("solve 5y + 3 = 2y + 18", [5]), ("solve 3(x + 2) = 21", [5]),
    ("find the roots of x^2 - 5x + 6 = 0", [2, 3]), ("solve x² + 2x - 8 = 0", [2, -4]),
    ("solve the quadratic 2x^2 - 4x - 6 = 0", [3, -1]), ("x^2 = 49", [7, -7]),
    ("what is the discriminant of x^2 + 4x + 4 = 0", [0]), ("evaluate 3x^2 + 2x - 5 at x = 4", [51]),
    ("if x = 3, what is x^3 - 2x + 1?", [22]), ("f(x) = 2x + 3. find f(5)", [13]),
    ("solve 2x + 3y = 12 and x - y = 1", [3, 2]), ("x + y = 10, x - y = 2. find x and y", [6, 4]),
    ("slope of the line through (1, 2) and (4, 8)", [2]), ("distance between the points (0, 0) and (3, 4)", [5]),
    ("midpoint of (2, 4) and (6, 10)", [4, 7]),
    # sequences and logs
    ("find the 10th term of an arithmetic sequence with first term 3 and common difference 4", [39]),
    ("what is the 20th term of the AP 5, 8, 11, ...", [62]),
    ("sum of the first 10 terms of an arithmetic progression with first term 2 and common difference 3", [155]),
    ("sum of the numbers from 1 to 100", [5050]),
    ("5th term of a geometric sequence with first term 2 and common ratio 3", [162]),
    ("sum of the first 5 terms of a GP with first term 1 and ratio 2", [31]),
    ("log base 2 of 8", [3]), ("what is log 1000", [3]), ("ln(1)", [0]), ("natural log of 10", [log(10)]),
    # geometry
    ("area of a circle with radius 7", [pi * 49]), ("find the area of a circle whose diameter is 10 cm", [pi * 25]),
    ("circumference of a circle of radius 5", [10 * pi]),
    ("what is the area of a rectangle with length 8 and width 5?", [40]), ("perimeter of a rectangle 12 by 7", [38]),
    ("a square has side 9. what is its area?", [81]), ("perimeter of a square with side 6.5 cm", [26]),
    ("area of a triangle with base 10 and height 6", [30]), ("find the area of a triangle with sides 3, 4 and 5", [6]),
    ("a right triangle has legs 6 and 8. find the hypotenuse", [10]),
    ("the hypotenuse of a right triangle is 13 and one side is 5. find the other side", [12]),
    ("volume of a cube with side 4", [64]), ("volume of a box 3 by 4 by 5", [60]),
    ("volume of a cylinder with radius 3 and height 10", [pi * 90]),
    ("what is the volume of a sphere of radius 6?", [4 / 3 * pi * 216]),
    ("surface area of a sphere with radius 2", [16 * pi]), ("volume of a cone with radius 3 and height 4", [12 * pi]),
    ("two angles of a triangle are 50 and 60 degrees. what is the third angle?", [70]),
    ("My rectangle is 12 m long and 5 m wide, what's the area?", [60]), ("radius = 3. area of the circle?", [9 * pi]),
    ("area of a sector with radius 6 and angle 60 degrees", [6 * pi]),
    ("sum of the interior angles of a hexagon with 6 sides", [720]),
    ("convert 180 degrees to radians", [pi]), ("what is sin 30 degrees", [0.5]), ("cos(60)", [0.5]), ("tan 45", [1]),
    # conversions
    ("convert 5 km to meters", [5000]), ("how many minutes in 2.5 hours", [150]),
    ("convert 100 celsius to fahrenheit", [212]), ("3 feet in inches", [36]), ("2 kg in grams", [2000]),
    # calculus
    ("derivative of 4x^3 at x = 2", [48]), ("what is the derivative of x^2 at x = 3", [6]),
    ("differentiate 5x^4", [20, 3]), ("integrate 3x^2 from 0 to 2", [8]),
    ("definite integral of x^3 from 1 to 3", [20]), ("integral of 6x^2", [2, 3]),
    # counting, vectors, matrices
    ("10 choose 3", [120]), ("how many ways can I choose 2 people from 5?", [10]),
    ("how many ways to arrange 3 books out of 7", [210]), ("5P2", [20]),
    ("a bag has 3 red balls and 5 blue balls. what is the probability of picking a red ball?", [0.375]),
    ("dot product of (1, 2, 3) and (4, 5, 6)", [32]), ("magnitude of the vector (3, 4)", [5]),
    ("determinant of the matrix [[1, 2], [3, 4]]", [-2]),
    # replies that are not calculations
    ("hi", "greet"), ("hello there!", "greet"), ("thanks", "thanks"), ("what can you do?", "help"),
    ("who are you", "about"), ("what is the capital of France?", "none"), ("tell me a joke", "none"),
    ("who is the prime minister of India", "none"), ("write a poem about the sea", "none"),
    ("what's the weather like today", "none"), ("explain machine learning", "none"), ("how do I cook pasta", "none"),
    ("find the area of a circle", ("need_values", "none")), ("solve the quadratic equation", ("need_values", "none")),
]

# Plausible questions outside what the model was built for. A refusal is fine here; a wrong number is not.
STRETCH = [
    ("what is 20% more than 50", [60]), ("what is 1/3 as a decimal", [1 / 3]),
    ("area of a semicircle of radius 4", [8 * pi]), ("what is the next term in 2, 4, 6, 8", [10]),
    ("factorise x^2 - 9", None), ("what are the factors of 12", None), ("simplify 12/18", None),
    ("solve x^3 = 27", [3]), ("what is the derivative of sin x", None), ("integrate x^2 + 3x from 0 to 1", [1 / 3 + 1.5]),
    ("how many seconds are there in a day", [86400]), ("what is 2 hours 30 minutes in minutes", [150]),
    ("the sum of two numbers is 20 and their difference is 4. find the numbers", [12, 8]),
    ("what is the square of the sum of 3 and 4", [49]), ("volume of a hemisphere of radius 3", [18 * pi]),
]
