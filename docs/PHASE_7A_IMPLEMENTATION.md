# Phase 7A implementation handoff

Phase 7A started on `feature/phase-6c-local-ai-experiment` at `3376753b564cb108b62fcd75e1578507185fe39e` with a clean working tree. The local implementation commit on that branch contains this report. Independent Antigravity QA and formal phase closure are pending.

## Workflow and accessibility changes

- Added Clear Dataset to release the current selection during or after an import, cancel active work, remove worksheet and analytical state, and return focus to the file chooser. The results workspace is bound to the active dataset revision, so replacement or schema changes also retire the previous view and evidence.
- Added bilingual retry for cancelled and transient import failures. Header and delimiter errors can lead users to import options and let them retry the same file with revised settings. Worksheet and schema changes have focus recovery. A ready announcement gives the record and column counts.
- Made workspace section destinations focusable and kept the preview table keyboard-scrollable. Search, filtering, and sorting controls include the accessible description that they apply to the first eight records.
- Descriptive statistics and inference announce progress, completion, and recovery separately from their named evidence groups. Direct analysis and conversation restore focus when a focused Cancel control disappears. Existing evidence values, statistical conventions, and dataset limits are preserved.
- Bounded select widths for narrow layouts. The workspace keeps the existing colors, themes, language switching, and document direction.

Changed files include `src/app.tsx`, `src/locale.ts`, `src/results.tsx`, `src/preview.tsx`, `src/statistics-panel.tsx`, `src/inference-panel.tsx`, `src/conversation/panel.tsx`, `src/styles.css`, `tests/browser/analysis.spec.ts`, and this report.

## Verification

- `npm run typecheck` passed. `npm test` passed all 10 test files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 63 individual tests, with zero failures and skips in both runs.
- `npm run build:portable`, `npm run build`, and `npm run build:eh` passed. Exact artifact sizes below are uncompressed and measured from the generated files, including static files. Deltas use the generated checkpoint artifacts before the change.

| Build | Output | Total bytes | Change | Entry JS | Largest asset |
| --- | --- | ---: | ---: | ---: | --- |
| Portable | `dist-portable` | 883,670 | +3,993 | 315,392 | XLSX JS, 530,607 bytes |
| DuckDB MVP | `dist` | 41,286,247 | +3,986 | 317,325 | Wasm, 39,362,651 bytes |
| DuckDB EH | `dist-eh` | 36,094,295 | +3,986 | 317,325 | Wasm, 34,242,586 bytes |

The portable variant remains the static-hosting baseline. The DuckDB builds retain their existing large Wasm files. No dependency, storage, hosting, or network configuration was added.

### Targeted browser checks

| Build | Browser | Passed | Failed | Skipped |
| --- | --- | ---: | ---: | ---: |
| Portable | Chrome | 15 | 0 | 0 |
| Portable | Playwright Firefox | 15 | 0 | 0 |
| Portable | Playwright WebKit | 15 | 0 | 0 |
| DuckDB MVP | Chrome | 4 | 0 | 0 |
| DuckDB EH | Chrome | 4 | 0 | 0 |

The selected `analysis.spec.ts` and `conversation.spec.ts` tests covered CSV import and retry, JSON replacement, XLSX sheet selection, malformed or unsupported input, stale results across schema changes, direct and conversational evidence, worker cancellation and recovery, and keyboard navigation. The portable salary fixture retained five records, three valid salaries, one blank, one invalid observation, and mean 20 in English and Arabic. Chrome smoke coverage on both reference builds exercised XLSX sheet selection and the three new Phase 7A workflows.

An early run passed 26 of 27 cases. The new privacy assertion rejected two WebKit `blob:` URLs from Playwright's in-memory file picker. The assertion now checks local blob events separately and still requires actual HTTP requests to be same-origin static GETs, without query parameters, request bodies, or fixture identifiers. A later portable run passed 42 of 45 cases because the 360px viewport setup had been placed in a different test from its assertions. Moving the setup fixed all three failures in the final 45-case run.

The 4,500,017-byte CSV fixture with 100,000 records rendered eight preview rows and one header row at 360px without page-level horizontal overflow. Three Pearson runs in each browser retained all 100,000 pairs, produced `r = 1`, and accounted for all pairs in two scatter cells. The measured interaction-to-assertion ranges were 370–414 ms in Chrome, 438–749 ms in Firefox, and 397–470 ms in WebKit. The plot became observable within two animation frames in 6.1–14.1 ms, 4–5 ms, and 24–31 ms respectively. Each browser recorded four worker starts and four terminations. These are desktop test timings with simulated viewport sizes. They do not establish peak memory or physical-device performance. Synthetic privacy checks observed same-origin asset loads and empty web storage, IndexedDB, caches, and cookies.

## Independent QA handoff

- Walk through import, preview, quality, and conversational evidence with keyboard alone in English and Arabic, in both themes. Check focus order and visible focus from the skip link through section navigation, table controls, worksheet selection, schema selection, and the question composer.
- With a native screen reader, listen to import, cancellation, error, cleared, and analysis announcements. Confirm that evidence is navigable on demand and that focus returns to the relevant control when Cancel disappears.
- Recover from duplicate headers, malformed files, a failed worker, and a rejected worksheet. Replace a dataset with a same-named selection, and clear during both import and analysis. Check that old evidence stays hidden during recovery and that the next dataset gets a clean conversation.
- On physical Android and iOS, check the native file chooser, horizontal table scrolling, focus visibility, and 320–390px RTL layout. Repeat with near-limit files and verify dataset and question privacy with network and storage inspection.

The complete browser matrix, native screen readers, physical mobile devices including Apple Safari, and peak memory measurement were outside this implementation verification. The focused checks found no remaining reproducible defect. Run independent QA before closing Phase 7A.
