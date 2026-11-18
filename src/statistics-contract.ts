import type { ScatterData } from './scatter.ts'

export const statisticMethods = {
  count: 'count',
  sum: 'sum',
  mean: 'mean',
  median: 'quantile',
  min: 'extreme',
  max: 'extreme',
  range: 'range',
  sampleVariance: 'sampleMoment',
  populationVariance: 'populationMoment',
  sampleSd: 'sampleRoot',
  populationSd: 'populationRoot',
  q1: 'quantile',
  q3: 'quantile',
  p90: 'quantile',
  p95: 'quantile',
  pearson: 'pairedPearson',
} as const

export type StatisticOperation = keyof typeof statisticMethods
export type StatisticMethod = typeof statisticMethods[StatisticOperation]
export type StatisticWarning = 'excluded' | 'roundedToZero'
export type UndefinedStatistic = 'noObservations' | 'insufficientObservations' | 'constantInput' | 'numericRange'

export interface StatisticRequest {
  operation: StatisticOperation
  columns: string[]
}

export interface StatisticResult extends StatisticRequest {
  method: StatisticMethod
  value: number | null
  valid: number
  excluded: number
  missingOnly: number
  invalid: number
  warnings: StatisticWarning[]
  reason: UndefinedStatistic | null
  scatter?: ScatterData
}
