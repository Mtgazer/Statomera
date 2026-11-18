# Testing strategy

Use small synthetic fixtures with reviewed expected outcomes, plus generated scale fixtures with reproducible seed and schema. Store input semantics, expected values and reference method beside each fixture. Compare counts and integers exactly. Set per-method absolute and relative tolerances for floating-point outputs and record exclusions, sample design, units, method version and null policy. Independently derive simple values by hand and cross-check advanced tests with a pinned reference such as SciPy.

| Layer | Planned verification |
| --- | --- |
| Ingestion | BOM, quoted delimiters and newlines, duplicate headers, mixed schemas, invalid encodings, ambiguous dates, empty files, truncated records, cancel and re-import. Track XLSX sheet and cell semantics and Parquet codec/logical types separately. |
| Quality/profile | Blank versus literal sentinel, all-missing column, invalid value versus absent value, leading-zero IDs, duplicate rows versus repeated cells, expected interval gaps versus irregular series, stable thresholds for outliers. |
| Operations | Grouping, sums and denominators, missing exclusions, empty and constant inputs, large magnitudes, wide decimal values, correlations with pairwise counts, statistical tests with known effects, confidence intervals and failed assumptions. |
| Question handling | A bilingual gold corpus labeled by intent, column IDs, ambiguity and unsupported states. Verify mixed-script mapping and follow-up context. Compare answered intent accuracy and abstention separately and trace every number to the result. |
| Browser and accessibility | Chromium, Firefox and Safari on desktop, plus at least one lower-memory physical Android and a representative current Android. Verify direction and numeral presentation, keyboard and screen reader flows, touch layouts, 200% zoom, reduced motion and readable chart equivalents. Review a WCAG 2.2 AA target before design sign-off. |
| Performance | Cold/warm asset loading, wide/narrow data, compressed formats, high-cardinality groups and repeated cancellation. Capture device/browser, bytes, rows, columns, elapsed time, UI stalls and available memory proxies. Repeat three times and log median and worst case. |
| Security and release | Negative input tests, no accidental network transfer, bounded output, app and worker CSP, secret and dependency checks, upgrade/rollback, anonymous access, browser compatibility and feedback data minimization. |

Run fast checks per change. Run browser smoke tests on branch review and real-device tests at ingestion, analytics, PWA and release milestones. Publish actual pass/fail evidence and rerun regressions after fixes. Release only when approved functionality passes deterministic references, supported browser and language paths work, privacy controls hold, and known limits are published.

## Phase 2A fixtures

Run the existing unit suite and the browser suite against portable, MVP and EH builds. The CSV reference fixtures cover generic schemas, duplicate headers, empty and malformed files, opt-in markers, unsafe integers, Arabic and quoted values, booleans, ambiguous dates and exact repeated rows. Verify count partitions and hand-derived numerical summaries. The browser suite includes a deterministic multilingual 80,000-row fixture in addition to the previous scale runs. See [Phase 2A verification](PHASE_2A_REPORT.md#verification-and-performance) for commands, measurements and device coverage.
