import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const origin = 'http://127.0.0.1:4174'
const parser = '**/parse.worker-*.js'
const salaryFile = fileURLToPath(new URL('../fixtures/salary.csv', import.meta.url))

async function upload(page: Page, csv: string) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'same-name.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  })
}

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        performance.mark('router:worker-start')
      }
      terminate() {
        performance.mark('router:worker-stop')
        super.terminate()
      }
    }
  })
}

async function workers(page: Page) {
  return page.evaluate(() => ['router:worker-start', 'router:worker-stop']
    .map(name => performance.getEntriesByName(name).length))
}

test('routes verified scalar and inference results through the real worker with local privacy', async ({ page, context }) => {
  await instrument(page)
  const requests: { url: string; method: string; body: string | null }[] = []
  context.on('request', request => requests.push({
    url: request.url(), method: request.method(), body: request.postData(),
  }))
  await page.goto(origin)
  await page.locator('input[type=file]').setInputFiles(salaryFile)
  await expect(page.getByTestId('mean')).toHaveText('20')

  const results = await page.evaluate(async () => {
    const { router } = window.askoraRouterTest
    const rows = await router.run('How many rows?')
    const english = await router.run('mean salary')
    const arabic = await router.run('متوسط المرتبات كام؟')
    const interval = await router.run('احسب فترة ثقة ٩٩٪ لمتوسط المرتبات')
    const defaultLevel = await router.run('one-sample t-test for salary against 19.25')
    const unresolved = await router.run('mean')
    const abusive = await router.run('delete invalid records')
    return { rows, english, arabic, interval, defaultLevel, unresolved, abusive }
  })
  expect(results.rows).toMatchObject({ status: 'completed', evidence: { source: 'datasetProfile', value: 5 } })
  const mean = { status: 'completed', operation: 'mean',
    evidence: { source: 'statisticsWorker', result: { value: 20, valid: 3, missingOnly: 1, invalid: 1 } } }
  expect(results.english).toMatchObject(mean)
  expect(results.arabic).toMatchObject(mean)
  expect(results.interval).toMatchObject({ status: 'completed', evidence: { confidence: 'explicit',
    result: { request: { method: 'meanInterval', level: 99 }, estimate: 20, degrees: 2 } } })
  expect(results.defaultLevel).toMatchObject({ status: 'completed', evidence: { confidence: 'default',
    result: { request: { method: 'oneSample', level: 95, nullMean: 19.25 } } } })
  expect(results.unresolved).toMatchObject({ status: 'needs_clarification', stage: 'interpretation' })
  expect(results.abusive).toMatchObject({ status: 'unsupported', stage: 'interpretation', reason: 'dataModification' })
  expect(await workers(page)).toEqual([5, 5])

  await upload(page, 'salary,group\n10,Team\n20,Team\n30,team\n40,team\n60,LocalOnlyRouterCell')
  await expect(page.getByTestId('mean')).toHaveText('32')
  const welch = await page.evaluate(async () => {
    const { router } = window.askoraRouterTest
    return [
      await router.run('Welch test for salary by group comparing "Team" and "team"'),
      await router.run('Welch test for salary by group comparing "Team" and "TEAM"'),
    ]
  })
  expect(welch[0]).toMatchObject({ status: 'completed', evidence: { result: { estimate: -20, outsideGroups: 1,
    counts: [{ valid: 2, missing: 0, invalid: 0 }, { valid: 2, missing: 0, invalid: 0 }] } } })
  expect(welch[1]).toMatchObject({ status: 'needs_clarification', stage: 'validation',
    reason: 'absentGroups', groups: ['TEAM'], excluded: 3 })
  expect(await workers(page)).toEqual([8, 8])
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(async () => [
    localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length,
  ])).toEqual([0, 0, 0, 0])
  expect(requests.filter(request => request.url.startsWith('http')).every(request =>
    request.method === 'GET' && request.body === null && !request.url.includes('LocalOnlyRouterCell') &&
    new URL(request.url).origin === origin && /^\/(?:assets\/[^?]+)?$/.test(new URL(request.url).pathname),
  )).toBe(true)
})

