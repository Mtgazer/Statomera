import { delimiters } from './dataset.ts'
import type { Delimiter } from './dataset.ts'

export const limits = {
  bytes: 5 * 1024 * 1024,
  rows: 100_000,
  cells: 1_000_000,
  columns: 32,
  field: 4096,
  preview: 8,
  rejected: 5,
  milliseconds: 10_000,
} as const

export const inputErrors = [
  'fileType', 'empty', 'fileSize', 'encoding', 'structure', 'rowWidth',
  'rowLimit', 'columnLimit', 'fieldLimit', 'cellLimit', 'headers', 'delimiter', 'options', 'jsonShape', 'xlsxShape', 'worksheet', 'expandedLimit', 'parquetDeferred',
] as const

export type InputError = typeof inputErrors[number]

export class CsvError extends Error {
  readonly code: InputError

  constructor(code: InputError) {
    super(code)
    this.code = code
  }
}

export function validateFile(name: string, size: number) {
  const format = name.toLowerCase().split('.').at(-1)
  if (format === 'parquet' && name.includes('.')) throw new CsvError('parquetDeferred')
  if (!name.includes('.') || (format !== 'csv' && format !== 'json' && format !== 'xlsx')) throw new CsvError('fileType')
  if (size === 0) throw new CsvError('empty')
  if (size > limits.bytes) throw new CsvError('fileSize')
  return format
}

export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new CsvError('encoding')
  }
}

// Strict delimited records with quoted fields and doubled quotes.
export function* readRecords(text: string, separator: Delimiter): Generator<string[]> {
  let offset = text.charCodeAt(0) === 0xfeff ? 1 : 0
  let row: string[] = []

  while (offset < text.length || row.length > 0) {
    let field = ''
    if (text[offset] === '"') {
      offset++
      for (;;) {
        const char = text[offset++]
        if (char === undefined) throw new CsvError('structure')
        if (char === '"') {
          if (text[offset] !== '"') break
          offset++
        }
        field += char
        if (field.length > limits.field) throw new CsvError('fieldLimit')
      }
    } else {
      const start = offset
      while (offset < text.length && text[offset] !== separator && text[offset] !== '\r' && text[offset] !== '\n') {
        if (text[offset] === '"') throw new CsvError('structure')
        if (offset - start >= limits.field) throw new CsvError('fieldLimit')
        offset++
      }
      field = text.slice(start, offset)
    }

    if (field.includes('\0')) throw new CsvError('structure')
    row.push(field)
    if (row.length > limits.columns) throw new CsvError('columnLimit')

    const delimiter = text[offset++]
    if (delimiter === separator) continue
    if (delimiter === '\r' && text[offset] === '\n') offset++
    if (delimiter !== undefined && delimiter !== '\r' && delimiter !== '\n') {
      throw new CsvError('structure')
    }
    yield row
    row = []
  }
}

/** Suggest a delimiter only when the first logical record gives unambiguous evidence. */
export function detectDelimiter(text: string): Delimiter {
  const candidates: Delimiter[] = []
  for (const delimiter of delimiters) {
    try {
      const first = readRecords(text, delimiter).next()
      if (!first.done && first.value.length > 1) candidates.push(delimiter)
    } catch (error) {
      if (!(error instanceof CsvError)) throw error
    }
  }
  if (candidates.length > 1) throw new CsvError('delimiter')
  return candidates[0] ?? ','
}
