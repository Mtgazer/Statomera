# Decision log

Initial status recorded 2026-11-18 after Phase 1B. Update entries with the date, evidence, tradeoffs and explicit approval where applicable.

| ID | Status | Decision and rationale |
| --- | --- | --- |
| D01 | Confirmed | Free, public, zero-spend beta first. Validate correctness, security and user value before spending. |
| D02 | Confirmed | Deterministic evidence owns statistical facts. Constrain analysis execution, preserve privacy and communicate limitations. |
| D03 | Confirmed | English and Arabic, including mixed questions and both layout directions. The historical Electric Graphite and Champagne Gold identity is superseded by D15. |
| D04 | Confirmed | Phase 0 is discovery and a written proof plan under the current request. Explicit approval gates Phase 1. |
| D05 | Superseded for the initial CSV artifact by D12 | Browser-first static React, strict TypeScript and Vite with a single-threaded DuckDB-Wasm worker. Validate the chosen bundle, runtime and device limits before adopting it. |
| D06 | Recommended | Start with CSV and deterministic bilingual intents plus direct controls. Require evidence for each additional format, analytical method or interpreter. Defer cloud AI and service backend. |
| D07 | Recommended | Avoid data persistence initially. Use IndexedDB only if a reviewed requirement warrants it. Add ECharts and PWA late, after device and accessibility checks. |
| D08 | Recommended | Cloudflare Pages Free, default subdomain, static assets only. GitHub Actions is conditional on repo choice and verified quota controls. Keep local build and test commands usable. |
| D09 | Open | Confirm Phase 1, stack after the proof, formats and limits, methods, device support, accessibility gate, feedback channel, hosting and CI plan. |
| D10 | Open | Choose repo owner, visibility and license before publication. Approve production logo and fonts, secondary blue use, final subtitle and any light mode. Verify naming availability before promotion. |
| D11 | Future | Subscriptions, managed AI, managed data and Android distribution require separate approval. |
| D12 | Recommended after Phase 1B | Build the initial CSV artifact with a bounded TypeScript worker and static Cloudflare Pages Direct Upload. Preserve DuckDB reference builds for comparison and later engine evaluation. Public deployment still requires approval. See the [Phase 1B report](PHASE_1B_REPORT.md). |
| D13 | Implemented in Phase 3 | Keep quality checks descriptive and worker-local. Use bounded co-missingness summaries and conservative univariate IQR flags with visible eligibility and thresholds. See the [Phase 3 methods and limits](PHASE_3_REPORT.md#methods-and-result-contract). |
| D14 | Implemented in Phase 5A | Use a bounded bilingual grammar with exact schema lookup and structured clarification. Keep parsing separate from execution, apply eligibility before resolution, and treat quoted labels as literal data. See the [Phase 5A report](PHASE_5A_REPORT.md). |
| D15 | Confirmed internally on 2026-11-19 | STATOMERA, Statistical Data Intelligence, with a navy, teal, and silver identity. The tagline is proposed. Availability and trademark verification remain open. See the [brand identity](BRAND_IDENTITY.md). |
