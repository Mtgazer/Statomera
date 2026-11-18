import { defineConfig } from '@playwright/test'

const mode = process.env.ASKORA_TEST_MODE ?? 'production'
if (!['production', 'portable', 'duckdb-eh'].includes(mode)) throw new Error('Unknown browser test mode')

const routerHarness = process.env.ASKORA_ROUTER_TEST === '1'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  testIgnore: routerHarness ? [] : ['**/router.spec.ts'],
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: process.env.ASKORA_BROWSER_CHANNEL } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: [{
    command: `npm run preview -- --mode ${mode} --host 127.0.0.1 --port 4173 --strictPort`,
    url: 'http://127.0.0.1:4173',
  }, ...(routerHarness ? [{
    command: 'npm run preview -- --config vite.router-test.config.ts --mode portable --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
  }] : [])],
})
