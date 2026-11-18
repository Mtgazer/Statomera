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
  await page.getByRole('button', { name: 'Choose file' }).focus()
  const selection = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await selection).setFiles(fixture)
  await expect(page.getByTestId('mean')).toHaveText('20')
  if (!portable) await expect(page.getByTestId('mean')).toHaveAttribute('data-reference-mean', '20')
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

test('malformed, empty, invalid-encoding and over-limit inputs recover', async ({ page }) => {
  await page.goto('/')
  for (const [contents, message, name] of [
    ['', 'The file is empty.'],
    ['employee,salary\nAmal', /different number of fields/],
    ['employee,salary\n"Amal,20', /unmatched quotes/],
    ['salary,salary\n1,2', /unique/],
    [Buffer.from([0xff]), /UTF-8/],
    [Buffer.alloc(5 * 1024 * 1024 + 1), /5 MiB limit/],
    ['salary\n1', /Choose a CSV/, 'sample.txt'],
  ] as const) {
    await upload(page, contents, name)
    await expect(page.getByRole('alert')).toHaveText(message)
  }
  await upload(page, 'موظف,الراتب\n"نور, حسن",10\nمريم,30\nعمر,NA\nآمال,')
  await expect(page.getByTestId('mean')).toHaveText('20')
  await expect(page.getByRole('region', { name: 'Dataset preview' }).getByText('نور, حسن')).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Choose file' })).toBeFocused()
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
  await expect(page.getByRole('region', { name: 'Dataset preview' }).getByText(cell, { exact: true })).toBeVisible()
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
  await page.evaluate(() => {
    function tick() {
      performance.mark('askora:test:frame')
      if (!performance.getEntriesByName('askora:analysis').length) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const name = 'x'.repeat(45)
  const data = Buffer.from('employee,salary\n' + `${name},10\n${name},30\n`.repeat(50_000))
  await upload(page, data)
  await expect(page.getByTestId('rows')).toHaveText('100,000', { timeout: 12_000 })
  await expect(page.getByTestId('mean')).toHaveAttribute('data-value', '20')
  const stats = await page.evaluate(() => {
    const run = performance.getEntriesByName('askora:analysis').at(-1)!
    const ticks = performance.getEntriesByName('askora:test:frame').map(frame => frame.startTime)
      .filter(time => time >= run.startTime && time <= run.startTime + run.duration)
    const gaps = ticks.slice(1).map((time, index) => time - ticks[index])
    return {
      started: performance.getEntriesByName('askora:test:started').length,
      terminated: performance.getEntriesByName('askora:test:terminated').length,
      milliseconds: run.duration,
      frameSamples: ticks.length,
      maxFrameGapMs: gaps.length ? Math.max(...gaps) : null,
    }
  })
  expect(stats.started).toBe(portable ? 1 : 2)
  expect(stats.terminated).toBe(stats.started)
  const preview = page.getByRole('region', { name: 'Dataset preview', exact: true }).last()
  await expect(preview.getByRole('row')).toHaveCount(9)
  await page.getByLabel('Search preview').fill('no matching row')
  await expect(preview.getByRole('row')).toHaveCount(1)
  expect(await page.evaluate(() => performance.getEntriesByName('askora:test:started').length)).toBe(stats.started)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  console.log(JSON.stringify({ mode, browserName, rows: 100000, bytes: data.length,
    cpuThrottle: portable && browserName === 'chromium' ? 4 : 1, ...stats }))
})

test('generic profiles expose quality counts and localized numeric and categorical summaries', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Import options', { exact: true }).click()
  await page.getByRole('checkbox', { name: 'Treat NA, N/A, NULL and NaN as missing' }).check()
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../fixtures/mixed.csv', import.meta.url)))
  await expect(page.getByTestId('rows')).toHaveText('8')
  await expect(page.getByTestId('columns')).toHaveText('5')
  await expect(page.getByTestId('duplicate-rows')).toHaveText('1')
  await expect(page.getByTestId('mean')).toHaveCount(0)
  const profiles = page.getByRole('region', { name: 'Column profiles' })
  const column = (name: string) => profiles.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) }).first()
  const amount = column('amount')
  const cells = amount.getByRole('cell')
  for (const [index, text] of ['Number', '1', '1', '5', '1'].entries()) {
    await expect(cells.nth(index)).toHaveText(text)
  }
  await amount.getByText('Details', { exact: true }).click()
  await expect(amount.locator('dl')).toHaveText('Count5Mean22Minimum10Maximum40Median20')
  await expect(amount.locator('.rejected').getByRole('listitem')).toHaveText('Record 4 bad')
  const group = column('group')
  await group.getByText('Details', { exact: true }).click()
  await expect(group.getByRole('table', { name: 'Most frequent values' })).toContainText('جنوب5')
  const date = column('day')
  await expect(date.getByRole('cell', { name: 'ISO date', exact: true })).toBeVisible()
  await date.getByText('Details', { exact: true }).click()
  await expect(date.getByText(/date-like values are ambiguous/)).toBeVisible()

  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('region', { name: 'ملفات تعريف الأعمدة' }).getByText('الوسيط', { exact: true })).toBeVisible()
  await expect(page.getByTestId('duplicate-rows')).toHaveText('١')
})

