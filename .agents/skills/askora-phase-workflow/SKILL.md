---
name: askora-phase-workflow
description: Run an approved Askora phase or checkpoint, including scope review, verification, documentation and local Git.
---

# Askora phase workflow

1. From the repo root, check Git status and history. Read `docs/ROADMAP.md`, `docs/DECISIONS.md` and the active phase report or request. List scope, affected components, risks and acceptance checks. Preserve user changes.
2. Load only the skills and reference docs the task needs. Make bounded changes and run the acceptance checks. Record exact commands and distinguish failures, skips and unavailable checks.
3. Review the diff for scope and secrets. Commit coherent verified changes locally on the requested branch. Keep Git local until explicit authorization to connect a remote. Preserve history and existing branches and keep merges to main subject to review.
4. Report commit hashes, remaining issues and the current phase outcome. Stop at its approved boundary.
