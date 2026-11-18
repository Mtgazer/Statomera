import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { chromium } from '../../node_modules/playwright/index.mjs'

const exec = promisify(execFile)
const origin = `http://127.0.0.1:${process.env.ASKORA_6C_PORT ?? 4166}`
const fallback = process.argv.includes('--wasm')
const hybrid = process.argv.includes('--hybrid')
const headedVulkan = process.argv.includes('--headed-vulkan')
const resume = process.argv.find(value => value.startsWith('--resume='))?.slice('--resume='.length)
const probeOnly = process.argv.includes('--probe-only')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const result = { runId, requests: [], unexpected: [], attempts: [], inference: [], resources: {}, outputs: {} }
const { cases } = JSON.parse(await readFile('../phase-6b-local-ai/benchmark.json'))
const root = 'measurements'
await mkdir(root, { recursive: true })
if (resume) {
  const saved = JSON.parse(await readFile(resume, 'utf8'))
  assert.ok(saved && typeof saved === 'object' && !Array.isArray(saved))
  assert.ok(Object.entries(saved).every(([id, output]) => cases.some(item => item[0] === id) && typeof output === 'string'))
  Object.assign(result.outputs, saved)
  result.resumedCases = Object.keys(saved).length
}
const drm = '/sys/class/drm'
const radeonPaths = (await readdir(drm).catch(() => [])).filter(name => /^card\d+$/.test(name))
const radeonDevice = (await Promise.all(radeonPaths.map(async name => {
  const path = `${drm}/${name}/device`
  const vendor = await readFile(path + '/vendor', 'utf8').catch(() => '')
  return vendor.trim() === '0x1002' ? path : null
}))).find(Boolean)
const radeonBusy = radeonDevice ? radeonDevice + '/gpu_busy_percent' : null

let phase = 'baseline'
let floor = false
let lastCPU
let lastPhase
let polling
async function sample() {
  const bucket = phase
  const [memory, system, gpu, radeon] = await Promise.all([
    readFile('/proc/meminfo', 'utf8'),
    readFile('/proc/stat', 'utf8'),
    exec('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits'], { timeout: 2500 })
      .then(({ stdout }) => stdout.trim().split('\n')[0].split(',').map(Number)).catch(() => null),
    radeonBusy ? readFile(radeonBusy, 'utf8').then(Number).catch(() => null) : null,
  ])
  const total = Number(/^MemTotal:\s+(\d+)/m.exec(memory)?.[1])
  const available = Number(/^MemAvailable:\s+(\d+)/m.exec(memory)?.[1])
  const stats = system.split('\n')[0].trim().split(/\s+/u).slice(1, 9).map(Number)
  const activity = stats.reduce((sum, ticks) => sum + ticks, 0)
  const idle = stats[3] + stats[4]
  const cpu = lastCPU && lastPhase === bucket && activity > lastCPU.activity
    ? 100 * (1 - (idle - lastCPU.idle) / (activity - lastCPU.activity)) : null
  lastCPU = { activity, idle }
  lastPhase = bucket
  const row = result.resources[bucket] ??= { samples: 0, minAvailableMiB: Infinity, peakNonAvailableMiB: 0,
    peakCpuPercent: null, peakNvidiaMiB: null, peakGpuPercent: null, peakRadeonPercent: null }
  row.samples++
  row.minAvailableMiB = Math.min(row.minAvailableMiB, available / 1024)
  row.peakNonAvailableMiB = Math.max(row.peakNonAvailableMiB, (total - available) / 1024)
  if (cpu !== null) row.peakCpuPercent = Math.max(row.peakCpuPercent ?? 0, cpu)
  if (gpu && gpu.every(Number.isFinite)) {
    row.peakNvidiaMiB = Math.max(row.peakNvidiaMiB ?? 0, gpu[0])
    row.peakGpuPercent = Math.max(row.peakGpuPercent ?? 0, gpu[1])
  }
  if (Number.isFinite(radeon)) row.peakRadeonPercent = Math.max(row.peakRadeonPercent ?? 0, radeon)
  if (['load', 'inference'].includes(bucket) && (available < 1536 * 1024 || (gpu && gpu[0] > 3800))) {
    floor = true
    await browser?.close()
  }
}

