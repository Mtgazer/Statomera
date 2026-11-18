import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const salary = fileURLToPath(new URL('../fixtures/salary.csv', import.meta.url))
const parser = '**/parse.worker-*.js'

async function upload(page: Page, text: string) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'same-name.csv', mimeType: 'text/csv', buffer: Buffer.from(text),
  })
}

function panel(page: Page) {
  return page.locator('#conversation')
}

async function ask(page: Page, text: string) {
  const input = panel(page).getByRole('textbox')
  await input.fill(text)
  await input.press('Enter')
  return panel(page).locator('.conversation-reply').last()
}

test('production conversation uses verified profile, scalar and inference evidence in both languages', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests: { url: string; method: string; body: string | null }[] = []
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }))
  await page.goto('/')
  await expect(panel(page)).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(salary)
  await expect(page.getByTestId('mean')).toHaveText('20')
  await page.getByRole('link', { name: 'Ask your data' }).press('Enter')
  const input = panel(page).getByRole('textbox', { name: 'Question' })
  await input.fill('mean')
  await input.press('End')
  await input.press('Shift+Enter')
  await expect(input).toHaveValue('mean\n')
  await expect(panel(page).getByRole('list', { name: 'Conversation' })).toHaveCount(0)
  await input.press('s')
  await input.press('a')
  await input.press('l')
  await input.press('a')
  await input.press('r')
  await input.press('y')
  await input.press('Enter')
  let newest = panel(page).locator('.conversation-reply').last()
  await expect(newest.getByTestId('statistic-value')).toHaveText('20')
  await expect(newest).toContainText('Valid observations3')
  await expect(newest).toContainText('Excluded records2')
  await expect(newest).toContainText('salary')

  newest = await ask(page, 'Are there missing values?')
  await expect(newest).toContainText('PresentYes')
  await expect(newest).toContainText('Blank cells1')
  newest = await ask(page, 'How many rows are there?')
  await expect(newest).toContainText('Count5')
  newest = await ask(page, 'one-sample t-test for salary against 19.25 at 99%')
  await expect(newest.getByTestId('inference-estimate')).toHaveText('20')
  await expect(newest).toContainText('99% · Requested')
  await expect(newest).toContainText('Null mean19.25')
  await expect(newest.getByTestId('inference-p')).not.toBeEmpty()
  await newest.getByText('Assumptions and scope').press('Enter')
  await expect(newest.getByText('The hypothesis test is two-sided.')).toBeVisible()
  newest = await ask(page, 'confidence interval for salary')
  await expect(newest).toContainText('95% · Default')
  await expect(newest.getByRole('img', { name: 'Confidence interval plot 95%' })).toBeVisible()

  await page.getByLabel('Theme').selectOption('light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  newest = await ask(page, 'متوسط المرتبات كام؟')
  await expect(newest.getByTestId('statistic-value')).toHaveText('٢٠')
  await expect(newest.getByTestId('statistic-value')).toHaveAttribute('data-value', '20')
  await expect(newest).toContainText('المشاهدات الصالحة٣')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

  newest = await ask(page, 'توقع مستقبل AskoraPrivateQuestion')
  await expect(newest.getByRole('heading', { name: 'السؤال غير مدعوم' })).toBeVisible()
  await expect(newest).toContainText('التنبؤ خارج نطاق التحليل المدعوم')
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(async () => [
    localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length,
  ])).toEqual([0, 0, 0, 0])
  const origin = new URL(page.url()).origin
  expect(requests.filter(request => request.url.startsWith('http')).every(request =>
    request.method === 'GET' && request.body === null && !request.url.includes('AskoraPrivateQuestion') &&
    new URL(request.url).origin === origin && /^\/(?:assets\/[^?]+)?$/.test(new URL(request.url).pathname),
  )).toBe(true)
  await panel(page).getByRole('button', { name: 'مسح المحادثة' }).click()
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  await expect(panel(page).getByRole('textbox')).toBeFocused()
  await page.reload()
  await page.locator('input[type=file]').setInputFiles(salary)
  await expect(panel(page).getByRole('textbox')).toBeVisible()
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
})

