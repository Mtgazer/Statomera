import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const manifest = JSON.parse(await readFile(new URL('./model-manifest.json', import.meta.url)))
const root = new URL(`./assets/models/${manifest.repository}/`, import.meta.url)
const ready = new URL('./assets/ready.json', import.meta.url)

async function matches(path, file) {
  if ((await stat(path).catch(() => null))?.size !== file.bytes) return false
  const hash = createHash(file.sha256 ? 'sha256' : 'sha1')
  if (file.gitBlob) hash.update(`blob ${file.bytes}\0`)
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex') === (file.sha256 ?? file.gitBlob)
}

async function download(file) {
  const destination = new URL(file.path, root)
  if (await matches(destination, file)) return
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true })
  const partial = new URL(destination.href + '.part')
  try {
    const source = `https://huggingface.co/${manifest.repository}/resolve/${manifest.revision}/${file.path}`
    console.log(`Downloading ${file.path} · ${file.bytes.toLocaleString('en')} bytes`)
    await new Promise((resolve, reject) => {
      const curl = spawn('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '900',
        '--proto', '=https', '--proto-redir', '=https', '--output', fileURLToPath(partial), source],
      { stdio: 'inherit' })
      const interrupt = () => curl.kill('SIGTERM')
      process.once('SIGINT', interrupt)
      process.once('SIGTERM', interrupt)
      curl.once('error', reject)
      curl.once('close', code => {
        process.off('SIGINT', interrupt)
        process.off('SIGTERM', interrupt)
        if (code === 0) resolve()
        else reject(new Error(`Download did not complete for ${file.path}`))
      })
    })
    if (!await matches(partial, file)) throw new Error(`Integrity check failed for ${file.path}`)
    await rename(partial, destination)
  } finally {
    await rm(partial, { force: true })
  }
}

await rm(ready, { force: true })
for (const file of manifest.files) await download(file)
const bytes = manifest.files.reduce((total, file) => total + file.bytes, 0)
await writeFile(ready, JSON.stringify({ revision: manifest.revision, bytes }))
console.log(`Verified ${bytes.toLocaleString('en')} model and tokenizer bytes`)
