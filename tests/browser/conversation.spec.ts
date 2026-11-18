import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
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
