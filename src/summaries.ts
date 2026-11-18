import type { FrequencySummary, NumericSummary } from './dataset.ts'
import { Binary64Mean } from './mean.ts'

export function summarizeNumbers(values: number[]): NumericSummary | null {
  if (!values.length) return null
  const calculator = new Binary64Mean()
  for (const value of values) calculator.add(value)
  const mean = calculator.result()!
  values.sort((a, b) => a - b)
  const center = Math.floor(values.length / 2)
  let median = values[center]
  if (values.length % 2 === 0) {
    const midpoint = new Binary64Mean()
    midpoint.add(values[center - 1])
    midpoint.add(median)
    median = midpoint.result()!
  }
  return { count: values.length, mean, min: values[0], max: values[values.length - 1], median }
}

export const distinctLimit = 1024
const displayedCategories = 8

export function summarizeFrequencies(frequencies: Map<string, number>): FrequencySummary {
  const entries = Array.from(frequencies, ([value, count]) => ({ value, count }))
  entries.sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
  return { distinct: entries.length, entries: entries.slice(0, displayedCategories),
    omitted: Math.max(0, entries.length - displayedCategories) }
}
