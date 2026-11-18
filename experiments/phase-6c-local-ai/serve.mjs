import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'model-manifest.json')))
const modelRoot = `/models/${manifest.repository}/`
const allowed = new Map(manifest.files.map(file => [modelRoot + file.path, `assets${modelRoot}${file.path}`]))
for (const flavor of ['asyncify', 'jsep']) for (const ext of ['mjs', 'wasm']) {
  const basename = `ort-wasm-simd-threaded.${flavor}.${ext}`
  allowed.set('/runtime/' + basename, 'assets/runtime/' + basename)
}
allowed.set('/ready.json', 'assets/ready.json')
const port = Number(process.env.ASKORA_6C_PORT ?? 4166)
const mime = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  css: 'text/css', wasm: 'application/wasm', onnx: 'application/octet-stream' }

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
  if (request.headers.host !== `127.0.0.1:${port}` || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(403).end()
    return
  }
  const path = request.url
  const relative = path === '/' ? 'dist/index.html'
    : allowed.get(path) ?? (/^\/assets\/[\w.-]+\.(?:js|css)$/.test(path) ? 'dist' + path : null)
  if (!relative) return response.writeHead(404).end()
  const target = resolve(root, relative)
  const file = await stat(target).catch(() => null)
  if (!file?.isFile()) return response.writeHead(404).end()
  response.writeHead(200, { 'Content-Type': mime[target.split('.').at(-1)] ?? 'application/octet-stream',
    'Content-Length': file.size })
  if (request.method === 'HEAD') return response.end()
  const body = createReadStream(target)
  response.on('close', () => body.destroy())
  body.on('error', () => response.destroy())
  body.pipe(response)
})

server.listen(port, '127.0.0.1', () => console.log(`Askora Phase 6C · http://127.0.0.1:${port}`))
