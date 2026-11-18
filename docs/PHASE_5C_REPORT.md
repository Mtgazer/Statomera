# Phase 5C bilingual conversational workspace

Phase 5C began on `feature/phase-5b-analysis-router` at `204215f` with a clean tree. The implementation branch is `feature/phase-5c-conversational-ui`.

## Workspace behavior

After a dataset is ready, **Ask your data** appears between the dataset overview and preview and is linked from the workspace navigation. The composer submits with Enter, inserts a newline with Shift+Enter, and leaves IME composition to the browser. The send, cancel, retry and clear buttons are native controls. The transcript has a keyboard-focusable scroll area. A polite live region announces progress and the outcome of each turn without reading the entire table aloud.

The interface renders in the selected workspace language and theme. Original column labels, group names and questions use bidi isolation and text rendering. English uses LTR and Arabic uses RTL. The 390-pixel viewport checks cover typography, control layout, and horizontal overflow. The feature uses existing Electric Graphite and Champagne Gold tokens.

## Evidence and lifecycle

The panel sends each standalone question to Phase 5B's `createAnalysisRouter`. Profile answers preserve count and presence, units, and blank versus configured-marker counts. The shared statistical and inference renderers show the worker value, method, eligible and excluded observations, unavailable reasons, and warnings. The conversation adds original column names, assumptions, confidence provenance, the explicit null mean, and pairing or group direction when applicable. A p-value below binary64 range is shown with the existing bound and the worker's retained natural log. Inference reuses the existing confidence interval plot.

Clarification distinguishes missing inputs, ambiguous or ineligible columns, and absent Welch groups. Unsupported, unavailable, cancelled, validation failure and execution failure have distinct localized presentations. Retry resubmits the original question on the same active revision. The screen asks users to submit a complete revised question after clarification.

Each panel is keyed by the published dataset revision. Its router and request use the existing session, and the UI checks both request identity and the live revision before publishing a reply. File selection, worksheet selection and schema override retire the previous conversation. Cancel aborts the current request. Clear aborts it and empties the draft and transcript. Up to 24 turns of at most 512 UTF-16 code units per question remain in component memory for that revision. Queries and transcripts use no storage, telemetry or transmission. Previous turns are for display, with each question parsed independently.

The Phase 5A parser, Phase 5B router and numerical engines retain their existing contracts. The direct controls and prior profiling and charts remain available. The isolated Phase 5B test hook is absent from all release builds. No dependencies were added.

## Verification

- Type checks ran in `npm run build:portable`, `npm run build`, and `npm run build:eh`. All three builds passed. `npm test` passed all ten files. The non-isolated Node run `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 61 cases, including the independent numerical references and router parity tests.
- The initial focused portable production UI suite passed 12 cases across Chrome, Playwright Firefox and Linux WebKit. It covered keyboard submission and multiline input, verified profile and statistical evidence, Arabic and English, RTL and light mode at 390 px, clarification, refusals, Pearson paired counts, an unavailable coefficient, cancellation, worker failure and retry, clear, replacement and override invalidation. The bilingual salary result was 20 from three eligible values. The final test definition also checks the default 95% interval and the reused interval plot.
- Browser privacy checks observed only same-origin static GETs with empty bodies and no question text in request URLs. Cookies, local and session storage, IndexedDB and cache storage remained empty. A reload and import yielded an empty transcript.
- Dark English and light Arabic conversation screenshots were reviewed at 390 px. The initial review exposed a long-answer scroll anchor that could hide the newest result at the bottom of the transcript. A final Chromium layout check confirmed the newest Arabic result was visible in a populated transcript. The implementation aligns the newest turn when the result arrives and limits Pearson-specific exclusion wording to Pearson results. An early broad browser run was stopped before retesting those refinements.

- The final full regression used `ASKORA_ROUTER_TEST=1 ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` for portable, production (MVP) and duckdb-eh. MVP and EH each passed all 102 cases. Portable passed 101 of 102. All 36 new production conversation cases passed. The one failure was the previously observed Chromium native file-picker timeout before processing began. The test now verifies focus and sends Enter directly to the picker button while listening for the chooser. Six targeted picker repeats per build passed across the three browsers (18 total). The application picker implementation was unchanged.

| Build | Files | Total uncompressed bytes |
| --- | ---: | ---: |
| Portable | 11 | 873,701 |
| DuckDB MVP | 13 | 41,276,280 |
| DuckDB EH | 13 | 36,084,328 |
| Isolated router harness | 11 | 873,772 |

Portable grew by 44,066 bytes, including the now-reachable parser and router. The worker assets are unchanged. Physical Android, Apple Safari, full screen-reader coverage and peak worker memory remain unverified.

## Local checkpoints

Implementation and production UI tests are in `6d152eb`. The picker test adjustment and this report are a separate local checkpoint. Work stops at Phase 5C.
