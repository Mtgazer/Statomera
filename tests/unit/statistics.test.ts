import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { defaultCsvOptions } from '../../src/dataset.ts'
import type { SchemaOverrides } from '../../src/dataset.ts'
import { normalizeJson } from '../../src/json.ts'
import { normalizeCsv, missingPolicy } from '../../src/normalize.ts'
import { calculateStatistic } from '../../src/statistics.ts'
import type { StatisticOperation, StatisticRequest } from '../../src/statistics-contract.ts'

const marker = missingPolicy(['NA'])
const csv = readFileSync(new URL('../fixtures/phase-4a-statistics.csv', import.meta.url), 'utf8')
const dataset = normalizeCsv(csv, defaultCsvOptions)
const ids = dataset.columns.map(column => column.id)
const numeric = Object.fromEntries(ids.map(id => [id, 'numeric'])) as SchemaOverrides

function calculate(operation: StatisticOperation, ...indices: number[]) {
  return calculateStatistic(dataset, marker, numeric, { operation, columns: indices.map(index => ids[index]) })
}

function measure(operation: StatisticOperation, ...values: string[]) {
  const data = normalizeCsv(['salary', ...values].join('\n'), defaultCsvOptions)
  return calculateStatistic(data, marker, {}, { operation, columns: [data.columns[0].id] })
}

test('independent signed univariate references and exclusion provenance', () => {
  // [-3,-1,1,3] sums to zero, with sum of squared deviations 20.
  const expected = {
    count: 4, sum: 0, mean: 0, median: 0, min: -3, max: 3, range: 6,
    sampleVariance: 20 / 3, populationVariance: 5,
    sampleSd: 2.581988897471611, populationSd: 2.23606797749979,
    q1: -1.5, q3: 1.5, p90: 2.4, p95: 2.7,
  } as const
  for (const operation of Object.keys(expected) as (keyof typeof expected)[]) {
    const result = calculate(operation, 0)
    assert.equal(result.value, expected[operation], operation)
    assert.deepEqual([result.valid, result.excluded, result.missingOnly, result.invalid], [4, 3, 2, 1], operation)
    assert.deepEqual(result.warnings, ['excluded'])
    assert.equal(result.operation, operation)
    assert.equal(result.reason, null)
    assert.deepEqual(result.columns, [ids[0]])
  }
})

test('Pearson uses the complete-row intersection, with exact signed and hand-derived references', () => {
  const positive = calculate('pearson', 0, 1)
  assert.equal(positive.value, 1)
  assert.equal(positive.method, 'pairedPearson')
  assert.deepEqual([positive.valid, positive.excluded, positive.missingOnly, positive.invalid], [4, 3, 1, 2])
  assert.equal(calculate('pearson', 0, 2).value, -1)
  // Cross-products sum to 16 and both centered sums of squares equal 20.
  assert.equal(calculate('pearson', 0, 5).value, 0.8)
  assert.equal(calculate('pearson', 5, 0).value, 0.8)
  assert.equal(calculate('pearson', 0, 3).reason, 'constantInput')
  assert.equal(calculate('pearson', 0, 4).reason, 'insufficientObservations')

  const data = normalizeCsv('x,y\n-1e308,1e-308\n0,0\n1e308,-1e-308', defaultCsvOptions)
  const columns = data.columns.map(column => column.id)
  assert.equal(calculateStatistic(data, marker, {}, { operation: 'pearson', columns }).value, -1)
  const disjoint = normalizeCsv('x,y\n1,NA\nNA,2', defaultCsvOptions)
  assert.equal(calculateStatistic(disjoint, marker, {}, { operation: 'pearson', columns }).reason, 'noObservations')
  const orthogonal = normalizeCsv('x,y\n-1,1\n0,-2\n1,1', defaultCsvOptions)
  assert.equal(calculateStatistic(orthogonal, marker, {}, { operation: 'pearson', columns }).value, 0)
})

test('constant, single and empty data have explicit operation-dependent semantics', () => {
  for (const op of ['sampleVariance', 'populationVariance', 'sampleSd', 'populationSd', 'range'] as const) {
    assert.equal(calculate(op, 3).value, 0)
  }
  assert.equal(calculate('sampleVariance', 4).reason, 'insufficientObservations')
  assert.equal(calculate('sampleSd', 4).reason, 'insufficientObservations')
  assert.equal(calculate('populationVariance', 4).value, 0)
  assert.equal(calculate('populationSd', 4).value, 0)
  assert.equal(calculate('p95', 4).value, 9)
  assert.equal(measure('count', 'NA').value, 0)
  assert.deepEqual([measure('sum').value, measure('sum').reason], [null, 'noObservations'])
})

test('large offsets, overflow and precision round at the result boundary', () => {
  const offset = ['4503599627370495', '4503599627370496', '4503599627370497']
  assert.equal(measure('sampleVariance', ...offset).value, 1)
  assert.equal(measure('populationVariance', ...offset).value, 2 / 3)
  assert.equal(measure('sum', '1e308', '1', '-1e308').value, 1)
  assert.equal(measure('sum', '1e308', '1e308').reason, 'numericRange')
  assert.equal(measure('mean', '1e308', '1e308').value, 1e308)
  assert.equal(measure('range', '-1e308', '1e308').reason, 'numericRange')
  assert.equal(measure('median', '-1e308', '1e308').value, 0)
  assert.equal(measure('populationVariance', '-1e308', '1e308').reason, 'numericRange')
  assert.equal(measure('populationSd', '-1e308', '1e308').value, 1e308)
  assert.equal(measure('populationSd', '-1e-200', '1e-200').value, 1e-200)
  assert.deepEqual(measure('populationVariance', '-1e-200', '1e-200').warnings, ['roundedToZero'])
  assert.equal(measure('populationSd', '0', '5e-324').value, 0) // Half the minimum subnormal, ties to even.
  assert.deepEqual(measure('median', '0', '5e-324').warnings, ['roundedToZero'])
  assert.equal(measure('median', '5e-324', '1e-323').value, 1e-323) // 1.5 subnormal units.
  assert.equal(measure('sum', '0.1', '0.2').value, 0.30000000000000004)
  assert.equal(measure('mean', '10', '20', '30', 'bad', '""').value, 20)
})

test('worker operation validation enforces its allowlist and active schema', () => {
  assert.throws(() => calculateStatistic(dataset, marker, numeric, {
    operation: 'toString', columns: [ids[0]],
  } as unknown as StatisticRequest), { code: 'options' })
  assert.throws(() => calculate('pearson', 0, 0), { code: 'options' })
  assert.throws(() => calculateStatistic(dataset, marker, { ...numeric, [ids[0]]: 'text' }, {
    operation: 'mean', columns: [ids[0]],
  }), { code: 'options' })
  const json = normalizeJson('[{"س":10},{"س":"30"},{"س":null},{"س":"bad"}]', defaultCsvOptions)
  const id = json.columns[0].id
  assert.throws(() => calculateStatistic(json, marker, {}, { operation: 'mean', columns: [id] }), { code: 'options' })
  const typed = calculateStatistic(json, marker, { [id]: 'numeric' }, { operation: 'mean', columns: [id] })
  assert.deepEqual([typed.value, typed.valid, typed.missingOnly, typed.invalid], [20, 2, 1, 1])
})
