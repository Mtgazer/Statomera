"""Generate Phase 4B oracles with SciPy 1.16.3. Output to stdout as JSON."""
import json
import math
import warnings

import numpy as np
from scipy import __version__, stats

CASES = [
    ("meanInterval", [-3, 1, 4, 9, 10], None, 95, 0),
    ("meanInterval", [1, 2], None, 99, 0),
    ("oneSample", [-3, 1, 4, 9, 10], None, 90, 2),
    ("oneSample", [1, 2, 3, 4, 5], None, 95, 3),
    ("oneSample", [0.9999, 1, 1.0001] * 12, None, 95, 0),
    ("welch", [2, 4, 8, 9], [1, 2, 3, 4], 95, 0),
    ("welch", [2, 2.05, 2.1], [-100, -20, 0, 20, 50, 80, 190], 99, 0),
    ("welch", [2, 2, 2], [3, 4, 5, 6, 7], 90, 0),
    ("paired", [12, 14, 15, 20, 21], [10, 8, 17, 18, 20], 95, 0),
]


def make_case(method, x, y, level, null):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        if method == "welch":
            test = stats.ttest_ind(x, y, equal_var=False)
            estimate = np.mean(x) - np.mean(y)
            effect = estimate / np.sqrt((np.var(x, ddof=1) + np.var(y, ddof=1)) / 2)
        elif method == "paired":
            test = stats.ttest_rel(x, y)
            difference = np.subtract(x, y)
            estimate = np.mean(difference)
            effect = estimate / np.std(difference, ddof=1)
        else:
            test = stats.ttest_1samp(x, null)
            estimate = np.mean(x)
            effect = (estimate - null) / np.std(x, ddof=1)
    interval = test.confidence_interval(level / 100)
    result = dict(estimate=float(estimate), degrees=float(test.df), lower=float(interval.low), upper=float(interval.high))
    if method != "meanInterval":
        result.update(t=float(test.statistic), p=float(test.pvalue), effect=float(effect))
    return dict(method=method, x=x, y=y, level=level, nullMean=null, expected=result)


# Include tails near the numerical branch switch, fractional degrees and the full
# supported df range. Log references retain scale down to SciPy's representable tail.
degrees = [1, 1.001, 1.5, 2, 5, 10, 33.25, 100, 1000, 10000, 99999]
critical = [[df, level, float(stats.t.isf((100 - level) / 200, df))]
            for df in degrees for level in [90, 95, 99]]
tails = []
for df in degrees:
    for t in [1e-9, 0.002, 0.5, 1, 1.5, 1.732, 1.733, 2, 3, 6, 10, 20, 30, 50, 100, 1e5, 1e100, 1e300]:
        p = 2 * stats.t.sf(t, df)
        if p >= 1e-300:  # SciPy's survival path itself underflows for some extreme t.
            tails.append([df, t, math.log(p)])
print("{")
for key, rows in (("cases", [make_case(*case) for case in CASES]), ("critical", critical), ("tails", tails)):
    print(f'  "{key}": [')
    print(",\n".join("    " + json.dumps(row, allow_nan=False) for row in rows))
    print("  ],")
print(f'  "scipy": "{__version__}"')
print("}")