test('import options recover duplicate headers and read a headerless file', async ({ page }) => {
  await page.goto('/')
  const duplicate = fileURLToPath(new URL('../fixtures/duplicate-headers.csv', import.meta.url))
  await page.locator('input[type=file]').setInputFiles(duplicate)
  await expect(page.getByRole('alert')).toHaveText(/unique/)
  await page.getByText('Import options', { exact: true }).click()
  await page.getByRole('checkbox', { name: /Keep duplicate headers/ }).check()
  await page.locator('input[type=file]').setInputFiles(duplicate)
  const preview = page.getByRole('region', { name: 'Dataset preview' })
  await expect(preview.getByRole('columnheader', { name: 'field [1]', exact: true })).toBeVisible()
  await expect(preview.getByRole('columnheader', { name: 'FIELD [2]', exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'First record contains headers' }).uncheck()
  await page.getByLabel('Delimiter').selectOption('\t')
  await upload(page, '1\tغرب\n2\tشرق')
  await expect(preview.getByRole('columnheader', { name: 'Column 1', exact: true })).toBeVisible()
  await expect(preview.getByRole('cell', { name: 'غرب', exact: true })).toBeVisible()
  await expect(page.getByTestId('rows')).toHaveText('2')
  await upload(page, '\t\n')
  await expect(page.getByTestId('rows')).toHaveText('1')
  await expect(page.getByTestId('columns')).toHaveText('2')
})

test('profiles a large multi-column dataset inside the existing bounds', async ({ page, browserName }) => {
  await page.goto('/')
  const data = Buffer.from('value,label,enabled,date\n' +
    '10,شمال,true,2024-01-01\n30,جنوب,false,2024-01-02\n'.repeat(40_000))
  await upload(page, data)
  await expect(page.getByTestId('rows')).toHaveText('80,000', { timeout: 12_000 })
  await expect(page.getByTestId('duplicate-rows')).toHaveText('79,998')
  const row = page.getByRole('region', { name: 'Column profiles' }).getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'value', exact: true }) })
  await row.getByText('Details', { exact: true }).click()
  await expect(row.locator('dl').first()).toHaveText('Count80,000Mean20Minimum10Maximum30Median20')
  const milliseconds = await page.evaluate(() => performance.getEntriesByName('askora:analysis').at(-1)?.duration)
  console.log(JSON.stringify({ mode, browserName, bytes: data.length, rows: 80000, columns: 4, milliseconds }))
})

