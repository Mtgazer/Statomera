import { CsvError, limits } from './csv.ts'
import { schemaTypes } from './dataset.ts'
import type { ColumnProfile, ColumnWarning, Dataset, DatasetProfile, SchemaOverrides, SourceCell } from './dataset.ts'
import { classify, inferType } from './infer.ts'
import type { Evidence, TypedValue } from './infer.ts'
import { normalizedLabel } from './normalize.ts'
import { distinctLimit, summarizeFrequencies, summarizeNumbers } from './summaries.ts'

function sourceText(cell: SourceCell) {
  return typeof cell === 'string' ? cell : cell.text
}

function classifySource(cell: SourceCell, text: string, override = false): TypedValue {
  if (typeof cell !== 'string' && cell.kind === 'text' && !override) return { type: 'text' }
  return classify(text)
}

const salaryNames = new Set(['salary', 'راتب', 'الراتب'])

export function profileDataset(
  dataset: Dataset,
  isMarker: (value: string) => boolean,
  onSalaryNumber?: (value: number) => void,
  overrides: SchemaOverrides = {},
): DatasetProfile {
  const selected = new Map(Object.entries(overrides))
  for (const [id, type] of selected) {
    if (!type || !schemaTypes.includes(type) || !dataset.columns.some(column => column.id === id)) {
      throw new CsvError('options')
    }
  }
  const salaryColumns = dataset.columns.filter(column => column.sourceName !== null &&
    salaryNames.has(normalizedLabel(column.sourceName)))
  const salaryColumnId = salaryColumns.length === 1 ? salaryColumns[0].id : null

  const state = dataset.columns.map(() => ({
    admissibleNumbers: 0,
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
      if (preview.length < limits.preview) preview.push(row.map(sourceText))
      const key = JSON.stringify(row)
      if (seen.has(key)) duplicateRows++
      else seen.add(key)

      row.forEach((raw, index) => {
        const column = state[index]
        const value = sourceText(raw).trim()
        if (!value) column.blank++
        else if (isMarker(value)) column.markedMissing++
        else if (typeof raw === 'string' || raw.kind !== 'invalid') {
          const parsed = classifySource(raw, value, selected.has(dataset.columns[index].id))
          const nativeKind = typeof raw === 'string' ? undefined : raw.kind
          const evidenceType = nativeKind === 'numeric' && parsed.type === 'text' ? 'numeric' : parsed.type
          column.evidence[evidenceType]++
          if (parsed.type === 'numeric') column.admissibleNumbers++
          if (parsed.type === 'text' && parsed.warning) column.warnings.add(parsed.warning)
        }
      })
    }
    seen.clear()
  }

  const columns = dataset.columns.map((column, index): ColumnProfile => {
    const { evidence, warnings, blank, markedMissing } = state[index]
    const override = selected.get(column.id) ?? null
    const type = override ?? (column.id === salaryColumnId && dataset.source !== 'structured'
      ? 'numeric' : inferType(evidence, warnings.has('leadingZeros')))
    if (Object.values(evidence).filter(count => count > 0).length > 1) warnings.add('mixed')
    return { ...column, type, override, blank, markedMissing, invalid: 0, valid: 0, rejected: [],
      warnings: [...warnings], numeric: null, frequency: null }
  })
  // The first pass already counted every admissible numeric value. Pack only those
  // values for the exact median and avoid dynamic array capacity and boxing.
  const numbers = columns.map((column, index) => column.type === 'numeric'
    ? new Float64Array(state[index].admissibleNumbers) : null)
  const frequencies = columns.map(column => column.type === 'text' || column.type === 'boolean'
    ? new Map<string, number>() : null)

  let record = 0
  for (const row of dataset.records()) {
    record++
    row.forEach((raw, index) => {
      const value = sourceText(raw).trim()
      if (!value || isMarker(value)) return
      const column = columns[index]
      const parsed = column.type === 'text' ? { type: 'text' } as const : classifySource(raw, value, column.override !== null)
      if ((typeof raw !== 'string' && raw.kind === 'invalid') || (column.type !== 'text' && parsed.type !== column.type)) {
        column.invalid++
        if (column.rejected.length < limits.rejected) column.rejected.push({ record, value: sourceText(raw) })
        return
      }
      column.valid++
      if (column.type === 'numeric' && parsed.type === 'numeric') {
        numbers[index]![column.valid - 1] = parsed.value
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
