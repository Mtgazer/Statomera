import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { defaultCsvOptions } from '../../src/dataset.ts'
import { calculateInference } from '../../src/inference.ts'
import type { InferenceRequest } from '../../src/inference-contract.ts'
import { normalizeJson } from '../../src/json.ts'
import { missingPolicy, normalizeCsv } from '../../src/normalize.ts'
import { studentCritical, studentLogTwoSided } from '../../src/student-t.ts'

const reference = JSON.parse(readFileSync(new URL('../reference/inference-scipy.json', import.meta.url), 'utf8'))
const marker = missingPolicy(['NA'])

function close(actual: number | null | undefined, expected: number, relative = 1e-10, absolute = 2e-13) {
  assert.ok(actual !== null && actual !== undefined &&
    Math.abs(actual - expected) <= Math.max(absolute, Math.abs(expected) * relative), `${actual} vs ${expected}`)
}

function infer(text: string, request: Partial<InferenceRequest> = {}) {
  return calculateInference(normalizeCsv(text, defaultCsvOptions), marker, {}, {
    method: 'oneSample', column: 'column-1', level: 95, nullMean: 0, ...request,
  })
}

test('matches independent SciPy critical values and direct log survival references', () => {
  assert.equal(reference.scipy, '1.16.3')
  for (const [df, level, expected] of reference.critical) close(studentCritical(df, level), expected)
  for (const [df, t, expected] of reference.tails) {
    close(studentLogTwoSided(Math.log(t), df), expected, 4e-12, 5e-12)
  }
  assert.equal(studentLogTwoSided(-Infinity, 10), 0)
  // For df=1 the two-sided Cauchy tail is 2 atan(1/t) / pi.
  close(studentCritical(1, 95), 1 / Math.tan(Math.PI * 0.025), 1e-13)
  close(studentLogTwoSided(Math.log(1e300), 1), Math.log((2 / Math.PI) * Math.atan(1e-300)), 2e-15)
})

test('matches SciPy one-sample, Welch, paired and interval references', () => {
  for (const { method, x, y, level, nullMean, expected } of reference.cases) {
    let data = ['salary', ...x]
    const request: Partial<InferenceRequest> = { method, level, nullMean }
    if (method === 'welch') {
      data = ['salary,المجموعة', ...x.map((value: number) => value + ',علاج'),
        ...y.map((value: number) => value + ',ضبط')]
      request.groupColumn = 'column-2'
      request.groups = ['علاج', 'ضبط']
    }
    if (method === 'paired') {
      data = ['salary,matched', ...x.map((value: number, i: number) => value + ',' + y[i])]
      request.second = 'column-2'
    }
    const result = infer(data.join('\n'), request)
    assert.equal(result.reason, null, method)
    for (const field of ['estimate', 'degrees', 't'] as const) {
      if (field in expected) close(result[field], expected[field])
    }
    close(result.interval?.lower, expected.lower)
    close(result.interval?.upper, expected.upper)
    if ('p' in expected) {
      close(result.p, expected.p, 1e-10, 0)
      close(result.effect?.value, expected.effect)
    } else {
      assert.equal(result.p, null)
      assert.equal(result.t, null)
      assert.equal(result.effect, null)
    }
  }
})

test('preserves pair alignment and partitions invalid and missing exclusions', () => {
  const result = infer('salary,y\n12,10\n14,8\n15,17\n20,18\n21,20\nNA,2\nbad,NA\n90,1e9999', {
    method: 'paired', second: 'column-2',
  })
  assert.deepEqual(result.counts, [{ valid: 5, missing: 1, invalid: 2 }])
  assert.equal(result.excluded, 3)
  assert.equal(result.estimate, 1.8)
  close(result.t, reference.cases.at(-1).expected.t)
})

