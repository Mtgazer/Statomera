import { defineConfig } from '@playwright/test'

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
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
  },
})
