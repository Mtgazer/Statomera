import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CsvError, decodeCsv, limits, validateFile } from '../../src/csv.ts'
import type { InputError } from '../../src/csv.ts'
import { defaultCsvOptions } from '../../src/dataset.ts'
import { normalizeCsv } from '../../src/normalize.ts'
import { profileDataset } from '../../src/profile.ts'
import { formatNumber, messages } from '../../src/locale.ts'

function profileCsv(text: string) {
  const values: number[] = []
  const profile = profileDataset(normalizeCsv(text, defaultCsvOptions), () => false, value => values.push(value))
  return { profile, numericCsv: values.join('\n') }
}

function rejects(action: () => unknown, code: InputError) {
  assert.throws(action, error => error instanceof CsvError && error.code === code)
}

test('fixture separates five records into known valid, blank and invalid counts', () => {
  const csv = readFileSync(new URL('../fixtures/salary.csv', import.meta.url), 'utf-8')
  const { profile, numericCsv } = profileCsv(csv)
  assert.deepEqual(profile.columns.map(column => column.sourceName), ['employee', 'salary'])
  assert.equal(profile.rows, 5)
  assert.equal(profile.columns.at(-1)?.valid, 3)
  assert.deepEqual(profile.columns.map(column => column.blank), [0, 1])
  assert.equal(profile.columns.at(-1)?.invalid, 1)
  assert.deepEqual(profile.columns.at(-1)?.rejected, [{ record: 4, value: 'N/A' }])
  assert.equal(numericCsv, '10\n20\n30')
})

test('handles BOM, Arabic headers, quoted commas, doubled quotes and line breaks', () => {
  const { profile, numericCsv } = profileCsv('\ufeff"اسم الموظف",الراتب\r\n"أحمد, The ""A""",10\r\n"سطر\nثانٍ",20\r\n')
  assert.deepEqual(profile.columns.map(column => column.sourceName), ['اسم الموظف', 'الراتب'])
  assert.deepEqual(profile.preview, [['أحمد, The "A"', '10'], ['سطر\nثانٍ', '20']])
  assert.equal(numericCsv, '10\n20')
})

test('preserves zero and numeric sentinels, rejects overflow, underflow and non-decimal tokens', () => {
  const { profile, numericCsv } = profileCsv('salary\n0\n-999\n" "\n""\nNA\n0x10\n1e309\n1e-400\nInfinity\n1.75e308\n-5e-324')
  assert.equal(profile.rows, 11)
  assert.equal(profile.columns.at(-1)?.valid, 4)
  assert.equal(profile.columns.at(-1)?.invalid, 5)
  assert.equal(profile.columns[0].blank, 2)
  assert.equal(numericCsv, '0\n-999\n1.75e+308\n-5e-324')
})

test('allows header-only and all-excluded datasets', () => {
  assert.equal(profileCsv('salary\n').profile.rows, 0)
  const result = profileCsv('salary\n""\nfalse\n')
  assert.equal(result.profile.columns.at(-1)?.valid, 0)
  assert.equal(result.numericCsv, '')
})

test('rejects empty, malformed and inconsistent records and missing or duplicate headers', () => {
  for (const [csv, code] of [
    ['', 'empty'], ['  ', 'empty'],
    ['salary, salary\n1,2', 'headers'],
    ['salary,\n1,2', 'headers'],
    ['a,salary\nx', 'rowWidth'], ['salary\n1,2', 'rowWidth'],
    ['salary\n"12', 'structure'], ['salary\n"12"x', 'structure'],
    ['salary\n1"2', 'structure'], ['salary\n1\0', 'structure'],
  ] as const) {
    rejects(() => profileCsv(csv), code)
  }
  assert.equal(profileCsv('a,salary\nx,').profile.columns[1].blank, 1)
  assert.equal(profileCsv('name\nx').profile.columns[0].type, 'text')
  assert.equal(profileCsv('salary,راتب\n1,2').profile.salaryColumnId, null)
})

test('checks resource caps and bounds preview and diagnostics', () => {
  rejects(() => validateFile('example.xlsx', 5), 'fileType')
  rejects(() => validateFile('example.csv', 0), 'empty')
  rejects(() => validateFile('example.csv', limits.bytes + 1), 'fileSize')
  rejects(() => decodeCsv(Uint8Array.of(0xff).buffer), 'encoding')
  rejects(() => profileCsv('salary,' + 'x,'.repeat(limits.columns)), 'columnLimit')
  rejects(() => profileCsv('salary\n' + '9'.repeat(limits.field + 1)), 'fieldLimit')
  rejects(() => profileCsv('salary\n' + '1\n'.repeat(limits.rows + 1)), 'rowLimit')
  const result = profileCsv('salary\n' + 'bad\n'.repeat(20)).profile
  assert.equal(result.columns[0].invalid, 20)
  assert.equal(result.preview.length, limits.preview)
  assert.equal(result.columns[0].rejected.length, limits.rejected)
})

test('the same canonical result is localized and both languages cover every state', () => {
  assert.equal(formatNumber(20, 'en'), '20')
  assert.equal(formatNumber(20, 'ar'), '٢٠')
  assert.deepEqual(Object.keys(messages.en), Object.keys(messages.ar))
  assert.deepEqual(Object.keys(messages.en.errors), Object.keys(messages.ar.errors))
})
