import { defineConfig } from '@playwright/test'

const mode = process.env.ASKORA_TEST_MODE ?? 'production'
if (!['production', 'portable', 'duckdb-eh'].includes(mode)) throw new Error('Unknown browser test mode')

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: process.env.ASKORA_BROWSER_CHANNEL } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: `npm run preview -- --mode ${mode} --host 127.0.0.1 --port 4173 --strictPort`,
    url: 'http://127.0.0.1:4173',
  },
})
