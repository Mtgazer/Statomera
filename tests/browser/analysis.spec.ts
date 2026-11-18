import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const mode = process.env.ASKORA_TEST_MODE ?? 'production'
const portable = mode === 'portable'
const dist = portable ? 'dist-portable' : mode === 'duckdb-eh' ? 'dist-eh' : 'dist'
const workerPattern = portable ? '**/parse.worker-*.js' : '**/duckdb-browser-*.worker-*.js'

const fixture = fileURLToPath(new URL('../fixtures/salary.csv', import.meta.url))

async function upload(page: Page, value: string | Buffer, name = 'sample.csv') {
  await page.locator('input[type=file]').setInputFiles({
    name, mimeType: 'text/csv', buffer: Buffer.from(value),
  })
}

test('local picker flow, identical bilingual results and theme switch on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Choose CSV' }).focus()
  const selection = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await selection).setFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveText('20')
  for (const [metric, count] of Object.entries({ rows: '5', columns: '2', valid: '3', blank: '1', invalid: '1' })) {
    await expect(page.getByTestId(metric)).toHaveText(count)
  }
  await expect(page.getByRole('heading', { name: 'Examples of invalid salaries' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveText('Record 4 N/A')

  await page.getByLabel('Theme').selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByTestId('mean')).toHaveText('٢٠')
  await expect(page.getByTestId('mean')).toHaveAttribute('data-value', '20')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveAttribute('data-value', '20')
  await expect(page.getByTestId('rows')).toHaveText('٥')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.getByLabel('اللغة').selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByTestId('mean')).toHaveText('20')
})

test('malformed, missing-column, empty, invalid-encoding and over-limit inputs recover', async ({ page }) => {
  await page.goto('/')
  for (const [contents, message, name] of [
    ['', 'The file is empty.'],
    ['name\nAmal', /Include one salary column/],
    ['employee,salary\nAmal', /different number of fields/],
    ['employee,salary\n"Amal,20', /unmatched quotes/],
    ['salary,salary\n1,2', /unique/],
    [Buffer.from([0xff]), /UTF-8/],
    [Buffer.alloc(5 * 1024 * 1024 + 1), /5 MiB limit/],
    ['salary\n1', /\.csv extension/, 'sample.txt'],
  ] as const) {
    await upload(page, contents, name)
    await expect(page.getByRole('alert')).toHaveText(message)
  }
  await upload(page, 'موظف,الراتب\n"نور, حسن",10\nمريم,30\nعمر,NA\nآمال,')
  await expect(page.getByTestId('mean')).toHaveText('20')
  await expect(page.getByText('نور, حسن')).toBeVisible()
  await expect(page.getByTestId('invalid')).toHaveText('1')
  await expect(page.getByTestId('blank')).toHaveText('1')
})

test('empty denominator and extreme numerical values match independent references', async ({ page }) => {
  await page.goto('/')
  for (const [contents, canonical] of [
    ['salary\n""\nNA\n', null],
    ['salary\n', null],
    ['salary\n-5\n0\n6\n', 1 / 3],
    ['salary\n1e308\n1e308\n', 1e308],
    ['salary\n1e308\n1e308\n-1e308\n-1e308\n', 0],
    ['salary\n-5e-324\n', -5e-324],
  ] as const) {
    await upload(page, contents)
    const mean = page.getByTestId('mean')
    await expect(mean).toBeVisible()
    if (canonical === null) {
      await expect(mean).toHaveText('Unavailable')
      expect(await mean.getAttribute('data-value')).toBeNull()
    } else {
      await expect(mean).toHaveAttribute('data-value', String(canonical))
    }
  }
})

test('cancel terminates active work and a replaced file takes precedence', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        if (String(url).includes('parse.worker')) {
          const send = this.postMessage.bind(this)
          this.postMessage = (value: unknown) => {
            setTimeout(() => send(value), 400)
          }
        }
      }
      terminate() {
        performance.mark('askora:test:terminated')
        super.terminate()
      }
    }
  })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('status')).toHaveText('Analysis cancelled.')
  await expect(page.getByRole('button', { name: 'Choose CSV' })).toBeFocused()
  expect(await page.evaluate(() => performance.getEntriesByName('askora:test:terminated').length)).toBe(1)
  await expect(page.getByTestId('mean')).toHaveCount(0)
  await upload(page, 'salary\n100')
  await upload(page, 'salary\n50')
  await expect(page.getByTestId('mean')).toHaveText('50')
  expect(await page.evaluate(() => performance.getEntriesByName('askora:test:terminated').length)).toBe(portable ? 3 : 4)
})

test('an engine startup failure is localized and retryable', async ({ page, context }) => {
  const pattern = workerPattern
  await context.route(pattern, route => route.abort())
  await page.goto('/')
  await page.getByLabel('Language').selectOption('ar')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByRole('alert')).toHaveText(portable ? /تعذّرت معالجة الملف/ : /تعذّر إكمال التحليل/)
  await context.unroute(pattern)
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveText('٢٠')
})

test('a stalled engine hits the time budget and can be retried', async ({ page, context }) => {
  const pattern = portable ? workerPattern : '**/*.wasm'
  await context.route(pattern, route => portable
    ? route.fulfill({ contentType: 'text/javascript', body: '' })
    : route.abort())
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByRole('alert')).toHaveText(/10-second limit|engine could not finish/, { timeout: 12_000 })
  await context.unroute(pattern)
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveText('20')
})

