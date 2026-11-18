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
