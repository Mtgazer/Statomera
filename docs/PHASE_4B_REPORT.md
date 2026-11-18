# Phase 4B verified statistical inference

2026-11-18, Africa/Cairo. The local branch `feature/phase-4b-statistical-inference` starts at the Phase 4A checkpoint `de2a42c`.

The Statistical Inference panel supports a Student t confidence interval for a sample mean and two-sided one-sample, paired and Welch tests. The same worker result drives English and Arabic. Confidence defaults to 95%, with 90% and 99% available. Estimates, intervals, test statistics, and standardized effect sizes are presented separately, alongside exclusion counts, assumptions and any unavailable values.

## Methods and formulas

| Method | Estimate and standard error | Degrees of freedom and effect size |
| --- | --- | --- |
| Mean interval | Sample mean. Standard error `s/√n` | `n−1`. Reports the interval and sample counts. |
| One-sample t | Sample mean. Standard error `s/√n`. The test numerator is mean minus the entered null mean. | `n−1`. Cohen's d is the difference from the null mean divided by sample SD. |
| Paired t | Mean of within-row differences, outcome minus matched value. Standard error `s_d/√n` uses the sample SD of the complete pair differences. | `n−1`, with `n` complete pairs. Paired dᶻ is mean difference divided by SD of those differences. |
| Welch independent t | Group A mean minus group B mean. Standard error `√(v_A + v_B)`, where `v_g = s_g²/n_g`. | Welch–Satterthwaite `(v_A+v_B)²/[v_A²/(n_A−1)+v_B²/(n_B−1)]`. The standardized difference divides the raw difference by `√((s_A²+s_B²)/2)`. |

Sample variances use divisor `n−1`. Both difference tests use a zero null difference. Two-sided p is `P(|T_df| ≥ |t|)`. The interval is estimate ± the upper Student t critical value times standard error. The one-sample interval is for the population mean even when a nonzero null mean is entered. The group effect size uses the unweighted mean of the sample variances, and the estimates in source units remain available for practical interpretation. The panel gives no automatic significance or causal conclusion. [NIST t-test formulas and Welch–Satterthwaite degrees of freedom](https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm)

## Eligibility, assumptions and numerical behavior

