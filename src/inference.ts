import { CsvError, limits } from './csv.ts'
import type { ColumnProfile, Dataset, SchemaOverrides, SourceCell } from './dataset.ts'
import { Binary64Parts, integerRoot, Moments, roundRootUnits, roundUnits } from './mean.ts'
import { classifySource, inspectDataset, numericObservation, sourceText } from './schema.ts'
import { confidenceLevels, inferenceMethods } from './inference-contract.ts'
import type { InferenceCounts, InferenceRequest, InferenceResult } from './inference-contract.ts'
import { studentCritical, studentLogTwoSided } from './student-t.ts'

type Ratio = { numerator: bigint; denominator: bigint }
const dimensionlessShift = 1074n

function addRatios(left: Ratio, right: Ratio): Ratio {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  }
}

function logRatio(numerator: bigint, denominator: bigint) {
  const numeratorShift = Math.max(0, numerator.toString(2).length - 53)
  const denominatorShift = Math.max(0, denominator.toString(2).length - 53)
  return (numeratorShift - denominatorShift) * Math.LN2 +
    Math.log(Number(numerator >> BigInt(numeratorShift)) / Number(denominator >> BigInt(denominatorShift)))
}

function standardized(difference: Ratio, variance: Ratio) {
  const numerator = difference.numerator ** 2n * variance.denominator
  const denominator = difference.denominator ** 2n * variance.numerator
  const magnitude = roundRootUnits(numerator << (2n * dimensionlessShift), denominator)
  return {
    value: difference.numerator < 0n ? -magnitude : magnitude,
    logMagnitude: magnitude > 0 && Number.isFinite(magnitude) ? Math.log(magnitude)
      : numerator ? logRatio(numerator, denominator) / 2 : -Infinity,
  }
}

function bounds(estimate: Ratio, variance: Ratio, critical: number) {
  // Retain 64 guard bits below the least binary64 unit and combine before rounding.
  // This also supports a representable endpoint when its center or margin would overflow.
  const criticalUnits = new Binary64Parts().read(critical)
  const margin = integerRoot(variance.numerator * criticalUnits ** 2n /
    (variance.denominator << (2n * (dimensionlessShift - 64n))))
  const center = estimate.numerator << 64n
  const offset = margin * estimate.denominator
  const denominator = estimate.denominator << 64n
  return [center - offset, center + offset].map(numerator =>
    ({ value: roundUnits(numerator, denominator), nonzero: numerator !== 0n }))
}

function createSample() {
  return { moments: new Moments(), counts: { valid: 0, missing: 0, invalid: 0 } satisfies InferenceCounts }
}

type Sample = ReturnType<typeof createSample>

function categorize(sample: Sample, x: ReturnType<typeof numericObservation>, y: ReturnType<typeof numericObservation> = 0) {
  if (x === 'invalid' || y === 'invalid') sample.counts.invalid++
  else if (x === 'missing' || y === 'missing') sample.counts.missing++
  else {
    sample.counts.valid++
    return [x, y] as const
  }
  return null
}

function varianceOf(sample: Sample, n: bigint): Ratio {
  return { numerator: sample.moments.centeredSumNumerator(n), denominator: n * (n - 1n) }
}

function validRequest(request: InferenceRequest) {
  if (!request || !inferenceMethods.includes(request.method) || !confidenceLevels.includes(request.level) ||
      typeof request.column !== 'string') return false
  if (request.method === 'oneSample') return Number.isFinite(request.nullMean)
  if (request.method === 'paired') return typeof request.second === 'string' && request.second !== request.column
  if (request.method === 'welch') {
    return typeof request.groupColumn === 'string' && request.groupColumn !== request.column &&
      Array.isArray(request.groups) && request.groups.length === 2 && request.groups[0] !== request.groups[1] &&
      request.groups.every(label => typeof label === 'string' && label.length > 0 && label.length <= limits.field)
  }
  return true
}

function membership(raw: SourceCell, group: ColumnProfile, isMarker: (value: string) => boolean) {
  const value = sourceText(raw).trim()
  if (!value || isMarker(value) || (typeof raw !== 'string' && raw.kind === 'invalid')) return null
  if (group.type === 'text') return value
  const parsed = classifySource(raw, value, group.override !== null)
  return parsed.type === 'boolean' ? parsed.value : null
}

