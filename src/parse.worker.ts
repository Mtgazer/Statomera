import { CsvError, decodeCsv, validateFile } from './csv.ts'
import { missingPolicy, normalizeCsv } from './normalize.ts'
import { profileDataset } from './profile.ts'
import type { DatasetProfile } from './dataset.ts'
import type { ParserReply, ParseRequest } from './analysis.ts'

self.onmessage = async ({ data: { file, options, statistic } }: MessageEvent<ParseRequest>) => {
  let reply: ParserReply
  try {
    const format = validateFile(file.name, file.size)
    const start = performance.now()
    const isMarker = missingPolicy(options.missingMarkers)
    let workbook: DatasetProfile['workbook']
    const dataset = format === 'xlsx'
      ? await (await import('./xlsx.ts')).normalizeXlsx(file, options, value => {
        workbook = value
        if (statistic === undefined) self.postMessage({ workbook: value } satisfies ParserReply)
      })
      : await readTextDataset()
    async function readTextDataset() {
      const text = decodeCsv(await file.arrayBuffer())
      return format === 'json' ? (await import('./json.ts')).normalizeJson(text, options) : normalizeCsv(text, options)
    }
    if (statistic !== undefined) {
      const { calculateStatistic } = await import('./statistics.ts')
      const result = calculateStatistic(dataset, isMarker, options.schemaOverrides ?? {}, statistic)
      self.postMessage({ ok: true, statistic: result } satisfies ParserReply)
      return
    }
    const observations: string[] = []
    const collect = import.meta.env.MODE === 'portable' ? undefined
      : (value: number) => observations.push(String(value))
    const profile = profileDataset(dataset, isMarker, collect, options.schemaOverrides)
    const result = { ...profile, workbook, timings: { parseMs: performance.now() - start, engineMs: 0, queryMs: 0 } }
    reply = { ok: true, result }
    if (import.meta.env.MODE !== 'portable' && observations.length) {
      reply.reference = { numericCsv: observations.join('\n'), count: observations.length }
    }
  } catch (error) {
    reply = { ok: false, error: error instanceof CsvError ? error.code : 'read' }
  }
  self.postMessage(reply)
}
