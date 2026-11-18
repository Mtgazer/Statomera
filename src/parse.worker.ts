import { CsvError, decodeCsv, validateFile } from './csv.ts'
import { missingPolicy, normalizeCsv } from './normalize.ts'
import { profileDataset } from './profile.ts'
import type { ParserReply, ParseRequest } from './analysis.ts'

self.onmessage = async ({ data: { file, options } }: MessageEvent<ParseRequest>) => {
  let reply: ParserReply
  try {
    validateFile(file.name, file.size)
    const start = performance.now()
    const isMarker = missingPolicy(options.missingMarkers)
    const bytes = await file.arrayBuffer()
    const dataset = normalizeCsv(decodeCsv(bytes), options)
    const observations: string[] = []
    const collect = import.meta.env.MODE === 'portable' ? undefined
      : (value: number) => observations.push(String(value))
    const profile = profileDataset(dataset, isMarker, collect)
    const result = { ...profile, timings: { parseMs: performance.now() - start, engineMs: 0, queryMs: 0 } }
    reply = { ok: true, result }
    if (import.meta.env.MODE !== 'portable' && observations.length) {
      reply.reference = { numericCsv: observations.join('\n'), count: observations.length }
    }
  } catch (error) {
    reply = { ok: false, error: error instanceof CsvError ? error.code : 'read' }
  }
  self.postMessage(reply)
}
