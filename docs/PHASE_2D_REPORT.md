# Phase 2D dataset workspace

2026-11-18, Africa/Cairo. Based on `49a19cc` on `feature/phase-2d-data-workspace`.

## Implemented workspace

- **Overview.** Filename, detected file format, selected worksheet, record and column counts, inferred types, repeated rows, missing cells and invalid observations. The salary fixture still shows its existing summary.
- **Preview.** The first eight records retain source text and record numbers. Text badges distinguish blanks, configured missing markers and invalid cells. Column headers select the corresponding explorer profile. Search matches preview text across columns. Filtering shows rows with missing or invalid cells, and selecting a column enables locale-aware text sorting. Preview actions leave full-dataset metrics unchanged.
- **Quality and explorer.** The quality summary explains its counts and links to column details. The explorer shows inferred type, active override, valid, blank, marked and invalid counts, unique valid values, warnings, rejected-value examples and existing numerical/categorical summaries. Narrow viewports stack profiles in cards with the override and expanded details in view.
- **Import flow.** Existing file options, worksheet changes, dark/light themes, English/Arabic, cancellation, retries and worker recovery are available. Anchored sections and a keyboard skip link provide navigation.

## Architecture and limits

The existing worker and profiler supply preview statuses during the validation pass. Type inference is tracked independently from the applied override. Distinct values use the same bounded maps as categorical frequencies and stop at 1,024 distinct values per column. Above that, the UI reports a lower bound. Values use the active type's canonical number or Boolean form, or trimmed source text. Distinct counts exclude missing and invalid values. No extra dataset scan, format adapter, table package or statistical engine was added. The main thread handles up to eight rows and the existing bounded profiles.

## Accessibility and verification

Reviewed a 1440 px English dark overview and the Arabic light layout at 390 px. The mobile visual review caught hidden expanded details in the horizontally scrolled explorer, so the explorer now stacks on narrow screens. A follow-up screenshot verified that the selected card and override fit the viewport. Browser tests cover the skip link, keyboard column selection, live preview-count markup, labeled native controls, selected/sorted states, clean RTL layout and light theme. Status text accompanies color. Sampled accent and invalid-text contrast pairs ranged from 5.64:1 to 9.18:1; this was a targeted check. Full assistive-technology testing, physical Android and Apple Safari remain unverified.

Ran the three builds with `npm run build:portable`, `npm run build` and `npm run build:eh`, including type checks. Unit tests used `node --experimental-test-isolation=none --test tests/unit/*.test.ts`. The focused run used `npm run test:browser -- --workers=3 --grep 'workspace navigation|near-limit|local picker|generic profiles|XLSX worksheet'` in portable mode. The final run used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` for portable, production and duckdb-eh on Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. All three builds and type checks passed. All 24 unit tests and 162 final browser cases passed, with zero skips. The earlier focused run passed 15 cases.

The bilingual CSV regression still verifies 5 records, 3 valid salaries, 1 blank, 1 invalid and mean 20. JSON and XLSX assertions verify schema overrides, localized results and worksheet/format handling. Existing worker and privacy tests cover replacement, cancellation, cleanup and recovery, same-origin static requests, inert data and empty persistence stores.

## Performance and build

The near-limit fixture is 100,000 rows and 4,900,016 bytes. The browser verifies that the preview renders exactly eight records and that filtering does not start another worker. Browser durations below are single headless measurements with three concurrent browser projects. Chromium used 4× page CPU throttling for this fixture.

| Browser | 100,000 rows | Largest sampled frame gap | 80,000 rows, 4 columns |
| --- | ---: | ---: | ---: |
| Chrome | 301 ms | 32.4 ms | 269 ms |
| Firefox | 285 ms | 18.0 ms | 397 ms |
| WebKit | 293 ms | 26.0 ms | 366 ms |

The reproducible Node benchmark `node scripts/benchmark-csv.mjs whole 100000` on a 3,388,923-byte fixture had median profiling times of 390 ms in Phase 2C and 400 ms in Phase 2D. Linux process peak RSS was 192,964 KiB and 190,260 KiB respectively. These are three-iteration process proxies, including runtime and other allocations. Peak browser-worker memory was not measured.

Portable output has eight files totaling 771,023 bytes, up 13,356 bytes from Phase 2C. Application JS is 221,220 bytes, CSS 8,747 bytes, the parser worker 8,002 bytes, and the largest lazy XLSX module 530,610 bytes. The portable build still contains no DuckDB or Wasm. MVP and EH totals are 41,173,593 and 35,981,641 bytes respectively. There are no dependency changes. Production npm audit reported zero advisories. The full audit exited 1 on the pinned development-only Picomatch issue. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Phase 3 recommendations

Review full-dataset paging and query scope before extending the preview beyond eight records. Validate warning language with representative ambiguous data and test screen readers, physical mobile devices and high-cardinality memory before raising limits. Treat quality diagnostics and any future inference as evidence-based findings with visible assumptions.

Implementation checkpoint `28848c6`. This report and the documentation updates follow in the next local commit. The branch has a clean working tree and no configured remote. Phase 2D ends here.
