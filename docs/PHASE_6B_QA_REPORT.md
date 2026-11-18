# Phase 6B Independent QA Report

Independent Quality Assurance evaluation performed by Antigravity for Askora Phase 6B (Local AI Feasibility Review and Deterministic Intent Benchmark).

---

## 1. Verified Git checkpoint

The repository state was independently verified before starting the review:

- **Branch**: `feature/phase-6b-local-ai-feasibility`
- **HEAD commit**: `cf83854` (`docs: evaluate local AI feasibility for Phase 6B`)
- **Preceding commit**: `8f58ab3` (Phase 6A final verification)
- **Working tree**: Clean prior to QA deliverable creation
- **Source code status**: Unmodified (`src/`, `package.json`, and `tests/` contain zero changes from Phase 6A)

---

## 2. Research accuracy

The research and analysis presented in `docs/PHASE_6B_REPORT.md` and `experiments/phase-6b-local-ai/` were independently audited against official publisher documentation, repository releases, and technical reports:

1. **Qwen3-0.6B**:
   - **Publisher**: Alibaba Cloud (Qwen Team).
   - **Parameters**: 0.60B total parameters (~0.44B non-embedding).
   - **Architecture**: Dense causal language model with native context window up to 32,768 tokens.
   - **Dual-mode capability**: Supports seamless switching between *thinking mode* and *non-thinking mode*. This is critical for constrained structured JSON output, preventing chain-of-thought reasoning tokens from polluting or prefixing the JSON object.
   - **Language Support**: Documented multilingual coverage across 100+ languages, with explicit family-level support for English, Modern Standard Arabic (MSA), and Egyptian Arabic.
   - **Pinned ONNX Export**: `onnx-community/Qwen3-0.6B-ONNX` at commit `558750086ed49d78cb701ed6fa85af33fd16453f`.

2. **Qwen2.5-0.5B-Instruct**:
   - **Publisher**: Alibaba Cloud.
   - **Parameters**: 0.49B total parameters (~0.36B non-embedding).
   - **Architecture & Context**: 32,768 context length, 8,192 max generation tokens, Grouped Query Attention (GQA with 2 KV heads).
   - **Language Support**: Documented for English and Arabic with improved structured output capabilities; however, specific Egyptian Arabic dialect comprehension at this 0.5B scale remains unproven.
   - **Pinned ONNX Export**: `onnx-community/Qwen2.5-0.5B-Instruct` at commit `516c8d04add8a80c5228f32102b57953b8d421a9`.

3. **Gemma 3 1B IT**:
   - **Publisher**: Google DeepMind.
   - **Parameters**: ~1.0B parameters.
   - **Context & Attention**: 32,768 token context with sliding-window local/global attention.
   - **Language Support**: Strong multilingual foundation; English is extensively documented. Arabic (MSA and regional dialects) at the 1B scale has limited independent validation on schema-constrained extraction.
   - **Pinned ONNX Export**: `onnx-community/gemma-3-1b-it-ONNX` at commit `a58439f40017d3b99c7d378ff525e54e0ba08ebf`.

---

## 3. Model comparison verification

The model comparison metrics reported in the feasibility study were verified:

| Feature / Metric | Qwen3-0.6B | Qwen2.5-0.5B-Instruct | Google Gemma 3 1B IT |
| :--- | :--- | :--- | :--- |
| **Total Parameters** | 0.60B | 0.49B | ~1.0B |
| **Context Window** | 32,768 tokens | 32,768 tokens | 32,768 tokens |
| **Q4F16 Model Size** | 570 MB | 483 MB | 763 MB (+ 461 kB external) |
| **INT8 Model Size** | 618 MB | 512 MB | 1.0 GB |
| **FP16 Model Size** | 1.2 GB | 997 MB | 2.03 GB (+ 378 kB external) |
| **KV Cache Allocation (1,024 tok)** | ~112 MiB (full FP16) | ~12 MiB (GQA 2 heads) | ~26 MiB (sliding window) |
| **Host RAM Planning Range** | 1.52 – 2.02 GiB | 1.26 – 1.76 GiB | 1.80 – 2.30 GiB |
| **Model VRAM Planning Range** | 0.89 – 1.29 GiB | 0.71 – 1.11 GiB | 0.99 – 1.39 GiB |
| **Transfer Time at 25 Mb/s** | ~182 s (~3 min) | ~155 s (~2.6 min) | ~244 s (~4 min) |
| **Read Time at 500 MB/s** | ~1.14 s | ~0.97 s | ~1.53 s |
| **Primary Advantage** | Non-thinking mode, documented Egyptian/MSA Arabic support | Smallest memory footprint and KV cache | Strong reasoning baseline |
| **Primary Limitation** | Untested real browser accuracy | Dialectal Arabic unverified at 0.5B | Custom restrictive license, largest size |

