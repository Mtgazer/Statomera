import type { FrequencySummary, NumericSummary } from './dataset.ts'
import { Binary64Mean } from './mean.ts'
import { quantile } from './quantiles.ts'

export function summarizeNumbers(values: Float64Array): NumericSummary | null {
  if (!values.length) return null
  const calculator = new Binary64Mean()
  for (const value of values) calculator.add(value)
  const mean = calculator.result()!
  values.sort()
  const median = quantile(values, 50).value
  return { count: values.length, mean, min: values[0], max: values[values.length - 1], median }
}

const displayedCategories = 8

export function summarizeFrequencies(frequencies: Map<string, number>): FrequencySummary {
  const entries = Array.from(frequencies, ([value, count]) => ({ value, count }))
  entries.sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
  return { distinct: entries.length, entries: entries.slice(0, displayedCategories),
    omitted: Math.max(0, entries.length - displayedCategories) }
}
