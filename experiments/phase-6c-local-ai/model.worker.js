import { AutoModelForCausalLM, AutoTokenizer, TextStreamer, env } from '@huggingface/transformers'
import corpus from './generated/corpus.json'
import manifest from './model-manifest.json'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/models/'
env.useBrowserCache = false
env.useWasmCache = false
env.useCustomCache = false
const ort = env.backends.onnx
ort.wasm.proxy = false
ort.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 1, 4) : 1

let backend
let model
let tokenizer
let active = false
let device
const send = (type, data = {}) => self.postMessage({ type, ...data })

async function probe() {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) return { available: false, api: Boolean(navigator.gpu), deviceCreated: false }
  const { vendor, architecture, device: id, description, isFallbackAdapter } = adapter.info
  const shaderF16 = adapter.features.has('shader-f16')
  const info = { available: true, vendor, architecture, id, description, isFallbackAdapter,
    features: [...adapter.features].sort(), shaderF16, deviceCreated: false,
    storageBindingBytes: adapter.limits.maxStorageBufferBindingSize }
  try {
    device = await adapter.requestDevice({
      requiredFeatures: shaderF16 ? ['shader-f16'] : [],
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      },
    })
    return { ...info, deviceCreated: true }
  } catch (error) {
    return { ...info, deviceError: String(error) }
  }
}

async function load(selected) {
  if (model || !['webgpu', 'webgpu-hybrid', 'wasm'].includes(selected)) throw new Error('Select one supported backend and unload any existing model')
  const started = performance.now()
  const gpu = selected !== 'wasm'
  if (gpu) {
    const capability = await probe()
    send('probe', { capability })
    if (!capability.deviceCreated || !capability.shaderF16 || capability.isFallbackAdapter !== false) {
      throw new Error('WebGPU hardware with shader-f16 is unavailable. Select WASM CPU explicitly to try the same Q4F16 graph.')
    }
    ort.webgpu.device = device
    device.lost.then(info => send('device-lost', { message: info.message || info.reason }))
  }
  const flavor = gpu ? 'asyncify' : 'jsep'
  const runtime = `/runtime/ort-wasm-simd-threaded.${flavor}`
  ort.wasm.wasmPaths = Object.fromEntries(['mjs', 'wasm'].map(ext =>
    [ext, new URL(`${runtime}.${ext}`, self.location.origin).href]))
  const options = { local_files_only: true, progress_callback(event) {
    if (['initiate', 'progress', 'done'].includes(event.status)) send('progress', {
      file: event.file, stage: event.status, loaded: event.loaded, total: event.total,
    })
  } }
  tokenizer = await AutoTokenizer.from_pretrained(manifest.repository, options)
  model = await AutoModelForCausalLM.from_pretrained(manifest.repository, {
    ...options, device: gpu ? 'webgpu' : 'wasm', dtype: 'q4f16',
    session_options: {
      executionProviders: [gpu ? 'webgpu' : 'wasm'],
      ...(selected === 'webgpu' && { extra: { session: { disable_cpu_ep_fallback: '1' } } }),
    },
  })
  backend = selected
  send('ready', { backend, loadMs: performance.now() - started, threads: selected === 'wasm' ? ort.wasm.numThreads : null })
}

async function run(id) {
  if (!model) throw new Error('Load the model first')
  const entry = corpus.cases.find(item => item.id === id)
  if (!entry) throw new Error('Select a synthetic case')
  const started = performance.now()
  const inputs = tokenizer.apply_chat_template([
    { role: 'system', content: corpus.instructions },
    { role: 'user', content: JSON.stringify({ columns: corpus.columns, question: entry.question }) },
  ], { add_generation_prompt: true, enable_thinking: false })
  const inputTokens = inputs.input_ids.dims.at(-1)
  if (inputTokens + 128 > 1024) throw new Error('Synthetic prompt exceeds the 1,024-token context budget')
  let firstTokenAt
  let lastTokenAt
  let generatedTokens = 0
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true, callback_function() {},
    token_callback_function(tokens) {
      const now = performance.now()
      firstTokenAt ??= now
      lastTokenAt = now
      generatedTokens += tokens.length
    },
  })
  const gpu = backend !== 'wasm'
  const pass = gpu ? GPUComputePassEncoder.prototype : null
  const dispatch = pass?.dispatchWorkgroups
  let gpuDispatches = 0
  if (pass) {
    pass.dispatchWorkgroups = function (...groups) {
      gpuDispatches++
      return dispatch.apply(this, groups)
    }
  }
  let output
  try {
    output = await model.generate({ ...inputs, do_sample: false, max_new_tokens: 128, streamer })
  } finally {
    if (pass) pass.dispatchWorkgroups = dispatch
  }
  if (gpu && !gpuDispatches) throw new Error('No WebGPU compute dispatches were observed during generation')
  const ids = output.tolist()[0].slice(inputTokens)
  const raw = tokenizer.decode(ids, { skip_special_tokens: true })
  const decodeMs = lastTokenAt - firstTokenAt
  send('result', { id, backend, raw, inputTokens, generatedTokens, gpuDispatches, elapsedMs: performance.now() - started,
    firstTokenMs: firstTokenAt == null ? null : firstTokenAt - started,
    tokensPerSecond: generatedTokens > 1 && decodeMs > 0 ? (generatedTokens - 1) * 1000 / decodeMs : null })
}

self.onmessage = async ({ data }) => {
  if (active) return
  active = true
  try {
    if (data.type === 'load') await load(data.backend)
    if (data.type === 'run') await run(data.id)
  } catch (error) {
    send('error', { stage: data.type, message: String(error) })
  } finally {
    active = false
  }
}