---

## 4. Licensing findings

Independent verification of the legal and distribution terms confirms:

1. **Qwen Family Licensing (Qwen3-0.6B and Qwen2.5-0.5B-Instruct)**:
   - **Upstream License**: **Apache License 2.0**.
   - **Commercial Use**: Fully permitted for commercial deployment and redistribution.
   - **Redistribution Requirements**: Must retain copyright, trademark, and patent notices; include a copy of the Apache 2.0 license; state changes if modified; and preserve any upstream `NOTICE` file.
   - **Exported ONNX Weights & Tokenizer**: The `onnx-community` repositories inherit and maintain Apache-2.0 metadata for these models.

2. **Google Gemma 3 1B IT Licensing**:
   - **License**: **Custom Gemma Terms of Use** (not an OSI-approved open source license).
   - **Commercial Use**: Allowed, but strictly subject to Google's *Gemma Prohibited Use Policy* (prohibiting specific sensitive domains, surveillance, and deceptive generation).
   - **Flow-down Terms**: Requires passing downstream restrictions to any recipients and providing notice of terms. Gated model on Hugging Face.
   - **Redistribution Assessment**: Substantially higher compliance and governance friction for a privacy-first, zero-spend public beta compared to Apache 2.0.

3. **Inference Runtime Licensing**:
   - **Transformers.js** (`@huggingface/transformers`): Apache License 2.0.
   - **ONNX Runtime Web** (`onnxruntime-web`): MIT License.
   - **WebLLM** (`@mlc-ai/web-llm`): Apache License 2.0.
   - All runtime dependencies are standard permissive licenses compatible with Askora's static distribution.

---

## 5. Benchmark reproduction

The Phase 6B evaluation framework was independently executed and verified from repository root:

### 5.1 Self-Test Execution
- Command: `node experiments/phase-6b-local-ai/evaluate.mjs self-test`
- Result: **PASSED**.
- Assertions verified: Case uniqueness, gold route contract integrity, invalid JSON rejection, payload size limit (>4096 bytes), duplicate key detection, route validator schema rejection, and unsafe routable tracking.

### 5.2 Deterministic Parser Baseline Reproduction
- Command: `node experiments/phase-6b-local-ai/evaluate.mjs baseline`
- Result: **100% REPRODUCED**.

| Evaluation Dimension | Reported in Phase 6B | Independently Measured | Match |
| :--- | :---: | :---: | :---: |
| **Overall Exact Score** | 27 / 32 (84.4%) | **27 / 32 (84.4%)** | EXACT |
| **English (`en`)** | 8 / 8 (100%) | **8 / 8 (100%)** | EXACT |
| **Modern Standard Arabic (`msa`)** | 6 / 8 (75.0%) | **6 / 8 (75.0%)** | EXACT |
| **Egyptian Arabic (`egy`)** | 6 / 8 (75.0%) | **6 / 8 (75.0%)** | EXACT |
| **Mixed Arabic/English (`mix`)** | 7 / 8 (87.5%) | **7 / 8 (87.5%)** | EXACT |
| **Intent Resolution** | 14 / 16 | **14 / 16** | EXACT |
| **Column Identification** | 10 / 12 | **10 / 12** | EXACT |
| **Parameter Extraction** | 7 / 8 | **7 / 8** | EXACT |
| **Clarification Handling** | 6 / 8 | **6 / 8** | EXACT |
| **Unsupported Request Rejection** | 8 / 8 (100%) | **8 / 8 (100%)** | EXACT |
| **Exact Refusal Reason** | 7 / 8 | **7 / 8** | EXACT |
| **Unsafe Attempt Count** | 0 | **0** | EXACT |
| **Unsafe Routable Count** | 0 | **0** | EXACT |
| **Parser Latency (3,200 calls)** | Median: ~0.023 ms, p95: ~0.045 ms | **Median: ~0.021 ms, p95: ~0.034 ms** | Consistent |

