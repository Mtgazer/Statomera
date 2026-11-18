import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { defaultCsvOptions } from '../../src/dataset.ts'
import { missingPolicy, normalizeCsv } from '../../src/normalize.ts'
import { profileDataset } from '../../src/profile.ts'
import { describeNumbers } from '../../src/quality.ts'

function profile(csv: string) {
  return profileDataset(normalizeCsv(csv, defaultCsvOptions), missingPolicy(['NA']))
}

test('quality counts separate blanks, markers, invalid cells and exact duplicate groups', () => {
  const csv = readFileSync(new URL('../fixtures/phase-3-quality.csv', import.meta.url), 'utf8')
  const result = profile(csv)
  const [salary, region, note] = result.columns
  assert.equal(result.rows, 14)
  assert.deepEqual([salary.blank, salary.markedMissing, salary.invalid, salary.valid], [2, 1, 3, 8])
  assert.equal(salary.missingRate, 3 / 14)
  assert.equal(note.missingRate, 3 / 14)
  assert.deepEqual(result.missingPatterns, { complete: 11, entries: [{ columns: [0, 2], count: 3 }], other: 0 })
  assert.equal(result.duplicateRows, 3)
  assert.deepEqual(result.duplicateFrequency, { groups: 2, entries: [
    { occurrences: 2, groups: 1 }, { occurrences: 3, groups: 1 },
  ] })
  assert.deepEqual(region.findings, ['constant'])
  assert.deepEqual(region.frequency?.entries, [{ value: 'شمال', count: 14 }])
  assert.deepEqual(salary.findings, ['substantialMissing', 'invalid', 'ambiguous', 'outliers'])
  // Ordered valid sample 1–7, 100 gives quartile ranks 1.75 and 5.25 (zero-based).
  assert.deepEqual(salary.distribution?.outliers, {
    status: 'assessed', q1: 2.75, q3: 6.25, lower: -2.5, upper: 11.5, below: 0, above: 1,
  })
  assert.deepEqual(salary.distribution?.bins.map(bin => bin.count), [7, 0, 0, 0, 0, 0, 0, 1])
})

test('IQR handles small, constant, zero-spread and extreme samples and uses strict fences', () => {
  const describe = (numbers: number[]) => describeNumbers(Float64Array.from(numbers))
  assert.equal(describe([1, 2, 300]).outliers.status, 'smallSample')
  assert.deepEqual(describe([3, 3]).bins, [{ upper: 3, count: 2 }])
  assert.equal(describe([3, 3]).outliers.status, 'constant')
  assert.equal(describe([1, 1, 1, 1, 1, 1, 1, 99]).outliers.status, 'zeroIqr')
  assert.deepEqual(describe([-3, 0, 0, 0, 2, 2, 2, 5]).outliers, {
    status: 'assessed', q1: 0, q3: 2, lower: -3, upper: 5, below: 0, above: 0,
  })
  assert.deepEqual(describe([-4, 0, 0, 0, 2, 2, 2, 6]).outliers, {
    status: 'assessed', q1: 0, q3: 2, lower: -3, upper: 5, below: 1, above: 1,
  })
  const extreme = describe([-1e308, -8e307, -7e307, -6e307, 6e307, 7e307, 8e307, 1e308])
  assert.equal(extreme.outliers.status, 'range')
  assert.ok(extreme.bins.every(bin => Number.isFinite(bin.upper)))
  assert.equal(extreme.bins.reduce((sum, bin) => sum + bin.count, 0), 8)
  assert.deepEqual(describe([1, 2, 3, 4, 5, 6, 7, 9]).bins.map(bin => bin.count), [2, 1, 1, 1, 1, 1, 0, 1])
})

test('quality rules handle empty denominators and require a valid sample for variation', () => {
  assert.equal(profile('value').columns[0].missingRate, null)
  assert.deepEqual(profile('value\n' + '😀\n'.repeat(19) + 'شمال').columns[0].findings, ['lowVariation'])
  assert.deepEqual(profile('value\n' + '😀\n'.repeat(18) + 'شمال').columns[0].findings, [])
  assert.deepEqual(profile('value\n1\n1.0').columns[0].findings, ['constant'])
  assert.equal(profile('value\n1\n1.0').duplicateRows, 0)
})

test('pattern memory is bounded, handles the 32nd column and reconciles every record', () => {
  const columns = Array.from({ length: 32 }, (_, index) => 'c' + index)
  const rows = Array.from({ length: 1000 }, (_, mask) =>
    columns.map((_, index) => index === 31 || (mask & (1 << index)) ? 'NA' : 'ok').join(','))
  const result = profile([columns.join(','), ...rows, rows[0], rows[0], rows[999]].join('\n'))
  const { complete, entries, other } = result.missingPatterns
  assert.equal(complete, 0)
  assert.equal(entries.length, 8)
  assert.deepEqual(entries[0], { columns: [31], count: 3 })
  assert.equal(other, 993)
  assert.equal(entries.reduce((sum, row) => sum + row.count, 0) + other, result.rows)
  assert.equal(result.duplicateFrequency.groups, 2)
})

test('near-limit records keep exact totals and return bounded diagnostics', () => {
  const rows = 100_000
  const result = profile('value,label\n' + '2,جنوب\n3,NA\n'.repeat(rows / 2))
  assert.equal(result.rows, rows)
  assert.equal(result.duplicateRows, rows - 2)
  assert.deepEqual(result.duplicateFrequency.entries, [{ occurrences: rows / 2, groups: 2 }])
  assert.deepEqual(result.missingPatterns, {
    complete: rows / 2, entries: [{ columns: [1], count: rows / 2 }], other: 0,
  })
  assert.equal(result.preview.length, 8)
  assert.equal(result.columns[0].numeric?.mean, 2.5)
})