- Eligibility follows the active inferred or overridden schema and import missing-marker policy. Paired tests preserve row alignment and count complete pairs. A row containing both an invalid and a missing value counts as invalid. Welch uses one numeric outcome and one text or Boolean grouping column. Two distinct explicit category values create mutually exclusive row groups. Text matches trimmed source text and Boolean uses its canonical value. Other categories and rows without an eligible group label are reported outside the selected groups. The UI lists up to eight categories from each available frequency profile.
- One-sample and Welch observations must be independent and representative of the population or groups under comparison. Paired differences must be independent across meaningful matches. Approximate normality matters especially for small samples. Check skew and extreme values. A warning below 30 eligible observations in either required sample is a review prompt. The app cannot establish independence, matching semantics, sampling validity or absence of selection bias.
- At least two observations per sample or two complete pairs are required. Zero standard error makes the inference unavailable. A single constant Welch group may still produce a finite test when the other varies, with an explicit warning.
- Exact binary64-unit moments and paired differences remove catastrophic cancellation through the variance and mean-difference calculations. Welch's ratios remain integer rationals until the numerical boundary. The interval combines its center and margin with 64 extra fixed-point bits before endpoint rounding. This preserves finite fields even when other results exceed binary64. The studentized statistic retains a log magnitude when its finite representation is unavailable. Very small p-values use the direct tail and retain log p. A probability that rounds below the representable range appears as an upper bound.
- The Student t implementation uses the regularized incomplete-beta identity at `x = df/(df+t²)`, with a bounded modified-Lentz continued fraction, symmetry, and a log gamma-ratio normalization evaluated by recurrence and a Stirling correction. Critical values invert the direct tail by bounded bisection. The continued fraction signals numerical failure if it fails to converge. [NIST DLMF incomplete-beta continued fraction](https://dlmf.nist.gov/8.17#v), [SciPy Student t distribution](https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_t.html)

## Independent verification

- The checked-in reference generator uses SciPy 1.16.3 and NumPy 2.5.5. It produces nine end-to-end fixtures from SciPy one-sample, Welch and paired tests, 33 critical values and 171 log-tail references spanning fractional degrees of freedom, small tails and the supported degree-of-freedom range. Effects use independent NumPy calculations. The degree-1 Cauchy identity independently checks an extreme tail where the SciPy survival computation cannot supply the reference. Regenerate with `python tests/reference/generate_inference.py` using the pinned reference packages. These packages were installed in a temporary environment for verification only. [SciPy Welch reference](https://docs.scipy.org/doc/scipy-1.16.3/reference/generated/scipy.stats.ttest_ind.html), [SciPy paired reference](https://docs.scipy.org/doc/scipy-1.16.3/reference/generated/scipy.stats.ttest_rel.html)
- A separate seeded SciPy sweep of 4,096 input pairs compared 3,849 finite reference tails at or above 1e-300. The maximum absolute log-tail difference was 5.87e-12. Regenerating the checked-in fixture produced identical bytes.
- End-to-end reference tolerance is `1e-10` relative with a `2e-13` absolute floor for non-p fields. p comparisons use relative tolerance alone, including a very small finite p-value. Log-tail tolerance is the larger of `4e-12` relative or `5e-12` absolute. Counts are exact. Tests cover equal and unequal group sizes, strongly unequal variances, missing and invalid observations, zero variance, small samples, overlap rejection, float overflow and underflow.
- `npm run typecheck`, `npm run build:portable`, `npm run build` and `npm run build:eh` passed. `npm test` passed seven files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 41 cases. The focused browser run `ASKORA_TEST_MODE=portable npm run test:browser -- --workers=3 --grep 'inference|local picker'` passed 12 cases across Chrome, Playwright Firefox and Linux WebKit. A preliminary broader run was stopped after portable and MVP completed so the final run could cover a schema-eligibility correction for structured Boolean groups and an endpoint rounding warning.

- Final browser regression used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` on Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. Portable, MVP and EH each passed all 75 cases for a total of 225, with zero failures or skips. The Phase 4A descriptive and bilingual salary regressions passed. Chromium's earlier file-picker timeout did not recur in the final runs. The picker and its test were unchanged, so these results establish non-reproduction during Phase 4B.

## Performance and hosting

The three 100,000-row paired inference runs per browser use a 4,400,017-byte CSV, with end-to-end timing from the browser action to the rendered result. The parser worker loads inference on demand and reopens the local File using the same import options and time limit. It scans for schema evidence and then streams selected observations and exact moments, with no additional row or pair arrays. Browser tests cover cancellation, retry, file replacement and worker termination.

| Portable browser | Three paired runs (ms) | Median (ms) |
| --- | --- | ---: |
| Chrome 156 | 387, 359, 375 | 375 |
| Playwright Firefox 159 | 511, 420, 401 | 420 |
| Linux WebKit 27.2 | 311, 259, 249 | 259 |

The browser projects ran concurrently. Timings include worker startup, decoding, calculation, and the observed render.

| Artifact | Files | Total uncompressed bytes | Largest asset |
| --- | ---: | ---: | --- |
| Portable | 11 | 817,812 | XLSX JS, 530,607 bytes |
| DuckDB MVP reference | 13 | 41,220,403 | Wasm, 39,362,651 bytes |
| DuckDB EH reference | 13 | 36,028,451 | Wasm, 34,242,586 bytes |

The inference worker chunk is 5,502 bytes. Portable output grew by 22,811 bytes and fits the observed Cloudflare Pages Free file-count and per-file limits. The package and lockfile are unchanged. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Security and remaining coverage

The privacy regression checks same-origin static HTTP GETs with empty bodies, absence of dataset tokens in URLs, empty storage and cookies, lazy loading, and worker retirement. Production npm audit returned zero advisories. The full audit exited 1 against the current lockfile, with four high-severity package entries tied to the existing development-only Picomatch advisory via Vite. Physical Android, Apple Safari, peak browser-worker memory and full screen-reader behavior remain unverified. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Recommendations for Phase 4C

Carry direction, assumptions, method, counts and numeric-limit warnings into any next analytical surface. Validate any proposed new operation with pinned independent references. Use physical-device and screen-reader feedback to review group selection, interval presentation, and repeated execution before extending the interface.

## Local checkpoints

Implementation and tests are in `c7b07a5`. This report and the architecture update are a separate local commit. Phase 4B ends here.
