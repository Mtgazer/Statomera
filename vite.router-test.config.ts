import { defineConfig } from 'vite'
import appConfig from './vite.config.ts'

export default defineConfig(env => {
  if (env.mode !== 'portable') throw new Error('Use the portable mode for the isolated router harness')
  const config = appConfig(env)
  return {
    ...config,
    build: { ...config.build, outDir: 'dist-router-test' },
    plugins: [...(config.plugins ?? []), {
      name: 'askora-router-test-entry',
      transformIndexHtml: {
        order: 'pre',
        handler: html => html.replace('/src/main.tsx', '/tests/browser/router-harness.tsx'),
      },
    }],
  }
})