export function calculateInference(
  dataset: Dataset, isMarker: (value: string) => boolean, overrides: SchemaOverrides, request: InferenceRequest,
): InferenceResult {
  if (!validRequest(request)) throw new CsvError('options')
  const { method, level } = request
  const welch = method === 'welch'
  const paired = method === 'paired'
  const { rows, columns } = inspectDataset(dataset, isMarker, overrides)
  const first = columns.find(column => column.id === request.column)
  const second = paired ? columns.find(column => column.id === request.second) : undefined
  const group = welch ? columns.find(column => column.id === request.groupColumn) : undefined
  if (first?.type !== 'numeric' || (paired && second?.type !== 'numeric') ||
      (welch && group?.type !== 'text' && group?.type !== 'boolean')) throw new CsvError('options')
  const a = createSample()
  const b = createSample()
  const yParts = new Binary64Parts()
  let outsideGroups = 0
  for (const row of dataset.records()) {
    let sample = a
    if (group) {
      const value = membership(row[group.index], group, isMarker)
      if (value === request.groups![1]) sample = b
      else if (value !== request.groups![0]) {
        outsideGroups++
        continue
      }
    }
    const values = categorize(sample, numericObservation(row[first.index], first, isMarker),
      second ? numericObservation(row[second.index], second, isMarker) : 0)
    if (!values) continue
    const [x, y] = values
    if (paired) {
      const difference = sample.moments.parts.read(x) - yParts.read(y)
      sample.moments.total += difference
      sample.moments.squares += difference ** 2n
    } else sample.moments.add(x, true)
  }
  const counts = welch ? [a.counts, b.counts] : [a.counts]
  const excluded = rows - a.counts.valid - b.counts.valid
  const result: InferenceResult = {
    request, counts, outsideGroups, excluded, estimate: null, interval: null, degrees: null,
    t: null, p: null, logP: null, effect: null, reason: null, warnings: excluded ? ['excluded'] : [],
  }
  const n = BigInt(a.counts.valid)
  const m = BigInt(b.counts.valid)
  function finite(value: number, exactNonzero = false) {
    if (!Number.isFinite(value)) {
      if (!result.warnings.includes('outOfRange')) result.warnings.push('outOfRange')
      return null
    }
    if (value === 0 && exactNonzero && !result.warnings.includes('roundedToZero')) result.warnings.push('roundedToZero')
    return value === 0 ? 0 : value
  }

  const estimate = welch
    ? { numerator: m * a.moments.total - n * b.moments.total, denominator: n * m }
    : { numerator: a.moments.total, denominator: n }
  if (estimate.denominator) result.estimate = finite(roundUnits(estimate.numerator, estimate.denominator), !!estimate.numerator)
  if (n < 2n || (welch && m < 2n)) {
    result.reason = 'insufficient'
    return result
  }
  if (n < 30n || (welch && m < 30n)) result.warnings.push('smallSample')

  const xVariance = varianceOf(a, n)
  const xSe = { numerator: xVariance.numerator, denominator: xVariance.denominator * n }
  let se = xSe
  let effectVariance = xVariance
  let degrees = Number(n - 1n)
  if (welch) {
    const yVariance = varianceOf(b, m)
    const ySe = { numerator: yVariance.numerator, denominator: yVariance.denominator * m }
    se = addRatios(xSe, ySe)
    effectVariance = addRatios(xVariance, yVariance)
    effectVariance.denominator *= 2n
    if (se.numerator) {
      if (!xSe.numerator || !ySe.numerator) result.warnings.push('constantGroup')
      const x = xSe.numerator * ySe.denominator
      const y = ySe.numerator * xSe.denominator
      degrees = roundUnits((x + y) ** 2n * (n - 1n) * (m - 1n) << dimensionlessShift,
        x ** 2n * (m - 1n) + y ** 2n * (n - 1n))
    }
  }
  if (!se.numerator) {
    result.reason = 'zeroVariance'
    return result
  }
  result.degrees = degrees
  const critical = studentCritical(degrees, level)
  if (!Number.isFinite(critical)) {
    result.reason = 'distribution'
    return result
  }
  const [lower, upper] = bounds(estimate, se, critical)
  result.interval = { lower: finite(lower.value, lower.nonzero), upper: finite(upper.value, upper.nonzero) }
  if (method === 'meanInterval') return result

  const center = method === 'oneSample' ? new Binary64Parts().read(request.nullMean!) : 0n
  const difference = { ...estimate, numerator: estimate.numerator - center * estimate.denominator }
  const statistic = standardized(difference, se)
  result.t = finite(statistic.value, !!difference.numerator)
  const logP = studentLogTwoSided(statistic.logMagnitude, degrees)
  if (!Number.isFinite(logP)) result.reason = 'distribution'
  else {
    result.logP = logP
    const probability = Math.exp(logP)
    if (probability === 0) result.warnings.push('pUnderflow')
    else result.p = probability
  }
  result.effect = {
    definition: welch ? 'averageVarianceD' : paired ? 'pairedDz' : 'cohenD',
    value: finite(standardized(difference, effectVariance).value, !!difference.numerator),
  }
  return result
}
