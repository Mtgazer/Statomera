# Phase 6B local AI feasibility

Reviewed 2026-11-19. Started from clean `feature/phase-6a-conversation-ux` at `8f58ab3`, including the post-fix Phase 6A QA verdict. Work is on `feature/phase-6b-local-ai-feasibility`. This study adds an offline benchmark and documentation. Production imports, dependencies, UI and execution are unchanged.

**Recommendation:** Start any separately approved, isolated experiment with **Qwen3-0.6B q4f16 and Transformers.js on ONNX Runtime Web**. Keep Qwen2.5-0.5B-Instruct as the smaller comparison. **No-go for production integration or a model download in the beta.** This study measured the deterministic baseline and browser capabilities. Model quality and device cost remain unmeasured.

## Model and license comparison

Sizes are upstream export listings in decimal MB or GB, rounded by the repository. They cover the selected graph and associated external tensors where listed. Total download also includes tokenizer, configuration, runtime and Wasm assets. The exact commits are the browser exports reviewed. Pin every file and verify its digest and terms before redistribution.

| Candidate | Parameters and advertised context | Browser export, quantization and model bytes | Language and structured output |
| --- | --- | --- | --- |
| Qwen/Qwen3-0.6B | 0.60B per Qwen, 32,768 supported tokens | ONNX Community `5587500`. Q4F16 570 MB, Q4 919 MB, INT8 618 MB, BNB4 892 MB, FP16 1.2 GB. WebGPU first, separate WASM/INT8 compatibility trial. | The Qwen3 publisher specifically lists Standard and Egyptian Arabic and English at family level. It supports a non-thinking chat template, which reduces the chance that reasoning text precedes JSON. Mixed-script resolution and strict JSON remain unmeasured on this export. [Model card](https://huggingface.co/Qwen/Qwen3-0.6B) · [Language coverage](https://qwenlm.github.io/blog/qwen3/) · [Pinned ONNX export](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/tree/558750086ed49d78cb701ed6fa85af33fd16453f/onnx) |
| Qwen/Qwen2.5-0.5B-Instruct | 0.49B, 32,768 context, 8,192 generation | ONNX Community `516c8d0`. Q4F16 483 MB, Q4 786 MB, INT8 512 MB, BNB4 764 MB, FP16 997 MB. WebGPU first, separate WASM/INT8 compatibility trial. | The family lists English and Arabic and improved structured output. The 0.5B quantized export has no verified Egyptian Arabic or schema-constrained accuracy here. The smaller download and KV cache make it a useful lower-resource control. [Model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) · [Pinned ONNX export](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/tree/516c8d04add8a80c5228f32102b57953b8d421a9/onnx) |
| Google Gemma 3 1B IT | About 1B, text-only 32,768 context for this size | ONNX Community `a58439f`. Q4F16 763 MB + 461 kB, Q4 859 MB + 347 kB, INT8 1 GB, BNB4 1.6 GB, FP16 2.03 GB + 378 kB. WebGPU trial with a compatible external-data loader, separate WASM/INT8 compatibility trial. | Google reports broad family-level multilingual training and publishes multilingual evaluations. English is documented. MSA, Egyptian Arabic, mixed language and exact JSON for this export remain unverified. Its weight size and distribution terms make it a secondary comparator. [Model card](https://huggingface.co/google/gemma-3-1b-it) · [Technical report](https://storage.googleapis.com/deepmind-media/gemma/Gemma3Report.pdf) · [Pinned ONNX export](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX/tree/a58439f40017d3b99c7d378ff525e54e0ba08ebf/onnx) |

- **Both Qwen models** are Apache-2.0 at the publisher, which permits commercial use and redistribution. An Askora mirror would need the license, applicable notices and attribution, and change notices where applicable. Verify conversion provenance and associated tokenizer and runtime assets separately. [Qwen3 license file](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/LICENSE) · [Qwen2.5 publisher license](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) · [Apache License §4](https://www.apache.org/licenses/LICENSE-2.0.html)
- **Gemma 3 1B IT** uses the custom Gemma terms. Commercial use and redistribution are conditional on those terms. Distribution includes flow-down of enforceable use restrictions, providing the agreement, change notices when applicable and a distribution notice for copies outside hosted service. The publisher's Hugging Face download is gated. Treat the ONNX conversion as subject to the underlying terms and resolve distribution conditions before considering a public mirror. [Google terms §§2–3](https://gemma.ai/resources/terms/) · [ONNX export license metadata](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX)

## Browser runtime comparison

| Option | Compatibility and acceleration | Loading, memory and maintenance |
| --- | --- | --- |
| WebGPU | Secure context and working adapter/device required. Probe the actual adapter, `shader-f16`, bindable storage and model operators. Recent Android support depends on hardware and browser. Safari 26 ships the API on Apple platforms. | Shader compilation, upload/staging buffers and GPU limits affect cold start. Integrated GPUs share system memory. Device loss and mobile backgrounding require teardown and fallback. Browser API presence alone proves neither runtime support nor device performance. [Chrome troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) · [Chrome Android announcement](https://developer.chrome.com/blog/new-in-webgpu-121) · [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| WebAssembly CPU | Broadest browser API support. CPU fallback is conditional on graph operators, WASM memory, SIMD and performance. Test one thread first. | Session setup, CPU weight traffic and repeated decoding add latency and thermal cost. Multi-threaded ORT requires browser cross-origin isolation, which needs separate hosting and asset compatibility checks. [ORT support matrix](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) · [ORT environment flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html) |
| Transformers.js + ONNX Runtime Web | Higher-level tokenizer, chat template and generation atop ORT execution providers. WebGPU or WASM under the selected export. ORT's published provider matrix is more conservative than browser API availability. Prompt-only JSON requires rejection on invalid output. | Transformers.js, ORT JS/Wasm and tokenizer increase lazy-load size. CPU and GPU provider binaries can differ. Pin both, instrument asset/session phases, disable remote loading and test export/operator compatibility. Direct ORT can give more control over packaging, but it leaves tokenization, generation and cache orchestration to Askora. [Transformers.js](https://huggingface.co/docs/transformers.js/index) · [Remote loading flags](https://huggingface.co/docs/transformers.js/api/env) · [ORT deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html) |
| WebLLM / MLC | WebGPU-oriented with workers and JSON/schema mode where supported. The compiled Wasm model library does not provide CPU inference fallback. Qwen3 has a separate MLC export. | Requires matched runtime, compiled library, tokenizer and weight shards. Model buffer requirements, shader initialization and storage remain device-specific. Schema-constrained generation can improve JSON compliance, but it cannot guarantee correct intent. Keep it as a WebGPU-only comparison if an adapter becomes available. [WebLLM docs](https://webllm.mlc.ai/docs/) · [API reference](https://github.com/mlc-ai/web-llm/blob/main/docs/user/api_reference.rst) · [MLC Qwen3 export](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC) |

No runtime assets were bundled in Phase 6B, so the production runtime overhead is **zero added bytes**. For scale, the published Transformers.js 4.2.0 minified web entry is about 432 kB uncompressed before external provider binaries. This is a package listing, separate from the eventual bundled or transferred size. [Versioned package assets](https://app.unpkg.com/@huggingface/transformers@4.2.0/files/dist)

The isolated trial should measure transferred JS, Wasm and tokenizers separately from weights and also measure decoded and compiled memory. Dependency and binary supply-chain review is required for any pinned trial bundle. Transformers.js and WebLLM source use Apache-2.0. ONNX Runtime uses MIT. Preserve third-party notices when redistributing. [Transformers.js license](https://github.com/huggingface/transformers.js/blob/main/LICENSE) · [WebLLM license](https://github.com/mlc-ai/web-llm/blob/main/LICENSE) · [ORT license](https://github.com/Microsoft/onnxruntime/blob/main/LICENSE)

## Hardware and performance

**Observed locally.** Linux x86-64, Ryzen 5 5600H, 12 logical CPUs, about 16 GiB RAM, 7.9 GiB available at inspection. PCI lists AMD Cezanne graphics and an RTX 3050 Ti Mobile. The NVIDIA driver query failed, so dedicated memory and utilization are unverified. A headless loopback probe tested a minimal Wasm module and adapter acquisition without GPU flags.

| Browser | Wasm | WebGPU in this probe |
| --- | --- | --- |
| Chrome 156.0.8078.47 | Available | API present, no adapter returned |
| Playwright Firefox 159.0 | Available | API absent |
| Playwright Linux WebKit 27.2 | Available | API absent |

All three probes used secure loopback contexts without cross-origin isolation. These observations apply to this headless session, including its drivers and browser configuration. Installed native ONNX Runtime 1.31.1 reported CPU and Azure providers. Only a local CPU provider would be relevant to the study. Ollama 0.40.8 was installed without a running loopback server, and no candidate weights were found in the inspected model caches. **Zero candidate inferences** ran. No weights were downloaded and no runtime was installed. CPU/GPU utilization, battery cost, model initialization, first-token time and tokens/s were not measured.

**Planning estimates.** Q4F16 estimates below use 1,024 total tokens, batch one and the full FP16 KV allocation `2 × layers × KV heads × head dimension × 2 bytes × 1,024 tokens`. Gemma uses sliding attention, so the full KV allocation is conservative for an implementation that reuses cache slots. VRAM assumes one weight copy plus KV and 0.25–0.65 GiB of scratch, runtime and staging headroom. Host RAM assumes two weight-sized copies plus KV and 0.35–0.85 GiB of headroom. These are sizing scenarios, not measured peaks or minimum requirements. Backend unpacking, extra copies and concurrent Askora workers can exceed them. On unified memory account for both allocations. [Qwen3 config](https://huggingface.co/Qwen/Qwen3-0.6B/raw/main/config.json) · [Qwen2.5 config](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/raw/main/config.json) · [Gemma ONNX config](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX/raw/main/config.json)

| Q4F16 model | KV estimate | Host RAM planning range | Model VRAM planning range | Weights-only transfer at 25 Mb/s | Weights-only read at 500 MB/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Qwen3 0.6B | 112 MiB | 1.52–2.02 GiB | 0.89–1.29 GiB | ~182 s | ~1.14 s |
| Qwen2.5 0.5B | 12 MiB | 1.26–1.76 GiB | 0.71–1.11 GiB | ~155 s | ~0.97 s |
| Gemma 3 1B | 26 MiB | 1.80–2.30 GiB | 0.99–1.39 GiB | ~244 s | ~1.53 s |

The read estimate is one initialization component. Tokenizer load, graph compilation, staging and allocations add unknown overhead. A simplified steady-state sensitivity calculation with one weight-sized read per generated token at 20 GB/s CPU memory bandwidth gives about 35, 41 and 26 tokens/s for Qwen3, Qwen2.5 and Gemma respectively. At 100 GB/s GPU bandwidth the same thought experiment gives 175, 207 and 131 tokens/s. Real throughput can differ substantially due to operator kernels, scheduler overhead, weight layout and memory traffic. One modeled decoder step is 29/24/38 ms on CPU and 6/5/8 ms on GPU. First-token time also includes prefill, which this scenario does not estimate. A 96-token response would spend about 2.7/2.3/3.7 s on CPU or 0.55/0.46/0.73 s on GPU in that idealized decode component alone. These figures are for comparative sizing only. End-to-end times, power and battery impact need real runs.

| Hardware category | Feasibility judgment |
| --- | --- |
| Low-memory devices, including 4 GiB systems | Keep deterministic mode as default. Browser, OS and data workloads can leave too little room for even Qwen2.5. Do not attempt automatic CPU fallback. |
| Ordinary laptops, around 8 GiB | Candidate for a bounded CPU experiment with Qwen2.5 or Qwen3 only after verifying headroom and latency with dataset workers running. |
| Modern laptops with usable WebGPU and around 16 GiB | Best first trial tier. Test integrated and discrete devices separately, including FP16 feature checks, device-loss recovery and peak RAM. |
| Android | Recent supported Chrome plus a qualified GPU is only an eligibility signal. Test actual lower-memory and recent devices for OOM, heat, transfers and backgrounding. |
| iPhone/iPad | Safari 26 API support warrants a test on actual devices. Export kernels, memory pressure, browser eviction and OS conditions are unknown. No physical Apple or Android device was verified in Phase 6B. |

## Independent benchmark and measured baseline

The [fixture](../experiments/phase-6b-local-ai/benchmark.json) contains 32 hand-labeled synthetic records, eight per language bucket. It covers numeric summaries, missingness, correlation, inference parameters, ambiguity, incompatible columns, unsupported operations and instruction-like text in questions and column names. Gold labels express the requested meaning within the Phase 5A contract even when the deterministic grammar cannot recover it. The [scorer and manual procedure](../experiments/phase-6b-local-ai/README.md) record exact intent, column and parameter accuracy as well as abstention, malformed output and unsafe candidates. No analytics workers or model endpoints are called by the scorer.

| Language of phrasing | Exact deterministic score |
| --- | ---: |
| English | 8/8 |
| Modern Standard Arabic | 6/8 |
| Egyptian Arabic | 6/8 |
| Mixed Arabic and English | 7/8 |
| Total | 27/32 |

Resolved intent was 14/16, applicable column identification 10/12, applicable parameter extraction 7/8, exact clarification 6/8, unsupported rejection 8/8 and exact refusal reason 7/8. There were zero unsafe attempted or routable resolutions on these 32 cases. Invalid JSON is inapplicable to the deterministic parser. Its 3,200 timed calls after 320 warmups had about 0.023 ms median and 0.045 ms p95 on this host. That measures parser interpretation only.

The observed gaps were an MSA one-sample phrasing with a missing null mean, MSA forecasting reason specificity, a free-form Egyptian mean paraphrase, an Egyptian ambiguous pair reported as unknown, and a mixed-script paired-test phrasing with explicit matching the parser did not recognize. These are concrete targets for the model comparison. No measured model rates exist for any language, intent, JSON or safety metric. The sample is small and was not independently double-labeled.

## Responsibility and privacy boundaries

Preferred experiment flow is deterministic parsing first. Preserve explicit refusals and existing resolved cases. For eligible unrecognized phrasing, an opt-in local model may propose compact intent JSON for user review.

```text
Question + minimal active-schema labels and IDs
  → cancellable local interpreter → strict bounded JSON and contract checks
  → exact-ID schema hydration, explicit parameter and ambiguity checks, user confirmation
  → revision-bound deterministic router → verified worker → localized evidence
```

A route passing structural checks can still be wrong. Reject unsupported, ambiguous or unresolved requests before execution. Use a conservative deterministic guard for hard refusals and leave ambiguous references or missing parameters to clarification. Ignore model-supplied revisions, types, numeric evidence, executable strings, tools, paths, formulas and unexpected fields. An approved adapter would construct canonical IDs, labels and types from the active snapshot and use the existing matching, group and parameter checks. A scope-safe interpretation can suggest what is missing, but it cannot invent a value or bypass confirmation. Bind jobs to revision and request identity, abort on change, cancellation and unmount, discard stale replies, and terminate a worker on time or resource-budget exhaustion. The scorer uses the router validator with synthetic metadata and stops before execution. [Phase 5A contract](PHASE_5A_REPORT.md) · [Phase 5B router](PHASE_5B_REPORT.md)

Core use stays free and independent of model assets. Offer local AI only behind explicit opt-in with transfer size, version and device requirements. Keep versioned runtime and weight assets outside the production entry. Aborting transfer must drop partial files. Disabling local AI releases the worker and gives the user an option to remove downloaded assets. Allow only a scoped cache of verified model files after consent. Never cache questions, candidate replies, dataset snapshots, or evidence. Fail closed if artifacts are unavailable offline, the cache is evicted, or the adapter fails. Keep deterministic Askora usable in each case.

Use pinned same-origin scripts and model assets, deny unexpected outbound connections, and test asset loading separately from inference with networking blocked. Worker isolation alone does not restrict network access, OS permissions or dependency behavior. Treat labels and questions as untrusted data, avoid prompt or worker telemetry, verify artifact hashes, and apply separate resource limits to the interpreter. The currently preferred Cloudflare Pages host caps a single file at 25 MiB. None of the three reviewed Q4F16 graph packages can be served there as listed. An audited shard manifest or separate zero-cost static asset plan would need independent approval and validation of integrity, quotas, cache behavior and cross-origin policy. No account, hosting configuration or download was created. [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Phase 6C decision

Proceed only if explicitly approved as an **isolated, synthetic, opt-in feasibility trial**. Qwen3 has the best documented dialect fit in this shortlist and an Apache-2.0 upstream license. Its lead is a research hypothesis. Compare Qwen2.5 first if available memory or transfer budget is the dominant constraint. Keep Gemma as a conditional lab comparator.

Before reconsidering integration, require gains on an independently reviewed held-out Egyptian/MSA and mixed corpus, no regressions on currently resolved questions or refusals, elevated scrutiny of every proposed routable mistake, and zero unsafe routable outputs on the adversarial test set. Require task-appropriate latency and memory on a real laptop and physical mobile devices before claiming mobile eligibility. Measure download/cancel, offline startup and fail-closed behavior against a reviewed host plan. If the gains do not justify the weight and operating costs, improve deterministic phrasing and clarification instead.

Validation in this phase used the benchmark self-test, deterministic baseline, a synthetic scoring-path dry run, 17 passing focused parser/router tests, successful repository type checking and the local browser capability probe. The comprehensive browser matrix and model inference remain outside this study. The founder’s `askora_project.md` in the parent workspace received an appended Phase 6B checkpoint. It is outside the Askora Git repository and is updated separately from this commit.
