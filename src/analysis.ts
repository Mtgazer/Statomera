import { CsvError, limits, validateFile } from './csv.ts'
import type { InputError } from './csv.ts'
import { defaultCsvOptions } from './dataset.ts'
import type { CsvOptions, DatasetProfile } from './dataset.ts'

import type { StatisticRequest, StatisticResult } from './statistics-contract.ts'

export type AnalysisErrorCode = InputError | 'read' | 'engine' | 'timeout' | 'cancelled'

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode

  constructor(code: AnalysisErrorCode) {
    super(code)
    this.code = code
  }
}

export type ParserReply =
  | { workbook: NonNullable<DatasetProfile['workbook']> }
  | { ok: true; statistic: StatisticResult }
  | { ok: true; result: AnalysisResult; reference?: { numericCsv: string; count: number } }
  | { ok: false; error: InputError | 'read' }

export interface ParseRequest { file: File; options: CsvOptions; statistic?: StatisticRequest }

export type AnalysisResult = DatasetProfile & {
  referenceSalaryMean?: number
  timings: { parseMs: number; engineMs: number; queryMs: number }
}

export function analyzeFile(file: File, signal: AbortSignal, options = defaultCsvOptions,
  onWorkbook?: (workbook: NonNullable<DatasetProfile['workbook']>) => void,
): Promise<AnalysisResult> {
  return runWorker({ file, options }, signal, onWorkbook)
}

export function analyzeStatistic(file: File, signal: AbortSignal, options: CsvOptions, statistic: StatisticRequest) {
  return runWorker({ file, options, statistic }, signal)
}

function runWorker(request: ParseRequest & { statistic: StatisticRequest }, signal: AbortSignal): Promise<StatisticResult>
function runWorker(request: ParseRequest, signal: AbortSignal,
  onWorkbook?: (workbook: NonNullable<DatasetProfile['workbook']>) => void): Promise<AnalysisResult>
function runWorker(request: ParseRequest, signal: AbortSignal,
  onWorkbook?: (workbook: NonNullable<DatasetProfile['workbook']>) => void,
): Promise<AnalysisResult | StatisticResult> {
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

    function succeed(result: AnalysisResult | StatisticResult) {
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
      validateFile(request.file.name, request.file.size)
      worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
      worker.onerror = () => fail('read')
      worker.onmessageerror = () => fail('read')
      worker.onmessage = async ({ data }: MessageEvent<ParserReply>) => {
        if (finished) return
        if ('workbook' in data) {
          onWorkbook?.(data.workbook)
          return
        }
        worker?.terminate()
        worker = undefined
        if (!data.ok) {
          fail(data.error)
          return
        }
        if ('statistic' in data) {
          if (request.statistic) succeed(data.statistic)
          else fail('engine')
          return
        }
        if (request.statistic) {
          fail('engine')
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
      worker.postMessage(request)
    } catch (error) {
      fail(error instanceof CsvError ? error.code : 'read')
    }
  })
}
