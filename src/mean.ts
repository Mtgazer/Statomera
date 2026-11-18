// Finite binary64 values are signed integers in units of 2^-1074.
export class Binary64Parts {
  private readonly bits = new DataView(new ArrayBuffer(8))
  significand = 0n
  shift = 0n

  read(value: number) {
    this.bits.setFloat64(0, value)
    const bits = this.bits.getBigUint64(0)
    const exponent = (bits >> 52n) & 0x7ffn
    const fraction = bits & ((1n << 52n) - 1n)
    const significand = exponent === 0n ? fraction : (1n << 52n) | fraction
    this.significand = bits >> 63n ? -significand : significand
    this.shift = exponent === 0n ? 0n : exponent - 1n
    return this.significand << this.shift
  }
}

export function roundUnits(numerator: bigint, denominator = 1n): number {
  const negative = numerator < 0n
  const magnitude = negative ? -numerator : numerator
  const shift = Math.max(0, (magnitude / denominator).toString(2).length - 53)
  const divisor = denominator << BigInt(shift)
  const quotient = magnitude / divisor
  const twiceRemainder = 2n * (magnitude % divisor)
  const roundUp = twiceRemainder > divisor || (twiceRemainder === divisor && quotient % 2n === 1n)
  const value = Number(quotient + (roundUp ? 1n : 0n)) * 2 ** (shift - 1074)
  return negative && value !== 0 ? -value : value
}

export class Binary64Mean {
  private readonly parts = new Binary64Parts()
  private total = 0n
  private count = 0

  add(value: number) {
    this.total += this.parts.read(value)
    this.count++
  }

  result(): number | null {
    return this.count ? roundUnits(this.total, BigInt(this.count)) : null
  }
}

export function integerRoot(squared: bigint): bigint {
  if (squared === 0n) return 0n
  let root = 1n << BigInt(Math.ceil(squared.toString(2).length / 2))
  let next = (root + squared / root) / 2n
  while (next < root) {
    root = next
    next = (root + squared / root) / 2n
  }
  return root
}

// Round sqrt(numerator / denominator) expressed in binary64's smallest units.
// Locate the binary64 spacing first. Compare the exact squared midpoint for ties to even.
export function roundRootUnits(numerator: bigint, denominator: bigint) {
  if (!numerator) return 0
  const bits = (numerator / denominator).toString(2).length
  const shift = Math.max(0, Math.floor((bits - 1) / 2) - 52)
  const divisor = denominator << BigInt(2 * shift)
  const squared = numerator / divisor
  let root = integerRoot(squared)
  const midpoint = 2n * root + 1n
  const comparison = 4n * numerator - divisor * midpoint * midpoint
  if (comparison > 0n || (comparison === 0n && root % 2n !== 0n)) root++
  return Number(root) * 2 ** (shift - 1074)
}

// Sum and product accumulators are exact for the accepted binary64 observations.
export class Moments {
  readonly parts = new Binary64Parts()
  total = 0n
  squares = 0n

  add(value: number, square: boolean) {
    this.total += this.parts.read(value)
    if (square) this.squares += this.parts.significand ** 2n << (2n * this.parts.shift)
  }

  centeredSumNumerator(n: bigint) {
    return n * this.squares - this.total ** 2n
  }
}
