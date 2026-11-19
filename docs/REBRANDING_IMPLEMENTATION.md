# STATOMERA rebranding handoff

Implementation started from clean checkpoint `efd4359f8e9bc2fddf5e1005ce2cd6d2556abe3a` on `feature/phase-6c-local-ai-experiment`. The focused local rebranding commit contains this handoff. Independent Antigravity QA is pending.

## Changes and assets

- The header, conversation speaker, document title, application metadata, and favicon now use STATOMERA. The descriptor is localized. The uppercase Latin wordmark is language-tagged and directionally isolated inside the Arabic interface. The proposed tagline is documented without publishing it in the app.
- The new dark-default navy, teal, and silver palette uses the existing theme tokens and layout. Both chart legends describe teal density. Measured contrast for the descriptor against its header background was 7.96:1 in dark and 7.50:1 in light. Teal focus and chart accents against the raised surface were 6.27:1 in dark and 5.60:1 in light. The light control border against the raised surface measured 3.19:1.
- The three original SVG files are [primary lockup](../public/assets/statomera-primary.svg), [header symbol](../public/assets/statomera-mark.svg), and [favicon](../public/assets/statomera-favicon.svg). They total 2,483 bytes and contain no scripts, referenced images, or font dependencies. The content security policy permits same-origin images for the two runtime assets. The image rule adds no external hosts.
- Active identity and references are updated in `README.md`, `AGENTS.md`, `.agents/skills/askora-ui-design/SKILL.md`, `docs/BRAND_IDENTITY.md`, `docs/BRAND_GUIDELINES.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_BRIEF.md`, `docs/DECISIONS.md`, and `docs/ROADMAP.md`. The existing external `askora_project.md` was updated in place outside the repository. Prior phase reports retain their original names and context.
- Application and delivery changes are in `index.html`, `src/app.tsx`, `src/styles.css`, `src/locale.ts`, `src/charts.tsx`, `src/conversation/copy.ts`, `src/conversation/panel.tsx`, and `vite.config.ts`. Only root private package name metadata changed in `package.json` and `package-lock.json`. The manifests and lockfile were compared structurally. Test changes are in `tests/browser/branding.spec.ts` and `tests/browser/analysis.spec.ts`.

## Compatibility

The rebrand preserves `askora:analysis` performance instrumentation, Vite plugin and harness identifiers, `ASKORA_*` test environment variables, skill IDs, test fixtures, and the existing checkout directory and Git branch. Worker modules, message and result contracts, import formats, and analytical formulas were untouched. Historical research and phase records preserve their original brand references. The active source and HTML scan found the former name only in the two instrumentation calls.

Production source has no localStorage, sessionStorage, IndexedDB, service-worker cache, or cookie dataset persistence. Browser checks seeded unrelated same-origin local and tab storage values, then verified that reload, import, and a language change preserved those values and introduced no extra keys, databases, caches, or cookies. The dataset and conversation stayed in memory during language changes and were cleared on reload, matching the existing lifetime. The privacy test continues to require same-origin GETs with empty bodies and no queries or dataset markers. Its path list includes the two exact runtime SVG names.

## Verification and build size

`npm run typecheck` passed. `npm test` passed all 10 unit files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 63 individual tests. Both unit runs had zero failures and skips. `npm run build:portable`, `npm run build`, and `npm run build:eh` passed.

| Build | Files | Total bytes | Change from Phase 7B | Entry JavaScript | Largest asset |
| --- | ---: | ---: | ---: | ---: | --- |
| Portable | 15 | 899,475 | +3,585 | 317,830 (+413) | XLSX JS, 530,607 bytes |
| DuckDB MVP | 17 | 41,300,417 | +3,569 | 318,144 (+413) | Wasm, 39,362,651 bytes |
| DuckDB EH | 17 | 36,108,465 | +3,569 | 318,144 (+413) | Wasm, 34,242,586 bytes |

Sizes are exact uncompressed artifact bytes. The SVGs account for 2,483 bytes of the growth. The rest is presentation code, HTML metadata, and the portable header directive. No dependency was added. Runtime branding uses only the symbol and favicon. The standalone wordmark is available as a separate asset.

### Targeted browser checks

| Build | Chromium (Chrome) | Playwright Firefox | Playwright WebKit |
| --- | ---: | ---: | ---: |
| Portable | 9 passed | 9 passed | 9 passed |
| DuckDB MVP | 6 passed | 6 passed | Outside the selected run |
| DuckDB EH | 6 passed | 6 passed | Outside the selected run |

The 51 selected executions covered the wordmark, metadata, asset delivery and image decoding, English LTR and Arabic RTL, dark and light themes, width checks at 320px, 768px, and 1280px, the reference salary mean of 20, and existing reports and charts. The portable run also exercised a production conversation, confidence interval and group exclusions, and the 100,000-row scatter report with no extra workers. Chrome screenshots were reviewed for the English dark desktop header, Arabic light layout at 320px, and the standalone primary artwork.

The initial portable run passed 24 of 27. One privacy assertion failed in each browser because its explicit static path list predated the two new SVG assets. The initial reference smoke selections passed 10 of 10 for MVP and 10 of 10 for EH. The final run includes the updated path check in each build. No final selected execution failed or was skipped.

## Remaining limits and Antigravity handoff

- Review the logo and favicon in normal browser tabs and at small icon sizes. Check English and Arabic branding in both themes and confirm that the header, conversation, metadata, and standalone logo present the same spelling.
- Confirm filename and column rendering, keyboard focus, responsive overflow, and import-to-report behavior with representative fixtures. Review chart legend contrast and descriptions with native screen readers and physical devices where available.
- Repeat same-origin asset, app storage, and 100,000-row worker checks. The full browser matrix, physical devices, native screen readers, and browser tab chrome were outside implementation verification.
- Trademark and availability verification remain open. The tagline is proposed. Independent QA and any later public rollout approval remain separate milestones.
