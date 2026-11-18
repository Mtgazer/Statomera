# Phase 4A verified descriptive statistics

2026-11-18, Africa/Cairo. The local branch `feature/phase-4a-descriptive-statistics` starts at the verified Phase 3 checkpoint `b53adf5`.

The workspace has a compact English and Arabic Descriptive Statistics panel. Choose an operation and an active numerical column, or two distinct columns for Pearson correlation. Each result includes column IDs, the operation and method, a number or undefined reason, the number of eligible observations or complete pairs, excluded counts and applicable warnings. Results are language-independent. The panel localizes numbers and methods and respects the workspace language, direction and theme.

## Mathematical conventions

| Operation | Definition |
| --- | --- |
| Count, sum and mean | Count all accepted numeric observations. Sum those values and divide by their count for the mean. A count of zero is defined. Other operations require observations, including sum. |
| Minimum, maximum and range | Use the eligible observed endpoints. Range is maximum minus minimum. |
| Median and selected quantiles | Use Type 7 linear interpolation at zero-based rank `(n − 1) × p` on sorted eligible values. Available percentiles are 25, 50 (median), 75, 90 and 95. The requested probabilities are exact rational percentages. The profiler median and Phase 3 quartiles use the same interpolation. [R quantile documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html) |
| Variance and standard deviation | Sum centered squared deviations, then divide by `n − 1` for sample variance or `n` for population variance. Standard deviation is the square root of the corresponding unrounded variance. Sample operations require two eligible observations. Population variance and standard deviation are zero for one observation, and all four are zero for an eligible constant sample when their minimum counts are met. |
| Pearson correlation | Use complete pairs from the same record, including repeated records. Divide the centered cross-product by the square root of the product of the two centered sums of squares. At least two complete pairs and variation in both columns within those pairs are required. The result describes linear association. |

Eligibility uses the existing adapter, missing-marker and conversion rules under the active schema. Invalid and missing records are disjoint in the result: a pair with any invalid value contributes to the invalid partition, even when its other value is missing. The missing-only partition counts the remaining excluded records. Missing-only and invalid counts sum to the excluded count. No imputation or unit conversions are applied.

Finite binary64 inputs are represented as integer multiples of `2^-1074`. Products accumulate at the squared unit scale. For exact integer-unit sums `Sx`, `Sxx` and `Sxy`, the centered numerators are `n × Sxx − Sx²` and `n × Sxy − Sx × Sy`. The subtractions are exact, including for large offsets. Rational outputs and square roots round once to binary64, nearest with ties to even. A rounded nonfinite result has an explicit numeric-range reason. A nonzero result rounded to zero carries a warning. Decimal text is governed by the existing binary64 conversion policy. The UI displays up to 17 significant digits.

## Execution and privacy

The existing parser worker accepts a fixed operation and positional column IDs. It opens the same immutable local File and import options, validates IDs and schema, then streams eligible observations. The first pass reuses the profiler's type-evidence code. The second visits only the requested columns for calculation. Percentiles allocate one bounded numeric buffer; other operations hold counters, endpoints and bounded exact accumulators. The worker returns only the result and provenance for the requested calculation. The UI retires it after completion, error, timeout, cancellation, selection changes, worksheet or schema changes and file replacement. The existing ten-second worker budget applies.

The browser network checks verify only static same-origin GETs with empty request bodies during repeated calculations. They check for dataset tokens in URLs and verify empty storage and cookies. The statistics engine is a lazy same-origin module. No package or lockfile changes were made. Production npm audit reported zero advisories. The full audit exited 1 with four high-severity package entries tracing to the existing development-only Picomatch advisory via Vite, tinyglobby and fdir. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Verification

