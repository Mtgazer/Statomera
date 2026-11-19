import { expect, test } from '@playwright/test'

const priorName = /\baskora\b|أسكورا/i

test('STATOMERA identity and local SVG assets work in English and Arabic', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain("img-src 'self'")
  await expect(page).toHaveTitle('STATOMERA — Statistical Data Intelligence')
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'STATOMERA')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /trace findings to verified evidence/)
  const banner = page.getByRole('banner')
  const wordmark = banner.getByText('STATOMERA', { exact: true })
  await expect(wordmark).toBeVisible()
  await expect(wordmark).toHaveAttribute('lang', 'en')
  await expect(wordmark).toHaveAttribute('dir', 'ltr')
  await expect(banner.getByText('Statistical Data Intelligence')).toBeVisible()
  await expect(banner.getByRole('img')).toHaveCount(0)

  const images = await page.evaluate(async () => {
    const mark = document.querySelector<HTMLImageElement>('header img')!
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!
    const favicon = new Image()
    favicon.src = icon.href
    await Promise.all([mark.decode(), favicon.decode()])
    return [mark.src, mark.naturalWidth, favicon.src, favicon.naturalWidth] as const
  })
  const [mark, markWidth, favicon, faviconWidth] = images
  expect(new URL(mark).pathname).toBe('/assets/statomera-mark.svg')
  expect(new URL(favicon).pathname).toBe('/assets/statomera-favicon.svg')
  expect(markWidth).toBeGreaterThan(0)
  expect(faviconWidth).toBeGreaterThan(0)
  const primary = new URL('statomera-primary.svg', mark).href
  for (const asset of [mark, favicon, primary]) {
    expect(new URL(asset).origin).toBe(new URL(page.url()).origin)
    const result = await request.get(asset)
    expect(result.ok()).toBe(true)
    expect(result.headers()['content-type']).toContain('image/svg+xml')
    const svg = await result.text()
    expect(svg).toMatch(/<title[^>]*>STATOMERA/)
    expect(svg).toMatch(/<desc[^>]*>[^<]+<\/desc>/)
  }

  const root = page.locator('html')
  await expect(root).toHaveAttribute('lang', 'en')
  await expect(root).toHaveAttribute('dir', 'ltr')
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).not.toContainText(priorName)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)

  await page.getByLabel('Theme').selectOption('light')
  await page.getByLabel('Language').selectOption('ar')
  await expect(root).toHaveAttribute('data-theme', 'light')
  await expect(root).toHaveAttribute('lang', 'ar')
  await expect(root).toHaveAttribute('dir', 'rtl')
  await expect(wordmark).toHaveAttribute('dir', 'ltr')
  await expect(banner.getByText('ذكاء البيانات الإحصائية')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(priorName)
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  }
})

test('STATOMERA preserves same-origin storage and existing dataset lifetime', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('existing-origin-preference', 'local sentinel')
    sessionStorage.setItem('existing-tab-preference', 'tab sentinel')
  })
  await page.reload()
  const input = page.locator('input[type=file]')
  await input.setInputFiles({ name: 'brand-smoke.csv', mimeType: 'text/csv', buffer: Buffer.from('salary\n10\n20\n30') })
  await expect(page.getByTestId('mean')).toHaveText('20')
  const question = page.locator('#conversation').getByRole('textbox')
  await question.fill('How many rows?')
  await question.press('Enter')
  const answer = page.locator('#conversation .conversation-reply')
  await expect(answer.getByText('STATOMERA', { exact: true })).toBeVisible()
  await expect(answer).toContainText('Count3')
  await page.getByLabel('Language').selectOption('ar')
  await expect(answer.getByText('STATOMERA', { exact: true })).toBeVisible()
  await expect(answer).not.toContainText(priorName)
  await expect(page.getByTestId('mean')).toHaveAttribute('data-value', '20')

  const storage = () => page.evaluate(async () => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    databases: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
    cookies: document.cookie,
  }))
  const expected = {
    local: [['existing-origin-preference', 'local sentinel']],
    session: [['existing-tab-preference', 'tab sentinel']],
    databases: 0, caches: 0, cookies: '',
  }
  expect(await storage()).toEqual(expected)
  await page.reload()
  await expect(page.getByTestId('mean')).toHaveCount(0)
  await expect(page.locator('#conversation')).toHaveCount(0)
  expect(await storage()).toEqual(expected)
})
