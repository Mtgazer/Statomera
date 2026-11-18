# Phase 2A CSV ingestion and data profiling

Date 2026-11-18, Africa/Cairo. Started from Phase 1B checkpoint `42c063f` on `feature/phase-2a-data-ingestion`.

## Implemented

The portable React application can profile any supported CSV schema in a dedicated worker. The existing English/Arabic, RTL/LTR, theme, file selection, cancellation and salary-summary flow remains available. Import options set the delimiter, header handling, duplicate-name policy and the common missing-marker preset. A row preview and per-column profile tables show counts, inferred types, warnings and expandable numeric or categorical details.

The [dataset contract](../src/dataset.ts) is independent of CSV syntax. The worker validates the file before decoding, selects the parser and returns the profile with timing metadata. The existing DuckDB MVP and EH builds still run their fixed reference salary query when there are valid salary observations. The TypeScript profile supplies the displayed summaries in all builds. The separate reference result is available as `referenceSalaryMean` in those modes. The portable build emits no DuckDB client, worker or Wasm. No package dependencies changed.

## Contract and interpretation

| Boundary | Behavior |
| --- | --- |
| Parsing | UTF-8 with optional BOM and comma, semicolon or tab separators. Accepts CRLF, LF and CR records, doubled quotes, quoted separators and line breaks. Auto selection uses the first logical record and asks for an explicit delimiter when multiple candidates fit. A single-field file defaults to comma. Malformed quotes, NUL and inconsistent record widths fail the import. |
| Normalization | `CsvOptions` defines delimiter, first-row or no-header mode, strict or disambiguated duplicate headers, and marker strings. `Dataset` supplies positional IDs, raw source labels and a repeatable, source-order rectangular record stream. IDs are stable within a schema and independent of duplicate labels or UI language. Header comparison trims, normalizes NFC and folds case. Duplicate labels reject by default, with positional labels available by opt-in. Empty headers are rejected in header mode. |
| Missing and invalid | A whitespace-only field is blank. Marker matching is explicit, trimmed, NFC-normalized and case-insensitive. The UI can opt into NA, N/A, NULL and NaN. The contract also accepts up to 16 custom strings of at most 64 code units. Incompatible nonmissing values count as invalid for a typed column. Text columns retain mixed values and explain ambiguity. The four quality counts (blank, marked missing, invalid, valid) partition each column's data rows. |
| Type inference | Across all nonmissing cells, numeric, boolean or date requires unanimity or at least two matching cells with an 80% share. Mixed evidence carries a warning. Leading zeros in integer-shaped values block general numeric inference. A unique legacy salary label (salary, راتب or الراتب) explicitly retains numeric validation and the salary summary. This label supplies no unit or currency. Numeric syntax is finite ASCII decimal or scientific notation in binary64. Bare integers outside its safe range, overflow and nonzero underflow are rejected for numeric columns. Boolean forms are true/false and صحيح/خطأ. Date type requires valid Gregorian YYYY-MM-DD values. Ambiguous date-like strings remain text or are reported as invalid in an inferred date column. |
| Profile | `DatasetProfile` contains total rows, previews, repeated-row count and `ColumnProfile` values. Repeated rows count occurrences after the first by exact parsed cells, preserving order, case, whitespace and Unicode spelling. The analysis keeps those rows in summaries. Column summaries exclude blanks, markers and invalid values. Count, min and max use admitted observations, mean uses the exact binary64 accumulator and median sorts observations, using the same accumulator for an even midpoint. Text categories use trimmed spelling, with case preserved, and booleans use canonical values. Up to eight frequency entries are ranked by count then lexicographic value. The report gives a distinct count up to 1,024 and an omission warning above it. |
| Limits | Keep the existing 5 MiB, 100,000-row, 32-column, 4,096-code-unit field and 10-second worker budgets. Add a 1,000,000-cell cap. Preview holds eight records and each column returns at most five invalid examples. Two passes use the same bounded decoded file. Exact median needs numeric storage and exact deduplication retains a bounded set of row keys during the first pass. |

For a later format adapter, the normalization boundary is `Dataset`. Introducing native numeric, null or temporal cells would require an explicit contract revision so the source representation and limits can be preserved. Phase 2A covers CSV text only.

## Analytical references

- [Salary fixture](../tests/fixtures/salary.csv) returns 5 rows, 3 valid, 1 blank, 1 invalid and mean 20 in both languages. The independent calculation is (10 + 20 + 30) / 3.
- [Clean numeric fixture](../tests/fixtures/clean-numeric.csv) has distance values 8, 2, 6 and 4, with mean and median 5. Score values 1, −4, 0 and 7 yield mean 1 and median 0.5.
- [Mixed fixture](../tests/fixtures/mixed.csv) has 8 rows across 5 columns and one repeated row. With the marker preset, its amount column has one blank, one marked missing and one invalid. Values 10, 20, 30, 40 and 10 give mean 22 and median 20. The group counts are 5 and 3, and one ambiguous date is flagged.
- [Duplicate headers](../tests/fixtures/duplicate-headers.csv), [malformed quotes](../tests/fixtures/malformed.csv) and an [empty file](../tests/fixtures/empty.csv) cover import policy and structural rejection. Other automated cases exercise sparse and mixed columns, headerless TSV-style input within a CSV file, unsafe integers, out-of-range values, quoted Unicode, high cardinality and the cell cap.

