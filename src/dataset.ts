export const delimiters = [',', ';', '\t'] as const
export type Delimiter = typeof delimiters[number]

export const commonMissingMarkers = ['NA', 'N/A', 'NULL', 'NaN'] as const

export interface CsvOptions {
  delimiter: Delimiter | 'auto'
  header: 'first-row' | 'none'
  duplicateHeaders: 'reject' | 'disambiguate'
  missingMarkers: readonly string[]
  schemaOverrides?: SchemaOverrides
}

export const defaultCsvOptions: CsvOptions = {
  delimiter: 'auto',
  header: 'first-row',
  duplicateHeaders: 'reject',
  missingMarkers: [],
}

export interface Column {
  id: string
  index: number
  sourceName: string | null
  duplicateName: boolean
}

/** A repeatable stream of rectangular, source-order records, excluding any header. */
export interface Dataset {
  columns: readonly Column[]
  records(): Iterable<readonly string[]>
}

export const schemaTypes = ['text', 'numeric', 'boolean', 'date'] as const
export type SchemaType = typeof schemaTypes[number]
export type SchemaOverrides = Readonly<Partial<Record<string, SchemaType>>>
export type ColumnType = SchemaType | 'empty'
export type ColumnWarning = 'mixed' | 'dateFormat' | 'leadingZeros' | 'numericRange' | 'manyCategories'
export interface RejectedValue { record: number; value: string }
export interface NumericSummary { count: number; mean: number; min: number; max: number; median: number }
export interface FrequencySummary {
  distinct: number
  entries: { value: string; count: number }[]
  omitted: number
}
export interface ColumnProfile extends Column {
  type: ColumnType
  override: SchemaType | null
  blank: number
  markedMissing: number
  invalid: number
  valid: number
  rejected: RejectedValue[]
  warnings: ColumnWarning[]
  numeric: NumericSummary | null
  frequency: FrequencySummary | null
}

export interface DatasetProfile {
  rows: number
  columns: ColumnProfile[]
  preview: (readonly string[])[]
  duplicateRows: number
  salaryColumnId: string | null
}