test('file replacement, schema overrides and clear invalidate prepared and in-flight requests', async ({ page, context }) => {
  await instrument(page)
  await page.goto(origin)
  await upload(page, 'salary,age\n10,1\n20,2')
  await expect(page.getByTestId('mean')).toHaveText('15')
  const beforeOverride = await page.evaluateHandle(() => window.askoraRouterTest.router.prepare('mean age'))
  await page.getByRole('combobox', { name: /Schema override.*age/ }).selectOption('text')
  await expect(page.getByRole('combobox', { name: /Schema override.*age/ })).toHaveValue('text')
  expect(await page.evaluate(candidate => window.askoraRouterTest.router.execute(candidate), beforeOverride))
    .toMatchObject({ status: 'failed', stage: 'validation', reason: 'staleRevision' })
  expect(await page.evaluate(() => window.askoraRouterTest.router.run('mean age')))
    .toMatchObject({ status: 'needs_clarification', stage: 'interpretation' })
  await beforeOverride.dispose()

  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const load = context.waitForEvent('request', { predicate: request => /\/parse\.worker-/.test(request.url()) })
  const old = await page.evaluateHandle(() => ({ promise: window.askoraRouterTest.router.run('mean salary') }))
  await load
  await context.unroute(parser)
  await upload(page, 'salary,age\n40,1\n50,2')
  await expect(page.getByTestId('mean')).toHaveText('45')
  expect(await page.evaluate(handle => handle.promise, old)).toMatchObject({ status: 'cancelled', reason: 'datasetChanged' })
  await old.dispose()
  expect(await page.evaluate(() => window.askoraRouterTest.router.run('mean salary')))
    .toMatchObject({ status: 'completed', evidence: { result: { value: 45 } } })
  expect(await workers(page)).toEqual([5, 5])
  expect(await page.evaluate(async () => {
    window.askoraRouterTest.clear()
    return window.askoraRouterTest.router.run('mean salary')
  })).toMatchObject({ status: 'failed', stage: 'validation', reason: 'noDataset' })
})

test('user cancellation, supersession, worker startup failure and retry clean up', async ({ page, context }) => {
  await instrument(page)
  await page.goto(origin)
  await page.locator('input[type=file]').setInputFiles(salaryFile)
  await expect(page.getByTestId('mean')).toHaveText('20')
  await context.route(parser, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const results = await page.evaluate(async () => {
    const { router } = window.askoraRouterTest
    const controller = new AbortController()
    const request = router.run('mean salary', controller.signal)
    controller.abort()
    const user = await request
    const older = router.run('mean salary')
    const current = await router.run('How many rows?')
    return { user, older: await older, current }
  })
  expect(results.user).toMatchObject({ status: 'cancelled', reason: 'user' })
  expect(results.older).toMatchObject({ status: 'cancelled', reason: 'superseded' })
  expect(results.current).toMatchObject({ status: 'completed', evidence: { value: 5 } })
  expect(await workers(page)).toEqual([3, 3])
  await context.unroute(parser)
  await context.route(parser, route => route.abort())
  expect(await page.evaluate(() => window.askoraRouterTest.router.run('mean salary')))
    .toMatchObject({ status: 'failed', stage: 'execution', reason: 'read' })
  await context.unroute(parser)
  expect(await page.evaluate(() => window.askoraRouterTest.router.run('mean salary')))
    .toMatchObject({ status: 'completed', evidence: { result: { value: 20 } } })
  expect(await workers(page)).toEqual([5, 5])
})

test('large paired router execution remains bounded and completes after worker cleanup', async ({ page, browserName }) => {
  await instrument(page)
  await page.goto(origin)
  const csv = 'salary,age,group\n' + '10,1,A\n20,2,B\n30,3,C\n40,4,D\n'.repeat(20000)
  await upload(page, csv)
  await expect(page.getByTestId('rows')).toHaveText('80,000')
  const timings: number[] = []
  for (let i = 0; i < 3; i++) {
    const started = performance.now()
    const result = await page.evaluate(() => window.askoraRouterTest.router.run('correlation between salary and age'))
    timings.push(Math.round(performance.now() - started))
    expect(result).toMatchObject({ status: 'completed', evidence: { result: { value: 1, valid: 80000, excluded: 0 } } })
    expect(result).not.toHaveProperty('evidence.result.scatter')
  }
  expect(await workers(page)).toEqual([4, 4])
  console.log(JSON.stringify({ browserName, rows: 80000, bytes: Buffer.byteLength(csv), timings }))
})
