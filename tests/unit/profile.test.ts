import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CsvError, limits } from '../../src/csv.ts'
import { commonMissingMarkers, defaultCsvOptions } from '../../src/dataset.ts'
import type { CsvOptions } from '../../src/dataset.ts'
import { normalizeCsv, missingPolicy } from '../../src/normalize.ts'
import { profileDataset } from '../../src/profile.ts'

function fixture(name: string) {
  return readFileSync(new URL(`../fixtures/${name}.csv`, import.meta.url), 'utf8')
}

function profile(text: string, overrides: Partial<CsvOptions> = {}) {
  const options = { ...defaultCsvOptions, ...overrides }
  return profileDataset(normalizeCsv(text, options), missingPolicy(options.missingMarkers))
}

test('clean non-salary columns produce independent numerical summaries', () => {
  const result = profile(fixture('clean-numeric'))
  assert.equal(result.salaryColumnId, null)
  assert.equal(result.rows, 4)
  assert.equal(result.columns.length, 2)
  assert.deepEqual(result.columns[0].numeric, { count: 4, mean: 5, min: 2, max: 8, median: 5 })
  assert.deepEqual(result.columns[1].numeric, { count: 4, mean: 1, min: -4, max: 7, median: 0.5 })
})

test('profiles bilingual semicolon data, exact duplicates, and independent quality counts', () => {
  const result = profile(fixture('mixed'), { missingMarkers: commonMissingMarkers })
  const [id, amount, group, enabled, day] = result.columns
  assert.equal(result.rows, 8)
  assert.equal(result.duplicateRows, 1)
  assert.equal(id.sourceName, 'معرّف')
  assert.equal(id.type, 'text')
  assert.ok(id.warnings.includes('leadingZeros'))
  assert.equal(result.preview[0][2], 'شمال, أ')
  assert.deepEqual(amount.numeric, { count: 5, mean: 22, min: 10, max: 40, median: 20 })
  assert.deepEqual([amount.blank, amount.markedMissing, amount.invalid, amount.valid], [1, 1, 1, 5])
  assert.deepEqual(amount.rejected, [{ record: 4, value: 'bad' }])
  assert.deepEqual(group.frequency?.entries, [{ value: 'جنوب', count: 5 }, { value: 'شمال, أ', count: 3 }])
  assert.equal(enabled.type, 'boolean')
  assert.deepEqual(enabled.frequency?.entries, [{ value: 'true', count: 6 }, { value: 'false', count: 2 }])
  assert.equal(day.type, 'date')
  assert.equal(day.invalid, 1)
  assert.ok(day.warnings.includes('dateFormat'))
})

test('missing markers require opt-in and preserve blanks, zero and literal sentinels', () => {
  const text = 'amount\n-999\n0\n1\n2\n3\n" null "\n""'
  const [ordinary] = profile(text).columns
  assert.deepEqual([ordinary.blank, ordinary.markedMissing, ordinary.invalid, ordinary.valid], [1, 0, 1, 5])
  assert.equal(ordinary.numeric?.min, -999)
  const [configured] = profile(text, { missingMarkers: ['null', '-999'] }).columns
  assert.deepEqual([configured.blank, configured.markedMissing, configured.invalid, configured.valid], [1, 2, 0, 4])
  assert.equal(configured.numeric?.mean, 1.5)
})

test('duplicate and no-header policies preserve positional IDs and source labels', () => {
  const text = fixture('duplicate-headers')
  assert.throws(() => profile(text), { code: 'headers' })
  const columns = profile(text, { duplicateHeaders: 'disambiguate' }).columns
  assert.deepEqual(columns.map(({ id, sourceName, duplicateName }) => [id, sourceName, duplicateName]), [
    ['column-1', 'field', true], ['column-2', ' FIELD ', true], ['column-3', 'enabled', false],
  ])
  const tab = profile('3\t8\n7\t10', { header: 'none' })
  assert.equal(tab.rows, 2)
  assert.equal(tab.columns[0].sourceName, null)
  assert.equal(tab.columns[0].numeric?.mean, 5)
  assert.equal(tab.columns[1].numeric?.mean, 9)
  assert.throws(() => profile('one;two,three\n1;2,3'), { code: 'delimiter' })
  assert.equal(profile('one;two,three\n1;2,3', { delimiter: ';' }).columns.length, 2)
})

