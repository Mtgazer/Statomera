import { defineConfig } from 'vite'

function securityHeaders(portable: boolean) {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      portable ? "script-src 'self'" : "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }
}

export default defineConfig(({ mode }) => ({
  build: { outDir: mode === 'portable' ? 'dist-portable' : mode === 'duckdb-eh' ? 'dist-eh' : 'dist' },
  resolve: {
    alias: mode === 'duckdb-eh' ? [
      { find: /^@duckdb\/duckdb-wasm\/dist\/duckdb-mvp\.wasm(?=\?|$)/, replacement: '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm' },
      { find: /^@duckdb\/duckdb-wasm\/dist\/duckdb-browser-mvp\.worker\.js(?=\?|$)/, replacement: '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js' },
    ] : [],
  },
  worker: { format: 'es' },
  base: './',
  plugins: [{
    name: 'askora-static-security-headers',
    generateBundle() {
      if (mode !== 'portable') return
      const lines = Object.entries(securityHeaders(true)).map(([name, value]) => `  ${name}: ${value}`)
      this.emitFile({ type: 'asset', fileName: '_headers', source: ['/*', ...lines, ''].join('\n') })
    },
    configurePreviewServer(server) {
      // Set headers before static file handling, including conditional responses.
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of Object.entries(securityHeaders(mode === 'portable'))) response.setHeader(name, value)
        next()
      })
    },
  }],
}))
