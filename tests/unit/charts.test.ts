import assert from 'node:assert/strict'
import { test } from 'node:test'
import { position } from '../../src/chart-scale.ts'
import { defaultCsvOptions } from '../../src/dataset.ts'
import { missingPolicy, normalizeCsv } from '../../src/normalize.ts'
import { describeNumbers } from '../../src/quality.ts'
import { calculateStatistic } from '../../src/statistics.ts'

test('histogram includes the minimum and every upper boundary exactly once', () => {
  const data = Float64Array.of(0, 0, 1, 1, 2, 4, 8, 8)
  const { bins } = describeNumbers(data)
  assert.deepEqual(bins.map(bin => bin.upper), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(bins.map(bin => bin.count), [4, 1, 0, 1, 0, 0, 0, 2])
})

test('box geometry uses Type 7 quartiles and observed extremes within the fences', () => {
  const { box, outliers } = describeNumbers(Float64Array.of(-10, 1, 2, 3, 4, 5, 6, 30))
  assert.deepEqual(box, { q1: 1.75, q3: 5.25, lowWhisker: 1, highWhisker: 6 })
  assert.deepEqual(outliers, { status: 'assessed', q1: 1.75, q3: 5.25, lower: -3.5, upper: 10.5, below: 1, above: 1 })
  const single = describeNumbers(Float64Array.of(7))
  assert.deepEqual(single.box, { q1: 7, q3: 7, lowWhisker: 7, highWhisker: 7 })
  assert.deepEqual(single.bins, [{ upper: 7, count: 1 }])
  assert.equal(single.outliers.status, 'constant')
  const small = describeNumbers(Float64Array.of(2, 6))
  assert.deepEqual(small.box, { q1: 3, q3: 5, lowWhisker: 2, highWhisker: 6 })
  assert.equal(small.outliers.status, 'smallSample')
})

function scatter(csv: string) {
  const data = normalizeCsv(csv, defaultCsvOptions)
  return calculateStatistic(data, missingPolicy(['NA']), { 'column-1': 'numeric', 'column-2': 'numeric' },
    { operation: 'pearson', columns: ['column-1', 'column-2'] })
}

test('scatter uses complete same-record pairs and retains constant and single-point data', () => {
  const result = scatter('x,y\n2,30\nNA,40\n5,bad\n4,30\n0,NA')
  assert.deepEqual([result.valid, result.missingOnly, result.invalid], [2, 2, 1])
  assert.equal(result.reason, 'constantInput')
  assert.deepEqual(result.scatter, { kind: 'points', x: [2, 4], y: [30, 30], points: [[2, 30], [4, 30]] })
  assert.equal(scatter('x,y\n2,NA').scatter, undefined)
  assert.deepEqual(scatter('x,y\n2,30').scatter, { kind: 'points', x: [2, 2], y: [30, 30], points: [[2, 30]] })
})

test('density grid counts every complete pair, honors boundaries and bounds payload', () => {
  const result = scatter('x,y\n' + '0,0\n1,1\n16,16\n'.repeat(33000) + 'NA,16\n16,invalid')
  assert.deepEqual([result.valid, result.missingOnly, result.invalid], [99000, 1, 1])
  const plot = result.scatter
  assert.equal(plot?.kind, 'density')
  if (plot?.kind !== 'density') return
  assert.deepEqual(plot.xEdges, Array.from({ length: 16 }, (_, i) => i + 1))
  assert.deepEqual(plot.yEdges, plot.xEdges)
  assert.deepEqual(plot.cells, [{ x: 0, y: 0, count: 66000 }, { x: 15, y: 15, count: 33000 }])
  assert.equal(plot.cells.reduce((n, cell) => n + cell.count, 0), result.valid)
  assert.equal(scatter('x,y\n' + '0,0\n'.repeat(256)).scatter?.kind, 'points')
  assert.equal(scatter('x,y\n' + '0,0\n'.repeat(257)).scatter?.kind, 'density')
})

test('linear chart domain safely includes extreme endpoints and no invented constant range', () => {
  const domain = [-Number.MAX_VALUE, Number.MAX_VALUE] as const
  assert.deepEqual([position(domain[0], domain), position(0, domain), position(domain[1], domain)], [0, 0.5, 1])
  assert.equal(position(2, [2, 2]), 0.5)
  assert.equal(position(Number.MIN_VALUE, [0, Number.MIN_VALUE]), 1)
})
