import corpus from './generated/corpus.json'
import manifest from './model-manifest.json'
import { validate } from './validate.js'
import './styles.css'

const byId = id => document.getElementById(id)
const backend = byId('backend')
const caseSelect = byId('case')
const loadButton = byId('load')
const runButton = byId('run')
let worker
let phase = 'idle'
let localFiles = false
let deadline
const uiMemory = () => {
  const bytes = performance.memory?.usedJSHeapSize
  return bytes === undefined ? 'UI JavaScript heap unavailable. Use external process monitoring.'
    : `UI JavaScript heap ${(bytes / 1048576).toFixed(1)} MiB. WASM and VRAM require external monitoring.`
}

for (const entry of corpus.cases) caseSelect.add(new Option(`${entry.id} · ${entry.language}`, entry.id))
function showQuestion() {
  byId('question').value = corpus.cases.find(entry => entry.id === caseSelect.value).question
}
caseSelect.onchange = showQuestion
showQuestion()

function update() {
  const pending = phase === 'loading' || phase === 'running'
  backend.disabled = Boolean(worker)
  loadButton.disabled = !localFiles || Boolean(worker)
  runButton.disabled = phase !== 'ready'
  caseSelect.disabled = pending
  byId('unload').disabled = phase !== 'ready'
  byId('cancel').disabled = !pending
  byId('memory').textContent = uiMemory()
}

function backendLabel(selected, threads) {
  if (selected === 'wasm') return threads ? `WASM CPU · ${threads} threads` : 'WASM CPU'
  return selected === 'webgpu-hybrid' ? 'WebGPU with ORT CPU helper nodes' : 'WebGPU only'
}
function status(message) { byId('status').textContent = message }
function close(message) {
  clearTimeout(deadline)
  worker?.terminate()
  worker = undefined
  phase = 'idle'
  status(message)
  update()
}
function wait(ms, label) {
  clearTimeout(deadline)
  deadline = setTimeout(() => close(`${label} timed out. Worker unloaded.`), ms)
}

loadButton.onclick = () => {
  if (!localFiles || worker) return
  const selected = backend.value
  const instance = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' })
  worker = instance
  phase = 'loading'
  status(`Loading ${backendLabel(selected)} locally…`)
  update()
  wait(120_000, 'Model load')
  instance.onmessage = ({ data }) => {
    if (worker !== instance) return
    switch (data.type) {
      case 'probe':
        byId('capability').textContent = JSON.stringify(data.capability, null, 2)
        break
      case 'progress':
        status(`Loading ${data.file ?? 'model'}${data.total ? ` · ${Math.round(100 * (data.loaded ?? 0) / data.total)}%` : ''}`)
        break
      case 'ready':
        clearTimeout(deadline)
        phase = 'ready'
        byId('metrics').textContent = JSON.stringify(data, null, 2)
        status(`Ready · ${backendLabel(data.backend, data.threads)}`)
        update()
        break
      case 'result': {
        clearTimeout(deadline)
        phase = 'ready'
        const { raw, ...measurements } = data
        byId('output').textContent = raw
        byId('validation').textContent = validate(raw)
        byId('metrics').textContent = JSON.stringify(measurements, null, 2)
        status(`Ready · ${backendLabel(data.backend)}`)
        update()
        break
      }
      case 'device-lost':
      case 'error':
        close(`${data.stage ?? data.type} failed · ${data.message}`)
        break
    }
  }
  instance.onerror = event => {
    if (worker === instance) close(`Worker failed · ${event.message}`)
  }
  instance.postMessage({ type: 'load', backend: selected })
}
runButton.onclick = () => {
  if (phase !== 'ready') return
  phase = 'running'
  byId('validation').textContent = 'Awaiting a result'
  byId('output').textContent = ''
  byId('metrics').textContent = ''
  status('Generating locally…')
  update()
  wait(60_000, 'Generation')
  worker.postMessage({ type: 'run', id: caseSelect.value })
}
function clearOutput() {
  byId('output').textContent = ''
  byId('metrics').textContent = ''
  byId('validation').textContent = 'Awaiting a result'
}
byId('cancel').onclick = () => { clearOutput(); close('Cancelled · model unloaded') }
byId('unload').onclick = () => { clearOutput(); close('Model unloaded') }
window.addEventListener('pagehide', () => close('Model unloaded'))

try {
  const response = await fetch('/ready.json', { cache: 'no-store' })
  const info = response.ok ? await response.json() : null
  if (info?.revision === manifest.revision && info.bytes === manifest.files.reduce((sum, file) => sum + file.bytes, 0)) {
    localFiles = true
    byId('availability').textContent = `${info.bytes.toLocaleString('en')} verified model and tokenizer bytes on disk.`
  } else {
    byId('availability').textContent = 'Model files unavailable. Run npm run download in the experiment folder.'
  }
} catch {
  byId('availability').textContent = 'Could not verify local model files.'
}
update()
