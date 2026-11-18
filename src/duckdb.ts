import { AsyncDuckDB, DuckDBAccessMode, VoidLogger } from '@duckdb/duckdb-wasm'
import wasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import engineUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import type { AnalysisResult } from './analysis.ts'

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

export function startDuckDb(
  profile: AnalysisResult,
  { numericCsv, count }: { numericCsv: string; count: number },
  onError: () => void,
) {
  const start = performance.now()
  const worker = new Worker(engineUrl)
  worker.addEventListener('error', onError)
  worker.addEventListener('messageerror', onError)
  return { worker, result: calculate() }

  async function calculate(): Promise<AnalysisResult> {
    const db = new AsyncDuckDB(new VoidLogger(), worker)
    await db.instantiate(wasmUrl)
    await db.open({ accessMode: DuckDBAccessMode.READ_WRITE, maximumThreads: 1 })
    const connection = await db.connect()
    await connection.query('SET autoload_known_extensions=false')
    await connection.query('SET autoinstall_known_extensions=false')
    await db.registerFileText(observationsFile, numericCsv)
    const engineMs = performance.now() - start

    const queryStart = performance.now()
    const table = await connection.query(meanQuery)
    const row = table.get(0)
    const mean = row?.mean
    if (Number(row?.valid) !== count || typeof mean !== 'number' || !Number.isFinite(mean)) {
      throw new Error('Unexpected engine result')
    }
    const queryMs = performance.now() - queryStart
    await connection.close()
    await db.dropFile(observationsFile)
    return { ...profile, referenceSalaryMean: mean, timings: {
      parseMs: profile.timings.parseMs, engineMs, queryMs: profile.timings.queryMs + queryMs,
    } }
  }
}