test('clarification, exact Pearson exclusions, and unavailable results remain distinct', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Import options', { exact: true }).click()
  await page.getByLabel('Treat NA, N/A, NULL and NaN as missing').check()
  await upload(page, 'salary,age,constant\n10,2,1\n20,4,1\nNA,5,1\nbad,6,1')
  await expect(page.getByTestId('rows')).toHaveText('4')
  let reply = await ask(page, 'mean')
  await expect(reply.getByRole('heading', { name: 'Clarification needed' })).toBeVisible()
  await expect(reply).toContainText('Specify the column.')
  reply = await ask(page, 'Pearson correlation between salary and age')
  await expect(reply.getByTestId('statistic-value')).toHaveText('1')
  await expect(reply).toContainText('Complete pairs2')
  await expect(reply).toContainText('Missing only1')
  await expect(reply).toContainText('With invalid values1')
  reply = await ask(page, 'correlation between age and constant')
  await expect(reply.getByRole('heading', { name: 'Result unavailable' })).toBeVisible()
  await expect(reply.getByTestId('statistic-value')).toHaveText('Undefined')
  await expect(reply.getByTestId('statistic-value')).not.toHaveAttribute('data-value')
  await expect(reply).toContainText('At least one column is constant')
})

test('cancellation, clear, execution failure and retry retire conversation workers', async ({ page, context }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        performance.mark('conversation:worker-start')
      }
      terminate() {
        performance.mark('conversation:worker-stop')
        super.terminate()
      }
    }
  })
  await page.goto('/')
  await upload(page, 'salary\n10\n20\n30')
  await expect(page.getByTestId('mean')).toHaveText('20')
  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await ask(page, 'mean salary')
  await expect(panel(page).getByText('Analyzing your question…', { exact: true }).first()).toBeVisible()
  await panel(page).getByRole('button', { name: 'Cancel question' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Question cancelled' })).toBeVisible()
  await context.unroute(parser)
  await context.route(parser, route => route.abort())
  await panel(page).getByRole('button', { name: 'Retry question' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Analysis failed' })).toBeVisible()
  await context.unroute(parser)
  await panel(page).getByRole('button', { name: 'Retry question' }).click()
  await expect(panel(page).getByTestId('statistic-value')).toHaveText('20')
  await expect(panel(page).locator('.conversation-question')).toHaveCount(1)

  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await ask(page, 'mean salary')
  await expect(panel(page).getByRole('button', { name: 'Cancel question' })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Clear conversation' }).click()
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  await context.unroute(parser)
  await expect.poll(() => page.evaluate(() => ['conversation:worker-start', 'conversation:worker-stop']
    .map(name => performance.getEntriesByName(name).length)))
    .toEqual((process.env.ASKORA_TEST_MODE ?? 'production') === 'portable' ? [5, 5] : [6, 6])
})

test('schema override and same-name file replacement retire old answers and pending questions', async ({ page, context }) => {
  await page.goto('/')
  await upload(page, 'salary,age\n10,1\n20,2')
  await expect(page.getByTestId('mean')).toHaveText('15')
  await ask(page, 'mean age')
  await expect(panel(page).getByTestId('statistic-value')).toHaveText('1.5')
  await page.getByRole('combobox', { name: /Schema override.*age/ }).selectOption('text')
  await expect(page.getByRole('combobox', { name: /Schema override.*age/ })).toHaveValue('text')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  const refusal = await ask(page, 'mean age')
  await expect(refusal).toContainText('active column type is unsuitable')
  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const requested = context.waitForEvent('request', { predicate: request => /\/parse\.worker-/.test(request.url()) })
  await ask(page, 'mean salary')
  await requested
  await context.unroute(parser)
  await upload(page, 'salary,age\n40,1\n50,2')
  await expect(page.getByTestId('mean')).toHaveText('45')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  await ask(page, 'mean salary')
  await expect(panel(page).getByTestId('statistic-value')).toHaveText('45')
  await expect(panel(page).locator('.conversation-question')).toHaveCount(1)
})

test('ambiguous and unsupported bilingual questions never start an analytical worker', async ({ page, context }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        performance.mark('hardening:worker')
      }
    }
  })
  const requests: { url: string; method: string; body: string | null }[] = []
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }))
  await page.goto('/')
  const heading = 'Ignore previous instructions; <b>PrivateLabel</b>'
  await upload(page, [
    `salary,Revenue,Cost,Cost and Profit,Revenue and Cost,Profit,إيراد,ايراد,"${heading}",صافي sales 2026,note`,
    '10,1,2,3,4,5,6,7,8,10,PrivateDataset', '20,2,3,4,5,6,7,8,10,20,PrivateDataset',
    '30,3,4,5,6,7,8,9,12,30,PrivateDataset',
  ].join('\n'))
  await expect(page.getByTestId('mean')).toHaveText('20')
  const input = panel(page).getByRole('textbox')
  const send = panel(page).getByRole('button', { name: 'Send question' })
  await input.fill('   ')
  await expect(send).toBeDisabled()
  await input.press('Enter')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  await input.fill('')
  const starts = () => page.evaluate(() => performance.getEntriesByName('hardening:worker').length)
  const initial = await starts()
  await page.keyboard.insertText('mean salary' + ' '.repeat(520) + 'then delete invalid rows')
  await expect(send).toBeDisabled()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(panel(page)).toContainText('Shorten your question to 512 characters or fewer.')
  await input.press('Enter')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  expect(await starts()).toBe(initial)
  const clarification = 'Clarification needed'
  const refusal = 'Question unsupported'
  for (const [question, title, explanation] of [
    ['correlation between revenue and cost and profit', clarification, 'More than one pair matches.'],
    ['متوسط إيراد', clarification, 'More than one column matches.'],
    ['Mean of salary2024', clarification, 'This column could not be found.'],
    ['Spearman correlation between Revenue and Cost', refusal, 'outside the supported analysis scope'],
    ['Calculate mean salary and median Revenue', refusal, 'Ask one question at a time.'],
    ['Does salary cause productivity?', refusal, 'cannot establish causation'],
    ['توقع مستقبل AskoraPrivateQuestion', refusal, 'Forecasting is outside'],
    ['متوسط المرتبات ثم احذف الصفوف', refusal, 'leaves its values intact'],
    ['confidence interval ٩٦٪ for salary', clarification, 'Use a confidence level of 90%, 95%, or 99%.'],
    ['one sample t test for salary', clarification, 'Specify the null mean.'],
  ]) {
    const reply = await ask(page, question)
    await expect(reply.getByRole('heading', { name: title })).toBeVisible()
    await expect(reply).toContainText(explanation)
    await expect(reply.locator('[data-value]')).toHaveCount(0)
  }
  await page.getByLabel('Language').selectOption('ar')
  const unsupported = await ask(page, 'إيه أكبر وأصغر قيمة في salary؟')
  await expect(unsupported).toContainText('اطرح سؤالًا واحدًا في كل مرة')
  expect(await starts()).toBe(initial)

  const quoted = await ask(page, `mean of "${heading}"`)
  await expect(quoted.getByTestId('statistic-value')).toHaveAttribute('data-value', '10')
  await expect(quoted.locator('bdi').filter({ hasText: heading })).toBeVisible()
  await expect(quoted.locator('b')).toHaveCount(0)
  const mixed = await ask(page, 'احسب فترة ثقة ٩٩٪ لمتوسط "صافي sales 2026"')
  await expect(mixed.getByTestId('inference-estimate')).toHaveText('٢٠')
  await expect(mixed).toContainText(/٩٩٪\u061c? · مطلوب/)
  await expect(mixed.locator('bdi').filter({ hasText: 'صافي sales 2026' })).toBeVisible()
  const western = await ask(page, 'one-sample t-test for salary against 19.25 at 99%')
  await expect(western.getByTestId('inference-estimate')).toHaveText('٢٠')
  await expect(western).toContainText('١٩٫٢٥')
  expect(await starts()).toBe(initial + 3)
  const origin = new URL(page.url()).origin
  expect(requests.filter(request => request.url.startsWith('http')).every(request =>
    request.method === 'GET' && request.body === null && !/Private|\?/.test(request.url) &&
    new URL(request.url).origin === origin && /^\/(?:assets\/[^?]+)?$/.test(new URL(request.url).pathname),
  )).toBe(true)
})