- `npm run typecheck`, `npm run build:portable`, `npm run build` and `npm run build:eh` passed. An intermediate type check rejected the direct cast in the deliberately malformed-request test. The test now marks the malformed input as unknown before exercising the runtime guard.
- `npm test` passed all six files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 34 individual cases. The signed multilingual fixture has valid values −3, −1, 1 and 3, centered squared deviations summing to 20, and population variance 5. Its Pearson reference cases are +1, −1 and 0.8. Tests also cover undefined and zero outputs, disjoint pairs, invalid and missing records, structured schema overrides, large offsets, extreme finite values and subnormal ties. The checked-in reference assertions require exact binary64 equality.
- A separate seeded scratch check compared 90 generated datasets across six operations against Python Fraction and 100-digit Decimal square roots. All 540 comparisons matched at binary64 precision after normalizing JSON numbers to binary64. The scratch harness initially compared some JSON integer tokens as arbitrary-precision Python integers and was corrected before comparison.
- The initial focused browser run passed nine cases and timed out on three instances of an overly specific test locator. Switching to the accessible combobox role and strengthening the override fixture resolved the failures. The rerun `ASKORA_TEST_MODE=portable npm run test:browser -- --workers=3 --grep 'descriptive|JSON profiles|XLSX worksheet'` passed all 15 cases on Chrome, Playwright Firefox and Linux WebKit.

- Full regression used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` on Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. Portable and DuckDB EH passed 66 of 66 each. DuckDB MVP passed 65 of 66 on the first run. Its one failure was a Chromium timeout waiting for the native file chooser before analysis began. The same test passed three consecutive targeted reruns using `--project=chromium --workers=1 --repeat-each=3 --grep "local picker flow"` against MVP. All statistics, privacy and lifecycle cases passed in all three builds. The salary fixture preserved 5 records, 3 valid salaries, 1 blank, 1 invalid and mean 20 in both languages. The full run skipped zero cases.

## Performance and build size

On a 100,000-row, three-column, 4,500,017-byte CSV, the browser tests run Pearson three times and check all 100,000 paired observations and exact correlation +1. Times include worker startup, decoding, type evidence, computation, rendering and test-observer latency. Each build retires every worker. Separate from the browser run, `node scripts/benchmark-csv.mjs whole 100000` measured the existing ingestion and profiles on 3,388,923 bytes in 416, 428 and 426 ms, with 222,676 KiB process peak RSS. Phase 3 reported 401 ms median and 195,640 KiB peak. These are separate process-level measurements and include runtime and GC effects.

| Browser, portable | Three runs (ms) | Median (ms) |
| --- | --- | ---: |
| Chrome 156 | 382, 355, 353 | 355 |
| Playwright Firefox 159 | 451, 380, 399 | 399 |
| Linux WebKit 27.2 | 302, 383, 264 | 302 |

The browser timings were taken with three Playwright projects running concurrently on the same host. Across all browsers, the MVP and EH runs ranged from 230 to 528 ms and 246 to 479 ms respectively.

| Artifact | Files | Total bytes | Largest uncompressed asset |
| --- | ---: | ---: | --- |
| Portable | 9 | 795,001 | XLSX JS, 530,610 bytes |
| DuckDB MVP reference | 11 | 41,197,568 | Wasm, 39,362,651 bytes |
| DuckDB EH reference | 11 | 36,005,616 | Wasm, 34,242,586 bytes |

Portable output grew by 13,370 bytes. The statistics engine adds a 3,255-byte lazy worker chunk. The portable artifact is Wasm-free and remains within the published Cloudflare Pages Free file-count and per-asset limits. The DuckDB artifacts are reference builds. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Limitations and Phase 4B recommendations

Each request reparses the local file to keep the worker short-lived. Peak browser-worker memory, physical Android, Apple Safari and full screen-reader testing remain unverified. Pearson can be sensitive to unusual observations and only describes linear association. The panel reports one statistic at a time. For Phase 4B, retain these eligibility and undefined-result contracts, validate any proposed comparative calculations with independent references, and benchmark repeated operations on physical lower-memory devices before considering aggregate caching.

## Local checkpoints

Implementation and tests are in `e31f73e`. This report and the architecture update are a separate local commit. Phase 4A ends here.
