# Phase 5B safe deterministic analysis routing

Phase 5B began at `106fbd7` on `feature/phase-5a-intent-engine` with a clean working tree. Work is on `feature/phase-5b-analysis-router`.

## Routing boundary

[createAnalysisRouter](../src/router/execute.ts) binds one router to one active [dataset session](../src/dataset-session.ts). `prepare(question)` passes only the active column IDs, source names and types to the Phase 5A parser. `execute(prepared, signal)` accepts the same in-memory revision identity and validates resolved candidates against the current profile and a closed operation list. `run(question, signal)` composes both steps. Parser refusals and clarifications return without launching workers. Candidate validation checks exact IDs, original names, active types, parameter eligibility and unexpected fields.

| Operation family | Evidence |
| --- | --- |
| Dataset overview and quality | Row and column counts, blank and configured-marker missing counts, invalid cell counts, and exact duplicate row counts from the verified profile. Quality and duplicate presence stays Boolean and retains the underlying count. |
| Descriptive statistics | Valid numerical count, sum, mean, median, minimum, maximum, and sample or population variance and standard deviation use the existing statistics worker. |
| Pearson correlation | The statistics worker supplies the existing correlation and complete-pair exclusions. The scalar envelope omits scatter payloads, including individual paired values. |
| Statistical inference | The inference worker supplies Student t mean intervals, two-sided one-sample and paired tests, and Welch tests. The router keeps exact null values, preserves explicit same-row matching, and applies 95% only when confidence is absent. Confidence provenance distinguishes explicit and default levels. |

Numeric values, denominators, warnings, unavailable reasons and effect sizes come from the existing engines. The router neither performs new moments nor calculates probabilities. It attaches typed method assumption labels only. The [result contract](../src/router/contract.ts) distinguishes interpretation, validation, execution failure, statistical unavailability and cancellation. Successful and statistically unavailable results preserve operation, revision, original column metadata, assumptions, and typed evidence for later localization. A cancelled reply carries the cancelled revision and reason without analytical evidence.

## Revision and worker lifecycle

The existing app publishes a profile only after the selected import completes. A new file selection, worksheet selection, schema override or retry creates a new volatile revision and invalidates the former one immediately. The identity is the revision object within its owning session. Its ordinal is useful for display or correlation within that session and does not authorize a copied or foreign handle. The session snapshots import options, including markers and overrides, and retains the original browser File. Clearing the session retires the revision. App unmount clears the session and aborts its import job.

Resolved candidates may start work only after revision and schema validation. A current new router execution supersedes the previous router job. The same abort signal reaches the existing short-lived worker adapter on user cancellation, replacement, clear or supersession. Termination, error handling and the existing timeout remain in that adapter. The router checks cancellation and active revision again after asynchronous results, drops obsolete evidence and releases its listeners. An old candidate cannot cancel work on the current revision.

## Welch membership

The router validates distinct canonical group strings and a current categorical grouping column. The existing inference worker streams exact text or Boolean membership with the current missing-marker and override rules. A group is present when its assigned valid, missing or invalid outcome count is nonzero. An absent group yields a validation clarification naming only the supplied absent labels and preserves assigned and outside-group counts. The existing inference engine exits before calculating a Welch test when either eligible sample is empty. A present group with all missing or invalid outcomes keeps the engine's statistical `insufficient` result. The check works above the profile frequency cap and uses no additional group materialization or category substitution.

## Verification

- `npm run typecheck`, `npm run build:portable`, `npm run build`, and `npm run build:eh` passed. `npm test` passed ten files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 61 individual cases.
- Seven router unit cases cover all supported operation families, equality with direct engine results, SciPy inference fixtures, exact parameters and confidence defaults, complete-pair exclusions, insufficient-sample and constant-column reasons, label changes, stale or fabricated candidates, Welch groups above the category cap, cancellation, supersession and nonexecution for unresolved intents. The salary fixture produces 20 from three eligible values in both languages.
- During implementation, TypeScript required an explicit discriminated return type on the column-pair validator. The first router fixture also exposed an ambiguous use of the header `matched` next to the phrase `by row`. Quoting the header resolved the fixture without changing the verified parser.
- Built the separate harness with `./node_modules/.bin/vite build --config vite.router-test.config.ts --mode portable`. `ASKORA_ROUTER_TEST=1 ASKORA_TEST_MODE=portable npm run test:browser -- --workers=3 router.spec.ts` passed 12 focused browser cases. The harness mounts the same active workspace and uses the production worker adapter. It exercises file replacement, stale overrides, clear, cancellation, supersession, deliberate worker startup failure, retry, and worker retirement on Chromium, Firefox and Linux WebKit. It is served on a separate loopback port and is excluded from production builds.

- Final browser verification used `ASKORA_ROUTER_TEST=1 ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` for portable, production, and duckdb-eh. All 90 cases per run passed, totaling 270 with no failures or skips. Each run included 78 release-build regressions and 12 cases against the isolated portable router harness. The previously observed Chromium file-picker timeout did not recur.

## Performance and build sizes

| Artifact | Files | Total bytes |
| --- | ---: | ---: |
| Portable | 11 | 829,635 |
| DuckDB MVP reference | 13 | 41,232,228 |
| DuckDB EH reference | 13 | 36,040,276 |
| Isolated test harness | 11 | 851,074 |

The release bundles grew by 547 bytes for the shared session lifecycle. The Phase 5B router and test hook are reachable only from the isolated harness in these builds. Existing statistical worker modules were unchanged. The browser timing fixture runs three end-to-end paired queries on 80,000 rows and 560,017 bytes. Times include browser automation, worker startup, parsing and verified computation. The scalar result excludes scatter data after the existing worker returns it, so the timing includes the worker's existing scatter aggregation.

| Browser (portable suite) | Three elapsed times (ms) | Median (ms) |
| --- | --- | ---: |
| Chrome 156 | 226, 213, 219 | 219 |
| Playwright Firefox 159 | 165, 157, 152 | 157 |
| Linux WebKit 27.2 | 207, 176, 222 | 207 |

## Privacy, limits and Phase 5C

Browser instrumentation observed same-origin static HTTP GETs with empty request bodies. Dataset tokens stayed out of request URLs. Cookie and data storage checks remained empty. Production npm audit reported zero advisories. The initial full audit stalled. A bounded retry with `--fetch-timeout=12000 --fetch-retries=0` completed with exit 1 and four entries associated with the existing development-only Picomatch advisory. The stalled command was then stopped. No runtime dependencies or remote services were added. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) Physical Android, Apple Safari, peak worker memory and full screen-reader coverage remain unverified. Welch group membership validation may still require reading the selected file. The router treats revision handles as in-memory objects rather than portable or persistent identifiers.

Phase 5C should render clarification, refusal and evidence from this envelope and preserve exact worker values. Bind displayed results to the active revision and current request, render original names as text, and use locale-specific labels for assumptions and unavailable reasons. Keep file contents and question history in volatile local state.

## Local checkpoints

Implementation and tests are in `aadcd3e`. The report and targeted architecture and roadmap updates are a separate local checkpoint. Work stops at Phase 5B.
