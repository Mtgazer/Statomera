# Phase 6B offline intent benchmark

From the Askora root, use the project's installed Node runtime.

```bash
node experiments/phase-6b-local-ai/evaluate.mjs self-test
node experiments/phase-6b-local-ai/evaluate.mjs baseline
node experiments/phase-6b-local-ai/evaluate.mjs prompt msa-04
node experiments/phase-6b-local-ai/evaluate.mjs score /tmp/askora-model-outputs.json
```

The benchmark has 32 hand-labeled synthetic questions and seven synthetic column labels. Language buckets describe the question phrasing. English or Modern Standard Arabic questions can still reference a label from another script. Each bucket has four resolved, two clarification, and two refusal cases. Gold labels express the requested meaning and current analytical scope independently of the parser's grammar. The scorer checks clarification reasons as an unordered set. It checks column and group order where meaningful and distinguishes an omitted parameter from an explicit one. This is a small diagnostic corpus with no claim of representative language coverage.

The scorer validates candidate JSON, hydrates column IDs from trusted synthetic metadata and invokes the production route validator without dispatching an analysis. It never loads model weights, reads a real dataset, executes a candidate or initiates network requests. The input format is a JSON object keyed by case ID, with the **raw generated string** as its value. Keep raw text including fences, invalid JSON and refusals. Missing or timed-out cases can be omitted and are counted as missing.

```json
{
  "en-01": "{\"status\":\"resolved\",\"kind\":\"descriptive\",\"operation\":\"mean\",\"column\":\"c1\"}"
}
```

## Manual model evaluation after approval

1. In a separate temporary project, pin the browser runtime, browser version, exact export revision and artifact hashes from the Phase 6B shortlist. Use only pre-obtained local runtime, Wasm, tokenizer, config and weight files. Log each variant and the total bytes. Begin with WebGPU and `q4f16`. Test Wasm and verified `q8` files separately if the FP16 graph lacks compatible CPU kernels. Keep the production project and lockfile out of this setup.
2. Serve the isolated fixture page and local files from loopback. For Transformers.js set `env.allowRemoteModels = false`, set `env.localModelPath` and Wasm paths to local assets, and verify the browser request log. In WebLLM replace both the remote model URL and the compiled model-library URL with pinned local assets. Load weights in a dedicated worker. Use synthetic content only. Cancel a delayed asset transfer with an abort signal and terminate the worker to cancel generation. Fail the run on non-loopback requests, unexpected persistence, missing files, unavailable hardware or unsupported operators. Static model assets may use an explicitly scoped cache in a separate offline reload check.
3. Generate the same prompt via the command above for each case ID. Start a fresh interaction each time, use the model's chat template, disable Qwen3 thinking, cap total context at 1,024 tokens and output at 96 new tokens, and start with deterministic decoding. If a runtime uses a schema-constrained mode, run and label it separately so prompt-only JSON success stays comparable. Record any prompt that exceeds the token cap as missing, avoiding silent truncation. Record complete outputs in the format above. Run the scorer on one untouched output file per model, quantization, runtime and repeat.
4. Check warm and cold sessions separately on each hardware tier in the report. Use five independent cold starts and record download bytes and time, cache-read and session-ready time, and peak process RAM or GPU memory where the platform exposes them. Run the full corpus warm, repeating each prompt three times. With a token streamer, record submit to first generated token, generation throughput after the first token, and submit to complete reply. Report median and p95 with failures. On physical mobile, compare sustained energy and thermal behavior for the same workload against deterministic-only idle runs. Test backgrounding, cancellation, device loss, offline reload and cache eviction. Mark missing instrumentation as unavailable.
5. Before considering a release, have a second Arabic-speaking reviewer label a larger unseen corpus. Report exact metrics per bucket and privacy and safety gates independently. Confirm every proposed action with the user during any isolated trial. Keep user questions, candidate output, datasets and conversation out of persistence and requests.

## Scoring

- Exact is the full projected intent or the expected abstention and reason. Intent accuracy checks kind and operation on resolvable cases. Column accuracy checks ordered IDs on resolvable cases with gold columns. Parameter accuracy checks expected explicit parameters on resolvable cases with them. Wrong operation counts as a miss for applicable columns and parameters.
- Clarification checks the expected operation and reason set. Rejection checks the unsupported status and reports a separate exact-reason score. Invalid JSON is a syntax/transport failure. Contract violations, over-budget responses, missing answers and rejected routes are separate counts.
- Unsafe attempts count parsed `resolved` responses that disagree with gold, including attempts the route validator rejects. Unsafe routable counts the subset the validator accepts, including the wrong legitimate route or parameters. These are conservative case-based counts, not estimates of all unsafe behavior. A structurally valid candidate can still misread a question. No score authorizes execution. Baseline JSON serialization is test plumbing and its invalid JSON count is inapplicable.
