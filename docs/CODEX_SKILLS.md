# Askora Codex skills

S0 inventory and evaluation, 2026-11-18. The bundled CLI reports 0.169.0-alpha.11.1. Repository-scoped discovery is documented for `.agents/skills/` between the launch directory and the repo root. Launch from Askora or a subdirectory. Use direct file reads when the current chat started outside the repo or its skill list predates the checkout. [Official skill discovery and packaging](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

| Scope | Findings and disposition |
| --- | --- |
| System | Skill Creator was used for authoring and validation. OpenAI Docs was used for discovery guidance. Skill Installer and ImageGen are available. The local system directory also contains an internal review-agent skill. |
| User and admin | No standalone user skills beyond bundled system files were found in the checked skill locations, and no admin skill directory was present. Global configuration was left untouched. |
| Session plugins | Sites and Visualize cover site authoring and in-chat visualization. Neither replaces a local React source tree or repeatable application tests. Document, PDF, presentation, spreadsheet, template and pet skills are unrelated to this proof. |
| Repo | Added `askora-phase-workflow`, `askora-data-engine`, `askora-statistical-validation` and `askora-ui-design`. They contain instructions and links to repo documents, with no bundled executables, package dependencies or service permissions. |

## Upstream candidates

- [Playwright](https://github.com/openai/skills/blob/main/skills/.curated/playwright/SKILL.md) is a curated terminal workflow around a Playwright CLI wrapper with Node/npm requirements. A project-local Playwright test harness gives repeatable fixture uploads, responsive checks and diagnostics with less skill overlap. Deferred the generic skill.
- [Security Best Practices](https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md) routes explicit security reviews to language-specific references, including React and TypeScript. Its defensive guidance is useful for later audits. This proof uses the existing Askora security policy and a focused browser network check.
- [Security Threat Model](https://github.com/openai/skills/blob/main/skills/.curated/security-threat-model/SKILL.md) exists in the official catalog and provides an instruction and reference workflow for trust boundaries. Defer installation until a dedicated architecture or release review warrants it.
- [Build Web Apps and Build Web Data Visualization](https://github.com/openai/plugins) are plugin bundles with broader building, debugging and chart workflows. Defer plugin installation. The proof needs a file picker, results table and browser checks. Reevaluate visualization in the reporting phase.

The four local skills are the only additions. No upstream scripts or bundles were installed. Reevaluate individual upstream files and license, scripts and permissions at a pinned revision before future adoption.

## Validation

Ran the system Skill Creator's `scripts/quick_validate.py` on each skill directory. All four passed. Checked name-to-directory alignment and referenced files. For a sample salary-mean verification task, manually routed to the statistical-validation skill and confirmed its test strategy points to the repository testing guide and requires an independently derived expected mean. Attempted local discovery through `codex debug prompt-input`, which failed on the read-only Codex state directory. Automatic discovery/invocation in this session remains unverified.
