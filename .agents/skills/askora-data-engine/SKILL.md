---
name: askora-data-engine
description: Implement or review Askora dataset ingestion, schema and quality detection, worker lifecycle or local analytical computation.
---

# Askora data engine

Read `docs/ARCHITECTURE.md` and `docs/SECURITY.md` from the repo root.

- Enforce format, dimensions, input and output budgets. Validate schema and preserve source labels and original values when inference is uncertain. Define duplicate equality and report ambiguous types.
- Distinguish blanks, policy-defined missing values and failed conversions. Keep zero and candidate sentinels as observations unless an explicit policy says otherwise. Report rejected counts and preserve localized error codes.
- Use deterministic worker-owned operations and bounded previews. Treat filenames, headers and cells as data. Release resources on completion, failure, timeout and cancel. Keep uploads and derived data local by default.
- Disclose the scope of exact operations and label samples or estimates.
