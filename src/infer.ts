import type { ColumnType, ColumnWarning } from './dataset.ts'

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const leadingZeros = /^[+-]?0\d+$/
const integer = /^[+-]?\d+$/
const dateShape = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

export function numericValue(value: string): number | null {
  if (!decimal.test(value) || leadingZeros.test(value)) return null
  const number = Number(value)
  if (!Number.isFinite(number) || (integer.test(value) && !Number.isSafeInteger(number))) return null
  if (number === 0 && /[1-9]/.test(value.split(/[eE]/, 1)[0])) return null
  return number
}

function validDate(value: string) {
  const parts = isoDate.exec(value)
  if (!parts) return false
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year > 0 && day >= 1 && day <= (days[month - 1] ?? 0)
}

export type TypedValue =
  | { type: 'numeric'; value: number }
  | { type: 'boolean'; value: 'true' | 'false' }
  | { type: 'date' }
  | { type: 'text'; warning?: ColumnWarning }

export function classify(value: string): TypedValue {
  if (leadingZeros.test(value)) return { type: 'text', warning: 'leadingZeros' }
  if (decimal.test(value)) {
    const number = numericValue(value)
    return number === null ? { type: 'text', warning: 'numericRange' } : { type: 'numeric', value: number }
  }
  const lower = value.toLowerCase()
  if (lower === 'true' || lower === 'صحيح') return { type: 'boolean', value: 'true' }
  if (lower === 'false' || lower === 'خطأ') return { type: 'boolean', value: 'false' }
  if (dateShape.test(value)) {
    return validDate(value) ? { type: 'date' } : { type: 'text', warning: 'dateFormat' }
  }
  return { type: 'text' }
}

export type Evidence = Record<TypedValue['type'], number>

export function inferType(evidence: Evidence, hasLeadingZeros: boolean): ColumnType {
  const total = evidence.numeric + evidence.date + evidence.boolean + evidence.text
  if (!total) return 'empty'
  for (const type of ['numeric', 'date', 'boolean'] as const) {
    if (type === 'numeric' && hasLeadingZeros) continue
    const count = evidence[type]
    if (count === total || (count >= 2 && count * 5 >= total * 4)) return type
  }
  return 'text'
}
