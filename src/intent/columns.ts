import { limits } from '../csv.ts'
import { schemaTypes } from '../dataset.ts'
import { classify } from '../infer.ts'
import type { Clarification, ColumnRole, IntentColumn, IntentLanguage } from './contract.ts'

export const questionLimit = 512
const reserved = /[§\p{Cf}\p{Cs}\p{Cc}]/u
const labelPrefix = /^(?:(?:the )?(?:column|field) +|(?:العمود|عمود|لعمود) +)/u
const aliases = new Map([
  ['المرتب', 'salary'], ['مرتب', 'salary'], ['الراتب', 'salary'], ['راتب', 'salary'],
  ['المرتبات', 'salary'], ['الرواتب', 'salary'], ['العمر', 'age'], ['عمر', 'age'],
])

export function fold(value: string): string {
  return value.normalize('NFC').toLowerCase()
    .replace(/[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا').replace(/[ىی]/gu, 'ي')
    .replace(/[٠-٩۰-۹]/gu, digit => String(digit.charCodeAt(0) & 15))
    .replace(/٫/gu, '.').replace(/٪/gu, '%').replace(/−/gu, '-').replace(/’/gu, "'")
    .replace(/\s+/gu, ' ').trim()
}

export function languageOf(value: string): IntentLanguage {
  const letters = value.replace(/[^\p{L}]/gu, '')
  const arabic = /\p{Script=Arabic}/u.test(letters)
  const latin = /\p{Script=Latin}/u.test(letters)
  return arabic && latin ? 'mixed' : arabic ? 'ar' : latin ? 'en' : 'unknown'
}

export function prepare(question: string) {
  const quotes: string[] = []
  if (reserved.test(question.replace(/[\t\n\r]/gu, ' '))) return null
  const outside = question.replace(/"([^"]*)"|“([^”]*)”|«([^»]*)»/gu, (_, straight, curly, angle) => {
    const index = quotes.push((straight ?? curly ?? angle) as string) - 1
    return `§${index}§`
  })
  if (/["“”«»]/u.test(outside)) return null
  return {
    text: fold(outside).replace(/[؟?!.]$/u, '').trim(),
    language: languageOf(question),
    quotes,
  }
}

export function validSchema(schema: readonly IntentColumn[]): boolean {
  return Array.isArray(schema) && schema.length <= limits.columns &&
    Array.from(schema).every(column => column && typeof column.id === 'string' && column.id.length > 0 && column.id.length <= 64 &&
      (column.sourceName === null || (typeof column.sourceName === 'string' && column.sourceName.length <= limits.field)) &&
      (column.type === 'empty' || schemaTypes.includes(column.type))) &&
    new Set(schema.map(column => column.id)).size === schema.length
}

type Eligibility = 'any' | 'numeric' | 'categorical'
type Lookup = { column: IntentColumn } | { issue: Clarification }

function eligible(column: IntentColumn, type: Eligibility): boolean {
  if (type === 'numeric') return column.type === 'numeric'
  if (type === 'categorical') return column.type === 'text' || column.type === 'boolean'
  return true
}

export function columnLookup(schema: readonly IntentColumn[], quotes: string[]) {
  // Store only the public identity, even if a caller passes full runtime profile objects.
  const columns = schema.map(({ id, sourceName, type }) => ({ id, sourceName, type }))
  const byKey = new Map<string, IntentColumn[]>()
  for (const column of columns) {
    if (column.sourceName === null) continue
    const key = fold(column.sourceName)
    if (!key) continue
    const matches = byKey.get(key) ?? []
    matches.push(column)
    byKey.set(key, matches)
  }

  function resolve(slot: string | undefined, role: ColumnRole, type: Eligibility): Lookup {
    const reference = slot?.trim()
    if (!reference) return { issue: { reason: 'missingColumn', role } }
    let options = byKey.get(reference)
    const explicit = options ? reference : reference.replace(labelPrefix, '')
    const quoted = quotedValue(explicit, quotes)
    if (quoted !== undefined) {
      // An exact quoted label can disambiguate a lossy normalization collision.
      options = columns.filter(column => column.sourceName !== null &&
        column.sourceName.normalize('NFC') === quoted.normalize('NFC'))
      if (!options.length) options = byKey.get(fold(quoted))
    } else {
      options ??= byKey.get(explicit)
      const linked = explicit.replace(/^لل(?=\p{Script=Arabic})/u, 'ال')
      options ??= byKey.get(linked)
      const alias = aliases.get(linked)
      if (!options && alias) options = byKey.get(alias)
    }

    if (!options?.length) return { issue: { reason: 'unknownColumn', role, reference: quoted ?? explicit } }
    if (options.length > 1) return { issue: { reason: 'ambiguousColumn', role, options } }
    if (!eligible(options[0], type)) return { issue: { reason: 'ineligibleColumn', role, options } }
    return { column: options[0] }
  }

  return resolve
}

export function quotedValue(token: string, quotes: string[]): string | undefined {
  const match = /^§(\d+)§$/u.exec(token)
  return match ? quotes[Number(match[1])] : undefined
}

export function groupValue(value: string, grouping: IntentColumn): string | null {
  if (!value.trim() || value.length > limits.field) return null
  if (grouping.type !== 'boolean') return value.trim()
  const parsed = classify(value.trim())
  return parsed.type === 'boolean' ? parsed.value : null
}
