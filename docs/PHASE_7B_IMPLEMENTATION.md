# Phase 7B implementation handoff

Phase 7B started on `feature/phase-6c-local-ai-experiment` at `a36eedf30cc88e466f3320ff277c96a06657046e` with a clean working tree. The local implementation commit on this branch contains this handoff. Independent Antigravity QA and formal closure are pending.

## Reporting and responsive presentation

- The analytical report shows the filename, source format, worksheet when present, record and column counts, blanks, configured missing markers, invalid values, and duplicate rows. It explains that preview filters affect the first eight rows only and that analyses use the complete dataset with method-specific eligibility.
- Report contents can show one column profile and the most recently added finding from each of descriptive statistics, inference, and conversation. A new selection replaces the previous finding in its section. Verified unavailable results include their reason. Unsupported questions stay in the conversation with their explanation. Empty reports and header-only datasets have their own states.
- The report retains existing result objects in memory at the active dataset revision. It reuses column summaries and quality diagnostics, statistical evidence, interval and inference outputs, and conversational evidence. It retains the original column names, paired counts, exclusions, inference assumptions, and Welch groups and outside-group counts. Replacing, clearing, or reprofiling a dataset retires its report. Clearing the conversation removes its contribution to the report.
- The histogram, box plot, scatter plot, and confidence interval use the existing SVG views and canonical result data. The chart module loads on first use. Chart descriptions are associated with accessible image roles and exact values remain available as text or tables. If the chart asset fails to load, the numerical evidence remains readable. Report contents mount on open, and copying evidence into the report starts no analytical workers.
- Keyboard jump navigation, visible focus, fit at narrow widths, English LTR, Arabic RTL, and dark and light themes use the existing workspace. The report stays in the workspace. Export formats and PWA functionality were outside this implementation.

## Files changed

- Report and chart adapter files include `src/report.tsx`, `src/report-action.tsx`, `src/chart-views.tsx`, and `src/charts.tsx`.
- Workspace integration files include `src/app.tsx`, `src/results.tsx`, `src/statistics-panel.tsx`, `src/inference-panel.tsx`, `src/quality-results.tsx`, `src/conversation/answer.tsx`, `src/conversation/panel.tsx`, `src/locale.ts`, and `src/styles.css`.
- Verification and handoff files include `tests/browser/report.spec.ts`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and this report.

## Build and unit verification

`npm run typecheck`, `npm test`, and `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed. The two unit runs passed all 10 test files and all 63 individual tests respectively, with zero failures and skips. All builds passed using `npm run build:portable`, `npm run build`, and `npm run build:eh`.

Values below are actual uncompressed output bytes. The comparison uses the Phase 7A artifacts. The lazy SVG chunk is shared by all four chart types. It was requested once after the first graph opened and absent during import and a context-only report.

| Build | Files | Total bytes | Change | Entry JavaScript | Lazy chart JavaScript | Largest asset |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Portable | 12 | 895,890 | +12,220 | 317,417 (+2,025) | 8,934 | XLSX JS, 530,607 |
| DuckDB MVP | 14 | 41,296,848 | +10,601 | 317,731 (+406) | 8,934 | Wasm, 39,362,651 |
| DuckDB EH | 14 | 36,104,896 | +10,601 | 317,731 (+406) | 8,934 | Wasm, 34,242,586 |

The portable variant remains the static-hosting baseline. The reference builds retain their existing large Wasm assets. The package manifest, lockfile, dataset limits, and statistical formulas were unchanged.

## Focused browser verification

The selected Playwright runs used the existing project configuration with `ASKORA_TEST_MODE=portable`, `production`, or `duckdb-eh` and one worker. The portable selection covered reporting, Phase 4C charts, salary and worksheet ingestion, Phase 7A lifecycle and focus, and the production conversation. The reference builds covered reporting, charts, the salary picker, and clearing active work. The 80 selected executions passed with zero failures and skips. The last change corrected the inferred-type label in column reports. A separate focused test verified the label, the active override, and the reset across a schema change. It passed seven executions with zero failures and skips. Those runs used all three portable browser projects and Chrome and Firefox on both reference builds.

| Build | Chrome | Playwright Firefox | Playwright WebKit |
| --- | ---: | ---: | ---: |
| Portable | 16 passed | 16 passed | 16 passed |
| DuckDB MVP | 8 passed | 8 passed | Outside the selected run |
| DuckDB EH | 8 passed | 8 passed | Outside the selected run |

The report tests compared Pearson with a Python `statistics.correlation` reference, histogram and quartile values with hand-checked fixtures, and confidence interval endpoints with the existing Phase 4B SciPy reference. They verified Welch exclusions and outside-group counts separately, chart names and descriptions, unavailable evidence, worksheet context, local-only requests, and empty browser storage. Content fit at 320, 360, 390, 768, and 1280 CSS px in the exercised layouts. The implementation review examined Chrome screenshots in English dark desktop and Arabic light mobile layouts.

The first report-only run passed 11 of 12 executions. Firefox's content process crashed during the confidence interval test. The first extended portable run passed 41 of 45. Firefox crashed again in that case, and a transient second status role from chart loading interfered with one Phase 7A assertion in each browser. The interim reference runs passed 13 of 16 on MVP and 14 of 16 on EH. Those runs used older built artifacts for the newly added chart-load failure check, and MVP also saw the Firefox crash. Chart loading now keeps the existing analysis status role distinct and preserves numerical evidence when SVG assets fail. The interval check waits for the chart and verifies each endpoint with the same explicit approach as Phase 4C. The isolated Firefox diagnostic passed both selected checks, and the browser crash did not recur in the 80-case run. The native Firefox crash cause was not established.

## Performance and remaining limits

The 4,400,017-byte, 100,000-record fixture kept all 100,000 complete pairs in two density cells of 50,000 pairs each. Opening the report reused the verified result with zero additional worker starts. The time from invoking report navigation through observing the chart was 44 ms in Chrome, 48 ms in Firefox, and 38 ms in WebKit for Portable. MVP measured 44 ms in Chrome and 49 ms in Firefox. EH measured 56 ms in Chrome and 46 ms in Firefox. These are individual desktop automation samples that include navigation and assertion overhead. They do not establish peak memory or physical-device responsiveness.

The implementation exercised desktop layout and simulated mobile viewports. Physical Android and iOS devices, Apple Safari, native screen readers, peak memory, and the full browser matrix remain unverified in this phase. Reports are intentionally bounded to the selected evidence in the current tab. When an on-demand chart asset is unavailable, the numeric evidence can still be read. Retrying the asset requires reloading the page.

## Antigravity handoff

- Cross-check the report against direct analysis and conversation on known fixtures in English and Arabic. Include blank cells, configured markers, invalid values, complete pairs, outside-group counts, unavailable outcomes, and chart alternatives.
- Verify keyboard navigation and focus, and inspect accessible descriptions and table navigation with native screen readers. Check long mixed-direction source labels, light and dark themes, touch, and table scrolling on physical Android and iOS devices.
- Exercise repeated near-limit imports and chart/report views on lower-memory devices. Confirm revision cleanup on schema changes, worksheet switches, and same-name replacement. Inspect request and storage behavior to verify that evidence remains local.
