import { defineConfig } from 'vite'

const headers = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
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

export default defineConfig({
  base: './',
  plugins: [{
    name: 'askora-preview-security-headers',
    configurePreviewServer(server) {
      // Set headers before static file handling, including conditional responses.
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
        next()
      })
    },
  }],
})
