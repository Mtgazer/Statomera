# Phase 2C additional data formats

2026-11-18, Africa/Cairo. Based on `7b3c73c` on `feature/phase-2c-file-formats`. CSV, flat JSON and a bounded XLSX subset are supported. Parquet produces a localized unavailable message.

## Library decisions

| Format | Decision | Reason and tradeoff |
| --- | --- | --- |
| JSON | Shared worker plus a small flat-shape adapter. Native JSON decoding is used for individual string tokens. | A whole-document JSON.parse would round numeric tokens and retain only the last duplicate key before profiling. The restricted grammar keeps those tokens, rejects duplicate keys and nested shapes, and needs no package. No remote dependencies or calls at runtime. |
| XLSX | SheetJS CE 0.20.3 from its official release, Apache-2.0, with zip.js 2.25.0 native entry, BSD-3-Clause. | SheetJS preserves sparse cell metadata, sheet names, stored formulas and date formats. It reads bounded XML parts into memory. zip.js gives a streamed, checked extraction boundary and stored-entry repacking before SheetJS. The native ZIP path runs in the existing worker and uses browser decompression. The alternative read-excel-file is MIT with a dedicated worker entry and four package dependencies in the evaluated release. It was not chosen for this pass because the adapter needs direct sparse cells, formula metadata and merge checks. The XLSX code ships as an optional 530,610-byte worker chunk. [SheetJS release](https://cdn.sheetjs.com/) · [SheetJS security](https://docs.sheetjs.com/docs/miscellany/security/) · [zip.js](https://github.com/gildas-lormeau/zip.js) · [read-excel-file](https://github.com/catamphetamine/read-excel-file) |
| Parquet | Defer after evaluating hyparquet 1.33.1, MIT, and the pinned DuckDB reference. | Hyparquet is browser-compatible JavaScript with sliced local reads and no runtime dependencies. Its installed package measured 307,266 unpacked bytes. The inspected Thrift footer and data-page decoders use serialized list and value counts for allocations before caller-visible metadata checks can enforce budgets. Restricting the eventual schema to flat columns or omitting codecs does not address those allocation sites. The pinned DuckDB raw Wasm files exceed the static host cap. The evaluated reader was removed from the dependency tree. No Parquet rows or nested structures are imported. [Hyparquet source](https://github.com/hyparam/hyparquet) · [DuckDB size evidence](PHASE_1B_REPORT.md#wasm-and-production-artifacts) |

## Supported data and normalization

The same repeatable rectangular `Dataset` feeds the existing profiler, exact duplicate counting, numerical summaries and schema overrides. CSV records retain their string contract. Structured adapters additionally carry an original display string and native kind per cell. Automatic inference preserves a native string such as `"12"` as text. An explicit Number override can convert such a string through the existing strict numeric rules. Structured numeric tokens outside the supported precision or range are rejected or counted as invalid by the adapter. Raw diagnostics stay local. Absent, null and blank inputs share the blank bucket. Repeated rows use normalized cell order and source kinds.

- **JSON** accepts a nonempty top-level array of flat objects with string keys and scalar string, numeric, Boolean or null values. The first appearance of each key determines column order. Sparse rows fill absent fields with blanks. Exact duplicate keys, nesting, arrays in cells, invalid JSON and an empty schema raise a localized error. Unsafe plain integer literals remain visible as original rejected tokens. Accepted decimal/scientific numbers use binary64. Object keys provide the headers. CSV delimiter and first-record settings do not affect JSON.
- **XLSX** lists up to 64 worksheets. Switch worksheets in the intake panel, including after an unsupported sheet fails. Each worksheet profiles its rectangular populated-cell range. Leading and trailing blank space outside that range and formatting-only cells do not extend it. First-record header handling applies, and interior blanks count as missing. Formula code is inert. A stored cached scalar is used as supplied and may be stale. Uncached formulas, selected sheets with merges, timestamps, unsupported cells and unsafe Excel integers fail explicitly. Excel error cells are counted as invalid. The supported date-only serials respect the 1900 or 1904 calendar, reject the fictitious 1900-02-29, and display YYYY-MM-DD. Workbook charts, images and presentation metadata are outside the tabular contract. A worksheet switch clears overrides tied to the prior positional schema.
- **Limits** retain 5 MiB input, 100,000 rows, 32 columns, one million cells, 4,096 code units per field and a 10-second job budget. Workbooks add 256 archive entries, 4 MiB per expanded entry and 12 MiB aggregate expanded bytes. The ZIP boundary excludes encrypted, overlapping and duplicate entries, unchecked compression methods and unusual paths. It checks CRC and output size and rejects XML declarations that could define external entities. The repacked archive contains bounded UTF-8 XML/relationship parts. Formula execution, external links and native code are outside the worker path.

## Build and performance

| Portable milestone | Artifact total | Main JavaScript | Format modules |
| --- | ---: | ---: | --- |
| Phase 2B | 222,791 bytes | 210,578 bytes | CSV worker |
| JSON-only intermediate | 226,027 bytes | 211,281 bytes | JSON inlined into the intermediate 9,390-byte worker |
| Final | 757,667 bytes | 212,098 bytes | Lazy JSON 1,697 bytes, XLSX 530,610 bytes, ZIP helper 81 bytes and common worker 7,731 bytes |

The final portable artifact has eight files and its largest is 530,610 bytes. ES worker output splits optional adapters. Browser checks verified that opening a page did not load XLSX and that opening a workbook fetched the module from the preview origin. The artifact has neither a DuckDB nor a Wasm asset and fits the documented 25 MiB per-asset limit. The MVP and EH comparison builds retain their original Wasm and total 41,160,231 and 35,968,279 bytes respectively. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

These single-run timings measure local file selection or worksheet switching through worker completion. All three browser projects ran concurrently on the Linux test host. They are smoke timings, with no claim about peak worker memory or mobile throughput.

| Headless browser | 10,000-row JSON (320,001 bytes) | XLSX switch to 2-row sheet (7 KiB workbook) |
| --- | ---: | ---: |
| Chrome | 69 ms | 96 ms |
| Firefox | 61 ms | 110 ms |
| WebKit | 44 ms | 92 ms |

## Verification and findings

Fixtures are the hand-authored [flat JSON](../tests/fixtures/flat.json), [OpenPyXL workbook](../tests/fixtures/worksheets.xlsx), [over-limit archive](../tests/fixtures/oversize-workbook.xlsx) and [valid PyArrow Parquet rejection case](../tests/fixtures/unsupported.parquet). JSON uses the independent mean (10 + 30) / 2 = 20. XLSX uses (10 + 30 + 2) / 3 = 14 on the first sheet and (40 + 60) / 2 = 50 on the second. The [fixture generator](../scripts/generate-xlsx-fixtures.py) injects a known formula cache independently of the reader.

Ran `npm run build:portable`, `npm run build`, `npm run build:eh`, each including TypeScript checking, and `node --experimental-test-isolation=none --test tests/unit/*.test.ts`. Browser runs used `ASKORA_TEST_MODE=<mode> npm run test:browser -- --workers=3` across all three build modes with Chrome 156, Playwright Firefox 159 and Linux WebKit 27.2. A focused matrix used `--grep 'JSON profiles|XLSX worksheet|format rejection'`. An initial workbook test found an OpenPyXL fixture cache patch mismatch and a SheetJS compatibility issue with stored ZIP data descriptors. The fixture generator now handles both empty-value spellings and the repack disables data descriptors. Final checks passed 23 unit tests and 153 browser cases (51 per build), with zero skips. All three builds and type checks passed. The preceding focused matrix passed nine cases. The bilingual CSV salary fixture still returns 5 rows, 3 valid, 1 blank, 1 invalid and mean 20.

Privacy checks verified same-origin static GETs, no outbound payloads or persistent dataset state, inert CSV rendering, cancellation during optional-module loading and worker recovery. The production advisory audit returned zero findings. The full audit exited 1 on the existing development-only Picomatch issue. The SheetJS release was also reviewed against upstream advisories. Browser-based peak memory, actual Apple Safari, physical Android, and hosted behavior were unmeasured. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [SheetJS security](https://docs.sheetjs.com/docs/miscellany/security/)

## Phase 2D recommendations

Evaluate a Parquet decoder with enforceable footer, page and codec allocation limits before admitting even flat schemas. Expand XLSX date/worksheet support only with real-device memory and compatibility evidence. Review workbook fixture coverage from multiple producers and run physical-device tests before raising any limits.

Implementation checkpoint `dac978d`. This report and the documentation updates are in the following local commit. The branch is clean and has no configured remote. Phase 2C ends here.
