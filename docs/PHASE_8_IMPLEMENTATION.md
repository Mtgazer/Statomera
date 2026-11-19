# STATOMERA Phase 8 implementation handoff

Release preparation began on `feature/phase-6c-local-ai-experiment` at clean checkpoint `ab67325d1277111f317b3098a2b9b022dadbd47f`. This handoff is in the release implementation commit. The adjacent release candidate directory holds `BUILD-INFO.txt` with the exact source commit and the byte comparison against that commit. Independent Antigravity QA and separate founder authorization for hosting remain pending.

## Release changes

- Added bilingual disclosure that files stay in the tab and the host receives ordinary app asset request data, such as the IP address. The release links to its [third-party notices](../public/third-party-notices.txt) in both layouts. Worker, storage, and evidence contracts were unchanged.
- The original packaged candidate omitted feedback while founder approval was pending. The feedback gate update below records the current source and packaging status.
- Added local portable packaging with an explicit release-file check, dashboard upload limits, and deterministic ZIP entry ordering and metadata. Retained the archive, archive SHA-256, per-file SHA-256, and provenance beside the repository for local recovery. [Runbook](RELEASE_RUNBOOK.md)
- Updated the roadmap, architecture, security and testing guidance, and the external founder record. No hosted preview or deployment was created.

## Security and licensing

The reviewed `package-lock.json` SHA-256 is `d07bbe9053d7ee7af34308b5c08eb29f200e91b083a98004a5c41fb0fcccaa24`. The production-only and full `npm audit` runs both exited zero with zero reported vulnerabilities on 2026-11-19. A temporary hidden-source-map inventory identified React and React DOM 19.2.8, Scheduler 0.27.0, SheetJS CE 0.20.3, and zip.js 2.25.0, including its bundled zlib-streams-ts fallback. The notice includes those licenses and the MIT notices for the build-generated browser runtime helpers. The release contains no source maps. The portable artifact includes no DuckDB Wasm binary.

- SheetJS publishes the affected ranges for the two previously documented advisories. The locked vendor CDN tarball at 0.20.3 is outside both. [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533) · [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363)
- The React Server Components advisory applies to server packages absent from this static application's lockfile. The pinned Vite 8.3.8 and Rolldown 1.2.19 are above the relevant development-server fix versions, and the dev server stays local. The earlier Picomatch advisory was withdrawn. No dependency upgrades were necessary for these findings. [React advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) · [Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7) · [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The audits and reachability review are point-in-time checks. Rerun them against the approved release lockfile before exposure. Hosted privacy and header checks remain open.

## Build, packaging, and recovery

All builds passed using Node.js 22.23.3 and npm 10.9.9. Sizes are uncompressed output bytes. Deltas use the rebrand checkpoint artifacts.

| Build | Files | Total bytes | Change | Largest asset |
| --- | ---: | ---: | ---: | --- |
| Portable | 16 | 920,038 | +20,563 | XLSX JavaScript, 530,607 bytes |
| DuckDB MVP | 18 | 41,320,980 | +20,563 | Wasm, 39,362,651 bytes |
| DuckDB EH | 18 | 36,129,028 | +20,563 | Wasm, 34,242,586 bytes |

The notices account for 20,044 bytes. The portable output fits the dashboard Direct Upload limit of 1,000 files and 25 MiB per file. The `_headers` rule sends same-origin app, asset, and worker policies. Both reference Wasm binaries exceed the per-file limit. [Cloudflare dashboard limits](https://developers.cloudflare.com/pages/get-started/direct-upload/#limits)

The retained `statomera-portable.zip` is 922,050 bytes. Its SHA-256 is `5fdbbb2d94b4e15d82a2076d10afa9a1de18697435b7f70a0382627f73589ce7`. `sha256sum -c`, `unzip -t`, all 16 restored-file hashes, and a recursive comparison to the portable build passed. A loopback HTTPS server applied the recovered `_headers`. It returned the expected headers and MIME types for all 15 served files, excluded `_headers` from public serving, and successfully loaded the restored CSV, JSON, and XLSX fixtures in Chrome. The loopback certificate was self-signed. Hosted TLS, actual Cloudflare response headers and native production rollback are unverified. Preview deployments are ineligible native rollback targets. [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## Exact check results

- `npm run typecheck` passed. `npm test` passed all 10 files. `node --experimental-test-isolation=none --test tests/unit/*.test.ts` passed all 63 individual unit cases. No unit failures or skips.
- `npm run build:portable`, `npm run build`, and `npm run build:eh` all passed.
- Focused portable Playwright passed 12/12 across Chromium using Chrome, Firefox, and Playwright WebKit. Tests covered the disclosure, notices, CSP, no automatic feedback link, browser storage and request privacy, salary CSV import, and XLSX worksheet selection. Chrome smoke checks passed 2/2 each on DuckDB MVP and EH. No failures or skips in those 16 checks.
- The restored archive passed 3/3 selected Chrome Playwright checks over loopback HTTPS. A separate local script verified all 15 served content types and security headers and ran two format smoke checks for JSON and XLSX. The independent rebrand regression was used as the baseline for the unchanged analytical and reporting paths.

## Antigravity handoff and outstanding conditions

- Confirm the exact recovered release artifact, notices, disclosure, and CSP. Spot-check the canonical salary and report values, cancellation and recovery, and same-origin traffic with no user payload or stored data. Verify the approved feedback link and disclosure from the rebuilt candidate.
- Run the keyboard, spoken status, and report walkthroughs on the documented device matrix. Run repeated near-limit imports on lower-memory physical hardware. Local Playwright WebKit passed the selected checks. Physical mobile devices, Apple Safari, native screen-reader audio, and peak memory remain unverified. [Device scenarios](TESTING.md#phase-8-release-checks)
- Confirm host and operator, name availability and trademark status, operational inbox retention, and explicit preview or public exposure approval. Check hosted anonymity, headers, caching, and recovery only after such approval. Phase 8 remains open for independent QA.

## Feedback gate update

The founder approved `uktbli.eg@gmail.com` and inbox retention of 12 months from receipt. Both locales disclose the recipient and retention before the user opens the editable draft. The `mailto:` URL contains only the approved recipient and `STATOMERA Feedback` subject. The draft body is blank. Sending is a separate user action in the mail client. The inbox operator applies retention with no application-side deletion or storage. The link remains identical after importing and analyzing a dataset.

At source checkpoint `31a2093a6a5b4b40c800f2ef5db8630b35c066e7` plus this feedback change, `npm run typecheck` and `npm run build:portable` passed. The 63 individual unit tests and all six focused portable release browser checks passed with zero failures and skips. Chromium and Firefox each passed the bilingual notice, feedback, and worker privacy checks. Tests intercepted the keyboard-activated link before launching a mail client. No email was sent. The package manifest, lockfile, and CSP were unchanged.

The retained ZIP remains byte-identical to the original pre-feedback archive, as confirmed by its existing SHA-256. The feedback-enabled release must be rebuilt, packaged separately, and reverified before release. Phase 8 remains open. [Release runbook](RELEASE_RUNBOOK.md)

Changed files include `src/app.tsx`, `src/locale.ts`, `tests/browser/release.spec.ts`, `docs/PHASE_8_IMPLEMENTATION.md`, `docs/RELEASE_RUNBOOK.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/TESTING.md`, and the external `askora_project.md`.