test('schema overrides reprofile the original values and reset with a new file', async ({ page }) => {
  await page.goto('/')
  await upload(page, 'measure\n10\n"$20"\n30\n"1,20"')
  const control = page.getByRole('combobox', { name: /Schema override.*measure/ })
  await expect(control).toHaveValue('auto')
  await control.focus()
  await expect(control).toBeFocused()
  await control.selectOption('numeric')
  await expect(control).toHaveValue('numeric')
  const row = page.getByRole('row').filter({ has: control })
  await row.getByText('Details', { exact: true }).click()
  await expect(row.locator('dl')).toContainText('Mean20')
  await expect(row.locator('.rejected').getByRole('listitem')).toHaveText(['Record 2 $20', 'Record 4 1,20'])
  await page.getByLabel('Language').selectOption('ar')
  const arabicControl = page.getByRole('combobox', { name: /تجاوز النوع المستنتج.*measure/ })
  await expect(arabicControl).toHaveValue('numeric')
  await arabicControl.selectOption('auto')
  await expect(arabicControl).toHaveValue('auto')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await upload(page, 'measure\nTRUE\nFALSE')
  await expect(arabicControl).toHaveValue('auto')
  await expect(page.getByRole('cell', { name: 'قيمة منطقية', exact: true })).toBeVisible()
})

test('cancelled or failed schema work hides stale results and can be retried', async ({ page, context }) => {
  await page.goto('/')
  await upload(page, 'value\n10\nbad\n30')
  const control = page.getByRole('combobox', { name: /Schema override.*value/ })
  await expect(control).toHaveValue('auto')
  const parser = '**/parse.worker-*.js'
  await context.route(parser, route => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await control.selectOption('numeric')
  await expect(control).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('status')).toHaveText('Analysis cancelled.')
  await context.unroute(parser)
  await context.route(parser, route => route.abort())
  await page.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(page.getByRole('alert')).toContainText('could not be processed')
  await context.unroute(parser)
  await page.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(control).toHaveValue('numeric')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('JSON profiles native values, reports precision failures and reuses overrides in Arabic', async ({ page, context, browserName }) => {
  const http = new Set<string>()
  context.on('request', request => {
    if (request.url().startsWith('http')) http.add(`${request.method()} ${request.url()}`)
  })
  await page.goto('/')
  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles(fileURLToPath(new URL('../fixtures/flat.json', import.meta.url)))
  await expect(page.getByTestId('rows')).toHaveText('4')
  await expect(page.getByTestId('columns')).toHaveText('4')
  const profiles = page.getByRole('region', { name: 'Column profiles' })
  const value = profiles.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'value', exact: true }) })
  await value.getByText('Details', { exact: true }).click()
  await expect(value.locator('dl')).toContainText('Mean20')
  await expect(value.getByTestId('missing-rate')).toHaveText('25%')
  await expect(value.locator('.rejected').getByRole('listitem')).toHaveText('Record 4 9007199254740993')
  await page.getByLabel('Language').selectOption('ar')
  const override = page.getByRole('combobox', { name: /تجاوز النوع المستنتج.*value/ })
  await override.selectOption('text')
  await expect(override).toHaveValue('text')
  await expect(page.getByTestId('rows')).toHaveText('٤')
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0)
  expect([...http].every(request => /^GET http:\/\/127\.0\.0\.1:4173\/(?:assets\/[^?]+)?$/.test(request))).toBe(true)
  const scale = JSON.stringify(Array.from({ length: 10000 }, (_, index) => ({ value: index % 2 ? 30 : 10, label: 'قيمة' })))
  await upload(page, scale, 'scale.json')
  await expect(page.getByTestId('rows')).toHaveText('١٠٬٠٠٠')
  console.log(JSON.stringify({ mode, browserName, format: 'json', rows: 10000, bytes: Buffer.byteLength(scale),
    milliseconds: await page.evaluate(() => performance.getEntriesByName('askora:analysis').at(-1)?.duration) }))
})

