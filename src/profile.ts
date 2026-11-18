import { CsvError, limits } from './csv.ts'
import { distinctLimit, schemaTypes } from './dataset.ts'
import type { ColumnProfile, ColumnWarning, Dataset, DatasetProfile, SchemaOverrides, SourceCell } from './dataset.ts'
import { classify, inferType } from './infer.ts'
import type { Evidence, TypedValue } from './infer.ts'
import { normalizedLabel } from './normalize.ts'
import { columnFindings, describeNumbers, displayedPatterns, patternLimit } from './quality.ts'
import { summarizeFrequencies, summarizeNumbers } from './summaries.ts'

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
  const previewQuality: DatasetProfile['previewQuality'] = []
  const preview: DatasetProfile['preview'] = []
  let rows = 0
  let duplicateRows = 0
  let duplicateGroups = 0
  const duplicateCounts = new Map<number, number>()

  // Keys represent entire raw rows, preserving cell boundaries and source spelling.
  {
    const seen = new Map<string, number>()
    for (const row of dataset.records()) {
      rows++
      if (preview.length < limits.preview) preview.push(row.map(sourceText))
      const key = JSON.stringify(row)
      const previous = seen.get(key) ?? 0
      if (previous) duplicateRows++
      seen.set(key, previous + 1)

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
    for (const count of seen.values()) {
      if (count === 1) continue
      duplicateGroups++
      duplicateCounts.set(count, (duplicateCounts.get(count) ?? 0) + 1)
    }
    seen.clear()
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
  // The first pass already counted every admissible numeric value. Pack only those
  // values for the exact median and avoid dynamic array capacity and boxing.
  const numbers = columns.map((column, index) => column.type === 'numeric'
    ? new Float64Array(state[index].admissibleNumbers) : null)
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