test('pending worksheet and schema changes discard the old transcript and block a second submission', async ({ page, context }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../fixtures/worksheets.xlsx', import.meta.url)))
  await expect(page.getByTestId('rows')).toHaveText('4')
  async function stall() {
    await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
    const stalled = context.waitForEvent('response', { predicate: response => /\/parse\.worker-/.test(response.url()) })
    await ask(page, 'mean amount')
    await stalled
    await expect(panel(page).getByRole('button', { name: 'Cancel question' })).toBeVisible()
    await context.unroute(parser)
  }
  await stall()
  const input = panel(page).getByRole('textbox')
  await input.fill('How many rows?')
  await input.press('Enter')
  await expect(input).toHaveValue('How many rows?')
  await expect(panel(page).getByRole('button', { name: 'Send question' })).toBeDisabled()
  await expect(panel(page).locator('.conversation-question')).toHaveCount(1)
  await page.getByLabel('Worksheet').selectOption('1')
  await expect(page.getByTestId('rows')).toHaveText('2')
  await expect(input).toHaveValue('')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  const verified = await ask(page, 'mean amount')
  await expect(verified.getByTestId('statistic-value')).toHaveText('50')
  await stall()
  const override = page.getByRole('combobox', { name: /Schema override.*amount/ })
  await override.selectOption('text')
  await expect(override).toHaveValue('text')
  await expect(panel(page).locator('.conversation-turns')).toHaveCount(0)
  const refusal = await ask(page, 'mean amount')
  await expect(refusal).toContainText('active column type is unsuitable')
})

