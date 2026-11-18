# Askora Phase 6C local Qwen3 experiment

The harness uses the pinned Qwen3-0.6B Q4F16 export, locally served Transformers.js 4.2.0 and ONNX Runtime Web 1.26.0-dev.20260416-b7804b056c. It only accepts the 32 synthetic questions from Phase 6B. The original gold labels stay in the offline scorer. No production application entry imports the experiment.

## Start the harness

Use Node 22+, npm, curl, and the existing Askora development dependencies. From this folder run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run download
npm run build
npm run serve
```

Open `http://127.0.0.1:4166` in Chrome. The first page load only checks the local asset marker. **Load model** first tries the selected backend, which defaults to WebGPU only. WebGPU only requires all graph nodes to use that provider. The separately selectable WebGPU with ORT CPU helper nodes option permits mixed execution on an eligible adapter. Successful GPU inference must record actual compute dispatches. If WebGPU reports no adapter, device, or FP16 support, select **WASM CPU fallback** and click **Load model** again. This uses the same model and quantization. Select a synthetic case and click **Run question**. **Cancel work** immediately terminates the worker and unloads the model during loading or inference. **Unload model** releases the worker after work has completed. A new load is required afterwards.

The downloader uses the exact manifest revision and verifies lengths, Git blob hashes for metadata, and SHA-256 for the graph. It writes the ready marker only after all checks pass. A cancelled or invalid transfer removes its partial file. Runtime and model files, metadata generated at build time, and measurement files are ignored by Git. The browser never fetches model files from Hugging Face. The Phase 6B format is supplied as a system prompt followed by a synthetic user message and tokenizer non-thinking template. Generation is greedy with up to 128 output tokens inside a 1,024-token total limit.

## Initial benchmark and independent QA

With the server running, start the following in a second terminal in the experiment directory:

```bash
npm run measure -- --wasm
```

Omit `--wasm` to try WebGPU alone. The flag explicitly permits the second CPU attempt when WebGPU fails. Add `--probe-only` to load and unload without generation. The script uses installed Google Chrome, automatic resource sampling of `/proc` and `nvidia-smi`, and serial questions. It aborts for available RAM below 1.5 GiB or NVIDIA VRAM usage over 3,800 MiB. The first case is used once cold, then again in the full warm corpus. The recorded CPU and GPU samples are whole-system observations, including concurrent tasks. The optional JavaScript heap shown in the UI excludes WASM memory and VRAM.

From the Askora repository root, score the raw synthetic outputs with the unchanged evaluator:

```bash
node experiments/phase-6b-local-ai/evaluate.mjs score \
  experiments/phase-6c-local-ai/measurements/<timestamp>-outputs.json
```

For a separate hardware diagnostic on this Ubuntu laptop, use a headed Chrome run with the AMD Vulkan ICD and the explicit mixed-provider opt-in. This does not change the normal browser launch.

```bash
VK_DRIVER_FILES=/usr/share/vulkan/icd.d/radeon_icd.json npm run measure -- --headed-vulkan --hybrid
```

Run one model job at a time. To continue an interrupted run on the **same backend and settings**, pass `--resume=measurements/<timestamp>-outputs.json`. Report resumed timings separately from the previous run.

Use the same timestamp for the metrics and outputs. Examine the completed count and failure state before interpreting scores. Outputs of timed-out or failed cases are absent. The benchmark writes only these synthetic diagnostic results locally. Interactive UI results are volatile. The loopback server uses no-store headers, a same-origin CSP and exact pinned model routes. The script rejects all unexpected browser requests and checks cookies, browser storage and caches before and after. A cold run means the first inference in a new worker with local weight files available, regardless of OS disk cache state.

For independent verification, reproduce WebGPU and WASM selection separately, cancel during model load and generation, unload and reload, and verify that the model is idle after an error or cancellation. Review the exact benchmark scores and unsafe routable candidates. Keep the browser offline from external origins during runtime. Check licence and hashes before preparing any new artifact distribution.
