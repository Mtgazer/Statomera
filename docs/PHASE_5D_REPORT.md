# Phase 5D conversational reliability and validation

Phase 5D started from the clean Phase 5C checkpoint `0b9c2a8` on `feature/phase-5c-conversational-ui`. The local working branch is `feature/phase-5d-conversation-hardening`.

## Baseline and Chromium file picker

Before implementation changes, the unchanged browser suite passed 102 of 102 cases in each of the portable, DuckDB MVP and DuckDB EH builds. All 306 cases completed across headless Chrome, Playwright Firefox and Linux WebKit. The native Chromium chooser opened and loaded the real salary fixture in each mode. The earlier picker timeout did not reproduce. The picker and its specific keyboard test were left unchanged.

## Reliability fixes

Two new focused Chrome checks reproduced issues against the unchanged portable artifacts.

- Clearing the session after publication terminated the active conversational worker, but the workspace still displayed the previous completed answer and its pending turn. The published session snapshot now drives workspace rendering. Clearing it unmounts the old evidence and transcript, and a new import starts with an empty conversation. The same test observes all three workers terminate.
- The browser's 512-character limit could truncate a long question to a valid prefix. For example, a mean request followed by a data modification instruction beyond the limit left an enabled submit button. The composer retains at most one extra code unit to detect overflow, blocks submission, and exposes a localized length message associated with the field. The router and parser retain their original input bound.

The production UI also verifies same-name file replacement, changing the worksheet and applying a schema override during active analysis, busy-state rejection of a second submission, cancellation, clear, worker failure and retry. The test harness calls the real session clear operation to check unmount and is separate from production assets. The existing router detaches its per-request abort listeners and the worker adapter terminates jobs on completion, failure and cancellation.

## Evidence and bilingual adversarial coverage

The panel uses the existing deterministic parser, closed router and verified worker or dataset-profile evidence. No statistical calculation or grammar was changed. The salary fixture yields mean 20 from three valid observations, with one blank and one invalid record. The test suite continues to verify complete Pearson pairs and missing versus invalid exclusions, unavailable coefficients, explicit versus default confidence levels, null means, confidence interval endpoints and shared numerical references. Association and inference are shown with their existing scope, assumptions and warnings. Causal requests are refused, and test evidence is described without claims of proof.

The production corpus covers overlapping English column names, Arabic normalization collisions, unknown columns, unsupported methods, multiple operations, causation, forecasts, data modification, invalid confidence, missing parameters, empty and oversized drafts, and quoted instruction-like labels. Clarifications and refusals add no analytical workers and contain no computed result. It also verifies Egyptian Arabic, input with Arabic and Western numerals, and a mixed-script column label with original spelling. An instruction-like column label containing HTML markup remains literal text and is usable as an exactly quoted label.

## Layout, accessibility and privacy

At 390 CSS pixels browser checks verify English LTR and Arabic RTL, both themes, no page overflow, isolated mixed-script labels, localized numbers, an associated composer label and key instructions, Enter and Shift+Enter, visible keyboard focus, cancel, retry and clear. The conversation has one polite atomic live region. Automated tests verify status text and focus through active analysis, cancellation, retry and clear. Existing tests exercise assumptions and accessible chart alternatives. A static contrast spot-check of the enabled conversation text and focus tokens found minimum sampled ratios of 5.89:1 for text and 5.69:1 for the focus ring across both themes.

Browser request checks saw same-origin static GETs with empty bodies and no question or dataset markers in URLs. The test containing instruction-like text exercises inert rendering. The existing storage and reload checks find no conversation in cookies, local or session storage, IndexedDB or Cache Storage, and no restored transcript after reload. The workspace keeps at most 24 turns per revision and sends no dataset or conversation contents to a service. No dependencies were added.

On 2026-11-18, both `npm audit --omit=dev --json` and `npm audit --json` returned zero advisories in the registry response captured for this run. This result applies to the checked lockfile and the audit response at verification time.

## Verification

Type checking, all three release builds and the isolated portable router harness build succeeded. The standard Node run passed all ten unit files. The non-isolated run expanded those files to 61 passing cases, including the independent descriptive, inference and visualization references and router parity checks. The focused portable browser rerun passed all 15 cases. The initial focused run passed 11 of 15. Three failures came from expecting the Arabic percent to omit its locale direction mark. The fourth came from removing the Firefox worker interception after the request event and before the stub response. The test now waits for the response and keeps the real keyboard assertions.

