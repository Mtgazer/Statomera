import { AsyncDuckDB, DuckDBAccessMode, VoidLogger } from '@duckdb/duckdb-wasm'
import wasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import engineUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import { CsvError, limits, validateFile } from './csv.ts'
import type { InputError, Profile } from './csv.ts'

export type AnalysisErrorCode = InputError | 'read' | 'engine' | 'timeout' | 'cancelled'

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode

  constructor(code: AnalysisErrorCode) {
    super(code)
    this.code = code
  }
}

export type ParserReply =
  | { ok: true; profile: Profile; numericCsv: string; parseMs: number }
  | { ok: false; error: InputError | 'read' }

export type AnalysisResult = Profile & {
  mean: number | null
  timings: { parseMs: number; engineMs: number; queryMs: number }
}

const observationsFile = 'observations.csv'

// All names and SQL are fixed. Only canonical, finite numeric tokens enter this file.
const meanQuery = `
  WITH observations AS (
    SELECT value
    FROM read_csv('observations.csv', columns = {'value': 'DOUBLE'},
      header = false, auto_detect = false)
  ), magnitude AS (
    SELECT max(abs(value)) AS scale FROM observations
  )
  SELECT count(*) AS valid,
    CASE
      WHEN isfinite(favg(value)) THEN favg(value)
      WHEN max(scale) = 0 THEN 0
      ELSE favg(value / scale) * max(scale)
    END AS mean
  FROM observations CROSS JOIN magnitude
`

export function analyzeFile(file: File, signal: AbortSignal): Promise<AnalysisResult> {
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

    async function calculate({ profile, numericCsv, parseMs }: Extract<ParserReply, { ok: true }>) {
      const timings = { parseMs, engineMs: 0, queryMs: 0 }
      if (!profile.valid) {
        succeed({ ...profile, mean: null, timings })
        return
      }

      try {
        const start = performance.now()
        worker = new Worker(engineUrl)
        worker.addEventListener('error', () => fail('engine'))
        worker.addEventListener('messageerror', () => fail('engine'))
        const db = new AsyncDuckDB(new VoidLogger(), worker)
        await db.instantiate(wasmUrl)
        await db.open({ accessMode: DuckDBAccessMode.READ_WRITE, maximumThreads: 1 })
        const connection = await db.connect()
        await connection.query('SET autoload_known_extensions=false')
        await connection.query('SET autoinstall_known_extensions=false')
        await db.registerFileText(observationsFile, numericCsv)
        timings.engineMs = performance.now() - start

        const queryStart = performance.now()
        const table = await connection.query(meanQuery)
        const row = table.get(0)
        const mean = row?.mean
        if (Number(row?.valid) !== profile.valid || typeof mean !== 'number' || !Number.isFinite(mean)) {
          fail('engine')
          return
        }
        timings.queryMs = performance.now() - queryStart
        await connection.close()
        await db.dropFile(observationsFile)
        succeed({ ...profile, mean, timings })
      } catch {
        fail('engine')
      }
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
      worker.onmessage = ({ data }: MessageEvent<ParserReply>) => {
        if (finished) return
        worker?.terminate()
        worker = undefined
        if (data.ok) void calculate(data)
        else fail(data.error)
      }
      worker.postMessage(file)
    } catch (error) {
      fail(error instanceof CsvError ? error.code : 'read')
    }
  })
}
