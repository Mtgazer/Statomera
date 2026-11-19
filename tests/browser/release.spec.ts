import { expect, test } from '@playwright/test'

test('release disclosures and third-party notices are available in both layouts', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await expect(page.getByText(/File contents stay in this tab.*such as your IP address/)).toBeVisible()
  const notices = page.getByRole('link', { name: 'Third-party notices' })
  const path = new URL((await notices.getAttribute('href'))!, page.url()).href
  expect(path).toBe(new URL('/third-party-notices.txt', page.url()).href)
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toMatch(/^text\/plain\b/)
  const text = await response.text()
  for (const license of ['React 19.2.8', 'SheetJS CE (xlsx) 0.20.3', 'zip.js 2.25.0', 'zlib-streams-ts', 'Apache License', 'BSD 3-Clause', 'MIT License']) {
    expect(text).toContain(license)
  }
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByText(/يتلقّى مضيف الموقع معلومات الطلب المعتادة/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'إشعارات الجهات الخارجية' })).toHaveAttribute('href', './third-party-notices.txt')
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
})

test('portable app and worker apply static CSP and keep dataset activity local', async ({ page, context }) => {
  test.skip(process.env.ASKORA_TEST_MODE !== 'portable', 'The release candidate is the portable build')
  const requests: { url: string; method: string; body: string | null }[] = []
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }))
  const home = await page.goto('/')
  const policy = home?.headers()['content-security-policy'] ?? ''
  for (const directive of ["default-src 'none'", "script-src 'self'", "connect-src 'self'", "worker-src 'self'", "frame-ancestors 'none'", "form-action 'none'"]) {
    expect(policy.split('; ')).toContain(directive)
  }
  const worker = context.waitForEvent('response', { predicate: response => /\/assets\/parse\.worker-.*\.js$/.test(response.url()) })
  await page.locator('input[type=file]').setInputFiles({
    name: 'Phase8PrivateFilename.csv', mimeType: 'text/csv', buffer: Buffer.from('employee,salary\nPhase8PrivateValue,20'),
  })
  await expect(page.getByTestId('mean')).toHaveText('20')
  const headers = await (await worker).allHeaders()
  expect(headers['content-type']).toMatch(/^(?:text|application)\/javascript\b/)
  expect(headers['content-security-policy']).toBe(policy)
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('no-referrer')

  const ask = page.locator('#conversation').getByRole('textbox')
  await ask.fill('How many rows?')
  await ask.press('Enter')
  await expect(page.locator('#conversation')).toContainText('Count1')
  const origin = new URL(page.url()).origin
  const network = requests.filter(({ url }) => /^https?:/.test(url))
  expect(network.length).toBeGreaterThan(0)
  expect(network.every(({ url, method, body }) => {
    const address = new URL(url)
    return address.origin === origin && /^\/(?:assets\/[^/]+)?$/.test(address.pathname) && !address.search &&
      method === 'GET' && body === null && !/Phase8Private|How many rows/i.test(decodeURI(url))
  })).toBe(true)
  expect(await page.evaluate(async () => [localStorage.length, sessionStorage.length,
    (await indexedDB.databases()).length, (await caches.keys()).length])).toEqual([0, 0, 0, 0])
  expect(await context.cookies()).toEqual([])
})
