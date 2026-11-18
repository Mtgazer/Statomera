---
name: askora-statistical-validation
description: Implement or verify Askora numerical results, statistical methods, assumptions, precision and analytical fixtures.
---

# Askora statistical validation

Read `docs/TESTING.md` from the repo root. State eligible observations, units, sample design, assumptions, exclusions and the calculation. Clarify missing prerequisites. Report effect sizes and intervals when appropriate and keep causal conclusions outside correlational results.

Require automated numerical reference tests with independently derived values. Test missing and invalid observations, sample size, degenerate cases, magnitude and precision. Compare integer counts exactly and specify method-appropriate tolerances for floating-point results. Verify the displayed numbers come from the tested result object across locales.
