# Phase 4C statistical visualization and validation

2026-11-18, Africa/Cairo. The local branch `feature/phase-4c-statistical-visualization` starts at verified Phase 4B checkpoint `d9f7ac5`.

## Visualizations

| Chart | Location and statistical convention |
| --- | --- |
| Histogram | Open a numerical column in Column Explorer. The worker's existing bins span the observed minimum to maximum in up to eight equal-width intervals. Coincident binary64 edges merge. Every bin includes its upper edge and only the first includes its lower edge. Heights count valid observations from zero. A vertical mark represents a populated bin with no width. The existing distribution table reports counts and exact upper edges. |
| Box plot | In the same column detail, the box shows Type 7 Q1 and Q3 and the median. When assessable, whiskers extend to the most extreme *observed* values inside the 1.5 × IQR fences. Hollow diamonds show the most extreme potential outlier on each flagged side. The panel lists total flagged counts by side. Constant columns collapse at their only value. For samples below eight, zero IQR or nonfinite fences, the existing unavailable status applies and whiskers show the observed range. |
| Scatter plot | Select Pearson correlation in Descriptive Statistics. It uses the same complete paired rows, including duplicates, with the first column on the horizontal axis. Up to 256 pairs appear as individual marks. Larger inputs count every pair in at most 16 × 16 linear cells over the complete-pair ranges. Coincident edges merge and cells follow the same inclusivity convention as histogram bins. Gold intensity is linear in the count relative to the densest cell. A keyboard-accessible table exposes exact pairs or cell ranges and counts. |
| Confidence interval plot | A supported Statistical Inference result plots its existing finite lower and upper endpoints and the estimated mean or difference on one linear scale. Exact displayed numbers accompany the plot with the selected confidence level. If one endpoint or the estimate exceeds the finite range, the numerical output and warnings remain available and the chart explains why it cannot render. |

Missing and invalid cells keep their separate profile counts or paired exclusion counts. Charts use verified engine values and bounded deterministic aggregates. The interface preserves numerical axis direction in English and Arabic and keeps the full observed ranges visible. Association and inference warnings remain alongside the results.

## Independent validation and accessibility

- The new tests verify hand-derived histogram counts `[4, 1, 0, 1, 0, 0, 0, 2]` with boundaries `1–8`, Type 7 quartiles `1.75` and `5.25` with whiskers `1` and `6`, exact pairing with missing and invalid observations, constant and single-observation columns and linear scaling across opposite-sign binary64 extremes. A 99,000-pair case independently verifies two cell counts of 66,000 and 33,000 and count conservation.
- Browser tests verify eight paired dots and the corresponding data table, the known box quartiles and outlier marker, and a 95% mean interval for `1, 2, 3, 4, 5`. Displayed endpoints agree with the independent Phase 4B SciPy fixture within the browser test's nine-decimal tolerance, and the estimate marker is centered. Phase 4A and Phase 4B numerical reference suites remain part of the unit run. [Phase 4B SciPy fixture](../tests/reference/inference-scipy.json)
- Charts have localized accessible names, adjacent explanations and numeric alternatives. Browser tests exercise keyboard activation, native details, labelled tables, the light theme and Arabic RTL at 390 CSS pixels. Chart outline and axis token contrast against their respective plot backgrounds ranged from 3.24:1 to 9.24:1. Density uses outlined cells and an exact table as well as fill intensity. A 390-pixel Chromium screenshot review checked the dark histogram and box plot and the Arabic light scatter plot. Physical Android, Apple Safari and full assistive-technology coverage remain unverified.

## Verification, performance and hosting

`npm run typecheck`, `npm run build:portable`, `npm run build` and `npm run build:eh` passed. `npm test` passed all eight unit files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 46 tests. The focused portable browser run passed 12 cases across Chrome, Playwright Firefox and Linux WebKit. The first full portable attempt passed 75 cases and failed three instances of an existing median selector because the box plot added a second Arabic median label. The original profile assertion was scoped to its summary and passed all three targeted reruns. The incomplete reference-build attempt was stopped before the final regression.

The 4,500,017-byte, 100,000-row Pearson fixture runs three times per browser. The full worker scan, Pearson calculation, bounded aggregation and observed chart render are included in end-to-end timings. Marker output is bounded at 256 points or 256 cells, and the accessible grid table stays unmounted until requested. Large scatter aggregation streams the pair columns once more to count cells after determining ranges. It stores a bounded prefix and a grid with no complete-pair array. Small plots use the original statistical pass. The UI only maps aggregates into SVG coordinates.

| Portable browser | End-to-end median (ms) | Worker message to chart DOM median (ms) | Worker message to second animation callback median (ms) |
| --- | ---: | ---: | ---: |
| Chrome 156 | 393 | 1.7 | 13.7 |
| Playwright Firefox 159 | 550 | 3 | 6 |
| Linux WebKit 27.2 | 394 | 3 | 33 |

The browser projects ran concurrently. This fixture populates two grid cells. DOM timing uses a mutation observer, and animation callbacks proxy scheduling rather than measuring GPU paint time. The largest portable end-to-end sample was 890 ms in Chrome and the largest portable callback proxy was 35 ms in Linux WebKit.

| Artifact | Files | Total uncompressed bytes | Largest asset |
| --- | ---: | ---: | --- |
| Portable | 11 | 829,088 | XLSX JS, 530,607 bytes |
| DuckDB MVP reference | 13 | 41,231,681 | Wasm, 39,362,651 bytes |
| DuckDB EH reference | 13 | 36,039,729 | Wasm, 34,242,586 bytes |

Portable grew by 11,276 bytes from Phase 4B. SVG and CSS reuse platform capabilities, with no added chart runtime or changes to the package and lockfile. The portable build fits the verified Cloudflare Pages Free file-count and per-file limits. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

Final browser regression used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3`. Portable, MVP, and EH each passed all 78 cases across Chrome, Playwright Firefox, and Linux WebKit. All 234 cases passed without skips, including the Phase 4A and Phase 4B regressions and local privacy checks. The previously observed Chromium file-picker timeout did not recur in any final mode.

## Privacy, security and limitations

Browser cases cover cancellation, file replacement, repeated chart calculation and worker cleanup. Request instrumentation checks that local charting makes only static same-origin HTTP GETs with empty bodies, without dataset identifiers in URLs. Storage and cookies remain empty. Production npm audit reported zero advisories. The full audit exited 1 with four high-severity package entries linked to the existing development-only Picomatch advisory via Vite. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The bounded density grid conceals within-cell variation. Duplicate small-sample scatter marks can overlap and the data table retains those rows. The box plot marks extremes and gives side counts in place of drawing every flagged record. Inclusive binary64 edge rounding can merge bins at tiny representable spans. Browser-worker peak memory and physical-device rendering performance were not measured.

## Recommendations for Phase 5

Carry chart provenance into any approved intent routing, including active schema, pairwise exclusions, binning, and confidence level. Keep verified results as the only source for numerical explanations. Expand keyboard and screen-reader walkthroughs on physical devices before making the chart workflow public.

## Local checkpoints

Implementation and tests are in `352a91c`. This report and the architecture update are a separate local commit. Phase 4C ends here.
