import { limits } from './csv.ts'
import { distinctLimit } from './dataset.ts'
import type { Dataset, DatasetProfile, SchemaOverrides } from './dataset.ts'
import { classifySource, inspectDataset, sourceText } from './schema.ts'
import { columnFindings, describeNumbers, displayedPatterns, patternLimit } from './quality.ts'
import { summarizeFrequencies, summarizeNumbers } from './summaries.ts'

export function profileDataset(
  dataset: Dataset,
  isMarker: (value: string) => boolean,
  onSalaryNumber?: (value: number) => void,
  overrides: SchemaOverrides = {},
): DatasetProfile {
  const previewQuality: DatasetProfile['previewQuality'] = []
  const preview: DatasetProfile['preview'] = []
  let duplicateRows = 0
  let duplicateGroups = 0
  const duplicateCounts = new Map<number, number>()

  // Keys represent entire raw rows, preserving cell boundaries and source spelling.
  const seen = new Map<string, number>()
  const { rows, columns, salaryColumnId, admissibleNumbers } = inspectDataset(dataset, isMarker, overrides, row => {
    if (preview.length < limits.preview) preview.push(row.map(sourceText))
    const key = JSON.stringify(row)
    const previous = seen.get(key) ?? 0
    if (previous) duplicateRows++
    seen.set(key, previous + 1)
  })
  for (const count of seen.values()) {
    if (count === 1) continue
    duplicateGroups++
    duplicateCounts.set(count, (duplicateCounts.get(count) ?? 0) + 1)
  }
  seen.clear()

  // The first pass already counted every admissible numeric value. Pack only those
  // values for the exact median and avoid dynamic array capacity and boxing.
  const numbers = columns.map((column, index) => column.type === 'numeric'
    ? new Float64Array(admissibleNumbers[index]) : null)
  const frequencies: (Map<string, number> | null)[] = columns.map(() => new Map())

  const patterns = new Map<number, number>()
  let complete = 0
  let other = 0
  let record = 0
  for (const row of dataset.records()) {
    record++
    const quality: DatasetProfile['previewQuality'][number] | undefined = record <= preview.length ? [] : undefined
    if (quality) previewQuality.push(quality)
    let missingMask = 0
    row.forEach((raw, index) => {
      const value = sourceText(raw).trim()
      if (!value || isMarker(value)) {
        missingMask |= 1 << index // Import limits allow at most 32 columns.
        quality?.push(value ? 'marked' : 'blank')
        return
      }
      const column = columns[index]
      const parsed = column.type === 'text' ? { type: 'text' } as const : classifySource(raw, value, column.override !== null)
      if ((typeof raw !== 'string' && raw.kind === 'invalid') || (column.type !== 'text' && parsed.type !== column.type)) {
        quality?.push('invalid')
        column.invalid++
        if (column.rejected.length < limits.rejected) column.rejected.push({ record, value: sourceText(raw) })
        return
      }
      quality?.push('valid')
      column.valid++
      if (column.type === 'numeric' && parsed.type === 'numeric') {
        numbers[index]![column.valid - 1] = parsed.value
        if (column.id === salaryColumnId) onSalaryNumber?.(parsed.value)
      }
      const counts = frequencies[index]
      if (counts) {
        const key = parsed.type === 'boolean' || parsed.type === 'numeric' ? String(parsed.value) : value
        counts.set(key, (counts.get(key) ?? 0) + 1)
        if (counts.size > distinctLimit) {
          frequencies[index] = null
          if (column.type === 'text' || column.type === 'boolean') column.warnings.push('manyCategories')
        }
      }
    })
    if (!missingMask) complete++
    else if (patterns.has(missingMask) || patterns.size < patternLimit) {
      patterns.set(missingMask, (patterns.get(missingMask) ?? 0) + 1)
    } else other++
  }

  columns.forEach((column, index) => {
    const values = numbers[index]
    const counts = frequencies[index]
    if (values?.length) {
      column.numeric = summarizeNumbers(values)
      column.distribution = describeNumbers(values)
    }
    column.distinct = counts?.size ?? null
    if (counts && (column.type === 'text' || column.type === 'boolean')) {
      column.frequency = summarizeFrequencies(counts)
    }
    column.findings = columnFindings(column, column.missingRate, counts)
  })

  const ranked = [...patterns].sort(([leftMask, left], [rightMask, right]) =>
    right - left || (leftMask >>> 0) - (rightMask >>> 0))
  for (const [, count] of ranked.slice(displayedPatterns)) other += count
  const entries = ranked.slice(0, displayedPatterns).map(([mask, count]) => ({
    columns: columns.filter(column => mask & (1 << column.index)).map(column => column.index),
    count,
  }))
  const duplicateFrequency = {
    groups: duplicateGroups,
    entries: [...duplicateCounts].sort(([left], [right]) => left - right)
      .map(([occurrences, groups]) => ({ occurrences, groups })),
  }
  return { rows, columns, preview, previewQuality, duplicateRows, duplicateFrequency,
    missingPatterns: { complete, entries, other }, salaryColumnId }
}