test('a headerless tab-separated record can consist entirely of blanks', () => {
  const result = profile('\t\n', { header: 'none' })
  assert.equal(result.rows, 1)
  assert.deepEqual(result.columns.map(({ type, blank }) => [type, blank]), [['empty', 1], ['empty', 1]])
})

test('ambiguous dates and leading zeros remain text and out-of-range numerics are reported', () => {
  const result = profile('day,id,amount\n01/02/2024,001,5\n2023-02-29,002,9\n04/03/2024,003,7\n2024-01-01,4,4\n2024-01-02,5,9007199254740993')
  assert.equal(result.columns[0].type, 'text')
  assert.ok(result.columns[0].warnings.includes('dateFormat'))
  assert.equal(result.columns[1].type, 'text')
  assert.ok(result.columns[1].warnings.includes('leadingZeros'))
  assert.equal(result.columns[2].invalid, 1)
  assert.ok(result.columns[2].warnings.includes('numericRange'))
  assert.equal(result.columns[2].numeric?.mean, 6.25)
})

test('row equality preserves cell boundaries, whitespace, case, and Unicode spelling', () => {
  const result = profile('x,y\n"a,b",c\na,"b,c"\n"a,b",c\n a,"b,c"\nA,"b,c"\né,1\né,1')
  assert.equal(result.duplicateRows, 1)
})

test('high-cardinality reports and mixed-type decisions stay bounded and explicit', () => {
  const entries = Array.from({ length: 1030 }, (_, i) => `item ${i}`)
  const [column] = profile(['label', ...entries].join('\n')).columns
  assert.equal(column.valid, 1030)
  assert.equal(column.frequency, null)
  assert.ok(column.warnings.includes('manyCategories'))
  const [mixed] = profile('sample\n12\nblue\n25\nred').columns
  assert.equal(mixed.type, 'text')
  assert.equal(mixed.invalid, 0)
  assert.ok(mixed.warnings.includes('mixed'))
})

test('resource and malformed-input gates fail before publishing a profile', () => {
  assert.throws(() => profile(fixture('empty')), { code: 'empty' })
  assert.throws(() => profile(fixture('malformed')), { code: 'structure' })
  assert.throws(() => profile('x\n1', { missingMarkers: [' '] }), { code: 'options' })
  const row = Array(limits.columns).fill('x').join(',')
  const columns = Array.from({ length: limits.columns }, (_, index) => `c${index}`).join(',')
  assert.throws(() => profile(columns + '\n' + (row + '\n').repeat(limits.cells / limits.columns + 1)),
    error => error instanceof CsvError && error.code === 'cellLimit')
})

test('schema overrides reuse strict conversions and preserve raw rejected values', () => {
  const dataset = normalizeCsv('أجر,enabled,date\n10,صحيح,2024-02-29\n$20,yes,03/04/2024\n1,خطأ,2023-02-29', defaultCsvOptions)
  const result = profileDataset(dataset, () => false, undefined, {
    'column-1': 'numeric', 'column-2': 'boolean', 'column-3': 'date',
  })
  assert.deepEqual(result.columns.map(column => [column.override, column.valid, column.invalid]), [
    ['numeric', 2, 1], ['boolean', 2, 1], ['date', 1, 2],
  ])
  assert.equal(result.columns[0].numeric?.mean, 5.5)
  assert.deepEqual(result.columns[2].rejected.map(value => value.value), ['03/04/2024', '2023-02-29'])
  assert.equal(result.preview[1][0], '$20')
  const text = profileDataset(dataset, () => false, undefined, { 'column-1': 'text' })
  assert.equal(text.columns[0].valid, 3)
  assert.equal(text.columns[0].numeric, null)
  assert.throws(() => profileDataset(dataset, () => false, undefined, { 'column-4': 'text' }), { code: 'options' })
})
