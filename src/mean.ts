// Accumulate finite binary64 inputs as integer multiples of 2^-1074.
// The integer is bounded by the binary64 range plus log2(the row limit).
export class Binary64Mean {
  private readonly bits = new DataView(new ArrayBuffer(8))
  private total = 0n
  private count = 0

  add(value: number) {
    this.bits.setFloat64(0, value)
    const bits = this.bits.getBigUint64(0)
    const exponent = Number((bits >> 52n) & 0x7ffn)
    const fraction = bits & ((1n << 52n) - 1n)
    const units = exponent === 0 ? fraction : ((1n << 52n) | fraction) << BigInt(exponent - 1)
    this.total += bits >> 63n ? -units : units
    this.count++
  }

  result(): number | null {
    if (this.count === 0) return null
    const negative = this.total < 0n
    const magnitude = negative ? -this.total : this.total
    const count = BigInt(this.count)
    // Round the exact quotient to the nearest representable binary64, ties to even.
    const shift = Math.max(0, (magnitude / count).toString(2).length - 53)
    const divisor = count << BigInt(shift)
    const quotient = magnitude / divisor
    const twiceRemainder = 2n * (magnitude % divisor)
    const roundUp = twiceRemainder > divisor || (twiceRemainder === divisor && quotient % 2n === 1n)
    const mean = Number(quotient + (roundUp ? 1n : 0n)) * 2 ** (shift - 1074)
    return negative && mean !== 0 ? -mean : mean
  }
}
