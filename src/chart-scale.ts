export type Domain = readonly [min: number, max: number]

/** Finite linear coordinates even when the difference of finite endpoints overflows. */
export function position(value: number, [min, max]: Domain): number {
  if (min === max) return 0.5
  const span = max - min
  return Number.isFinite(span)
    ? (value - min) / span
    : (value / 2 - min / 2) / (max / 2 - min / 2)
}

/** Upper edges for linear bins, with coincident binary64 edges merged. */
export function linearEdges(min: number, max: number, bins: number) {
  const edges: number[] = []
  for (let i = 1; i <= bins; i++) {
    const ratio = i / bins
    const edge = i === bins ? max : min < 0 && max > 0
      ? min * (1 - ratio) + max * ratio
      : min + (max - min) * ratio
    if (edges.at(-1) !== edge) edges.push(edge)
  }
  return edges
}
