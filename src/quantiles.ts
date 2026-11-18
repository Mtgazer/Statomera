import { Binary64Parts, roundUnits } from './mean.ts'

/** Type 7 quantile on a nonempty sorted binary64 sample, with integer percentages. */
export function quantile(sorted: Float64Array, percent: number) {
  const rank = (sorted.length - 1) * percent
  const index = Math.floor(rank / 100)
  const remainder = rank % 100
  if (!remainder) return { value: sorted[index], exactNonzero: sorted[index] !== 0 }
  const parts = new Binary64Parts()
  const numerator = BigInt(100 - remainder) * parts.read(sorted[index]) +
    BigInt(remainder) * parts.read(sorted[index + 1])
  return { value: roundUnits(numerator, 100n), exactNonzero: numerator !== 0n }
}
