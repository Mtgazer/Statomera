import assert from 'node:assert/strict'
import { decodeCsv, limits } from '../src/csv.ts'
import { defaultCsvOptions } from '../src/dataset.ts'
import { normalizeCsv } from '../src/normalize.ts'
import { profileDataset } from '../src/profile.ts'

async function chunkedDecode(blob, chunkSize = 64 * 1024) {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const pieces = []
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const bytes = await blob.slice(offset, offset + chunkSize).arrayBuffer()
    pieces.push(decoder.decode(bytes, { stream: true }))
  }
  pieces.push(decoder.decode())
  return pieces.join('')
}

const [mode = 'whole', count = '80000'] = process.argv.slice(2)
const rows = Number(count)
assert.ok(['whole', 'chunked'].includes(mode))
assert.ok(Number.isInteger(rows) && rows > 0 && rows <= limits.rows)
if (mode === 'chunked') {
  const quoted = '\ufefflabel;value\r\n"ألف;😀\n""β""";3\r\n'
  const text = await chunkedDecode(new Blob([quoted]), 1)
  assert.equal(text, quoted.slice(1))
  assert.deepEqual([...normalizeCsv(text, defaultCsvOptions).records()], [['ألف;😀\n"β"', '3']])
  await assert.rejects(chunkedDecode(new Blob([Uint8Array.of(0xc3, 0x28)]), 1))
}
const blob = new Blob(['id,value,group,enabled,date\n',
  Array.from({ length: rows }, (_, index) =>
    `${index + 1},${index % 2 ? 30 : 10},${index % 2 ? 'جنوب' : 'شمال'},true,${index % 11 ? '2024-01-01' : '01/02/2024'}\n`).join('')])
assert.ok(blob.size <= limits.bytes)
const samples = []
for (let run = 0; run < 3; run++) {
  let start = performance.now()
  const text = mode === 'chunked' ? await chunkedDecode(blob) : decodeCsv(await blob.arrayBuffer())
  const dataset = normalizeCsv(text, defaultCsvOptions)
  const readMs = performance.now() - start
  start = performance.now()
  let parsedRows = 0
  for (const row of dataset.records()) parsedRows += row.length === 5 ? 1 : 0
  const parseMs = performance.now() - start
  start = performance.now()
  const result = profileDataset(dataset, () => false)
  const profileMs = performance.now() - start
  assert.equal(parsedRows, rows)
  assert.equal(result.duplicateRows, 0)
  assert.equal(result.columns[1].numeric?.mean, (Math.ceil(rows / 2) * 10 + Math.floor(rows / 2) * 30) / rows)
  samples.push({ readMs, parseMs, profileMs })
}
console.log(JSON.stringify({ mode, bytes: blob.size, rows, samples, processPeakRssKiB: process.resourceUsage().maxRSS }))
