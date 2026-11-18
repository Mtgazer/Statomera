# Phase 2B memory and schema overrides

2026-11-18, Africa/Cairo. Based on `4868323` on the local `feature/phase-2b-memory-schema` branch.

## Baseline and comparison

Run `node scripts/benchmark-csv.mjs whole 80000` or replace `whole` with `chunked` and the row count with 10000, 80000 or 100000. Each invocation runs three iterations in one fresh Node 22.23.3 process on Ubuntu 26.04.1 x64 and Ryzen 5 5600H. The deterministic fixture uses unique numeric IDs, numeric amounts, Arabic categories, booleans and mixed ISO/ambiguous dates. The table shows median read/decode/setup time, a standalone parser scan, and complete profiling time including its own two scans. Values are milliseconds. Peak RSS is the Linux Node process high-water mark in KiB, including the generated input, runtime and allocations across iterations. It cannot attribute memory to a browser worker or establish that the OS immediately reclaims it.

| Rows / bytes | Phase 2A whole read / scan / profile | Chunked reads then join | Phase 2B whole read / scan / profile | Peak RSS, 2A / chunked / 2B |
| --- | ---: | ---: | ---: | ---: |
| 10,000 / 328,922 | 1.5 / 5.5 / 50.6 | 0.9 / 3.5 / 49.1 | 1.2 / 3.9 / 47.7 | 98,408 / 99,448 / 98,276 |
| 80,000 / 2,708,922 | 9.3 / 27.6 / 326.7 | 5.9 / 27.8 / 321.5 | 9.2 / 27.6 / 309.0 | 188,996 / 209,524 / 179,420 |
| 100,000 / 3,388,923 | 12.2 / 33.4 / 394.6 | 7.9 / 36.2 / 399.5 | 11.6 / 33.2 / 387.1 | 205,748 / 221,744 / 189,540 |

The higher-byte browser fixture uses 4,900,016 bytes at the existing 100,000-row limit. At 360 px and 4× Chromium page CPU throttling, the comparable single-worker measurement was 271 ms before and 251 ms after. The observed maximum interval between animation callbacks during the job was 31.5 ms before and 27.7 ms after, from 15 and 14 samples respectively. This is a responsiveness proxy from single headless runs. Both runs retired the worker. The preceding baseline also passed the cancellation/replacement and local-only browser checks. A larger row count would exceed the existing limit. Reliable peak browser-worker memory and physical Android/Apple Safari measurements were unavailable.

## Chunked parsing decision

The benchmark-only candidate reads 64 KiB slices using a streaming UTF-8 decoder and joins the decoded fragments before calling the shared parser. The quoted semicolon fixture crosses one-byte chunks, including escaped quotes, CRLF, embedded newlines, emoji and Arabic code points. The candidate also verifies malformed UTF-8 rejection. Joining makes it possible to reuse automatic delimiter selection and existing malformed-record errors. The read stage improved on the larger fixtures, but profiling stayed broadly comparable and process RSS increased. This tests chunked reads with the existing parser. It does not quantify a fully incremental lexer.

Retain the bounded whole-file parser. A true streaming implementation would need resumable delimiter detection, quoted-field and CRLF state, fatal decoding and cancellation between chunks, plus repeatable scans or a replacement for the two-pass profiling model. Exact duplicate detection and medians still need working state. At the existing file cap, the measured candidate gave no reason to introduce that complexity. Production continues to terminate the worker on cancellation, errors, timeout, replacement and completion.

Instead, Phase 2B clears duplicate keys before allocating the second-pass summaries, packs only admitted numeric values into fixed-size Float64Arrays for the exact median, and skips reclassification when counting text frequencies. The 100,000-row process peak decreased about 8% in these runs. Mean and median definitions and all file, row, column, cell and time limits are unchanged.

## Schema overrides

Column profiles now have an accessible native selector for Automatic, Text, Number, Boolean and ISO date in English and Arabic. The worker validates the override against generated positional column IDs and approved types. Blank and opt-in missing-marker handling occurs before strict conversion. Text preserves source values. Numeric, Boolean and ISO date overrides use the existing conversion rules, with rejected counts and bounded raw examples. Ambiguous dates, locale-formatted numbers and currency symbols stay invalid under their respective strict selections.

An override reprofiles the selected local File with its original import settings. The main thread retains the File handle and chosen overrides for retry during that import. A replacement import starts in automatic mode. While reprocessing, the previous result is removed. Abort and job identity checks prevent stale results from publishing. Cancelling or failing a schema job allows a local retry. The automatic salary regression remains 5 rows, 3 valid, 1 blank, 1 invalid and mean 20.

## Verification and deployment

Ran `npm run typecheck`, `npm run build:portable`, `npm run build`, `npm run build:eh` and `node --experimental-test-isolation=none --test tests/unit/*.test.ts`. Focused Chromium checks used `ASKORA_TEST_MODE=portable npm run test:browser -- --project=chromium --grep 'schema|near-limit'` and passed all three cases. Full browser reruns used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` for `portable`, `production` and `duckdb-eh`, with Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. The initial portable and MVP suites each hit three instances of the same ambiguous date-label test locator after adding the schema selector. The assertion now targets the profile cell. An early rerun was also blocked by the prior loopback server shutting down. The successful reruns started after teardown. Final runs passed 19 unit tests and 126 browser cases (42 per build), with zero skips. Type checking and all three builds passed.

Ran `npm audit --omit=dev --fetch-retries=0 --fetch-timeout=12000` and `npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=12000`.

Production audit returned zero advisories. The full audit exited 1 on the existing development-only Picomatch issue in the pinned Vite tree, with no dependency changes. Browser regressions exercised same-origin asset requests, inert source text, lack of dataset persistence, limits and worker termination. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The portable artifact is 222,791 bytes across five assets, up 1,700 bytes from Phase 2A. Its largest file is 210,578 bytes and it includes no Wasm or DuckDB artifacts. The static headers remain present. The largest file is below the documented 25 MiB Cloudflare Pages limit. MVP and EH reference builds retain their same-origin DuckDB paths. Hosted behavior remains unverified. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Phase 2C recommendation

Evaluate Excel, JSON and Parquet as separate bounded format adapters. Define typed preservation and per-format resource limits before implementation. Measure high-cardinality memory on a physical low-memory device before increasing budgets. Keep timestamp, decimal and identifier handling explicit.

Implementation and benchmark checkpoint `e2f5cea`. The report and architecture update follow in the documentation commit. Phase 2B ends on a clean local branch with no configured remote.
