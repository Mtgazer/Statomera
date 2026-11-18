import type { Column } from './dataset.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'

export function columnLabel(column: Column, locale: Locale) {
  const position = formatNumber(column.index + 1, locale)
  if (column.sourceName === null) return `${messages[locale].column} ${position}`
  return column.duplicateName ? `${column.sourceName} [${position}]` : column.sourceName
}
