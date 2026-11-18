import { linearEdges } from './chart-scale.ts'
import type { Domain } from './chart-scale.ts'

export type Point = readonly [x: number, y: number]

export type ScatterData = { x: Domain; y: Domain } & (
  | { kind: 'points'; points: Point[] }
  | { kind: 'density'; xEdges: number[]; yEdges: number[]; cells: { x: number; y: number; count: number }[] }
)

const pointLimit = 256
const gridResolution = 16

// Match the histogram convention: upper edges are inclusive, and the first
// bin also includes the observed minimum. Binary search keeps work bounded.
function bin(edges: number[], value: number) {
  let left = 0
  let right = edges.length - 1
  while (left < right) {
    const mid = (left + right) >>> 1
    if (value <= edges[mid]) right = mid
    else left = mid + 1
  }
  return left
}

export class ScatterAccumulator {
  private readonly points: Point[] = []
  private xMin = Infinity
  private xMax = -Infinity
  private yMin = Infinity
  private yMax = -Infinity

  add(x: number, y: number) {
    if (this.points.length <= pointLimit) this.points.push([x, y])
    this.xMin = Math.min(this.xMin, x)
    this.xMax = Math.max(this.xMax, x)
    this.yMin = Math.min(this.yMin, y)
    this.yMax = Math.max(this.yMax, y)
  }

  finish(pairs: () => Iterable<Point>): ScatterData | undefined {
    if (this.points.length === 0) return undefined
    const x: Domain = [this.xMin, this.xMax]
    const y: Domain = [this.yMin, this.yMax]
    if (this.points.length <= pointLimit) return { kind: 'points', x, y, points: this.points }

    const xEdges = linearEdges(...x, gridResolution)
    const yEdges = linearEdges(...y, gridResolution)
    const counts = new Uint32Array(xEdges.length * yEdges.length)
    for (const [px, py] of pairs()) counts[bin(yEdges, py) * xEdges.length + bin(xEdges, px)]++
    const cells: { x: number; y: number; count: number }[] = []
    counts.forEach((count, index) => {
      if (count) cells.push({ x: index % xEdges.length, y: Math.floor(index / xEdges.length), count })
    })
    return { kind: 'density', x, y, xEdges, yEdges, cells }
  }
}