test('XLSX worksheet selection, strict cell policy and local asset loading', async ({ page, context, browserName }) => {
  const requests: { method: string; url: string; data: string | null }[] = []
  context.on('request', request => {
    if (request.url().startsWith('http')) requests.push({ method: request.method(), url: request.url(), data: request.postData() })
  })
  await page.goto('/')
  expect(requests.some(request => request.url.includes('/xlsx-'))).toBe(false)
  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles(fileURLToPath(new URL('../fixtures/worksheets.xlsx', import.meta.url)))
  await expect(page.getByTestId('rows')).toHaveText('4')
  await expect(page.getByRole('region', { name: 'Dataset preview' }).getByText('2024-02-29')).toBeVisible()
  const worksheet = page.getByLabel('Worksheet')
  await expect(worksheet).toHaveValue('0')
  await expect(page.getByRole('region', { name: 'Dataset overview' }).getByText('مبيعات', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Dataset overview' }).getByText('XLSX', { exact: true })).toBeVisible()
  const amount = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'amount', exact: true }) })
  await amount.getByText('Details', { exact: true }).click()
  await expect(amount.locator('dl')).toContainText('Mean14')
  const override = amount.getByRole('combobox')
  await override.selectOption('text')
  await expect(override).toHaveValue('text')
  await worksheet.selectOption('2')
  await expect(page.getByRole('alert')).toContainText('unsupported content')
  await worksheet.selectOption('1')
  await expect(page.getByTestId('rows')).toHaveText('2')
  await expect(override).toHaveValue('auto')
  await amount.getByText('Details', { exact: true }).click()
  await expect(amount.locator('dl')).toContainText('Mean50')
  await expect(amount.getByTestId('missing-rate')).toHaveText('0%')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.getByLabel('ورقة العمل')).toHaveValue('1')
  expect(requests.some(request => /\/assets\/xlsx-/.test(request.url))).toBe(true)
  expect(requests.every(({ method, url, data }) => method === 'GET' &&
    /^http:\/\/127\.0\.0\.1:4173\/(?:assets\/[^?]+)?$/.test(url) && data === null)).toBe(true)
  console.log(JSON.stringify({ mode, browserName, format: 'xlsx', worksheet: 1,
    milliseconds: await page.evaluate(() => performance.getEntriesByName('askora:analysis').at(-1)?.duration) }))
})

test('format rejection, cancellation and worker recovery preserve the next import', async ({ page, context }) => {
  await page.goto('/')
  const fileInput = page.locator('input[type=file]')
  await upload(page, '[{"nested":{"value":10}}]', 'nested.json')
  await expect(page.getByRole('alert')).toContainText('flat objects')
  await fileInput.setInputFiles(fileURLToPath(new URL('../fixtures/unsupported.parquet', import.meta.url)))
  await expect(page.getByRole('alert')).toContainText('Parquet is unavailable')
  await fileInput.setInputFiles(fileURLToPath(new URL('../fixtures/oversize-workbook.xlsx', import.meta.url)))
  await expect(page.getByRole('alert')).toContainText('expanded archive limit')
  const pattern = '**/xlsx-*.js'
  await context.route(pattern, () => {}) // Hold the optional module fetch while cancelling.
  const workbook = fileURLToPath(new URL('../fixtures/worksheets.xlsx', import.meta.url))
  await fileInput.setInputFiles(workbook)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('status')).toHaveText('Analysis cancelled.')
  await context.unroute(pattern)
  await context.route(pattern, route => route.abort())
  await fileInput.setInputFiles(workbook)
  await expect(page.getByRole('alert')).toContainText('could not be processed')
  await context.unroute(pattern)
  await fileInput.setInputFiles(workbook)
  await expect(page.getByTestId('rows')).toHaveText('4')
})

