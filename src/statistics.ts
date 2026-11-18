import { CsvError } from './csv.ts'
import type { Dataset, SchemaOverrides } from './dataset.ts'
import { Moments, roundRootUnits, roundUnits } from './mean.ts'
import { inspectDataset, numericObservation } from './schema.ts'
import { quantile } from './quantiles.ts'
import { statisticMethods } from './statistics-contract.ts'
import type { StatisticRequest, StatisticResult } from './statistics-contract.ts'

const quantiles = { q1: 25, median: 50, q3: 75, p90: 90, p95: 95 } as const
const squaredUnitsShift = 1074n
const correlationUnitsShift = 2148n

export function calculateStatistic(
  dataset: Dataset,
  isMarker: (value: string) => boolean,
  overrides: SchemaOverrides,
  request: StatisticRequest,
): StatisticResult {
  if (!request || typeof request.operation !== 'string' || !Object.hasOwn(statisticMethods, request.operation) || !Array.isArray(request.columns)) {
    throw new CsvError('options')
  }
  const { operation } = request
  const paired = operation === 'pearson'
  if (request.columns.length !== (paired ? 2 : 1) || new Set(request.columns).size !== request.columns.length ||
      request.columns.some(id => !dataset.columns.some(column => column.id === id))) throw new CsvError('options')
  const { rows, columns, admissibleNumbers } = inspectDataset(dataset, isMarker, overrides)
  const inputs = request.columns.map(id => columns.find(column => column.id === id)!)
  if (inputs.some(column => column.type !== 'numeric')) throw new CsvError('options')
  const [first, second] = inputs
  const method = statisticMethods[operation]
  const firstMoments = new Moments()
  const secondMoments = new Moments()
  const dispersion = method === 'sampleMoment' || method === 'populationMoment' ||
    method === 'sampleRoot' || method === 'populationRoot'
  const ordered = method === 'quantile' ? new Float64Array(admissibleNumbers[first.index]) : null
  let min = Infinity
  let max = -Infinity
  let crossProducts = 0n
  let valid = 0
  let invalid = 0
  let missingOnly = 0
  for (const row of dataset.records()) {
    const x = numericObservation(row[first.index], first, isMarker)
    const y = second ? numericObservation(row[second.index], second, isMarker) : 0
    if (x === 'invalid' || y === 'invalid') invalid++
    else if (x === 'missing' || y === 'missing') missingOnly++
    else {
      if (ordered) ordered[valid] = x
      valid++
      if (method === 'extreme' || method === 'range') {
        min = Math.min(min, x)
        max = Math.max(max, x)
      }
      if (dispersion || paired || method === 'sum' || method === 'mean') firstMoments.add(x, dispersion || paired)
      if (paired) {
        secondMoments.add(y, true)
        const a = firstMoments.parts
        const b = secondMoments.parts
        crossProducts += (a.significand * b.significand) << (a.shift + b.shift)
      }
    }
  }
  const n = BigInt(valid)
  const excluded = rows - valid
  const result: StatisticResult = {
    operation, columns: request.columns, method, valid, excluded, invalid, missingOnly,
    value: null, reason: null, warnings: excluded ? ['excluded'] : [],
  }

  function finish(value: number, exactNonzero = false) {
    if (!Number.isFinite(value)) result.reason = 'numericRange'
    else {
      result.value = value === 0 ? 0 : value
      if (value === 0 && exactNonzero) result.warnings.push('roundedToZero')
    }
    return result
  }
  if (method === 'count') return finish(valid)
  if (!valid) {
    result.reason = 'noObservations'
    return result
  }
  if (valid < 2 && (paired || method === 'sampleMoment' || method === 'sampleRoot')) {
    result.reason = 'insufficientObservations'
    return result
  }
  if (method === 'sum') return finish(roundUnits(firstMoments.total))
  if (method === 'mean') return finish(roundUnits(firstMoments.total, n), firstMoments.total !== 0n)
  if (method === 'extreme') return finish(operation === 'min' ? min : max)
  if (method === 'range') {
    const { parts } = firstMoments
    return finish(roundUnits(parts.read(max) - parts.read(min)))
  }
  if (ordered) {
    ordered.sort()
    const result = quantile(ordered, quantiles[operation as keyof typeof quantiles])
    return finish(result.value, result.exactNonzero)
  }

  const xCentered = firstMoments.centeredSumNumerator(n)
  if (paired) {
    const yCentered = secondMoments.centeredSumNumerator(n)
    if (!xCentered || !yCentered) {
      result.reason = 'constantInput'
      return result
    }
    const covariance = n * crossProducts - firstMoments.total * secondMoments.total
    const magnitude = roundRootUnits(covariance ** 2n << correlationUnitsShift, xCentered * yCentered)
    return finish(covariance < 0n ? -magnitude : magnitude, covariance !== 0n)
  }
  const sample = method === 'sampleMoment' || method === 'sampleRoot'
  const denominator = n * (sample ? n - 1n : n)
  const value = method === 'sampleRoot' || method === 'populationRoot'
    ? roundRootUnits(xCentered, denominator)
    : roundUnits(xCentered, denominator << squaredUnitsShift)
  return finish(value, xCentered !== 0n)
}