### 5.3 Diagnostic Error Analysis
The 5 reproducible mismatches in the deterministic baseline were inspected:
1. `msa-06` ("اختبار t لعينة واحدة للعمر"): Gold is `oneSample` with `missingNullMean`; deterministic parser returned generic `unsupported` (`unknownOperation`).
2. `msa-07` ("تنبّأ بإيراد الشهر القادم."): Gold is refusal `forecast`; parser rejected with generic `unknownOperation`.
3. `egy-03` ("عايز أعرف المرتبات في المتوسط بتطلع كام؟"): Gold is `mean` of `salary`; parser returned `unknownOperation` due to colloquial conversational phrasing.
4. `egy-05` ("الارتباط بين العمر وإيراد عامل إيه؟"): Gold is `pearson` with `ambiguousColumn` (due to `إيراد` vs `ايراد`); parser returned `unknownColumn`.
5. `mix-04` ("paired t-test between salary and \"العمر\" using same rows"): Gold is `paired` with `matching: 'sameRow'`; parser failed to parse the quoted Arabic label inside English connector syntax.

### 5.4 Scorer Integrity Verification
Inspection of `evaluate.mjs` confirms:
- Intent, column, and parameter accuracy metrics are computed **exclusively** on cases where `gold.status === 'resolved'`.
- If a candidate proposes `status: 'resolved'` for an unsupported or clarification query, it is penalized as an `unsafeAttempt` and (if validly routable) an `unsafeRoutable`.
- The benchmark scorer does not allow ambiguities or refusals to be conflated with successful resolutions.

---

## 6. Runtime feasibility

The proposed runtime architecture (Transformers.js + ONNX Runtime Web in a dedicated Web Worker) was evaluated for practical consumer deployment:

1. **WebGPU Acceleration**:
   - Provides peak throughput (modeled at ~130–200 tokens/s on modern discrete/integrated GPUs).
   - Requires browser WebGPU support, secure origin, compatible hardware adapter, and optional `shader-f16` extension.
   - On headless environments, older devices, or mobile browsers with disabled/unsupported GPU flags, WebGPU fails to initialize.
2. **WASM CPU Fallback**:
   - Universal browser compatibility across modern browsers.
   - Single-threaded WASM execution on a 500+ MB model yields severe latency (~15–35 tokens/s on high-end desktop CPUs; dropping to <5–10 tokens/s on mobile CPUs), leading to high battery drain and thermal throttling.
   - Multi-threaded WASM requires cross-origin isolation (`COOP`/`COEP` headers), which complicates deployment on static hosts and blocks cross-origin resources.
3. **Download & Static Host Limits**:
   - The smallest Q4F16 candidate (Qwen2.5-0.5B at 483 MB) requires ~2.6 minutes over a 25 Mbps connection; Qwen3-0.6B (570 MB) requires ~3 minutes.
   - Askora's target zero-cost deployment host (Cloudflare Pages Free) strictly limits individual static asset files to **25 MiB**.
   - Serving either model requires an audited sharding pipeline (splitting weights into 20–24 chunks) or an external static object storage bucket with CORS headers.
4. **Feasibility Verdict**:
   - A model download in the initial beta would severely degrade user experience, introduce fragile device failures, and break the zero-cost single-bundle architecture.
   - Keeping deterministic parsing as the default and confining local AI to an opt-in, non-production research experiment is technically justified.

---

## 7. Memory and hardware limitations

