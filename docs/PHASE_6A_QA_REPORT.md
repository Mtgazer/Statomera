# Phase 6A Independent QA Report

Independent Quality Assurance evaluation performed by Antigravity for Askora Phase 6A (bilingual conversational question discovery, recovery guidance, and evidence presentation hardening).

---

## 1. Verified repository checkpoint

The repository state was verified before starting test execution:

- **Branch**: `feature/phase-6a-conversation-ux`
- **HEAD commit**: `bd69876` (`docs: hand off Phase 6A implementation for QA`)
- **Implementation commit**: `777a580` (`feat(conversation): add bilingual examples and recovery guidance`)
- **Prior baseline commit**: `ffd61da` (Phase 5D completion)
- **Working tree**: Clean prior to QA documentation

---

## 2. Test environment

- **Operating System**: Linux 6.8.0-49-generic (x86_64)
- **Node.js**: v22.23.3
- **npm**: 10.9.9
- **Playwright**: 1.65.1
- **Browsers evaluated**:
  - Google Chrome / Chromium: 156.0.8078.47
  - Mozilla Firefox (Playwright build): 159.0 (v1572)
  - WebKit (Playwright build): v2388 (execution blocked by missing host OS shared libraries)
- **Display Server**: Headless X11 / Wayland Linux environment

---

## 3. Feature coverage

Independent adversarial and positive verification covered all new conversational capabilities introduced in Phase 6A:

### 3.1 Supported-Question Discovery
- **Discovery Scope**: Evaluated example suggestion generation across diverse schema topologies:
  - Row count (`How many rows are there?` / `ما عدد الصفوف؟`)
  - Missing-value presence (`Are there missing values?` / `هل توجد قيم مفقودة؟`)
  - Mean of eligible numerical columns (`What is the mean of "..."?` / `ما متوسط "..."؟`)
- **Schema Boundary Resilience**:
  - Datasets with no numerical columns correctly offer only the two dataset-level questions (row count, missing presence).
  - Header-only datasets (0 rows) suggest row count and missing presence, with numerical candidates excluded (`!numeric?.count`).
  - Columns with all-missing, all-blank, or non-numeric data are correctly excluded from mean suggestions.
  - Ambiguous / duplicate column headers are excluded from mean suggestions.
  - Overlong column names (>512 code units) are excluded from suggestions.
  - Columns containing double quotes correctly use typographic quote alternatives (`“...”` or `«...»`), and columns containing all quote forms are safely bypassed.
  - Mixed-script, Arabic, and English column names resolve to the exact column ID via `route.columns[0]?.id === id`.
- **Composer Integration**:
  - Clicking or activating an example chip via keyboard (Enter) populates the composer textarea without auto-submitting.
  - Composer receives immediate keyboard focus upon example selection.
  - Examples update reactively when switching between English and Arabic.

### 3.2 Clarification & Recovery UX
- **Clarification Scenarios**: Verified unknown columns, ambiguous columns, invalid parameters, missing groups in Welch, and invalid null means.
- **Recovery Controls**:
  - "Edit question" button appears on the latest turn for `needs_clarification`, `unsupported`, `cancelled`, and `failed` (execution stage) replies.
  - Activating "Edit question" restores the exact previously submitted wording to the composer textarea without executing.
  - Unsupported replies display supported alternative question chips ("Supported questions to try" / "أسئلة مدعومة يمكنك تجربتها").
  - "Retry question" button is provided for cancelled and execution-failed turns.
- **Unavailable Result Guidance**:
  - Verifiable engine reasons correctly map to descriptive review advice:
    - `noObservations`: "Review missing and invalid values in the column profile." / "راجع القيم المفقودة وغير الصالحة في ملف تعريف العمود."
    - `insufficientObservations`: "Review the valid and excluded counts before retrying." / "راجع عدد القيم الصالحة والمستبعدة قبل إعادة المحاولة."
    - `constantInput`: "For Pearson correlation, choose two columns whose values vary among complete pairs." / "لحساب ارتباط بيرسون، اختر عمودين تتغير قيمهما ضمن الأزواج المكتملة."
    - `numericRange`: "Check the scale of the values in the column profile." / "تحقّق من مقياس القيم في ملف تعريف العمود."
    - Inference `insufficient`, `zeroVariance`, and `distribution` reasons correctly map to their localized guidance copy.
  - Refusals never fabricate numerical evidence; unavailable results preserve observed exclusions and valid counts.

---

## 4. Full browser results

The browser test suite contains **40 distinct tests** across 3 test files (`analysis.spec.ts`: 26, `conversation.spec.ts`: 9, `router.spec.ts`: 5).
Across the 3 supported build targets (Portable, DuckDB MVP, DuckDB EH) and 3 browser engines, the matrix targets 360 test runs.

