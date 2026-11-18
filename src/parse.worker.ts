import { CsvError, decodeCsv, profileCsv, validateFile } from './csv.ts'
import type { ParserReply } from './analysis.ts'

self.onmessage = async ({ data }: MessageEvent<File>) => {
  const file = data
  let reply: ParserReply
  try {
    validateFile(file.name, file.size)
    const start = performance.now()
    const bytes = await file.arrayBuffer()
    const parsed = profileCsv(decodeCsv(bytes))
    reply = { ok: true, ...parsed, parseMs: performance.now() - start }
  } catch (error) {
    reply = { ok: false, error: error instanceof CsvError ? error.code : 'read' }
  }
  self.postMessage(reply)
}