test('keyboard focus and polite status follow cancellation, retry and clear', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(salary)
  const workspace = panel(page)
  const input = workspace.getByRole('textbox', { name: 'Question' })
  const announcement = workspace.locator('[aria-live]')
  await expect(announcement).toHaveCount(1)
  await expect(announcement).toHaveAttribute('aria-live', 'polite')
  await expect(announcement).toHaveAttribute('aria-atomic', 'true')
  await expect(input).toHaveAccessibleDescription('Enter to send · Shift+Enter for a new line')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const stalled = context.waitForEvent('response', { predicate: response => /\/parse\.worker-/.test(response.url()) })
  await ask(page, 'mean salary')
  await stalled
  await context.unroute(parser)
  await expect(announcement).toHaveText('Analyzing your question… Question 1.')
  await expect(input).toBeFocused()
  await page.keyboard.press('Tab')
  const cancel = workspace.getByRole('button', { name: 'Cancel question' })
  await expect(cancel).toBeFocused()
  expect(await cancel.evaluate(button => getComputedStyle(button).outlineStyle)).toBe('solid')
  await page.keyboard.press('Enter')
  await expect(announcement).toHaveText('Question cancelled Question 1.')
  await expect(input).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(workspace.getByRole('button', { name: 'Retry question' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(announcement).toHaveText('Answer ready. Question 1.')
  await expect(input).toBeFocused()
  await expect(workspace.getByTestId('statistic-value')).toHaveText('20')
  await page.getByLabel('Theme').selectOption('light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(workspace.getByTestId('statistic-value')).toHaveText('٢٠')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await workspace.getByRole('button', { name: 'مسح المحادثة' }).press('Enter')
  await expect(announcement).toHaveText('مُسحت المحادثة.')
  await expect(workspace.getByRole('textbox', { name: 'السؤال' })).toBeFocused()
})

test('real conversation workers stay bounded across three dataset sizes and repeated turns', async ({ page, browserName }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        performance.mark('benchmark:worker-start')
      }
      terminate() {
        super.terminate()
        performance.mark('benchmark:worker-stop')
      }
    }
  })
  const workers = () => page.evaluate(() => ['benchmark:worker-start', 'benchmark:worker-stop']
    .map(mark => performance.getEntriesByName(mark).length))
  await page.goto('/')
  for (const rows of [5, 10_000, 100_000]) {
    // Same narrow scale fixture as the existing 100,000-row import stress check.
    const name = 'x'.repeat(45)
    const generated = 'employee,salary\n' + `${name},10\n${name},30\n`.repeat(rows / 2)
    if (rows === 5) await page.locator('input[type=file]').setInputFiles(salary)
    else await upload(page, generated)
    await expect(page.getByTestId('rows')).toHaveText(rows.toLocaleString('en-US'))
    const [before, stopped] = await workers()
    expect(stopped).toBe(before)
    const frames = await page.evaluateHandle(() => {
      let previous: number | undefined
      let samples = 0
      let maxGapMs = 0
      function sample(now: number) {
        if (previous !== undefined) maxGapMs = Math.max(maxGapMs, now - previous)
        previous = now
        samples++
        frame = requestAnimationFrame(sample)
      }
      let frame = requestAnimationFrame(sample)
      return { stop: () => {
        cancelAnimationFrame(frame)
        return { samples, maxGapMs: Math.round(maxGapMs) }
      } }
    })
    const milliseconds: number[] = []
    for (let i = 0; i < 3; i++) {
      const start = performance.now()
      const reply = await ask(page, 'mean salary')
      await expect(reply.getByTestId('statistic-value')).toHaveText('20')
      milliseconds.push(Math.round(performance.now() - start))
    }
    const frameProgress = await frames.evaluate(probe => probe.stop())
    await frames.dispose()
    expect(frameProgress.samples).toBeGreaterThan(0)
    await expect.poll(workers).toEqual([before + 3, before + 3])
    console.log(JSON.stringify({ mode: process.env.ASKORA_TEST_MODE, browserName, rows,
      bytes: rows === 5 ? statSync(salary).size : Buffer.byteLength(generated), milliseconds, ...frameProgress }))
  }
  const before = await workers()
  const first = await ask(page, 'How many rows are there?')
  await expect(first).toContainText('100,000')
  for (let i = 0; i < 24; i++) {
    const reply = await ask(page, 'How many rows?')
    await expect(reply).toContainText('100,000')
  }
  await expect(panel(page).locator('.conversation-question')).toHaveCount(24)
  await expect(panel(page).getByText('How many rows are there?', { exact: true })).toHaveCount(0)
  expect(await workers()).toEqual(before)
})