test('workspace navigation, preview interactions and quality stay bounded in Arabic and light mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to dataset workspace' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await page.locator('input[type=file]').setInputFiles(fixture)

  const overview = page.getByRole('region', { name: 'Dataset overview' })
  await expect(overview.getByText('salary.csv', { exact: true })).toBeVisible()
  await expect(overview.getByText('CSV', { exact: true })).toBeVisible()
  await expect(overview.getByTestId('missing-total')).toHaveText('1')
  await expect(overview.getByTestId('invalid-total')).toHaveText('1')
  const preview = page.getByRole('region', { name: 'Dataset preview', exact: true }).last()
  await expect(preview.getByText('Blank', { exact: true })).toBeVisible()
  await expect(preview.getByText('Invalid', { exact: true })).toBeVisible()
  await page.getByLabel('Filter preview').selectOption('invalid')
  await expect(preview.getByRole('row')).toHaveCount(2)
  await expect(preview.getByText('N/A', { exact: true })).toBeVisible()
  await page.getByLabel('Search preview').fill('unmatched')
  await expect(page.getByText('No preview rows match. Change the search or filter.')).toBeVisible()
  await page.getByLabel('Search preview').fill('')
  await page.getByLabel('Filter preview').selectOption('all')
  const header = preview.getByRole('button', { name: 'salary', exact: true })
  await header.focus()
  await page.keyboard.press('Enter')
  await expect(header).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Sort selected column').selectOption('ascending')
  await expect(preview.getByRole('columnheader', { name: 'salary' })).toHaveAttribute('aria-sort', 'ascending')
  const columnProfile = page.getByRole('region', { name: 'Column profiles' })
  await expect(columnProfile.getByText('Unique valid values')).toBeVisible()

  await page.getByLabel('Theme').selectOption('light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('navigation', { name: 'أقسام مساحة العمل' })).toBeVisible()
  await expect(page.getByTestId('mean')).toHaveText('٢٠')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('quality diagnostics localize missingness, duplicate frequencies and numeric outliers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('Import options', { exact: true }).click()
  await page.getByLabel('Treat NA, N/A, NULL and NaN as missing').check()
  await page.locator('input[type=file]').setInputFiles(
    fileURLToPath(new URL('../fixtures/phase-3-quality.csv', import.meta.url)))
  await expect(page.getByTestId('rows')).toHaveText('14')
  await expect(page.getByText('Search, filtering and sorting apply only to the first eight records.')).toBeVisible()
  const quality = page.getByRole('region', { name: 'Data quality', exact: true })
  const patternToggle = quality.getByText('Missingness patterns', { exact: true })
  await patternToggle.focus()
  await page.keyboard.press('Enter')
  await expect(quality.getByRole('table', { name: 'Missingness patterns' }).getByRole('row').last()).toContainText('salary')
  await quality.getByText(/Exact duplicate frequencies/).first().click()
  const frequencies = quality.getByRole('table', { name: 'Exact duplicate frequencies' })
  await expect(frequencies.getByRole('row')).toHaveCount(3)

  const explorer = page.getByRole('region', { name: 'Column profiles' })
  await explorer.getByRole('button', { name: 'salary', exact: true }).click()
  await expect(explorer.getByTestId('missing-rate')).toHaveText('21.43%')
  await expect(explorer.getByText('Review coverage before analysis.', { exact: false })).toBeVisible()
  await expect(explorer.getByText('11.5', { exact: true })).toBeVisible()
  await expect(explorer.getByRole('table', { name: /Distribution of valid values/ }).getByRole('row')).toHaveCount(9)

  await page.getByLabel('Theme').selectOption('light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByText('أنماط القيم المفقودة', { exact: true })).toBeVisible()
  await expect(page.getByTestId('missing-rate')).toContainText('٢١٫٤٣')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await upload(page, 'id,value\n1,3\n2,3')
  await expect(page.getByTestId('rows')).toHaveText('٢')
  await expect(page.getByTestId('duplicate-rows')).toHaveText('٠')
})
