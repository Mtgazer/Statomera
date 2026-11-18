import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Binary64Mean } from '../../src/mean.ts'

function mean(values: number[]) {
  const calculator = new Binary64Mean()
  for (const value of values) calculator.add(value)
  return calculator.result()
}

test('matches independently derived means, including cancellation and overflow', () => {
  assert.equal(mean([]), null)
  assert.equal(mean([10, 20, 30]), 20)
  assert.equal(mean([-5, 0, 6]), 1 / 3)
  assert.equal(mean([1e308, 1, -1e308]), 1 / 3)
  assert.equal(mean([Number.MAX_VALUE, Number.MAX_VALUE]), Number.MAX_VALUE)
  assert.equal(mean([1e308, 1e308, -1e308, -1e308]), 0)
  assert.equal(mean([-Number.MIN_VALUE]), -Number.MIN_VALUE)
})

test('rounds binary64 midpoints to even in normal and subnormal ranges', () => {
  const { EPSILON: e, MIN_VALUE: m } = Number
  assert.equal(mean([1, 1 + e]), 1)
  assert.equal(mean([1 + e, 1 + 2 * e]), 1 + 2 * e)
  assert.equal(mean([0, m]), 0)
  assert.equal(mean([m, 2 * m]), 2 * m)
  assert.equal(mean([-m, -2 * m]), -2 * m)
})