The final complete regression passed **351 of 351** cases with no retries or skips. Portable, DuckDB MVP and DuckDB EH each passed 117 of 117. The native Chromium picker passed again in all three modes.

The browser runs used Playwright 1.65.1, Chrome 156.0.8078.47, Playwright Firefox 159.0 and Linux WebKit 27.2. For each build mode the command was `ASKORA_ROUTER_TEST=1 ASKORA_TEST_MODE=<mode> ASKORA_BROWSER_CHANNEL=chrome npm run test:browser -- --workers=3`. Run the mode with its matching production assets and the isolated portable harness. Node was 22.23.3 and npm was 10.9.9.

| Build | Files | Total uncompressed bytes | Entry JavaScript bytes | Largest asset bytes |
| --- | ---: | ---: | ---: | ---: |
| Portable | 11 | 873,993 | 307,017 | 530,607 |
| DuckDB MVP | 13 | 41,276,571 | 308,951 | 39,362,651 |
| DuckDB EH | 13 | 36,084,619 | 308,951 | 34,242,586 |
| Isolated router harness | 11 | 874,064 | 307,088 | 530,607 |

Portable grew by 292 bytes from Phase 5C, and its largest asset remains the lazy XLSX parser. It remains the recommended static baseline. Both reference builds still contain large Wasm assets.

## Performance

The benchmark asks `mean salary` three times per size through the real parser and statistics worker. It uses the five-record salary fixture and two sizes of the existing synthetic narrow CSV stress fixture. The 10,000- and 100,000-row files alternate salaries of 10 and 30, whose mean is 20. Timing includes Playwright question entry, submission and observation of the verified DOM result. Frame gaps come from `requestAnimationFrame` during those repetitions. The desktop browsers ran headless with other cases in parallel on a Linux x86-64 workstation with an AMD Ryzen 5 5600H. Results are indicative and include test-driver overhead.

Times are median / worst of three in milliseconds. The frame column is the largest animation-frame gap during the 100,000-row repetitions.

| Build | Browser | 5 records (58 B) | 10,000 rows (490,016 B) | 100,000 rows (4,900,016 B) | Large-run frame gap (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Portable | Chrome | 39 / 43 | 60 / 63 | 229 / 237 | 17 |
| Portable | Firefox | 215 / 306 | 210 / 250 | 370 / 390 | 50 |
| Portable | WebKit | 75 / 143 | 118 / 119 | 249 / 264 | 26 |
| DuckDB MVP | Chrome | 60 / 72 | 58 / 59 | 228 / 229 | 17 |
| DuckDB MVP | Firefox | 168 / 204 | 251 / 251 | 422 / 460 | 67 |
| DuckDB MVP | WebKit | 68 / 119 | 119 / 121 | 246 / 378 | 27 |
| DuckDB EH | Chrome | 60 / 73 | 63 / 117 | 225 / 228 | 17 |
| DuckDB EH | Firefox | 165 / 202 | 252 / 268 | 405 / 426 | 66 |
| DuckDB EH | WebKit | 72 / 121 | 121 / 123 | 237 / 247 | 24 |

For each size all three question workers terminated. A subsequent run of 25 profile questions started no workers, retained 24 turns and evicted older turns. Pending jobs were keyboard-cancellable in all three browsers. The tests observe main-thread frame progress and explicit worker termination. They do not measure peak heap or garbage collection.

## Limitations and Phase 6 recommendations

The question grammar is intentionally bounded and each question is evaluated independently. Physical Android, Apple Safari, touch interaction, native screen-reader announcements and peak memory remain unverified. The keyboard and ARIA checks establish browser behavior and markup only.

If Phase 6 is approved, use this deterministic flow as the control group for any opt-in local model experiment. Compare Arabic, Egyptian Arabic and mixed-script recall and abstention against the same cases. Measure startup, memory and accessibility on physical devices before approving a release. Keep verified statistics and revision checks on the existing worker route.

## Local Git checkpoints

The implementation and focused regression tests are in local commit `591cf68`.

The Phase 5C baseline is `0b9c2a8`. The Phase 5D report and roadmap entry are recorded in the subsequent documentation commit on the local Phase 5D branch.
