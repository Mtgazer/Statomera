import { validateRoute } from '../../src/router/validation.ts'
import corpus from './generated/corpus.json'

const columns = new Map(corpus.columns.map(column => [column.id, column]))
const operations = new Set([
  'rowCount', 'columnCount', 'missingCount', 'invalidCount', 'duplicateRowCount',
  'count', 'sum', 'mean', 'median', 'min', 'max', 'pearson', 'sampleSd', 'populationSd',
  'sampleVariance', 'populationVariance', 'meanInterval', 'oneSample', 'paired', 'welch',
  'comparison', 'variance', 'sd',
])
const clarification = new Set([
  'missingColumn', 'unknownColumn', 'ambiguousColumn', 'ineligibleColumn', 'ambiguousColumnPair',
  'distinctColumns', 'distinctGroups', 'missingGroups', 'comparisonMethod', 'convention', 'rowMatching',
  'missingNullMean', 'invalidNullMean', 'invalidConfidence', 'conflictingConfidence',
])
const refusal = new Set([
  'empty', 'tooLong', 'invalidText', 'invalidSchema', 'unsupportedLanguage', 'unknownOperation',
  'unsupportedOperation', 'multipleOperations', 'unsupportedQualifier', 'dataModification', 'causal', 'forecast',
])

export function validate(raw) {
  if (new TextEncoder().encode(raw).length > 4096) return 'Rejected · output exceeds 4,096 bytes'
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    return 'Rejected · invalid JSON'
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Rejected · expected one object'
  const names = [...raw.matchAll(/("(?:[^"\\]|\\.)*")\s*(:)?/gu)]
    .filter(([, , colon]) => colon).map(([, key]) => JSON.parse(key))
  if (names.length !== new Set(names).size) return 'Rejected · duplicate fields'
  const { status, ...intent } = value
  const hasFields = (...keys) => Object.keys(intent).length === keys.length && keys.every(key => Object.hasOwn(intent, key))
  if (status === 'unsupported' && hasFields('reason') && refusal.has(intent.reason)) {
    return 'Valid refusal · nothing to execute'
  }
  if (status === 'needs_clarification' && hasFields('operation', 'reasons') && operations.has(intent.operation) &&
    Array.isArray(intent.reasons) && intent.reasons.length && intent.reasons.every(reason => clarification.has(reason))) {
    return 'Valid clarification · nothing to execute'
  }
  if (status !== 'resolved') return 'Rejected · invalid intent envelope'

  for (const key of ['column', 'grouping']) if (Object.hasOwn(intent, key)) intent[key] = columns.get(intent[key])
  if (Array.isArray(intent.columns)) intent.columns = intent.columns.map(id => columns.get(id))
  const route = validateRoute(intent, { profile: { columns: corpus.columns } })
  return 'reason' in route ? `Rejected · ${route.reason}` : 'Valid candidate shape · no analysis executed'
}
