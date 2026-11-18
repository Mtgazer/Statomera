import { limits } from '../csv.ts'
import type { ActiveDataset } from '../dataset-session.ts'
import { confidenceLevels } from '../inference-contract.ts'
import type { ConfidenceLevel, InferenceRequest } from '../inference-contract.ts'
import type { AnalysisIntent, Convention, DescriptiveOperation, IntentColumn, ProfileOperation } from '../intent/contract.ts'
import type { StatisticRequest } from '../statistics-contract.ts'
import type { Assumption, ValidationReason } from './contract.ts'

type Provenance = { operation: AnalysisIntent['operation']; columns: IntentColumn[]; assumptions: Assumption[] }

type ProfileRoute = {
  kind: 'profile'
  operation: ProfileOperation
  mode: 'count' | 'presence'
}

type Route = Provenance & (ProfileRoute | { kind: 'descriptive'; request: StatisticRequest } |
  { kind: 'inference'; request: InferenceRequest; confidence: 'explicit' | 'default'; matching?: 'sameRow' })

const descriptives = {
  count: null, sum: null, mean: null, median: null, min: null, max: null,
  sampleVariance: 'sample', populationVariance: 'population', sampleSd: 'sample', populationSd: 'population',
} satisfies Record<DescriptiveOperation, Convention | null>

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function fields(value: Record<string, unknown>, ...allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key))
}

type ColumnMatch = { column: IntentColumn } | { reason: ValidationReason }

export function validateRoute(intent: unknown, { profile }: ActiveDataset): Route | { reason: ValidationReason } {
  const invalid = { reason: 'invalidIntent' } as const
  const unsupported = { reason: 'unsupportedOperation' } as const
  const badParameters = { reason: 'invalidParameters' } as const
  if (!record(intent) || typeof intent.operation !== 'string') return invalid
  const { kind, operation } = intent
  const columns: IntentColumn[] = []

  function column(value: unknown, type: 'any' | 'numeric' | 'group'): ColumnMatch {
    if (!record(value) || !fields(value, 'id', 'sourceName', 'type') ||
      typeof value.id !== 'string' || (value.sourceName !== null && typeof value.sourceName !== 'string') ||
      typeof value.type !== 'string') return invalid
    const found = profile.columns.find(item => item.id === value.id)
    if (!found) return { reason: 'unknownColumn' }
    if (found.sourceName !== value.sourceName || found.type !== value.type) return { reason: 'changedColumn' }
    if ((type === 'numeric' && found.type !== 'numeric') ||
        (type === 'group' && found.type !== 'text' && found.type !== 'boolean')) return { reason: 'ineligibleColumn' }
    const selected = { id: found.id, sourceName: found.sourceName, type: found.type }
    columns.push(selected)
    return { column: selected }
  }

  function pair(value: unknown): { first: string; second: string } | { reason: ValidationReason } {
    if (!Array.isArray(value) || value.length !== 2) return invalid
    const first = column(value[0], 'numeric')
    if ('reason' in first) return first
    const second = column(value[1], 'numeric')
    if ('reason' in second) return second
    if (first.column.id === second.column.id) return { reason: 'distinctColumns' } as const
    return { first: first.column.id, second: second.column.id }
  }

  if (kind === 'profile') {
    const { mode } = intent
    if (operation !== 'rowCount' && operation !== 'columnCount' && operation !== 'missingCount' &&
        operation !== 'invalidCount' && operation !== 'duplicateRowCount') return unsupported
    const quality = operation === 'missingCount' || operation === 'invalidCount'
    if (!fields(intent, 'kind', 'operation', 'mode', ...(quality ? ['column'] : []))) return invalid
    if (mode !== 'count' && !(mode === 'presence' && operation !== 'rowCount' && operation !== 'columnCount')) return badParameters
    if (quality && intent.column !== undefined) {
      const selected = column(intent.column, 'any')
      if ('reason' in selected) return selected
    }
    return { kind, operation, mode, columns, assumptions: [] }
  }

  if (kind === 'descriptive') {
    if (operation === 'pearson') {
      if (!fields(intent, 'kind', 'operation', 'columns')) return invalid
      const selected = pair(intent.columns)
      if ('reason' in selected) return selected
      return { kind, operation, columns, assumptions: ['linearAssociation', 'completePairs'],
        request: { operation, columns: [selected.first, selected.second] } }
    }
    if (!Object.hasOwn(descriptives, operation)) return unsupported
    const allowed = operation as DescriptiveOperation
    if (!fields(intent, 'kind', 'operation', 'column', 'convention')) return invalid
    if (intent.convention !== undefined && (!descriptives[allowed] || intent.convention !== descriptives[allowed])) return badParameters
    const selected = column(intent.column, 'numeric')
    if ('reason' in selected) return selected
    return { kind, operation: allowed, columns, assumptions: [], request: { operation: allowed, columns: [selected.column.id] } }
  }

  if (kind !== 'inference' || (operation !== 'meanInterval' && operation !== 'oneSample' &&
      operation !== 'paired' && operation !== 'welch')) return unsupported

  const explicit = intent.confidence !== undefined
  if (explicit && !confidenceLevels.includes(intent.confidence as ConfidenceLevel)) return badParameters
  const level = explicit ? intent.confidence as ConfidenceLevel : 95
  const confidence = explicit ? 'explicit' : 'default'
  const base = { kind, operation, columns, confidence } as const
  const baseFields = ['kind', 'operation', 'confidence']
  if (operation === 'paired') {
    if (!fields(intent, ...baseFields, 'columns', 'matching')) return invalid
    if (intent.matching !== 'sameRow') return badParameters
    const selected = pair(intent.columns)
    if ('reason' in selected) return selected
    return { ...base, matching: 'sameRow', assumptions: ['completePairs', 'meaningfulRowPairs',
      'independentDifferences', 'smallSampleNormalDifferences', 'twoSided'],
      request: { method: operation, column: selected.first, second: selected.second, level } }
  }

  const outcome = column(intent.column, 'numeric')
  if ('reason' in outcome) return outcome
  const id = outcome.column.id
  if (operation === 'welch') {
    if (!fields(intent, ...baseFields, 'column', 'grouping', 'groups')) return invalid
    const grouping = column(intent.grouping, 'group')
    if ('reason' in grouping) return grouping
    if (id === grouping.column.id) return { reason: 'distinctColumns' }
    const groups = intent.groups
    if (!Array.isArray(groups) || groups.length !== 2) return badParameters

    const [a, b] = groups
    const canonical = (label: unknown): label is string => typeof label === 'string' &&
      label.length > 0 && label.length <= limits.field && label.trim() === label &&
      (grouping.column.type !== 'boolean' || label === 'true' || label === 'false')
    if (!canonical(a) || !canonical(b) || a === b) return badParameters
    return { ...base, assumptions: ['independentObservations', 'independentGroups', 'unequalVariancesAllowed',
      'smallSampleNormality', 'twoSided'], request: { method: operation, column: id, groupColumn: grouping.column.id, groups: [a, b], level } }
  }

  const oneSample = operation === 'oneSample'
  if (!fields(intent, ...baseFields, 'column', ...(oneSample ? ['nullMean'] : []))) return invalid
  const { nullMean } = intent
  if (oneSample && (typeof nullMean !== 'number' || !Number.isFinite(nullMean))) return badParameters
  return { ...base, assumptions: ['independentObservations', 'smallSampleNormality', ...(oneSample ? ['twoSided' as const] : [])],
    request: { method: operation, column: id, level, ...(oneSample && { nullMean: nullMean as number }) } }
}
