import type { ColumnProfile } from './dataset.ts'

export const patternLimit = 256
export const displayedPatterns = 8
export const substantialMissingRate = 0.2
const dominanceRate = 0.95
const minimumSample = 8

export type QualityFinding = 'missing' | 'substantialMissing' | 'invalid' | 'ambiguous' | 'outliers' | 'constant' | 'lowVariation'

export interface NumericQuality {
  bins: { upper: number; count: number }[]
  outliers:
    | { status: 'smallSample' | 'constant' | 'zeroIqr' | 'range' }
    | { status: 'assessed'; q1: number; q3: number; lower: number; upper: number; below: number; above: number }
}

function interpolate(left: number, right: number, fraction: number) {
  return left < 0 && right > 0
    ? left * (1 - fraction) + right * fraction
    : left + (right - left) * fraction
}

// Receives the same sorted valid observations used by the exact median.
export function describeNumbers(values: Float64Array): NumericQuality {
  const min = values[0]
  const max = values[values.length - 1]
  const bins: NumericQuality['bins'] = []
  let cursor = 0
  for (let i = 1; i <= 8; i++) {
    const upper = i === 8 ? max : interpolate(min, max, i / 8)
    if (bins.at(-1)?.upper === upper) continue
    const start = cursor
    while (cursor < values.length && values[cursor] <= upper) cursor++
    bins.push({ upper, count: cursor - start })
  }
  if (min === max) return { bins, outliers: { status: 'constant' } }
  if (values.length < minimumSample) return { bins, outliers: { status: 'smallSample' } }

  function quartile(fraction: number) {
    const position = (values.length - 1) * fraction
    const index = Math.floor(position)
    return interpolate(values[index], values[index + 1], position - index)
  }
  const q1 = quartile(0.25)
  const q3 = quartile(0.75)
  const iqr = q3 - q1
  if (iqr === 0) return { bins, outliers: { status: 'zeroIqr' } }
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return { bins, outliers: { status: 'range' } }
  let below = 0
  let above = 0
  while (values[below] < lower) below++
  while (values[values.length - 1 - above] > upper) above++
  return { bins, outliers: { status: 'assessed', q1, q3, lower, upper, below, above } }
}

export function columnFindings(column: ColumnProfile, rate: number | null, counts: Map<string, number> | null) {
  const findings: QualityFinding[] = []
  if (rate) findings.push(rate >= substantialMissingRate ? 'substantialMissing' : 'missing')
  if (column.invalid) findings.push('invalid')
  if (column.warnings.some(warning => warning !== 'manyCategories')) findings.push('ambiguous')
  const outliers = column.distribution?.outliers
  if (outliers?.status === 'assessed' && (outliers.below || outliers.above)) findings.push('outliers')
  if (column.valid >= 2 && column.distinct === 1) findings.push('constant')
  if (column.valid >= 20 && counts && counts.size > 1 &&
      [...counts.values()].some(count => count / column.valid >= dominanceRate)) findings.push('lowVariation')
  return findings
}
