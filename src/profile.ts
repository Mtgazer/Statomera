import { limits } from './csv.ts'
import type { ColumnProfile, ColumnWarning, Dataset, DatasetProfile } from './dataset.ts'
import { classify, inferType } from './infer.ts'
import type { Evidence } from './infer.ts'
import { normalizedLabel } from './normalize.ts'
import { distinctLimit, summarizeFrequencies, summarizeNumbers } from './summaries.ts'

const salaryNames = new Set(['salary', 'راتب', 'الراتب'])

export function profileDataset(
  dataset: Dataset,
  isMarker: (value: string) => boolean,
  onSalaryNumber?: (value: number) => void,
): DatasetProfile {
  const salaryColumns = dataset.columns.filter(column => column.sourceName !== null &&
    salaryNames.has(normalizedLabel(column.sourceName)))
  const salaryColumnId = salaryColumns.length === 1 ? salaryColumns[0].id : null

  const state = dataset.columns.map(() => ({
    evidence: { numeric: 0, boolean: 0, date: 0, text: 0 } satisfies Evidence,
    warnings: new Set<ColumnWarning>(),
    blank: 0,
    markedMissing: 0,
  }))
  const preview: DatasetProfile['preview'] = []
  let rows = 0
  let duplicateRows = 0

  // Keys represent entire raw rows, preserving cell boundaries and source spelling.
  {
    const seen = new Set<string>()
    for (const row of dataset.records()) {
      rows++
      if (preview.length < limits.preview) preview.push(row)
      const key = JSON.stringify(row)
      if (seen.has(key)) duplicateRows++
      else seen.add(key)

      row.forEach((raw, index) => {
        const column = state[index]
        const value = raw.trim()
        if (!value) column.blank++
        else if (isMarker(value)) column.markedMissing++
        else {
          const parsed = classify(value)
          column.evidence[parsed.type]++
          if (parsed.type === 'text' && parsed.warning) column.warnings.add(parsed.warning)
        }
      })
    }
  }

  const columns = dataset.columns.map((column, index): ColumnProfile => {
    const { evidence, warnings, blank, markedMissing } = state[index]
    const type = column.id === salaryColumnId ? 'numeric' : inferType(evidence, warnings.has('leadingZeros'))
    if (Object.values(evidence).filter(count => count > 0).length > 1) warnings.add('mixed')
    return { ...column, type, blank, markedMissing, invalid: 0, valid: 0, rejected: [],
      warnings: [...warnings], numeric: null, frequency: null }
  })
  const numbers = columns.map(column => column.type === 'numeric' ? [] as number[] : null)
  const frequencies = columns.map(column => column.type === 'text' || column.type === 'boolean'
    ? new Map<string, number>() : null)

  let record = 0
  for (const row of dataset.records()) {
    record++
    row.forEach((raw, index) => {
      const value = raw.trim()
      if (!value || isMarker(value)) return
      const column = columns[index]
      const parsed = classify(value)
      if (column.type !== 'text' && parsed.type !== column.type) {
        column.invalid++
        if (column.rejected.length < limits.rejected) column.rejected.push({ record, value: raw })
        return
      }
      column.valid++
      if (column.type === 'numeric' && parsed.type === 'numeric') {
        numbers[index]!.push(parsed.value)
        if (column.id === salaryColumnId) onSalaryNumber?.(parsed.value)
      }
      const counts = frequencies[index]
      if (counts) {
        const key = column.type === 'boolean' && parsed.type === 'boolean' ? parsed.value : value
        counts.set(key, (counts.get(key) ?? 0) + 1)
        if (counts.size > distinctLimit) {
          frequencies[index] = null
          column.warnings.push('manyCategories')
        }
      }
    })
  }

  columns.forEach((column, index) => {
    const values = numbers[index]
    const counts = frequencies[index]
    if (values) column.numeric = summarizeNumbers(values)
    if (counts) column.frequency = summarizeFrequencies(counts)
  })

  return { rows, columns, preview, duplicateRows, salaryColumnId }
}