### 4.1 Portable Mode (`dist-portable`)
- **Chromium**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed
  - *Failure*: `analysis.spec.ts:18` failed due to strict mode violation on line 33 (see Defect QA-6A-01).
- **Firefox**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed
  - *Failure*: `analysis.spec.ts:18` failed with the identical strict mode violation.
- **WebKit**: 0/40 executed (Blocked by environmental host dependencies: `libevent-2.1-7t64`, `libavif16`, `libmanette-0.2-0` missing on Linux host).

### 4.2 DuckDB MVP Mode (`dist`)
- **Chromium**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed (`analysis.spec.ts:18` failed)
- **Firefox**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed (`analysis.spec.ts:18` failed)
- **WebKit**: Blocked by environmental host dependencies.

### 4.3 DuckDB EH Mode (`dist-eh`)
- **Chromium**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed (`analysis.spec.ts:18` failed)
- **Firefox**: 39 passed, 1 failed (total 40)
  - `conversation.spec.ts`: 9/9 passed
  - `router.spec.ts`: 5/5 passed
  - `analysis.spec.ts`: 25/26 passed (`analysis.spec.ts:18` failed)
- **WebKit**: Blocked by environmental host dependencies.

---

## 5. Unit and statistical reference results

- **TypeScript Typecheck (`npm run typecheck`)**: PASSED (0 errors).
- **Unit Suite (`npm test`)**: 63 passed of 63 tests across 10 test modules (0 failed, 0 skipped, 0 retried).
- **Non-isolated Unit Suite (`node --experimental-test-isolation=none --test tests/unit/*.test.ts`)**: 63 passed of 63 tests.
- **Independent Statistical Reference Verification**:
  - Salary fixture (`tests/fixtures/salary.csv`):
    - Calculated Mean: 20
    - Observations: 5 rows (3 valid, 1 blank, 1 invalid).
  - Pearson correlation verified against SciPy reference fixtures and manual pairwise exclusions.
  - Student t methods (one-sample, Welch, paired) verified against `tests/reference/inference-scipy.json`.
  - Midpoint rounding to even verified in normal and subnormal ranges.

---

## 6. Build and audit results

### 6.1 Asset Metrics

| Build Target | Files | Total Uncompressed Bytes | Entry JS Bytes | Largest Asset Bytes |
| :--- | :---: | :---: | :---: | :---: |
| **Portable** (`dist-portable`) | 11 | 879,677 | 311,561 | 530,607 (`xlsx-*.js`) |
| **DuckDB MVP** (`dist`) | 13 | 41,282,261 | 313,501 | 39,362,651 (`duckdb-mvp-*.wasm`) |
| **DuckDB EH** (`dist-eh`) | 13 | 36,090,309 | 313,501 | 34,242,586 (`duckdb-eh-*.wasm`) |
| **Isolated Router Harness** (`dist-router-test`) | 11 | 879,746 | 311,630 | 530,607 (`xlsx-*.js`) |

### 6.2 Security Audit
- `npm audit --omit=dev --json`: 0 vulnerabilities (34 production dependencies).
- `npm audit --json`: 0 vulnerabilities (86 total dependencies).

---

## 7. Accessibility findings

- **Keyboard Navigation**:
  - Logical tab order holds across topbar, dataset overview, results, and conversation panel.
  - Example-question buttons are focusable via keyboard; pressing Enter transfers text to the composer and shifts active focus to the textarea.
  - Multi-line input works via `Shift+Enter` without triggering form submission.
  - Single `Enter` submits the question.
- **ARIA & Live Regions**:
  - The conversation contains exactly one polite atomic live region (`<p className="sr-only" aria-live="polite" aria-atomic="true">`).
  - Screen reader announcements report turn status transitions without duplication.
  - Textarea is properly linked to its instructions via `aria-describedby="conversation-keys"`.
  - When the 512-character limit is exceeded, `aria-invalid="true"` and `aria-describedby="conversation-keys conversation-limit"` are applied.

---

## 8. RTL/LTR and responsive findings

- **Tested Viewports**: 320px, 360px, 390px, 768px, and 1280px (Desktop).
- **Horizontal Overflow**:
  - `document.documentElement.scrollWidth <= viewportWidth` holds at all 5 viewports in both English (LTR) and Arabic (RTL).
  - No horizontal scrolling or control clipping observed even at 320px width.
- **Bilingual & Mixed-Script Typography**:
  - Long Arabic column names (e.g. `اسم_العميل_التفصيلي_للموظفين_في_القسم_المالي`) wrap cleanly in example chips without breaking container boundaries.
  - Mixed Arabic-English labels (e.g. `راتب net (USD)`) preserve isolated bidirectional text flow via `<bdi>`.
  - Arabic numerals inside RTL replies render cleanly with tabular lining (`font-variant-numeric: tabular-nums`).
- **Brand Tokens**: Electric Graphite (`#121316`) and Champagne Gold (`#d4af37`) tokens remain preserved across dark and light themes.

