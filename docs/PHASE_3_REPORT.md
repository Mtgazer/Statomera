# Phase 3 advanced data quality

2026-11-18, Africa/Cairo. Local branch `feature/phase-3-data-quality` starts at the verified Phase 2D checkpoint `36e169f`.

The existing CSV, JSON and XLSX worker now returns descriptive quality findings. Data Quality exposes co-missingness and exact duplicate frequencies. Column Explorer shows missing rates, distribution counts, IQR thresholds and review suggestions. The English and Arabic views use the same evidence. Preview search, filtering and sorting apply only to the first eight records. Reports describe the imported data under the active schema. They leave the source and its row order intact.

## Methods and result contract

| Method | Definition and limits |
| --- | --- |
| Missing rate | Blanks (including whitespace-only values and structured missing cells) plus configured missing markers, divided by all imported records for that column. Invalid conversions have their own count and remain in the denominator. A header-only dataset has no rate. A rate at or above 20% triggers a coverage warning. |
| Missingness patterns | Each record has an exact set of columns with blanks or configured markers. Invalid observations do not set missing bits. The “No missing cells” count may include rows with invalid values. The worker tracks the first 256 distinct nonempty patterns encountered in source order. It returns the eight most frequent **among those tracked**, breaking ties by ascending unsigned column mask. The other count includes rows from both unshown tracked patterns and untracked patterns. The three totals reconcile exactly to the row count. Patterns describe co-occurrence only. |
| Exact duplicate rows | Compare the normalized source cells position by position, before marker handling, trimming and conversion. CSV compares decoded field strings, preserving whitespace, case, Unicode spelling and marker spelling. JSON and XLSX use adapter-provided scalar text and kind, including each adapter's missing-cell representation. Formatting outside those scalar values (such as CSV quote syntax and spreadsheet styling) is outside equality. The frequency table counts groups by their total occurrences, including the first. The existing duplicate row count is the sum of occurrences after the first in each group. |
| Numeric distribution | Count all valid numeric observations, including repetitions, in up to eight equal-width ranges spanning the observed minimum and maximum. The first range includes the minimum and each range includes its upper edge. Coincident binary64 edges are collapsed, yielding one range for constant data. The table reports valid sample size and displays calculated boundaries with up to 17 significant digits. |
| Potential outliers | Require at least eight valid values for a nonconstant column. Use linear interpolation at zero-based ranks `(n−1) × 0.25` and `(n−1) × 0.75`. With `IQR = Q3 − Q1`, flag values strictly below `Q1 − 1.5 × IQR` or above `Q3 + 1.5 × IQR`. Constant columns, small samples, zero IQR and nonfinite fences have explicit statuses. The flags describe unusual values in this sample and may reflect valid extremes. |
| Categories and variation | The existing frequency and distinct policies still apply. Up to eight most frequent text or Boolean values appear, and unique totals above 1,024 are displayed as a lower bound. Values use the active type's canonical numeric or Boolean form or trimmed source text. Constant means at least two valid observations share one distinct value. Low variation means a nonconstant column has at least 20 valid observations and one value accounts for at least 95% of them, using a complete frequency map. |
| Recommendations | Fixed rules suggest reviewing missing or invalid values, checking type interpretation, reviewing duplicate groups and inspecting potential outliers. The rules have thresholds chosen for this phase. They offer descriptive prompts and do not assign quality scores or infer causes. |

The worker keeps its existing two input passes, file limits and termination behavior. The duplicate map stores one entry per distinct source row and is released after the first pass. Duplicate frequency buckets are bounded by the 100,000-row limit (at most 445 distinct repeated frequencies). The second pass tallies 32-bit missing masks within the existing width limit. Distribution and outlier scans reuse the same sorted numeric buffer as the median. React receives aggregates and finding codes alongside the existing bounded preview and examples. The feature uses the existing parsers and dependency set, with volatile local processing.

## Verification

- `npm run typecheck`, `npm run build:portable`, `npm run build` and `npm run build:eh` passed.
- `npm test` passed all five unit files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 29 individual cases. Independent reference cases cover missingness, exact duplicates, Unicode, skew, fences and endpoints, constant and small samples, high magnitudes, bounded pattern counts and 100,000 records. The skewed eight-value reference has quartiles 2.75 and 6.25, fences −2.5 and 11.5, and one potential outlier.
- `npm run test:browser -- --workers=3 --grep 'quality diagnostics'` passed in portable mode on Chrome, Firefox and Linux WebKit. The case exercises keyboard disclosure, localized denominators, duplicate and distribution table semantics, a 390-pixel Arabic RTL layout in light mode, and replacement of prior findings on upload.


