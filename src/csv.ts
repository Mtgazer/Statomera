export const limits = {
  bytes: 5 * 1024 * 1024,
  rows: 100_000,
  columns: 32,
  field: 4096,
  preview: 8,
  rejected: 5,
  milliseconds: 10_000,
} as const

export const inputErrors = [
  'fileType', 'empty', 'fileSize', 'encoding', 'structure', 'rowWidth',
  'rowLimit', 'columnLimit', 'fieldLimit', 'headers', 'salaryColumn',
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
  if (!name.toLowerCase().endsWith('.csv')) throw new CsvError('fileType')
  if (size === 0) throw new CsvError('empty')
  if (size > limits.bytes) throw new CsvError('fileSize')
}

export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new CsvError('encoding')
  }
}

// Strict comma-separated records with RFC-style quoted fields and doubled quotes.
function* records(text: string): Generator<string[]> {
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
      while (offset < text.length && !',\r\n'.includes(text[offset])) {
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
    if (delimiter === ',') continue
    if (delimiter === '\r' && text[offset] === '\n') offset++
    if (delimiter !== undefined && delimiter !== '\r' && delimiter !== '\n') {
      throw new CsvError('structure')
    }
    yield row
    row = []
  }
}

const salaryNames = new Set(['salary', 'راتب', 'الراتب'])
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

function numericValue(value: string): number | null {
  if (!decimal.test(value)) return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  if (number === 0 && /[1-9]/.test(value.split(/[eE]/, 1)[0])) return null
  return number
}

export function profileCsv(text: string) {
  const iterator = records(text)
  const first = iterator.next()
  if (first.done || !text.trim()) throw new CsvError('empty')
  const headers = first.value
  const names = headers.map(header => header.trim().normalize('NFC').toLowerCase())
  if (names.some(name => !name) || new Set(names).size !== names.length) {
    throw new CsvError('headers')
  }
  const salaryIndices = names.flatMap((name, index) => salaryNames.has(name) ? [index] : [])
  if (salaryIndices.length !== 1) throw new CsvError('salaryColumn')
  const [salaryIndex] = salaryIndices

  const missing = headers.map(() => 0)
  const preview: string[][] = []
  const rejected: { record: number; value: string }[] = []
  const observations: string[] = []
  let rows = 0
  let invalid = 0

  for (const row of iterator) {
    rows++
    if (rows > limits.rows) throw new CsvError('rowLimit')
    if (row.length !== headers.length) throw new CsvError('rowWidth')
    if (preview.length < limits.preview) preview.push(row)

    row.forEach((field, index) => {
      if (!field.trim()) missing[index]++
    })

    const raw = row[salaryIndex]
    const value = raw.trim()
    if (!value) continue
    const number = numericValue(value)
    if (number !== null) {
      observations.push(String(number))
      continue
    }
    invalid++
    if (rejected.length < limits.rejected) rejected.push({ record: rows, value: raw })
  }

  return {
    profile: { headers, missing, rows, preview, salaryIndex, valid: observations.length, invalid, rejected },
    numericCsv: observations.join('\n'),
  }
}

export type Profile = ReturnType<typeof profileCsv>['profile']
