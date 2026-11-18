import { CsvError, limits, validateFile } from './csv.ts'
import type { InputError } from './csv.ts'
import { defaultCsvOptions } from './dataset.ts'
import type { CsvOptions, DatasetProfile } from './dataset.ts'

export type AnalysisErrorCode = InputError | 'read' | 'engine' | 'timeout' | 'cancelled'

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode

  constructor(code: AnalysisErrorCode) {
    super(code)
    this.code = code
  }
}

export type ParserReply =
  | { ok: true; result: AnalysisResult; reference?: { numericCsv: string; count: number } }
  | { ok: false; error: InputError | 'read' }

export interface ParseRequest { file: File; options: CsvOptions }

export type AnalysisResult = DatasetProfile & {
  referenceSalaryMean?: number
  timings: { parseMs: number; engineMs: number; queryMs: number }
}

export function analyzeFile(file: File, signal: AbortSignal, options = defaultCsvOptions): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined
    let finished = false
    const timer = window.setTimeout(() => fail('timeout'), limits.milliseconds)

    function cleanup() {
      finished = true
      window.clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      worker?.terminate()
      worker = undefined
    }

    function fail(code: AnalysisErrorCode) {
      if (finished) return
      cleanup()
      reject(new AnalysisError(code))
    }

    function cancel() {
      fail('cancelled')
    }

    function succeed(result: AnalysisResult) {
      if (finished) return
      cleanup()
      resolve(result)
    }

    if (signal.aborted) {
      cancel()
      return
    }
    signal.addEventListener('abort', cancel, { once: true })

    try {
      validateFile(file.name, file.size)
      worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
      worker.onerror = () => fail('read')
      worker.onmessageerror = () => fail('read')
      worker.onmessage = async ({ data }: MessageEvent<ParserReply>) => {
        if (finished) return
        worker?.terminate()
        worker = undefined
        if (!data.ok) {
          fail(data.error)
          return
        }
        if (import.meta.env.MODE !== 'portable' && data.reference?.count) {
          try {
            const { startDuckDb } = await import('./duckdb.ts')
            if (finished) return
            const engine = startDuckDb(data.result, data.reference, () => fail('engine'))
            worker = engine.worker
            succeed(await engine.result)
          } catch {
            fail('engine')
          }
          return
        }
        succeed(data.result)
      }
      worker.postMessage({ file, options } satisfies ParseRequest)
    } catch (error) {
      fail(error instanceof CsvError ? error.code : 'read')
    }
  })
}