---

## 9. Privacy and security findings

- **Network Requests**:
  - During all normal and adversarial workflows, network inspection confirmed 100% same-origin static `GET` requests (`/`, `/assets/*`).
  - Zero question text, zero column names, and zero dataset records appear in request URLs, query parameters, or request bodies.
  - Zero analytics, telemetry, or third-party AI endpoints contacted.
- **Client Storage**:
  - `localStorage`: 0 keys stored.
  - `sessionStorage`: 0 keys stored.
  - `document.cookie`: Empty string (zero cookies written).
  - `IndexedDB` & `CacheStorage`: No dataset or conversation snapshots stored.
- **Injection Resilience**:
  - Adversarial column names containing HTML markup (`<script>alert(1)</script>`, `<img src=x onerror=alert(2)>`) remain inert string literals.
  - No script execution or unintended DOM rendering occurred.

---

## 10. Performance observations

Measured indicative timings on a Linux x86_64 host across repeated interactive operations:
- **Dataset Ingestion & Example Render**: ~29.5 ms – 32.8 ms
- **Example Selection & Input Focus Latency**: ~23.9 ms – 37.4 ms
- **Question Submission to Answer DOM Render**: ~7.5 ms – 9.8 ms
- **100,000-Row CSV Query Execution**:
  - Chromium: ~221 ms (median) / 226 ms (worst); max frame gap: 17 ms
  - Firefox: ~340 ms (median) / 352 ms (worst); max frame gap: 50 ms
- **Memory & Worker Lifecycle**:
  - Verified conversation workers terminate upon job completion, cancellation, and revision supersession.
  - 24-turn conversation history cap is strictly maintained; older turns are evicted without memory leaks.

---

## 11. Defect list with priorities

### Defect QA-6A-01: Playwright Test Regression Due to Unscoped Listitem Selector in `analysis.spec.ts`
- **Severity**: P1 (Blocks clean 100% automated browser regression across all browsers and build modes)
- **Component**: `tests/browser/analysis.spec.ts:33`
- **Reproduction Steps**:
  1. Build portable assets: `npm run build:portable`.
  2. Run browser test: `npx playwright test tests/browser/analysis.spec.ts:18 --project=chromium`.
- **Expected Behavior**:
  The browser assertion on line 33 targets the invalid salary list item in the column profile (`Record 4 N/A`) and passes cleanly.
- **Actual Behavior**:
  Playwright throws a strict mode violation error:
  ```text
  Error: strict mode violation: getByRole('listitem') resolved to 4 elements:
      1) <li>…</li> aka getByRole('listitem').filter({ hasText: 'How many rows are there?' })
      2) <li>…</li> aka getByRole('listitem').filter({ hasText: 'Are there missing values?' })
      3) <li>…</li> aka getByRole('listitem').filter({ hasText: 'What is the mean of "salary"?' })
      4) <li>…</li> aka getByText('Record 4 N/A')
  ```
- **Root Cause**:
  In Phase 6A, `ConversationPanel` introduced the initial suggested examples inside `<ul role="list"><li>...</li></ul>`. The test locator on line 33 of `analysis.spec.ts` was written before Phase 6A as an unscoped `page.getByRole('listitem')`. When the example list is rendered on an empty workspace, `page.getByRole('listitem')` resolves to 4 items instead of 1. All other tests in `analysis.spec.ts` (lines 318, 382, 430) properly scope to `.locator('.rejected').getByRole('listitem')`.
- **Suggested Fix Direction for Codex**:
  Update `tests/browser/analysis.spec.ts:33` to scope the selector to the rejected profile section:
  ```ts
  await expect(page.locator('.rejected').getByRole('listitem')).toHaveText('Record 4 N/A')
  ```

---

## 12. Unverified areas

1. **Linux WebKit Execution**: Headless Linux WebKit browser tests could not execute in this environment due to missing OS-level shared libraries (`libevent-2.1-7t64`, `libavif16`, `libmanette-0.2-0`). WebKit execution requires a host environment with these system dependencies installed.
2. **Physical Device Touch & Native Screen Readers**: Physical Android devices and native screen readers (e.g., NVDA, VoiceOver, TalkBack) were not physically connected; assertions were verified through Playwright ARIA tree inspections, keyboard emulation, and live-region DOM monitoring.

---

## 13. Final QA verdict

**FAIL — FIXES REQUIRED**

*Reason for verdict*:
The functional implementation of Phase 6A (bilingual question discovery, clarification UX, dataset lifecycle resets, privacy, and responsiveness) is verified and robust. However, Phase 6A introduced a reproducible P1 regression in the automated browser regression suite (`analysis.spec.ts:18` fails in Chromium and Firefox across all 3 build targets due to Defect QA-6A-01). Per the Askora QA protocol, a PASS verdict cannot be issued while a P1 regression remains unresolved in the test suite.
