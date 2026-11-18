# Phase 1B compatibility and deployment feasibility

2026-11-18, Africa/Cairo. Phase 1B began at `aba060d` on `feature/phase-1b-compatibility`. The scope is the existing CSV proof and its deployment path.

## Changes and analytical contract

The Vite build now supports three independently testable artifacts. All use the same CSV parser, validation rules, localized result contract and 5 MiB / 100,000-record / 32-column / 4,096-code-unit field / 10-second job limits. The default build keeps the Phase 1A DuckDB behavior and lazily imports the DuckDB client. The EH build changes the paired DuckDB module and worker. The portable build uses one parser worker and a bounded TypeScript mean accumulator. It neither buffers the observations as a separate CSV nor loads the DuckDB client, worker or Wasm.

The accumulator sums parsed finite binary64 values exactly as signed integers in units of 2⁻¹⁰⁷⁴. A single ties-to-even rounding is applied to the mean. Working arithmetic state stays bounded by the range of binary64 and the row cap, independent of retaining observations. The parser still reads and decodes the bounded full file. Decimal text first rounds to binary64, so this is a binary64 mean with ordinary localized display rounding. Signed zero is presented as zero. The scope is one mean operation and current CSV quality checks. DuckDB remains a reference path and candidate for broader SQL and Parquet.

The synthetic salary fixture independently gives (10 + 20 + 30) / 3 = 20. The browser matrix checks five records, three valid salaries, one blank, one invalid and canonical mean 20 in English and Arabic. Unit cases also verify cancellation of extreme magnitudes, same-sign overflow, subnormals and normal/subnormal ties against hand-derived results. A supplemental seeded check compared 350 mixed-exponent datasets against exact Python Fraction sums followed by binary64 rounding. All 350 matched.

## Wasm and production artifacts

| DuckDB-Wasm 1.32.0 variant | Raw Wasm | Browser requirements and result |
| --- | ---: | --- |
| MVP | 39,362,651 bytes (37.54 MiB) | Phase 1A baseline, single-threaded, emitted in `dist` |
| EH | 34,242,586 bytes (32.66 MiB) | Native Wasm exception handling, single-threaded, emitted in `dist-eh` |
| COI | 33,968,067 bytes (32.39 MiB) | Threaded variant requires cross-origin isolation and a pthread worker. Size inspected from the pinned package. Runtime untested and no COI files emitted. |

