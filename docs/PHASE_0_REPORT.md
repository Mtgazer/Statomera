# Phase 0 report

**Date:** 2026-11-18, Africa/Cairo
**Outcome:** Discovery and planning complete. Runtime feasibility remains to be tested under Phase 1 approval.

## Findings

Askora's first public beta should deliver credible dataset understanding and evidence-based analysis in English and Arabic at zero project spend. Browser-first processing is the recommended route. Use a narrow deterministic core, keep raw files local by default, and test an optional model separately. The original document provides history and proposals. The current founder request controls the deliverables and places implementation after Phase 0 review. The brand board establishes visual identity. See the [decision log](DECISIONS.md), [requirements matrix](PROJECT_BRIEF.md), [architecture evaluation](ARCHITECTURE.md) and [roadmap](ROADMAP.md).

## Environment and Git

The starting workspace was `IK projects` on Ubuntu 26.04.1 LTS. Its empty `Askora/` directory became the project root. The parent had an empty Git metadata placeholder and no usable repository. Askora had no repository, branches, commits or remotes. Original attachments were left in place and are available in the parent workspace. Versions observed were Node.js 22.23.3, npm 10.9.9, pnpm 12.14.0, Python 3.14.8 from Miniconda and Git 2.53.0. Yarn and Bun were absent from PATH. Git author name and email are configured, with values omitted from this report.

Git was initialized locally and the first checkpoint prepared on `docs/phase-0` for review. Use `git log -1 --oneline` for the checkpoint ID and `git status --short --branch` for current status. No remote was configured. Pushing requires an approved repository, its URL and authorized credentials. Confirm ownership, visibility and licensing before publication.

## Risk register

| Risk | Planned test and response |
| --- | --- |
| Large browser datasets | Generate narrow, wide and high-cardinality data at 1, 5, 10 and 25 MiB. Measure parse and query latency, UI stalls, outcome and cancellation. Set per-tier limits from the weakest supported device and reject oversize input early. |
| Excel ingestion | Compare pinned adapters with multi-sheet files, merged cells, formula caches, 1900/1904 dates, protected workbooks and controlled expansion limits. Require explicit sheet choice and disclose uncomputed formulas. Defer XLSX if no safe path passes. |
| Parquet ingestion | Test local projection, row groups, Snappy/Zstd, decimals, timestamps, nested types and truncated input with the deployed Wasm build. Declare supported codecs and types, and budget expanded bytes. |
| Type inference | Label fixtures with numeric-looking identifiers, leading zeros, mixed dates, decimals, large integers and mixed Arabic and Latin text. Track incorrect coercions and preserve ambiguities for review. |
| Missing-value false positives | Test blanks and parser nulls versus literal NA, 0, -999 and whitespace. Show candidate sentinels separately, require context for missing intervals and trace policy changes to a new result. |
| Statistical accuracy | Reconcile known-answer fixtures and pinned independent reference outputs. Test empty or constant cases, extreme values, assumptions, tie handling and counts. Prevent causal wording in correlation output. |
| Natural language | Evaluate intent, field selection and abstention on labeled English, Arabic and mixed corpora. Require confirmation when multiple plausible targets change the result. Offer direct operation controls. |
| Arabic interoperability | Test bidi headers, Arabic-Indic numerals, diacritics, normalization collisions and screen readers. Preserve canonical text and values through parsing, computation and rendering. |
| Browser memory and lifecycle | Record cold and repeated runs on real devices, compressed expansion, backgrounding, interrupted jobs and worker restart. Bound inputs, intermediate transfer and output independently of the nominal Wasm ceiling. |
| Android compatibility | Run the core flow on lower-memory and recent physical Android devices. Verify picker, layout, touch, suspend/resume and absence of a WebGPU dependency. |
| Untrusted data | Verify inert rendering and formula handling, bounded parsing and result sizes, rejected disallowed operations, no dataset network requests and clean recovery after invalid inputs. |
| Free static deployment | Validate artifact sizes, assets, headers, CI quota, anonymous access and terms before release. Keep local build and artifact rollback available. Optional assets or features can be deferred when free limits bind. |

## First approved implementation task

Build a minimal local, production-built browser page with a file picker, language switch and result panel. Use React, TypeScript, Vite and one same-origin single-threaded DuckDB-Wasm worker. Enable CSV only. Serve compiled assets from a local static origin for verification. In scope are import, counts and mean, with localized results and one fixed numeric field. No accounts, persistence, conversational model, charts or public deployment are needed for the proof.

1. Pin the build and engine versions. Bundle and measure the actual worker and Wasm files. Verify asset paths and MIME type. Limit proof upload to 5 MiB and cap rows at 100,000, columns at 32 and work at 10 seconds as provisional proof budgets. Document any stricter device behavior. Verify cleanup on timeout, limit rejection or replacement.
2. Register a local UTF-8 comma-separated file with a header and strict rectangular records. Stage inspected input using stable internal columns and require one unique `salary` field. Define blank salary as missing for this fixture. Classify nonempty nonnumeric values as invalid, retain their original value for diagnostics and exclude them from the mean with a reported count. Use fixed worker-owned operations, a conservative numeric grammar for the proof and explicit conversion. Display an unavailable result when no valid rows exist.
3. Ingest this hand-auditable fixture through the actual browser picker.

   ```csv
   employee,salary
   Amal,10
   عمر,
   Lina,20
   Nabil,N/A
   Noor,30
   ```

   Expect 5 rows, 2 columns, 1 blank salary (20%), 1 invalid salary, 3 valid salaries, sum 60 and mean 20. Show number of observations, exclusion rules and operation identity. Use exact comparison for these expected counts and values. An all-blank salary fixture yields an unavailable mean.
4. Verify both UI languages, original label and data text, re-import, malformed rows, missing and duplicate salary headers, oversize input and cancel/recovery. Record browser requests before and after import. Static asset fetches may occur. Dataset and result bytes must remain local and the flow must also complete with the network blocked after assets load.
5. Run repeatable browser gold-fixture tests in desktop Chromium and Firefox, smoke-test Safari where available and require a lower-memory physical Android run before committing to a mobile support claim. Record unavailable environments, browser versions, cold/warm times, responsiveness, assets and observed memory proxies. Try the scaled fixtures and verify a single asset fits the proposed host's 25 MiB limit. Initial review target for under-budget inputs is a usable UI during work and completion or controlled rejection within the time budget.
6. Record pass/fail and device data. If the Wasm route fails host, reliability or mobile gates, run the same proof with a streaming TypeScript CSV parser and bounded aggregators. A service backend needs separate evidence and approval. Establish release limits only from measured results.

## Review and verification

Phase 0 uses document review and repository checks. Browser compatibility, processing capacity, numerical behavior, hosting and security controls are test plans at this point. Approval is needed to enter Phase 1. Adopt the runtime stack after proof results, and review beta formats, limits, device/accessibility coverage, statistics, feedback, production assets, hosting, CI and release policy at their respective gates.
