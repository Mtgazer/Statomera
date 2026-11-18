# Phase 5A bilingual deterministic intent understanding

Phase 5A started at `c4b1328` on `feature/phase-4c-statistical-visualization`. The working tree matched the expected checkpoint. Implementation is on `feature/phase-5a-intent-engine`.

## Supported intent contract

`parseAnalysisIntent(question, schema)` in [src/intent/parse.ts](../src/intent/parse.ts) accepts one question and a read-only list of column IDs, source names, and active types. Its [TypeScript contract](../src/intent/contract.ts) returns a language hint and one of three statuses.

| Status | Result |
| --- | --- |
| `resolved` | A discriminated profile, descriptive, or inference intent with column IDs and original source names. Relevant parameters include presence versus count, sample versus population, null mean, confidence level, same-row matching, and literal group values. |
| `needs_clarification` | An operation candidate and structured issues for missing, unknown, ambiguous, or ineligible inputs. Validated partial inputs can be retained in `known`. |
| `unsupported` | A reason for refusal or an unmatched grammar, with no intent. |

| Family | Covered requests |
| --- | --- |
| Overview and quality | Row count, column count, missing or invalid values across the dataset or in a column, and exact duplicate row counts. Value-quality and duplicate requests can distinguish presence from count. |
| Descriptive | Valid numerical count, sum, mean, median, minimum and maximum. Variance and standard deviation accept explicit sample or population forms. An unspecified convention triggers clarification. |
| Correlation | Pearson between two distinct eligible numerical columns. A plain correlation question maps to the existing Pearson operation. |
| Inference | Mean confidence interval, one-sample t-test with finite explicit null mean, paired t-test with explicit same-row matching, and Welch t-test with an outcome, a categorical grouping column and two distinct quoted group labels. Supported confidence levels are 90%, 95% and 99%. The parser preserves an unspecified level as absent for later integration. |

The module recognizes finite anchored phrases, including “how many”, “calculate the median”, “mean”, “متوسط”, “المعدل”, “كام”, “قد إيه”, “فيه”, “احسبلي”, and “طلعلي”. Examples include `المرتبات كام متوسطها`, `احسب الوسيط لعمود age`, and `احسب فترة ثقة ٩٥٪ لمتوسط salary`. Explicit requests such as `Test whether average salary differs from 5000` preserve the stated null. `Compare sales and profit` asks for a method. `Compare the means of group A and group B using Welch's test` asks for the missing outcome, grouping column and exact group values.

## Resolution and safety

- The grammar folds NFC, letter case, Arabic diacritics and tatweel, alef and ya variants, whitespace, and Western, Arabic-Indic and Persian digits. It accepts Arabic question punctuation and decimal and percent forms. English, Arabic and mixed labels are script hints, rather than detected dialects. Recognized unsupported scripts are rejected. Unrecognized Latin wording fails with `unknownOperation`.
- Column names match whole slots. Exact folded labels take priority over label prefixes and aliases. The only bilingual aliases are `المرتب، مرتب، الراتب، راتب، المرتبات، الرواتب` → `salary` and `العمر، عمر` → `age`. The Arabic linked article `للـ` can resolve to `الـ` after an exact lookup. There is no fuzzy matching or general translation.
- Quoted exact names can disambiguate folded collisions. Straight double quotes, curly double quotes and guillemets protect literal labels and group text. Unquoted collisions are reported before checking eligibility, and alternative valid two-column splits trigger clarification. Distinct column IDs and active schema overrides determine eligibility. Grouping uses text or Boolean metadata. Boolean group literals are canonicalized with the engine's classifier. The parser has no evidence of actual group membership or values.
- Inputs are limited to 512 UTF-16 code units and the existing 32-column and 4,096-code-unit label limits. Malformed controls, bidi overrides, unpaired surrogates, unmatched quotes and invalid metadata have explicit results. Unknown operations, causal and forecasting requests, data modification, evident multiple operations and recognized unsupported qualifiers fail safely. Quotes keep punctuation and instruction-like schema strings inert.
- The entry point produces typed candidates only. Its runtime dependency graph uses the existing numeric lexer and schema constants. It has no network access, uploads, dataset reads, analytical execution, persistence, telemetry, or UI wiring. It projects only permitted column metadata even if the caller supplies richer objects. The browser smoke check saw zero requests during parsing and empty cookies, local/session storage, IndexedDB and cache storage.

## Verification and performance

- The focused intent suite passed eight tests, including 43 positive bilingual prompts and 38 separately maintained adversarial prompts. Additional assertions cover Unicode folding and collisions, prefix overlap, active types, deterministic replay, bounds, and quoted injection-like labels. During implementation the matrix exposed one unsupported linked Arabic article and a qualifier classified too generically. Both were corrected and the focused suite passed.
- `npm test` passed all nine unit files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 54 tests, including the existing independent numerical references. Type checks and `npm run build:portable`, `npm run build` and `npm run build:eh` passed.
- The final browser regression ran `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` in portable, production (DuckDB MVP), and duckdb-eh modes. All 78 cases per mode passed, for 234 total with zero failures or skips. Existing ingestion, profiling, overrides, charts, inference, worker cancellation and privacy checks passed. The bilingual salary fixture still reports a mean of 20. The previous Chromium file-picker timeout did not recur.
- An isolated browser smoke loaded transpiled parser modules through intercepted local test responses. Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2 each resolved a mixed-script 95% confidence request and refused an embedded data modification request. The release app does not import the module at this phase.
- A Node timing check warmed the parser for 100 calls, then measured 5,000 calls with 32 short labels and four mixed supported/refused questions. Median and p95 were 0.040 and 0.095 ms. With 31 roughly 4,000-code-unit labels, one short name, and a 512-code-unit question, 1,000 calls yielded 6.534 and 8.944 ms. These are local samples for parser work only.
- Output totals match Phase 4C. Portable is 829,088 bytes, DuckDB MVP is 41,231,681 bytes, and DuckDB EH is 36,039,729 bytes. The three builds retain the same asset names and file counts. There are no dependency changes. Production npm audit reported zero advisories. The full audit exited 1 with four entries linked to the existing development-only Picomatch advisory. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Limitations and recommended Phase 5B contract

Coverage depends on explicit grammar. Broad paraphrases, arbitrary filters, conversational references, additional tests, formulas, and unlabelled column positions are outside the Phase 5A grammar. Source labels longer than the question budget cannot be referenced directly. Physical-device and assistive-technology coverage remain unverified.

In Phase 5B, translate only resolved intents through a closed adapter to the existing profile, statistics and inference APIs. Revalidate IDs and active types against the current dataset revision. Apply the documented confidence default at that boundary, validate group values against eligible records, and keep the engine's missingness, pairing and cancellation semantics. Localize clarifications and render original labels as text. Numerical answers must come from verified engine results, with no execution for clarification or unsupported statuses.

## Local checkpoints

Implementation and tests are in `cd29cde`. This report and the targeted project documentation are a separate local commit. Work stops at Phase 5A.
