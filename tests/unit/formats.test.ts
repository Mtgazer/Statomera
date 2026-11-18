import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateFile } from '../../src/csv.ts'
import { defaultCsvOptions } from '../../src/dataset.ts'
import { normalizeJson } from '../../src/json.ts'
import { profileDataset } from '../../src/profile.ts'
import { normalizeXlsx } from '../../src/xlsx.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
const book = () => new Blob([fixture('worksheets.xlsx')])

test('JSON preserves native strings, booleans and numeric tokens for validation', () => {
  const data = normalizeJson(fixture('flat.json').toString(), defaultCsvOptions)
  const result = profileDataset(data, () => false)
  assert.deepEqual(result.columns.map(c => c.type), ['text', 'numeric', 'text', 'boolean'])
  assert.equal(result.rows, 4)
  assert.equal(result.columns[1].numeric?.mean, 20)
  assert.deepEqual(result.columns[1].rejected, [{ record: 4, value: '9007199254740993' }])
  assert.equal(result.columns[1].blank, 1)
  assert.equal(result.columns[3].blank, 1)
  assert.equal(result.preview[0][0], '001')
  const quotes = normalizeJson('[{"x":"12"},{"x":"30"}]', defaultCsvOptions)
  assert.equal(profileDataset(quotes, () => false).columns[0].type, 'text')
  assert.equal(profileDataset(quotes, () => false, undefined, { 'column-1': 'numeric' }).columns[0].numeric?.mean, 21)
})

test('JSON rejects unsupported shapes and duplicate keys, accepts sparse flat rows', () => {
  for (const input of ['{}', '[1]', '[{"a":{"b":1}}]', '[{"a":[1]}]', '[{"a":1,"a":2}]',
    '[{"a":01}]', '[{"a":1,}]', '[{"a":1}] false', '[{"a":1},]']) {
    assert.throws(() => normalizeJson(input, defaultCsvOptions), { code: 'jsonShape' })
  }
  assert.throws(() => normalizeJson('[]', defaultCsvOptions), { code: 'empty' })
  const data = normalizeJson('[{"__proto__":"local"},{"other":40}]', defaultCsvOptions)
  assert.deepEqual(profileDataset(data, () => false).preview, [['local', ''], ['', '40']])
  assert.throws(() => normalizeJson('[{"a":"' + 'x'.repeat(4097) + '"}]', defaultCsvOptions), { code: 'fieldLimit' })
  assert.throws(() => validateFile('example.parquet', 12), { code: 'parquetDeferred' })
})

test('XLSX reads worksheet names, cached values, missing cells, dates and error cells', async () => {
  const dataset = await normalizeXlsx(book(), defaultCsvOptions, info => {
    assert.deepEqual(info, { names: ['مبيعات', 'Second', 'Merged', 'Uncached', 'Timestamp'], selected: 0 })
  })
  const profile = profileDataset(dataset, () => false)
  assert.equal(profile.rows, 4)
  assert.deepEqual(profile.columns.map(c => c.type), ['text', 'numeric', 'date', 'boolean'])
  assert.equal(profile.columns[1].blank, 1)
  assert.equal(profile.columns[1].numeric?.mean, 14)
  assert.deepEqual(profile.columns[3].rejected, [{ record: 4, value: '#DIV/0!' }])
  assert.deepEqual(profile.preview[0], ['001', '10', '2024-02-29', 'true'])
  const next = await normalizeXlsx(book(), { ...defaultCsvOptions, worksheet: 1 }, () => {})
  assert.equal(profileDataset(next, () => false).columns[1].numeric?.mean, 50)
})

test('XLSX rejects malformed, expanded, merged, uncached and timestamp input', async () => {
  const read = (data: Blob, worksheet = 0) => normalizeXlsx(data, { ...defaultCsvOptions, worksheet }, () => {})
  for (const index of [2, 3, 4]) await assert.rejects(read(book(), index), { code: 'xlsxShape' })
  await assert.rejects(read(book(), 9), { code: 'worksheet' })
  await assert.rejects(read(new Blob(['not zip'])), { code: 'xlsxShape' })
  await assert.rejects(read(new Blob([fixture('oversize-workbook.xlsx')])), { code: 'expandedLimit' })
})
