# Phase 1A report

2026-11-18, Africa/Cairo. The technical proof covers local CSV import, a bounded preview and a single deterministic salary analysis. The repository preserves the Phase 0 and skills checkpoints. Phase 1B requires review and approval.

## Architecture and input policy

The static React 19.2.8 interface uses TypeScript 5.9.3 and a Vite 8.3.8 build. The UI uses the approved dark palette and Champagne Gold, a minimal light palette and text branding pending production logo assets. The picker is keyboard accessible. English LTR and Arabic RTL render the same result object.

1. A dedicated parser worker strictly decodes UTF-8 and validates CSV records and unique nonempty headers. It preserves original labels and values for display, counts structural blanks in each column, and recognizes exactly one normalized salary header (`salary`, `راتب` or `الراتب`).
2. The parser retires before the DuckDB-Wasm 1.32.0 MVP worker starts. Only canonical numeric ASCII values are registered as an in-memory file in the single-threaded engine. One fixed query computes the valid count and compensated floating-point mean. It uses max-magnitude scaling if the unscaled mean overflows. It checks the engine's valid count against the parser's count.
3. Completion, replacement, error and cancellation terminate the current worker. Blank and invalid salaries are excluded and reported separately. The preview contains the first eight records and diagnostics show up to five rejected observations. No values are persisted by the app.

Caps are 5 MiB, 100,000 data records, 32 columns, 4,096 UTF-16 code units per field and 10 seconds per job. The proof reads the bounded file into memory. A trimmed empty cell is blank. Literal `N/A` and other nonempty invalid salary tokens are invalid. Zero and finite numeric sentinels are valid observations. The numeric grammar accepts ASCII decimal and scientific notation without locale grouping or units. Overflow and conversion of nonzero inputs to zero are rejected. Binary64 rounding and cancellation remain possible, especially for mixed extremes. Currency-grade decimal precision and generalized type inference require separate work.

## Analytical reference

The synthetic [salary CSV](../tests/fixtures/salary.csv) has five records and two columns. By hand, `(10 + 20 + 30) / 3 = 20`. The browser renders 20 in English and ٢٠ in Arabic, with canonical value 20 in both. It reports three valid salaries, one blank (20% of records) and one rejected `N/A` at record 4. Tests also exercise an empty denominator, signed decimal means, large and subnormal values, Unicode, inconsistent widths and malformed quotes.

## Verification commands

```sh
npm install --ignore-scripts --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000
npm ci --offline --ignore-scripts --no-audit --no-fund
npm test
node --experimental-test-isolation=none --test tests/unit/*.test.ts
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers ./node_modules/.bin/playwright install firefox webkit
ASKORA_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers npm run test:browser
LD_LIBRARY_PATH=/tmp/askora-webkit-libs.h58Y7U/root/usr/lib/x86_64-linux-gnu ASKORA_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers npm run test:browser -- --project=webkit --project=chromium --project=firefox
LD_LIBRARY_PATH=/tmp/askora-webkit-libs.h58Y7U/root/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers npm run test:browser -- --project=webkit --max-failures=1
LD_LIBRARY_PATH=/tmp/askora-webkit-libs.h58Y7U/root/usr/lib/x86_64-linux-gnu ASKORA_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers npm run test:browser -- --grep 'local-only requests|previously loaded assets'
npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=12000
npm audit --omit=dev --fetch-retries=0 --fetch-timeout=12000
git diff --cached --check
git fsck --full
```

For a new environment, install locally supported Playwright browsers with `npx playwright install` and select projects with `npm run test:browser -- --project=chromium` as needed. The temporary paths above record this run. The ordinary sandbox denied binding loopback, so the browser runner used approved loopback access. Browser binaries and WebKit libraries were extracted to temporary paths. WebKit initially failed to launch. Six libraries from the configured Ubuntu archive (libevent-2.1-7t64, libavif16, libmanette-0.2-0, libyuv0, libgav1-2 and libhidapi-hidraw0) were downloaded with `apt-get download` and extracted with `dpkg-deb -x`. Symlinks in the temporary WebKit distribution supplied them to its launcher. System packages were unchanged.

## Test results and performance

The clean offline lockfile install, seven unit cases, TypeScript check and production build passed. Chrome 156.0.8078.47, Playwright Firefox 159.0 and Playwright Linux WebKit 27.2 each passed all eight browser cases across the full and focused runs on Ubuntu 26.04.1 x64, AMD Ryzen 5 5600H and approximately 16.9 GiB RAM. Coverage spans the keyboard picker, repeated analysis, RTL and theme switching at 390 px, strict CSV errors, extreme values, cancellation, replacement, worker failures, privacy and static-assets-only processing. An earlier assertion revealed that Vite's default static middleware omitted custom headers on conditional responses. The final preview applies those headers before the static middleware and the browser regression passed. The initial WebKit privacy assertion counted a browser-local blob read as a network request. The focused rerun checks the origin of local blob reads separately and still requires all HTTP requests to be first-party static asset GETs without payloads.

Three sequential runs per browser used a generated 60,000-row, two-column file of 1,020,016 bytes. Values below are milliseconds. The two numeric values alternate 10 and 30, so the independent expected mean is 20.

| Browser | Navigation | First tiny-file analysis | Larger file total median / worst | Parse range | Engine preparation range | Query range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chrome | 61 | 889 | 967 / 1,055 | 26–33 | 779–933 | 73–84 |
| Firefox | 192 | 1,440 | 1,423 / 1,429 | 27–35 | 1,253–1,298 | 69–81 |
| WebKit | 52 | 1,625 | 1,589 / 1,637 | 34–36 | 1,411–1,530 | 53–65 |

Engine preparation includes worker startup, Wasm loading and registering canonical data. These are local, headless timings. Browser caching can affect results. Chromium reported a roughly 27.4 MiB JavaScript heap proxy. Worker Wasm memory and total process memory were unavailable from these measurements. The narrow viewport check covers layout only. Physical Android and Safari remain untested.

## Security review

The browser loads code and Wasm from the same origin. Preview serves a CSP for both page and workers, with same-origin resources and WebAssembly compilation allowed. Extension autoload and autoinstall are disabled. File text never becomes SQL or markup. The analysis worker has no remote service or credentials. The browser suite checks requests, inert rendering, worker recovery, cookies, web storage, IndexedDB and Cache Storage. A test also repeats analysis with only previously loaded static assets supplied by the test harness.

The production dependency audit reported zero advisories. The full npm advisory check reported a high-severity Picomatch issue propagated through Vite's development/build dependency tree. The available release is affected and the advisory lists no patch. The proof passes only fixed trusted project paths to build tooling and uses a loopback preview. Track the advisory before hosted tooling or release. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Release constraints and Phase 1B proposal

The raw Wasm asset is 39,362,651 bytes (37.54 MiB). Vite reports 8,863.96 kB gzip. The raw artifact exceeds the proposed Cloudflare Pages 25 MiB per-asset limit. The production app JavaScript is 395,921 bytes, the DuckDB worker is 844,644 bytes, the parser worker is 2,312 bytes and CSS is 4,094 bytes. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

After approval, compare smaller worker packaging, verified compressed delivery and a bounded TypeScript CSV/mean fallback on the same fixtures. Measure actual lower-memory Android devices, including cold startup, maximum working set and suspend or restart. Verify Safari on an Apple device, review the dependency advisory and decide the baseline for a future static release. Full offline installation and production CSP are separate deployment checks.
