import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

const { columns, cases } = JSON.parse(await readFile('../phase-6b-local-ai/benchmark.json'))
const reference = readFileSync(0, 'utf8').trimEnd()
const split = reference.lastIndexOf('\n')
const example = JSON.parse(reference.slice(split + 1))
if (example.question !== cases[0][2]) throw new Error('Phase 6B prompt format changed')
await mkdir('generated', { recursive: true })
await writeFile('generated/corpus.json', JSON.stringify({
  columns, cases: cases.map(([id, language, question]) => ({ id, language, question })),
  instructions: reference.slice(0, split),
}))
await mkdir('assets/runtime', { recursive: true })
for (const flavor of ['asyncify', 'jsep']) {
  for (const ext of ['mjs', 'wasm']) {
    const name = `ort-wasm-simd-threaded.${flavor}.${ext}`
    await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `assets/runtime/${name}`)
  }
}