let browser
try {
  await sample()
  const args = headedVulkan ? ['--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-webgpu', '--ozone-platform=wayland'] : []
  result.launch = { headless: !headedVulkan, args, vulkanDriverFiles: process.env.VK_DRIVER_FILES ?? null }
  browser = await chromium.launch({ channel: 'chrome', headless: !headedVulkan, args })
  result.browser = browser.version()
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const safe = url.origin === origin && request.method() === 'GET' && !url.search && request.postData() === null &&
      /^\/(?:$|ready\.json$|assets\/|runtime\/|models\/)/.test(url.pathname)
    const entry = { path: url.pathname, method: request.method(), origin: url.origin, query: Boolean(url.search),
      body: request.postData() !== null }
    if (!safe) {
      result.unexpected.push(entry)
      await route.abort()
    } else {
      if (!result.requests.some(item => item.path === entry.path)) result.requests.push(entry)
      await route.continue()
    }
  })
  await page.goto(origin)
  const status = page.locator('#status')
  const load = page.locator('#load')
  const run = page.locator('#run')
  const metrics = page.locator('#metrics')
  const output = page.locator('#output')
  const readyOrIdle = async () => page.waitForFunction(() => !document.querySelector('#run').disabled ||
    !document.querySelector('#load').disabled, null, { timeout: 130_000 })
  const browserStorage = () => page.evaluate(async () => ({
    local: localStorage.length, session: sessionStorage.length, indexed: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length, cookies: document.cookie.length,
  }))
  result.storageBefore = await browserStorage()
  assert.equal(await status.textContent(), 'Model unloaded')
  assert.equal(result.requests.some(request => request.path.startsWith('/models/')), false)
  const sampleRepeats = () => {
    if (polling) return
    polling = sample().catch(error => { result.monitorError ??= String(error) }).finally(() => { polling = undefined })
  }
  const timer = setInterval(sampleRepeats, 1000)
  try {
    const backends = ['webgpu', ...(hybrid ? ['webgpu-hybrid'] : []), ...(fallback ? ['wasm'] : [])]
    for (const backend of backends) {
      phase = 'load'
      await page.locator('#backend').selectOption(backend)
      const started = performance.now()
      await load.click()
      await readyOrIdle()
      const state = await status.textContent()
      const capable = await page.locator('#capability').textContent()
      const measurement = await metrics.textContent()
      const attempt = { backend, state, browserElapsedMs: performance.now() - started,
        probe: capable.startsWith('{') ? JSON.parse(capable) : null,
        load: measurement ? JSON.parse(measurement) : null }
      result.attempts.push(attempt)
      console.log(JSON.stringify(attempt))
      if (await run.isDisabled()) continue
      if (!probeOnly) {
        phase = 'inference'
        const pending = cases.map(item => item[0]).filter(id => !Object.hasOwn(result.outputs, id))
        const sequence = resume || !pending.length ? pending : [pending[0], ...pending]
        for (const id of sequence) {
          await page.locator('#case').selectOption(id)
          await run.click()
          await readyOrIdle()
          const payload = await metrics.textContent()
          if (!payload) {
            result.inferenceFailure = { id, state: await status.textContent() }
            break
          }
          const record = { ...JSON.parse(payload), validation: await page.locator('#validation').textContent() }
          result.inference.push(record)
          result.outputs[id] = await output.textContent()
          await writeFile(`${root}/${runId}-outputs.json`, JSON.stringify(result.outputs, null, 2))
          console.log(JSON.stringify(record))
        }
      }
      if (await page.locator('#unload').isEnabled()) await page.locator('#unload').click()
      if (!probeOnly && result.inference.length > 0) break
    }
    phase = 'unloaded'
    result.storageAfter = await browserStorage()
    assert.deepEqual(result.storageAfter, result.storageBefore)
    assert.equal((await context.cookies()).length, 0)
    assert.deepEqual(result.unexpected, [])
    if (!probeOnly && Object.keys(result.outputs).length !== cases.length) {
      result.incomplete = `${Object.keys(result.outputs).length}/${cases.length} cases have output`
      process.exitCode = 2
    }
    assert.equal(await output.textContent(), '')
  } finally {
    clearInterval(timer)
    await polling
    if (!floor) await sample()
  }
} catch (error) {
  result.error = floor ? 'Stopped at host RAM or NVIDIA VRAM threshold' : String(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  const { outputs, ...summary } = result
  await writeFile(`${root}/${runId}-metrics.json`, JSON.stringify(summary, null, 2))
  await writeFile(`${root}/${runId}-outputs.json`, JSON.stringify(outputs, null, 2))
  console.log(`${root}/${runId}-metrics.json and -outputs.json`)
}