Each DuckDB build emits only one paired worker and module. The portable build emits no DuckDB files. The dependency stays installed locally so the reference builds remain reproducible. Transport gzip readings are distinct from the raw file-size check. [DuckDB bundle documentation](https://duckdb.org/docs/api/wasm/instantiation)

| Uncompressed byte count | MVP | EH | Portable |
| --- | ---: | ---: | ---: |
| Wasm | 39,362,651 | 34,242,586 | 0 |
| DuckDB worker JS | 844,644 | 772,759 | 0 |
| Lazy DuckDB client JS | 193,480 | 193,478 | 0 |
| Application JS | 203,722 | 203,722 | 201,752 |
| Parser worker JS | 2,324 | 2,324 | 2,987 |
| CSS | 4,094 | 4,094 | 4,094 |
| HTML | 415 | 415 | 415 |
| Pages headers file | 0 | 0 | 251 |

## Deployment recommendation

Use `npm run build:portable` and retain `dist-portable/` as the recommended Cloudflare Pages Free Direct Upload artifact after deployment approval. It has five files, totals 209,499 bytes, and its largest file is 201,752 bytes, comfortably below the published 25 MiB limit for both Wrangler and browser upload. The generated `_headers` applies same-origin CSP without the Wasm eval allowance. A local browser preview verifies the same policy. Live host headers, routing, reachability and rollback remain future checks. Static delivery requires no Functions. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [Direct Upload limits](https://developers.cloudflare.com/pages/get-started/direct-upload/#limits) · [Headers](https://developers.cloudflare.com/pages/configuration/headers/) · [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)

Both DuckDB artifacts exceed the Pages cap. Netlify's 300-credit Free plan and manual upload can serve the portable footprint in principle, but its Drop guide warns that files over 10 MB may stall and usage consumes credits. GitHub Pages' 1 GB site limit can fit the raw variants, but its free tier requires a public repository and it restricts commercial SaaS use. For the present scope, Pages Direct Upload with the portable artifact meets the numerical and asset criteria without requiring Git hosting. [Netlify pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) · [Netlify Drop](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/) · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## Dependency review

GHSA-fc5q-39xc-vjpf / CVE-2026-112366 affects Picomatch versions up to and including 4.0.7. npm still lists 4.0.7 as latest and the advisory lists no patched version. The lock resolves 4.0.7 directly through Vite 8.3.8 and through Vite → tinyglobby 0.2.17, including its fdir 6.5.0 path. The full npm audit flags that chain. The runtime-only audit reports zero advisories. [Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The affected behavior concerns compilation of attacker-controlled glob patterns. CSV contents, filenames and results are consumed after build inside the browser. Neither analysis path supplies values to Vite or a glob compiler. Vite still processes trusted build inputs on the development machine, so the dependency remains affected in that context. Keep dev/preview on loopback with trusted source and build configuration, and serve only static output for any later deployment. Revisit the pinned toolchain when a supported patch is available or before accepting untrusted build inputs. The audit's forced downgrade suggestion would change the Vite major without verifying suitability and was not applied.

## Browser and performance results

The headless matrix used Chrome 156.0.8078.47, Playwright Firefox 159.0 and Linux WebKit 27.2 on Ubuntu 26.04.1 x64, Ryzen 5 5600H and approximately 16.9 GiB RAM. Type checking and all three builds passed. Nine unit cases and 81 browser cases passed, with 27 browser cases per build and zero skipped. In each browser configuration, the suite covers the Phase 1A assertions, both languages, startup and stall recovery, cancellation/replacement, local-only asset requests, no dataset persistence, and near-limit worker teardown. The portable suite replaces DuckDB-specific failure injection with parser-worker failure and stall injection.

For each browser and build, a 1,020,016-byte, 60,000-row synthetic file ran three times after one tiny-file analysis in a fresh browser context. Separately, one 4,900,016-byte, 100,000-row file was tested at a 360 px viewport. Both use alternating 10 and 30 salaries with reference mean 20. Times are milliseconds from selection through worker completion, with no public network transit.

| Build | Browser | First tiny file | 60k median / worst | 100k run |
| --- | --- | ---: | ---: | ---: |
| Portable | Chrome | 20 | 45 / 47 | 175 |
| Portable | Firefox | 31 | 53 / 53 | 127 |
| Portable | WebKit | 33 | 55 / 55 | 144 |
| MVP | Chrome | 882 | 911 / 927 | 1,013 |
| MVP | Firefox | 1,288 | 1,203 / 1,290 | 1,382 |
| MVP | WebKit | 1,648 | 1,844 / 1,929 | 1,706 |
| EH | Chrome | 850 | 681 / 721 | 848 |
| EH | Firefox | 1,002 | 994 / 999 | 1,106 |
| EH | WebKit | 1,386 | 1,301 / 1,362 | 1,495 |

Portable removes the extra numeric CSV and the separate Wasm runtime. Chrome's page-level JavaScript heap proxy after the smaller runs was approximately 25.2 MiB portable, 27.4 MiB MVP and 27.3 MiB EH. This proxy excludes reliable accounting of worker and Wasm memory, so it cannot establish peak process memory or prove when memory returns to the OS. The near-limit instrumented jobs terminated every started worker (one portable, two DuckDB). Repeated analysis, cancelled and replaced work, and timeout/retry checks exercise lifecycle behavior. The portable Chrome near-limit run used CDP 4× CPU throttling. This is a desktop slowdown check, with worker-thread throttling and real-device thermal or memory pressure unmeasured.

## Physical-device verification

ADB was available and detected no connected Android device after a permitted enumeration. This Linux host ran Playwright WebKit. Apple Safari was not available. CPU throttling and narrow viewport tests are desktop checks.

1. Build with `npm ci --ignore-scripts && npm run build:portable` and start `npm run preview:portable -- --host 127.0.0.1 --port 4173 --strictPort`. For a USB-debugging-authorized Android phone, check `adb devices` and use `adb reverse tcp:4173 tcp:4173`. Open `http://127.0.0.1:4173/` in Android Chrome. On a Mac, run the same build and preview locally and open that URL in Safari.
2. Use only synthetic data. Transfer `tests/fixtures/salary.csv` to the device's local Files/Downloads. Construct the scale fixture locally with `python3 -c 'print("employee,salary"); print((("x"*45 + ",10\n" + "x"*45 + ",30\n")*50000), end="")' > /tmp/askora-scale.csv` and transfer it too. For Android, `adb push /tmp/askora-scale.csv /sdcard/Download/askora-scale.csv` copies the generated file.
3. Record device model, RAM, OS and browser version. Import the small fixture once cold and three times after warm-up. Check 5/3/1/1 and mean 20 in both languages, both directions and themes. Import the scale fixture three times. Expect 100,000 rows and mean 20. Record first-result and repeat times, UI stalls, and background/resume or memory pressure symptoms. On Android, sample Chrome process memory with `adb shell dumpsys meminfo com.android.chrome` before and after the repeated runs, noting that it includes process overhead. On macOS use Activity Monitor and Web Inspector as available.
4. While a scale run is pending, cancel or select the smaller file. Verify there is no stale result. If the portable run finishes before Cancel can be tapped, repeat with a debugger-paused worker or the test harness. Verify visible focus, no horizontal document overflow and no dataset network requests. Remove Android forwarding after testing with `adb reverse --remove tcp:4173`.

## Verification commands

```sh
npm run build
npm run build:eh
npm run build:portable
node --experimental-test-isolation=none --test tests/unit/*.test.ts
# Existing locally provisioned browser binaries and extracted WebKit runtime libraries
export LD_LIBRARY_PATH=/tmp/askora-webkit-libs.h58Y7U/root/usr/lib/x86_64-linux-gnu
export ASKORA_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/askora-phase-1a-browsers
ASKORA_TEST_MODE=portable npm run test:browser
ASKORA_TEST_MODE=production npm run test:browser
ASKORA_TEST_MODE=duckdb-eh npm run test:browser
npm ls picomatch
npm view picomatch version dist-tags --fetch-retries=0 --fetch-timeout=8000
npm audit --omit=dev --fetch-retries=0 --fetch-timeout=8000
npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=8000
git diff --cached --check
git fsck --full --no-dangling
```

## Git and outstanding gates

The implementation checkpoint is `070bd4f`. This report and the architecture decision are in the following documentation commit on `feature/phase-1b-compatibility`. The final branch is clean and local. No remote, GitHub connection, account or public deployment was created.

The portable artifact clears the documented asset limits. Before a public launch, verify its actual hosted headers and routing with deployment approval, run the physical-device checks, and recheck development dependencies. Raw DuckDB assets remain blocked on Pages. Broader operations would require a fresh engine and deployment assessment. Phase 1B ends here.
