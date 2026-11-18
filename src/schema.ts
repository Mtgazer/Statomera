import { CsvError } from './csv.ts'
import { schemaTypes } from './dataset.ts'
import type { ColumnProfile, ColumnWarning, Dataset, SchemaOverrides, SourceCell } from './dataset.ts'
import { classify, inferType } from './infer.ts'
import type { Evidence, TypedValue } from './infer.ts'
import { normalizedLabel } from './normalize.ts'

export function sourceText(cell: SourceCell) {
  return typeof cell === 'string' ? cell : cell.text
}

export function classifySource(cell: SourceCell, text: string, override = false): TypedValue {
  if (typeof cell !== 'string' && cell.kind === 'text' && !override) return { type: 'text' }
  return classify(text)
}

const salaryNames = new Set(['salary', 'راتب', 'الراتب'])

export function inspectDataset(
  dataset: Dataset,
  isMarker: (value: string) => boolean,
  overrides: SchemaOverrides,
  observe?: (row: readonly SourceCell[]) => void,
) {
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
  let rows = 0
  for (const row of dataset.records()) {
    rows++
    observe?.(row)
    row.forEach((raw, index) => {
      const column = state[index]
      const value = sourceText(raw).trim()
      if (!value) column.blank++
      else if (isMarker(value)) column.markedMissing++
      else if (typeof raw === 'string' || raw.kind !== 'invalid') {
        const parsed = classifySource(raw, value)
        const nativeKind = typeof raw === 'string' ? undefined : raw.kind
        const evidenceType = nativeKind === 'numeric' && parsed.type === 'text' ? 'numeric' : parsed.type
        column.evidence[evidenceType]++
        if (parsed.type === 'numeric' || (selected.get(dataset.columns[index].id) === 'numeric' &&
            classifySource(raw, value, true).type === 'numeric')) column.admissibleNumbers++
        if (parsed.type === 'text' && parsed.warning) column.warnings.add(parsed.warning)
      }
    })
  }

  const columns = dataset.columns.map((column, index): ColumnProfile => {
    const { evidence, warnings, blank, markedMissing } = state[index]
    const override = selected.get(column.id) ?? null
    const inferredType = column.id === salaryColumnId && dataset.source !== 'structured'
      ? 'numeric' : inferType(evidence, warnings.has('leadingZeros'))
    const type = override ?? inferredType
    if (Object.values(evidence).filter(count => count > 0).length > 1) warnings.add('mixed')
    return { ...column, type, inferredType, distinct: 0, override, blank, markedMissing, invalid: 0, valid: 0, rejected: [],
      warnings: [...warnings], numeric: null, frequency: null,
      missingRate: rows ? (blank + markedMissing) / rows : null, distribution: null, findings: [] }
  })
  return { rows, columns, salaryColumnId, admissibleNumbers: state.map(column => column.admissibleNumbers) }
}

export function numericObservation(raw: SourceCell, column: ColumnProfile, isMarker: (value: string) => boolean) {
  const text = sourceText(raw).trim()
  if (!text || isMarker(text)) return 'missing'
  if (typeof raw !== 'string' && raw.kind === 'invalid') return 'invalid'
  const parsed = classifySource(raw, text, column.override !== null)
  return parsed.type === 'numeric' ? parsed.value : 'invalid'
}
