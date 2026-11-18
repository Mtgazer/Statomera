# Phase 6C local Qwen3 experiment

On 2026-11-19 the experiment started from clean `feature/phase-6b-local-ai-feasibility` at `af34cc3`. The local implementation branch is `feature/phase-6c-local-ai-experiment`. Phase 6B implementation `cf83854`, its benchmark and its independent QA report were the basis for this run.

## Pinned assets and runtime

| Asset | Verified bytes |
| --- | ---: |
| `onnx/model_q4f16.onnx` | 569,789,750 |
| `config.json` | 912 |
| `generation_config.json` | 219 |
| `tokenizer.json` | 9,117,040 |
| `tokenizer_config.json` | 9,705 |
| `chat_template.jinja` | 4,116 |
| **Model and tokenizer total** | **578,921,742** |

All model files came from `onnx-community/Qwen3-0.6B-ONNX` at `558750086ed49d78cb701ed6fa85af33fd16453f`. Graph SHA-256 is `9e33a5911974174761d0dfdcc0bec975d9c45af0eae5e9eb647b8ba9442a8f91`. The config identifies Qwen3, 28 layers, eight KV heads and FP16 KV for Q4F16. The graph is self-contained. The config entry for external data applies to the full precision graph. The tokenizer config embeds the non-thinking chat-template branch. The upstream weights use Apache-2.0. Redistribution requires the license, applicable notices and attribution, and change notices where applicable. Phase 6C uses local verified files without artifact redistribution. [Pinned graph](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/blob/558750086ed49d78cb701ed6fa85af33fd16453f/onnx/model_q4f16.onnx) · [Qwen3 license](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/LICENSE) · [Apache terms](https://www.apache.org/licenses/LICENSE-2.0.html)

The experiment lockfile pins Transformers.js 4.2.0 and ONNX Runtime Web `1.26.0-dev.20260416-b7804b056c`. It serves the asyncify WebGPU and JSEP fallback runtime files from loopback. The JSEP factory and WASM binary used for the CPU path are 46,490 and 26,101,073 bytes, separate from weights. The worker uses the pinned runtime's provider selection, GPU device setting, local model and cache settings, tokenizer chat-template arguments and token streamer. [Runtime guide](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html) · [Streamer reference](https://huggingface.co/docs/transformers.js/api/generation/streamers)

## Harness and backend

The page starts unloaded. The user chooses a backend and explicitly loads the verified model from the loopback static server. A dedicated worker owns the runtime and permits one job at a time. Cancel, unload, timeout and page exit terminate the worker. The harness accepts only the existing synthetic questions. Generated text is displayed inertly and checked with bounded JSON validation, duplicate-key rejection, exact synthetic column IDs and the pure route validator. No execution router or analysis worker is loaded. Production code and dependencies are untouched.

The host is Ubuntu Linux x86-64 with a Ryzen 5 5600H and 12 logical CPUs, about 16 GiB RAM and 8 GiB swap. The laptop has AMD Cezanne/Radeon Graphics (RADV Renoir) and an RTX 3050 Ti Laptop GPU with 4,096 MiB dedicated memory. The NVIDIA driver reports 595.99.02. Vulkan reports instance 1.4.341 and NVIDIA device API 1.4.329. Chrome was 156.0.8078.47.

The initial high-performance WebGPU adapter request returned null although Chrome exposed the API. Adapter features, FP16 support and device creation could therefore not be established. A second headless probe with documented Linux Vulkan flags also returned no adapter. With headed Chrome and Vulkan flags, the NVIDIA Ampere adapter reported a hardware device and created it successfully, but lacked `shader-f16`. It exposed a 2,147,483,644-byte storage-binding limit. Selecting the AMD Vulkan ICD in a separate headed run exposed the hardware GCN 5 adapter with `shader-f16`, created a device and reported a 4,294,967,292-byte binding limit. Both adapters reported `core-features-and-limits`, `subgroups` and `timestamp-query`. The harness records the full adapter feature list. The AMD benchmark record retains it in the ignored measurements directory. ORT rejected the AMD WebGPU-only session because some graph nodes needed the CPU provider. The explicit mixed-provider mode loaded the unchanged graph, and the worker required observed GPU compute dispatches before reporting a result. [Chrome GPU troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips)

The explicit WASM session loaded the **same Q4F16 graph** using four CPU threads in a cross-origin isolated loopback context. Worker session loading took 4.31 s, or about 4.41 s from clicking Load to the ready UI. An early implementation smoke exposed Transformers.js metadata detection skipping a full HTTP model root. Setting the same-origin model path to `/models/` fixed tokenizer loading.

## Measured inference and resource use

The CPU run produced 12 distinct outputs before the task-owned browser was closed to switch backends and keep inference serial. The AMD mixed-provider run returned all 32 outputs plus an initial cold run of en-01. CPU and GPU scores were kept separate.

| Backend and case | Total | First token | Decode tokens/s | Generated tokens |
| --- | ---: | ---: | ---: | ---: |
| WASM CPU, en-01 cold | 50.37 s | 6.75 s | 2.91 | 128 |
| WASM CPU, en-01 warm repeat | 50.52 s | 6.76 s | 2.90 | 128 |
| WASM CPU, 12-case warm median | 51.32 s | 6.69 s | 2.82 | 128 |
| AMD WebGPU + ORT CPU, en-01 cold | 5.36 s | 2.42 s | 16.67 | 50 |
| AMD WebGPU + ORT CPU, en-01 warm repeat | 4.53 s | 1.83 s | 18.20 | 50 |
| AMD WebGPU + ORT CPU, 32-case warm median | 8.88 s | 1.79 s | 17.92 | 128 |

AMD worker load took 3.66 s. During inference the worker observed 28,144–72,136 WebGPU compute dispatch calls per response. ORT also used CPU nodes. AMD warm elapsed time ranged from 4.53 to 9.21 s.

Cold refers to the first inference in the loaded worker with assets already on disk. The repeated same case is the direct warm comparison. The worker tried greedy generation with a 1,024-token total context limit, a cap of 128 new tokens and non-thinking mode. Requests were run serially.

| Run and stage | Samples | Minimum available RAM (MiB) | Peak nonavailable RAM (MiB) | Peak CPU | Peak NVIDIA VRAM (MiB) | Peak NVIDIA GPU | Peak AMD GPU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WASM CPU, baseline | 1 | 9,600 | 7,717 | — | 11 | 8% | — |
| WASM CPU, load | 4 | 6,271 | 11,045 | 31% | 11 | 0% | — |
| WASM CPU, inference | 615 | 3,693 | 13,624 | 73% | 41 | 4% | — |
| AMD WebGPU + ORT CPU, baseline | 1 | 11,681 | 5,636 | — | 11 | 0% | 9% |
| AMD WebGPU + ORT CPU, load | 7 | 7,696 | 9,620 | 30% | 11 | 0% | 25% |
| AMD WebGPU + ORT CPU, inference | 267 | 5,658 | 11,658 | 17% | 11 | 0% | 97% |
| AMD WebGPU + ORT CPU, unloaded | 1 | 6,748 | 10,569 | — | 11 | 0% | 84% |

The CPU inference sampling interval included short capability and model-loading probes. No second inference overlapped it. The NVIDIA device did not execute either benchmark, so its readings represent ambient use. AMD uses shared memory and its model allocation was not isolated from host RAM. Neither run crossed the configured RAM or NVIDIA VRAM stop threshold.

Host RAM figures use Linux `MemTotal − MemAvailable`. CPU percentages are aggregate host non-idle deltas. NVIDIA figures are whole-device samples, including desktop activity. Sampling at one second can miss brief peaks. Renderer heap, model allocations and VRAM are separate measurements. Physical mobile behavior is unverified.

## Benchmark and privacy

The experiment reused all 32 Phase 6B fixture cases and the original scorer. The gold fixture is excluded from the browser bundle. A structurally accepted candidate can still be wrong for the question. No candidate executes. The measured deterministic Phase 6B baseline was 27/32 exact and 8/8 unsupported requests rejected.

| Measure | Deterministic Phase 6B | AMD WebGPU + ORT CPU |
| --- | ---: | ---: |
| Exact, all questions | 27/32 | 0/32 |
| Exact, English | 8/8 | 0/8 |
| Exact, Modern Standard Arabic | 6/8 | 0/8 |
| Exact, Egyptian Arabic | 6/8 | 0/8 |
| Exact, Mixed script | 7/8 | 0/8 |
| Resolved intent | 14/16 | 0/16 |
| Column identification | 10/12 | 0/12 |
| Parameter extraction | 7/8 | 0/8 |
| Exact clarification | 6/8 | 0/8 |
| Unsupported rejection | 8/8 | 0/8 |
| Exact refusal reason | 7/8 | 0/8 |
| Invalid JSON | Inapplicable | 24 |
| Invalid contract | 0 | 5 |
| Route rejected | 0 | 3 |
| Unsafe resolved attempts | 0 | 8 |
| Unsafe routable candidates | 0 | 0 |

The CPU subset had 0/12 exact with 8 invalid JSON outputs, 3 contract failures and one route rejection. Its other 20 cases were unmeasured. The AMD run hit the 128-token cap on 24/32 cases. No generated proposal was executed. The local measurement prefixes are `2026-11-18T22-55-44-014Z` for CPU and `2026-11-18T23-06-06-308Z` for AMD. The timestamps in the filenames are UTC.

The server binds only to `127.0.0.1` and rejects unexpected methods and host headers. It uses a same-origin CSP and `Cache-Control: no-store`. Model and WASM cache options are disabled. The browser starts without requesting weights. The runner blocks unexpected methods, URLs, origins and bodies and checks cookies, local/session storage, IndexedDB and Cache Storage. Approved model downloads and package installation were separate from browser inference. Benchmark outputs are synthetic diagnostic files written locally by the runner. Interactive questions and results are volatile.

The completed AMD run recorded 12 distinct loopback static GET paths, zero unexpected requests, no request bodies or query strings, and zero entries in the checked stores before and after. Unload cleared the output. Cancellation returned the interface to idle after a stalled tokenizer request. A live WASM generation cancellation also cleared the output and all four workers emitted close events. The browser delivers these events asynchronously.

## Recommendation and handoff

**No-go for production integration.** Keep deterministic interpretation and numerical analysis authoritative. Default Chrome WebGPU was unavailable. The AMD mixed-provider diagnostic was faster, but all 32 candidates failed validation and the model rejected none of the eight unsupported requests in the expected format. CPU latency and intent quality rule out this setup for the beta. A separate accelerated-browser or prompting study would require explicit approval and can use the same untouched baseline.

The [experiment instructions](../experiments/phase-6c-local-ai/README.md) cover install, download, build, launch, measurement and scoring for Antigravity. Independent QA should repeat backend detection, cancellation during loading and generation, unload/reload, output validation and request/storage inspection. Codex ran the isolated build, local execution and focused lifecycle/privacy smoke. The full production QA matrix remains for Antigravity.
