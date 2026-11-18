import { CsvError, limits } from './csv.ts'
import type { CsvOptions, Dataset, SourceCell } from './dataset.ts'
import { normalizeColumns } from './normalize.ts'

// Restricted JSON grammar. Parse string tokens with the native decoder, and keep
// number tokens intact so unsafe integers never round before profiling.
export function normalizeJson(text: string, options: CsvOptions): Dataset {
  const tokens = /[ \t\r\n]*(?:(["{}\[\]:,])|(true|false|null)|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?))/y
  const strings = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y
  let position = 0
  let current = next()

  function next(): { tag: string; value: string } {
    tokens.lastIndex = position
    const match = tokens.exec(text)
    if (!match) {
      if (/^[ \t\r\n]*$/.test(text.slice(position))) return { tag: 'end', value: '' }
      throw new CsvError('jsonShape')
    }
    position = tokens.lastIndex
    if (match[1] === '"') {
      strings.lastIndex = position - 1
      const quoted = strings.exec(text)
      if (!quoted) throw new CsvError('jsonShape')
      position = strings.lastIndex
      const value: string = JSON.parse(quoted[0])
      if (value.length > limits.field) throw new CsvError('fieldLimit')
      return { tag: 'text', value }
    }
    return { tag: match[1] ?? (match[2] === 'null' ? 'missing' : match[2] ? 'boolean' : 'numeric'),
      value: match[2] === 'null' ? '' : match[2] ?? match[3] ?? '' }
  }

  function consume(tag: string): string {
    if (current.tag !== tag) throw new CsvError('jsonShape')
    const value = current.value
    current = next()
    return value
  }

  const labels = new Set<string>()
  const rows: Map<string, SourceCell>[] = []
  consume('[')
  if (current.tag === ']') throw new CsvError('empty')
  do {
    if (rows.length >= limits.rows) throw new CsvError('rowLimit')
    consume('{')
    const row = new Map<string, SourceCell>()
    if (current.tag !== '}') do {
      const name = consume('text')
      if (row.has(name)) throw new CsvError('jsonShape')
      labels.add(name)
      if (labels.size > limits.columns) throw new CsvError('columnLimit')
      if (labels.size * (rows.length + 1) > limits.cells) throw new CsvError('cellLimit')
      consume(':')
      const kind = current.tag
      if (kind !== 'text' && kind !== 'boolean' && kind !== 'numeric' && kind !== 'missing') {
        throw new CsvError('jsonShape')
      }
      const value = consume(kind)
      if (value.length > limits.field) throw new CsvError('fieldLimit')
      row.set(name, { text: value, kind })
      if (current.tag !== ',') break
      consume(',')
    } while (true)
    consume('}')
    rows.push(row)
    if (labels.size * rows.length > limits.cells) throw new CsvError('cellLimit')
    if (current.tag !== ',') break
    consume(',')
  } while (true)
  consume(']')
  if (current.tag !== 'end' || !labels.size) throw new CsvError('jsonShape')
  const names = [...labels]
  const missing = { text: '', kind: 'missing' } as const
  return {
    source: 'structured', columns: normalizeColumns(names, true, options.duplicateHeaders),
    *records() { for (const row of rows) yield names.map(name => row.get(name) ?? missing) },
  }
}
