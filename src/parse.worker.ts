import { CsvError, decodeCsv, profileCsv, validateFile } from './csv.ts'
import { Binary64Mean } from './mean.ts'
import type { ParserReply } from './analysis.ts'

self.onmessage = async ({ data }: MessageEvent<File>) => {
  const file = data
  let reply: ParserReply
  try {
    validateFile(file.name, file.size)
    const start = performance.now()
    const bytes = await file.arrayBuffer()
    const text = decodeCsv(bytes)
    if (import.meta.env.MODE === 'portable') {
      const accumulator = new Binary64Mean()
      const { profile } = profileCsv(text, value => accumulator.add(value))
      const parseMs = performance.now() - start
      const mean = accumulator.result()
      reply = { ok: true, result: { ...profile, mean, timings: {
        parseMs, engineMs: 0, queryMs: performance.now() - start - parseMs,
      } } }
    } else {
      const parsed = profileCsv(text)
      reply = { ok: true, ...parsed, parseMs: performance.now() - start }
    }
  } catch (error) {
    reply = { ok: false, error: error instanceof CsvError ? error.code : 'read' }
  }
  self.postMessage(reply)
}