The older missing-salary rejection scenario now asserts valid generic ingestion. Other Phase 1A and 1B cases run against the new profile, including worker lifecycle, simulated cached assets, extreme numeric references and inert rendering.

## Verification and performance

Checked with Node 22.23.3, Chrome 156.0.8078.47, Playwright Firefox 159.0 and Linux WebKit 27.2 on Ubuntu 26.04.1 x64 with a Ryzen 5 5600H. Test commands from the repository root:

```sh
npm run typecheck
node --experimental-test-isolation=none --test tests/unit/*.test.ts
npm run build:portable
npm run build
npm run build:eh
export LD_LIBRARY_PATH=/tmp/askora-webkit-libs.h58Y7U/root/usr/lib/x86_64-linux-gnu
export ASKORA_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers
ASKORA_TEST_MODE=portable npm run test:browser
ASKORA_TEST_MODE=production npm run test:browser
ASKORA_TEST_MODE=duckdb-eh npm run test:browser
npm audit --omit=dev --fetch-retries=0 --fetch-timeout=12000
npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=12000
git diff --cached --check
git fsck --full --no-dangling
```

Type checking, all three production builds and 18 unit tests passed. The full browser matrix passed 108 cases. After a final refinement for all-blank headerless tab input, clearer UI guidance and an explicit DuckDB salary-reference assertion, all three builds passed 45 targeted browser reruns. Both runs reported zero failed or skipped browser cases. The targeted rerun used `npm run test:browser -- --grep 'local picker|malformed|generic profiles|import options|profiles a large'` with each of the three modes. An initial type check during implementation caught tests importing the retired salary-only contract. Updating those assertions to the shared profile resolved the error.

The 60,000-row fixture is 1,020,016 bytes and runs three times per browser and build. The 100,000-row fixture is 4,900,016 bytes and runs once at a 360 px viewport, with Chromium 4× page CPU throttling for the portable run only. The generic multilingual fixture is 2,280,025 bytes, 80,000 rows and four columns, with a reference mean of 20 and 79,998 repeated rows. Durations in the table are from the full matrix and measure file selection to worker completion, in milliseconds. The final targeted portable run measured the 80,000-row fixture at 241 ms in Chrome, 290 ms in Firefox and 429 ms in WebKit. The reference modes include DuckDB startup and query on salary inputs. The generic fixture has no salary label.

| Build | Browser | 60k median / worst | 100k run | 80k mixed run |
| --- | --- | ---: | ---: | ---: |
| Portable | Chrome | 100 / 105 | 262 | 237 |
| Portable | Firefox | 134 / 137 | 237 | 285 |
| Portable | WebKit | 99 / 100 | 216 | 406 |
| MVP | Chrome | 962 / 986 | 1,222 | 284 |
| MVP | Firefox | 1,369 / 1,394 | 1,550 | 280 |
| MVP | WebKit | 1,580 / 1,607 | 1,759 | 357 |
| EH | Chrome | 828 / 835 | 946 | 238 |
| EH | Firefox | 1,098 / 1,122 | 1,298 | 328 |
| EH | WebKit | 1,536 / 1,577 | 2,319 | 480 |

Worker lifecycle assertions count the created and terminated workers on near-limit imports and confirm cancel, replacement, timeout and retry. Page-level Chromium JS heap snapshots are a proxy. They do not measure peak worker/Wasm memory or process reclamation. Physical Android and Apple Safari were unavailable for these runs. Follow the [Phase 1B device steps](PHASE_1B_REPORT.md#physical-device-verification) with the generic mixed and scale fixtures when hardware is available.

## Security and static build

The tested preview only made same-origin static asset GET requests during analysis. Browser-only blob reads in WebKit had no outbound payload. Tests confirmed inert cell rendering, no browser storage or cookies from analysis, local asset responses and worker security headers. The worker sends bounded profile output and is terminated on completion, failure, timeout or cancellation. CSV fields never enter arbitrary SQL or code execution.

The production audit reported zero advisories. The full dependency audit exited 1 on the previously reported Picomatch 4.0.7 development-tree issue through Vite, tinyglobby and fdir. No patched version is listed. CSV input is parsed in browser workers after build and cannot supply glob patterns to the toolchain. [Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

| Portable output | Raw bytes |
| --- | ---: |
| Application JavaScript | 209,210 |
| Parser worker JavaScript | 6,560 |
| CSS | 4,655 |
| HTML | 415 |
| Pages headers | 251 |
| Total | 221,091 |

The portable output remains five files and its largest asset is 209,210 bytes, below the 25 MiB Pages cap. It is 11,592 bytes larger than Phase 1B and uses the existing dependency set. The MVP and EH reference artifacts total 40,623,654 and 35,431,702 bytes. Each has seven files and retains its original oversized raw Wasm asset. Hosted behavior remains unverified. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Phase 2B recommendations

Evaluate chunked CSV parsing and peak worker memory on lower-memory Android hardware. Review schema overrides and delimiter preview/retry UX with representative datasets. Assess cardinality summaries and larger files against measured memory budgets. Confirm hosted CSP, routing and privacy only after deployment approval. Keep type and sentinel policies explicit when adding future format adapters.

## Git checkpoints

The verified implementation commit is `3afadaa`. This report, README, architecture, roadmap and testing updates are in the next commit on `feature/phase-2a-data-ingestion`. The branch remains local, with a clean working tree and no configured remote. Phase 2A ends here.
