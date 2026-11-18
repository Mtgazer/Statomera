// Normalize B(a, 1/2) with the log gamma ratio. Shift a upward before
// the Stirling expansion and subtract the linear terms analytically.
function correction(x: number) {
  const z = 1 / (x * x)
  return (1 / 12 + z * (-1 / 360 + z * (1 / 1260 + z * (-1 / 1680 + z / 1188)))) / x
}

function logInverseBeta(a: number) {
  let recurrence = 0
  while (a < 16) {
    recurrence -= Math.log1p(0.5 / a)
    a++
  }
  return recurrence + 0.5 * Math.log(a / Math.PI) + a * Math.log1p(0.5 / a) - 0.5 +
    correction(a + 0.5) - correction(a)
}

function softplus(x: number) {
  return Math.max(0, x) + Math.log1p(Math.exp(-Math.abs(x)))
}

// Modified Lentz evaluation of the incomplete-beta fraction (NIST DLMF 8.17.22–23).
function betaFraction(a: number, b: number, x: number): number {
  const tiny = 1e-280
  const floorMagnitude = (value: number) => Math.abs(value) < tiny ? (value < 0 ? -tiny : tiny) : value
  let c = 1
  let d = 1 / floorMagnitude(1 - (a + b) * x / (a + 1))
  let fraction = d
  for (let m = 1; m <= 512; m++) {
    const twice = 2 * m
    const even = m * (b - m) * x / ((a + twice - 1) * (a + twice))
    d = 1 / floorMagnitude(1 + even * d)
    c = floorMagnitude(1 + even / c)
    fraction *= d * c
    const odd = -(a + m) * (a + b + m) * x / ((a + twice) * (a + twice + 1))
    d = 1 / floorMagnitude(1 + odd * d)
    c = floorMagnitude(1 + odd / c)
    const delta = c * d
    fraction *= delta
    if (Math.abs(delta - 1) <= 4 * Number.EPSILON) return Math.log(fraction)
  }
  return NaN
}

/** Natural log of P(|T_df| >= |t|), computed without subtracting a rounded CDF. */
export function studentLogTwoSided(logAbsT: number, df: number, normalization = logInverseBeta(df / 2)) {
  if (logAbsT === -Infinity) return 0
  const a = df / 2
  const logRatio = 2 * logAbsT - Math.log(df)
  const logX = -softplus(logRatio)
  const logY = -softplus(-logRatio)
  const front = normalization + a * logX + 0.5 * logY
  // x = df/(df+t²), y = 1-x evaluated independently to retain small complements.
  const y = Math.exp(logY)
  if (y > 1.5 / (a + 2.5)) {
    return Math.min(0, front - Math.log(a) + betaFraction(a, 0.5, Math.exp(logX)))
  }
  return Math.log1p(-Math.exp(front + Math.LN2 + betaFraction(0.5, a, y)))
}

export function studentCritical(df: number, level: number) {
  const logAlpha = Math.log((100 - level) / 100)
  const normalization = logInverseBeta(df / 2)
  let low = 0
  let high = 1
  while (studentLogTwoSided(Math.log(high), df, normalization) > logAlpha) {
    high *= 2
    if (high > 128) return NaN // With df >= 1, supported levels need at most the Cauchy 99% cutoff.
  }
  for (let i = 0; i < 56; i++) {
    const center = (low + high) / 2
    const logTail = studentLogTwoSided(Math.log(center), df, normalization)
    if (Number.isNaN(logTail)) return NaN
    if (logTail > logAlpha) low = center
    else high = center
  }
  return (low + high) / 2
}
