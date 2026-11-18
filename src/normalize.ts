import { CsvError, detectDelimiter, limits, readRecords } from './csv.ts'
import { delimiters } from './dataset.ts'
import type { Column, CsvOptions, Dataset } from './dataset.ts'

export function normalizedLabel(value: string) {
  return value.trim().normalize('NFC').toLowerCase()
}

export function missingPolicy(markers: readonly string[]) {
  if (!Array.isArray(markers) || markers.length > 16 ||
      markers.some(marker => typeof marker !== 'string' || marker.length > 64 || !marker.trim())) {
    throw new CsvError('options')
  }
  const normalized = new Set(markers.map(normalizedLabel))
  return (value: string) => normalized.size > 0 && normalized.has(normalizedLabel(value))
}

export function normalizeCsv(text: string, options: CsvOptions): Dataset {
  if ((options.delimiter !== 'auto' && !delimiters.includes(options.delimiter)) ||
      !['first-row', 'none'].includes(options.header) ||
      !['reject', 'disambiguate'].includes(options.duplicateHeaders)) {
    throw new CsvError('options')
  }
  const delimiter = options.delimiter === 'auto' ? detectDelimiter(text) : options.delimiter
  if (!text.trim() && !(delimiter === '\t' && text.includes('\t'))) throw new CsvError('empty')
  const first = readRecords(text, delimiter).next()
  if (first.done) throw new CsvError('empty')
  const hasHeader = options.header === 'first-row'
  const columns = normalizeColumns(first.value, hasHeader, options.duplicateHeaders)

  return {
    columns,
    *records() {
      const iterator = readRecords(text, delimiter)
      if (hasHeader) iterator.next()
      let rows = 0
      for (const row of iterator) {
        rows++
        if (rows > limits.rows) throw new CsvError('rowLimit')
        if (row.length !== columns.length) throw new CsvError('rowWidth')
        if (rows * columns.length > limits.cells) throw new CsvError('cellLimit')
        yield row
      }
    },
  }
}

export function normalizeColumns(labels: readonly string[], hasHeader: boolean, policy: CsvOptions['duplicateHeaders']): Column[] {
  const names = hasHeader ? labels.map(normalizedLabel) : []
  const repeated = new Set(names.filter((name, index) => names.indexOf(name) !== index))
  if (names.includes('') || (repeated.size && policy === 'reject')) {
    throw new CsvError('headers')
  }
  return labels.map((value, index) => ({
    id: `column-${index + 1}`, index, sourceName: hasHeader ? value : null,
    duplicateName: hasHeader && repeated.has(names[index]),
  }))

}