test('local-only requests, inert cell rendering, no storage and bounded performance', async ({ page, context, browserName }) => {
  const requests: Array<{ url: string; method: string; data: string | null }> = []
  const errors: string[] = []
  const wasmMime: string[] = []
  const policies: string[] = []
  context.on('request', req => requests.push({ url: req.url(), method: req.method(), data: req.postData() }))
  context.on('response', async res => {
    if (res.url().endsWith('.wasm')) wasmMime.push((await res.headerValue('content-type')) ?? '')
    if (res.url().includes('.worker-')) policies.push((await res.headerValue('content-security-policy')) ?? '')
  })
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto('/')
  expect(await response?.headerValue('content-security-policy')).toContain("worker-src 'self'")
  const cell = '<em>LocalOnlyCell</em>'
  await upload(page, `employee,salary\n"${cell}",5\n`)
  await expect(page.getByText(cell, { exact: true })).toBeVisible()
  await expect(page.locator('em')).toHaveCount(0)
  await expect(page.getByTestId('mean')).toHaveText('5')

  const firstAnalysisMs = await page.evaluate(() => performance.getEntriesByName('askora:analysis').at(-1)?.duration)
  const data = Buffer.from('employee,salary\n' + 'Sample Person,10\nSample Person,30\n'.repeat(30_000))
  const timings = []
  for (let run = 0; run < 3; run++) {
    await upload(page, data)
    await expect(page.getByTestId('rows')).toHaveText('60,000')
    await expect(page.getByTestId('mean')).toHaveText('20')
    timings.push(await page.evaluate(() => {
      const measure = performance.getEntriesByName('askora:analysis').at(-1) as PerformanceMeasure
      return { totalMs: measure.duration, ...measure.detail }
    }))
  }

  expect(requests.some(request => request.url.endsWith('.wasm'))).toBe(!portable)
  if (!portable) expect(wasmMime).toContain('application/wasm')
  expect(policies.length).toBeGreaterThan(0)
  expect(policies.every(policy => policy.includes("connect-src 'self'"))).toBe(true)
  for (const request of requests) {
    const url = new URL(request.url)
    expect(url.origin).toBe('http://127.0.0.1:4173')
    expect(request.method).toBe('GET')
    expect(request.data).toBeNull()
    // WebKit may surface reads of the selected File as local blob URLs.
    if (url.protocol === 'blob:') continue
    expect(url.protocol).toBe('http:')
    expect(url.pathname).toMatch(/^(\/$|\/assets\/[^/]+\.(js|css|wasm)$)/)
    expect(url.search).toBe('')
    expect(request.url).not.toContain('LocalOnlyCell')
  }
  expect(errors).toEqual([])
  const runtime = await page.evaluate(async () => ({
    startupMs: performance.getEntriesByType('navigation')[0].duration,
    jsHeapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
    local: localStorage.length,
    session: sessionStorage.length,
    indexed: (await indexedDB.databases()).length,
    cache: (await caches.keys()).length,
  }))
  expect([runtime.local, runtime.session, runtime.indexed, runtime.cache]).toEqual([0, 0, 0, 0])
  expect(await context.cookies()).toEqual([])
  console.log(JSON.stringify({ mode, browserName, bytes: data.length, rows: 60000, ...runtime, firstAnalysisMs, timings }))
})

test('analysis works when previously loaded assets are supplied without live requests', async ({ page, context }) => {
  const origin = 'http://127.0.0.1:4173'
  const seenAssets = new Set<string>()
  context.on('request', request => {
    const url = new URL(request.url())
    if (url.origin === origin && /^\/assets\/[^/]+\.(js|wasm)$/.test(url.pathname)) {
      seenAssets.add(url.pathname)
    }
  })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveText('20')

  // Supply only immutable assets from the completed warm-up. No route goes to a server.
  const cached = new Set(seenAssets)
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.protocol === 'blob:' && url.origin === origin) return route.continue()
    if (url.origin !== origin || url.search || !cached.has(url.pathname)) return route.abort()
    const path = fileURLToPath(new URL('../../' + dist + url.pathname, import.meta.url))
    return route.fulfill({
      path,
      contentType: url.pathname.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      headers: { 'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'" },
    })
  })
  await upload(page, 'salary\n60\n80')
  await expect(page.getByTestId('mean')).toHaveText('70')
})

test('near-limit input returns the reference mean and retires every worker', async ({ page, context, browserName }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        performance.mark('askora:test:started')
      }
      terminate() {
        performance.mark('askora:test:terminated')
        super.terminate()
      }
    }
  })
  if (portable && browserName === 'chromium') {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  await page.goto('/')
  const name = 'x'.repeat(45)
  const data = Buffer.from('employee,salary\n' + `${name},10\n${name},30\n`.repeat(50_000))
  await upload(page, data)
  await expect(page.getByTestId('rows')).toHaveText('100,000', { timeout: 12_000 })
  await expect(page.getByTestId('mean')).toHaveAttribute('data-value', '20')
  const stats = await page.evaluate(() => ({
    started: performance.getEntriesByName('askora:test:started').length,
    terminated: performance.getEntriesByName('askora:test:terminated').length,
    milliseconds: performance.getEntriesByName('askora:analysis').at(-1)?.duration,
  }))
  expect(stats.started).toBe(portable ? 1 : 2)
  expect(stats.terminated).toBe(stats.started)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  console.log(JSON.stringify({ mode, browserName, rows: 100000, bytes: data.length,
    cpuThrottle: portable && browserName === 'chromium' ? 4 : 1, ...stats }))
})