test('Welch groups are mutually exclusive, directional and retain exclusion counts', () => {
  const rows = 'salary,group\n4,علاج\n6,علاج\n1,ضبط\n3,ضبط\nNA,علاج\nbad,ضبط\n20,آخر\n13,NA'
  const request = { method: 'welch', groupColumn: 'column-2', groups: ['علاج', 'ضبط'] } satisfies Partial<InferenceRequest>
  const result = infer(rows, request)
  assert.deepEqual(result.counts, [{ valid: 2, missing: 1, invalid: 0 }, { valid: 2, missing: 0, invalid: 1 }])
  assert.equal(result.outsideGroups, 2)
  assert.equal(result.excluded, 4)
  assert.equal(result.estimate, 3)
  assert.equal(result.effect?.definition, 'averageVarianceD')
  const reverse = infer(rows, { ...request, groups: ['ضبط', 'علاج'] })
  assert.equal(reverse.estimate, -3)
  assert.equal(reverse.t, -result.t!)
  assert.equal(reverse.p, result.p)
  assert.throws(() => infer(rows, { ...request, groups: ['ضبط', 'ضبط'] }), { code: 'options' })
  assert.throws(() => infer(rows, { ...request, groupColumn: 'column-1' }), { code: 'options' })
})

test('structured Boolean group membership follows inference and schema overrides', () => {
  const rows = [true, false, true, false, false, 'true'].map((group, i) => ({ salary: i + 1, group }))
  const data = normalizeJson(JSON.stringify(rows), defaultCsvOptions)
  const request = { method: 'welch', column: 'column-1', level: 95,
    groupColumn: 'column-2', groups: ['true', 'false'] } satisfies InferenceRequest
  const automatic = calculateInference(data, marker, {}, request)
  assert.deepEqual(automatic.counts.map(count => count.valid), [2, 3])
  assert.equal(automatic.outsideGroups, 1)
  const overridden = calculateInference(data, marker, { 'column-2': 'boolean' }, request)
  assert.deepEqual(overridden.counts.map(count => count.valid), [3, 3])
  assert.equal(overridden.outsideGroups, 0)
})

test('invalid inference requests and unidentifiable tests have explicit outcomes', () => {
  assert.throws(() => infer('salary\n1\n2', { nullMean: Infinity }), { code: 'options' })
  assert.throws(() => infer('salary\n1\n2', { method: 'paired', second: 'column-1' }), { code: 'options' })
  assert.equal(infer('salary\n4').reason, 'insufficient')
  for (const method of ['meanInterval', 'oneSample'] as const) {
    const result = infer('salary\n4\n4', { method })
    assert.equal(result.estimate, 4)
    assert.equal(result.reason, 'zeroVariance')
    assert.equal(result.interval, null)
    assert.equal(result.p, null)
  }
  assert.equal(infer('salary,g\n2,A\n2,A\n3,B\n3,B', {
    method: 'welch', groupColumn: 'column-2', groups: ['A', 'B'],
  }).reason, 'zeroVariance')
})

test('extreme scales preserve finite inference fields and never expose zero for an underflowed p-value', () => {
  const small = infer('salary\n1e-300\n2e-300\n3e-300')
  close(small.t, Math.sqrt(12))
  assert.ok(small.interval && small.interval.lower! < 0 && small.interval.upper! > 0)
  const large = infer('salary,y\n1e308,-1e308\n1e308,-8e307', { method: 'paired', second: 'column-2' })
  assert.equal(large.estimate, null)
  close(large.t, 19)
  assert.ok(large.interval?.lower && large.interval.lower > 0)
  assert.equal(large.interval?.upper, null)
  const farNull = infer('salary\n0\n5e-324', { nullMean: -1e-14 })
  assert.equal(farNull.t, null)
  assert.ok(farNull.p && farNull.p > 1e-311 && farNull.p < 1e-309)
  const underflow = infer('salary\n' + '1\n2\n3\n'.repeat(10), { nullMean: 1e308 })
  assert.equal(underflow.p, null)
  assert.ok(underflow.logP! < -10000)
  assert.ok(underflow.warnings.includes('pUnderflow'))
})