Physical inspection of the host environment confirmed:
- **Host**: AMD Ryzen 5 5600H (12 logical CPUs), 16 GiB RAM (8.3 GiB available), NVIDIA RTX 3050 Ti Mobile (4 GiB VRAM), AMD Cezanne iGPU.
- **Headless Probes**: In headless execution without display server GPU pass-through, WebGPU adapter acquisition failed in Chrome, and was absent in Firefox/WebKit.
- **Model Inferences**: Confirmed **zero model inferences** were executed; no candidate weights were downloaded or placed in local caches.
- **Categorization of Findings**:
  - *Measured locally*: Host CPU/RAM/GPU hardware presence, deterministic parser execution times, headless WebGPU adapter acquisition failure.
  - *Publisher specifications*: Parameter counts, context lengths, upstream quantization sizes.
  - *Analytical estimates*: KV cache sizing, host RAM/VRAM planning ranges, memory-bandwidth throughput sensitivity.
  - *Unmeasured assumptions*: On-device time-to-first-token (TTFT), real token generation rates, battery/thermal drain on physical mobile devices.

---

## 8. Privacy and security

The security boundary designed for the optional local AI interpreter was verified:

```text
User Question + Minimal Schema Metadata (Column IDs & Labels only)
  → Sandboxed Local Worker (Transformers.js / ONNX Runtime)
  → Strict Flat JSON Schema Validation (length ≤ 4096, unique keys, allowed enum values)
  → Column ID Hydration from Trusted In-Memory Schema
  → Revision-Bound Deterministic Route Validator (src/router/validation.ts)
  → User Confirmation (Review editable question / clarification)
  → Analysis Router → Computation Worker → Provenance Evidence
```

**Verified Constraints**:
1. **No Calculation Authority**: The model is structurally forbidden from computing statistics, means, intervals, or counts.
2. **No Arbitrary Code / SQL**: The route validator strictly rejects unexpected fields (such as `sql`, `code`, or `formula`), rejecting any injection payload.
3. **No Direct Execution**: Intent proposal is strictly separated from execution; execution requires hydration with real column IDs and validation against the active dataset revision.
4. **Zero Data Leaks**: Phase 6B introduces no network calls, no cloud telemetry, no analytics, and no remote API dependencies.

---

## 9. Production isolation

Verification of the production codebase confirmed complete isolation:
- `git diff cf83854^..cf83854` confirms zero changes to `src/`, `package.json`, `package-lock.json`, or `tests/`.
- `npm run typecheck`: **PASSED** (0 errors).
- `npm test`: **PASSED** (63 of 63 unit tests passed).
- `npm run build:portable`: **PASSED** with identical asset byte counts (11 files, 879,677 bytes; entry JS 311.56 kB).
- Zero model weights, experimental runtime packages, or external dependencies were introduced into production assets.

---

## 10. Defects and discrepancies

- **Defects in Application Code**: **0** (No application code was altered).
- **Defects in Benchmark / Evaluation**: **0** (Benchmark script executes cleanly; self-test assertions pass; baseline reproducibility is exact).
- **Documentation Discrepancies**: None. The report explicitly and honestly identifies unmeasured areas, distinguishes estimates from verified facts, and recommends against premature production deployment.

---

## 11. Remaining unknowns

1. **On-Device Accuracy on Domain-Specific Questions**: Because no live candidate inference was run, actual task-specific accuracy of Qwen3-0.6B on Egyptian Arabic, Modern Standard Arabic, and mixed-script data questions remains an unproven research hypothesis.
2. **Physical Mobile Device Behavior**: Memory pressure, background tab throttling, WebGPU support on Android Chrome, and Safari WebGPU stability on physical iPhones/iPads remain unverified.
3. **Cloudflare Pages Asset Sharding**: The exact build-time chunking and runtime reassembly mechanism required to serve ~570 MB of weights under the 25 MiB file cap has not yet been implemented or benchmarked.

---

## 12. Final verdict

**PASS WITH NON-BLOCKING ISSUES**

*Verdict Justification*:
1. The research, licensing audit, and architectural recommendations are thorough, accurate, and aligned with Askora's core product values (zero project spend, local privacy, deterministic correctness).
2. The deterministic benchmark is 100% reproducible with sound scoring semantics.
3. Production isolation is complete; the existing deterministic beta remains 100% functional with zero added runtime overhead.
4. The recommendation to issue a **No-Go for production integration** and maintain deterministic parsing as the default is strongly endorsed.
5. The verdict carries the *Non-Blocking Issues* designation solely because live model inference, physical device performance, and weight sharding infrastructure remain unmeasured research unknowns that must be addressed before any future experimental trial is considered.
