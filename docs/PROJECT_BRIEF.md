# Project brief

Askora serves people who need to understand data without writing SQL or Python. The expected flow is open a local file, inspect schema and quality findings, ask a supported question, and inspect how the result was computed. If the user asks for profit and only revenue is available, explain that cost data is required. Report relationships with appropriate caveats and treat causal claims as a separate question requiring stronger evidence.

## Requirements matrix

Priority describes the recommended delivery order. Confirmed refers to product intent. Proposed entries require review before becoming commitments. Phase gates and testing detail are in the roadmap and testing strategy.

| Capability | Status and priority | Dependencies | Acceptance check |
| --- | --- | --- | --- |
| Free public beta, zero project spend and worldwide reach as a goal | Confirmed, launch blocker | Static host, tested artifact, release approval | Visit anonymously without payment from representative networks and regions, verify account limits and published restrictions |
| Local dataset import and preview | Confirmed core, essential | File picker, adapter, bounded worker | Preview representative data with original labels and correct dimensions, reject invalid input cleanly |
| CSV first, then TSV, XLSX, JSON/JSONL and Parquet individually | Proposed sequence and formats, CSV for proof | Parser and format-specific device tests | Per-format valid, malformed and boundary fixtures before claiming support |
| Structure, type, and semantic hints | Confirmed goal, essential | Raw tokens and stable column IDs | Compare detected types to fixture truth, expose ambiguous dates, IDs, units and overrides |
| Missing values and missing information | Confirmed, essential | Explicit missing policy, expected sequence metadata | Distinguish absent cells, configured sentinels, expected interval gaps and absent fields |
| Duplicate rows and repeated values | Confirmed goal, high | Typed equality policy and chosen fields | Verify whole-row duplicate count separately from per-column repeats or unique constraints |
| Invalid and inconsistent entries | Confirmed goal, high | Validation rules and source values | Flag invalid dates and category variants with source positions and reasons |
| Distributions and potential outliers | Confirmed goal, high | Valid numerical data, method policy | Compare quantiles and outlier flags to known results and show thresholds and limitations |
| Aggregates, grouping and comparisons | Confirmed goal, essential | Typed engine and operation registry | Exact dimension and count fixtures, reference means and grouped totals |
| Relationships and hypothesis tests | Confirmed analytical direction, high, exact methods proposed | Assumptions, design metadata and reference computations | Test correlation, effect and sample count, clarify paired versus independent design, handle degenerate inputs |
| English, Arabic, mixed questions and localized explanations | Confirmed, essential | Structured locale messages, matching and stable IDs | Route equivalent questions to the same calculation, preserve English headers in RTL and show local errors |
| Verifiable answers and clarification | Confirmed accuracy requirement, essential | Validated plan, result provenance and renderer | Audit every number to computed output, explain unsupported analyses and ask when column choice is ambiguous |
| Analysis steps interface, charts and reports | Traceability confirmed, UI and chart/report scope proposed, high | Versioned evidence and chart adapter | Compare chart series and report values to results and offer a readable tabular equivalent |
| Privacy, security and reliability | Confirmed, release blocker | Trust boundaries and release checks | Verify no dataset transfer in local mode, enforce limits and review dependencies |
| Dark graphite and Champagne Gold identity | Confirmed, high | Design tokens, approved mark and bilingual layout | Compare reference geometry and color tokens, test contrast, layout and focus states |
| Responsive web and real-user feedback | Confirmed validation goal, workflows proposed, high | Device matrix, explicit feedback submission | Complete primary tasks on Android, verify feedback excludes datasets by default |
| On-device language model and installable PWA | Proposed, gated | Device and language benchmarks, model rights, cache controls | Core works without either, opt-in paths pass separate readiness checks |
| Native Android, cloud AI/workspaces, accounts, billing and advanced modeling | Future | Evidence, funding and dedicated approval | Define separate gates if approved |