- Final regression used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` for portable, production (DuckDB MVP) and duckdb-eh on Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. All 57 cases per mode passed, for 171 total with zero failures or skips. The salary regression confirmed 5 rows, 3 valid values, 1 blank, 1 invalid and mean 20 in English and Arabic. JSON and XLSX checks confirmed rates on structured data and preserved worksheet and override behavior.
- Browser privacy checks passed across the three modes. They observed only same-origin static HTTP GETs with empty request bodies (and local blob access when surfaced by WebKit), inert rendering of dataset text, CSP protections and empty cookies, local/session storage, IndexedDB and cache storage. Replacement, cancellation, timeouts and worker recovery passed. The near-limit cases verified matching worker start and termination counts.

## Performance and builds

The Node benchmark `node scripts/benchmark-csv.mjs whole 100000` profiled 100,000 rows and five columns (3,388,923 bytes) in 399, 401 and 403 ms, rounded to the nearest millisecond. Peak process RSS was 195,640 KiB across the three runs. Phase 2D reported a 400 ms median and 190,260 KiB for the same benchmark. This comparison uses separate runs. Process RSS includes the runtime and allocations outside the profiler.

The portable browser cases measured end-to-end analysis time for a 4,900,016-byte, 100,000-row CSV and a 2,280,025-byte, 80,000-row CSV. These were single headless observations with three browser projects running in parallel. Chrome used 4× page CPU throttling for the 100,000-row case only. Each browser terminated its worker at completion and preview controls did not start another worker.

| Browser | 100,000 rows | Largest sampled frame gap | 80,000 rows, four columns |
| --- | ---: | ---: | ---: |
| Chrome | 347 ms | 36.1 ms | 266 ms |
| Firefox | 322 ms | 24 ms | 405 ms |
| Linux WebKit | 281 ms | 17 ms | 389 ms |

The DuckDB reference variants took 1.44–1.95 seconds on the same 100,000-row fixture, with sampled frame gaps of up to 264 ms on Linux WebKit. Both workers terminated in every reference run.

| Artifact | Files | Total uncompressed bytes | Largest asset |
| --- | ---: | ---: | --- |
| Portable | 8 | 781,631 | XLSX module, 530,610 bytes |
| DuckDB MVP reference | 10 | 41,184,198 | Wasm, 39,362,651 bytes |
| DuckDB EH reference | 10 | 35,992,246 | Wasm, 34,242,586 bytes |

Portable output grew by 10,608 bytes from Phase 2D. It includes 229,637 bytes of application JS, 9,094 bytes of CSS, and a 9,846-byte parser worker. It has no Wasm. Its file count and largest asset are within the observed Cloudflare Pages Free limits. The two reference Wasm assets exceed the 25 MiB per-file limit. The size check used local build output. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Security and limitations

- `npm audit --omit=dev --json` reported zero advisories. `npm audit --json` exited 1 and reported four high-severity package entries linked to one existing development-only advisory. The locked `picomatch@4.0.7` comes through Vite and its `tinyglobby`/`fdir` chain. Glob matching is in build tooling, outside the dataset path. The audit's automatic Vite suggestion is a major downgrade. The development dependency remains pinned in Phase 3. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
- Peak browser-worker memory, physical Android and Apple Safari, and full assistive-technology testing were unavailable. IQR is descriptive and can underflag or overflag skewed, discrete or multimodal samples. Frequency and missing-pattern caps can hide rarer categories and patterns. Preview actions are limited to eight rows. The interface reports aggregate diagnostics and leaves observations intact.

## Recommendations for Phase 4

Carry explicit eligibility, counts and method metadata into every approved analysis operation. Validate paired-data exclusions, numerical precision and interpretation against independent fixtures before adding new methods. Use the current quality findings as context for analysis choices. Keep calculation and recommendation rules audited separately and verify browser memory on physical low-memory devices before increasing any data limits.

## Local checkpoints

Implementation and tests are in `9c9eb6b`. This report and the architecture and decision updates follow in the next local commit. Phase 3 ends here.
