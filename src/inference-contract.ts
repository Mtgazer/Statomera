export const inferenceMethods = ['meanInterval', 'oneSample', 'welch', 'paired'] as const
export const confidenceLevels = [90, 95, 99] as const
export type InferenceMethod = typeof inferenceMethods[number]
export type ConfidenceLevel = typeof confidenceLevels[number]
export type InferenceReason = 'insufficient' | 'zeroVariance' | 'distribution'
export type InferenceWarning = 'smallSample' | 'excluded' | 'constantGroup' | 'outOfRange' | 'pUnderflow' | 'roundedToZero'
export type EffectDefinition = 'cohenD' | 'pairedDz' | 'averageVarianceD'

export type InferenceRequest = {
  method: InferenceMethod
  column: string
  level: ConfidenceLevel
  nullMean?: number
  second?: string
  groupColumn?: string
  groups?: [string, string]
}

export interface InferenceCounts {
  valid: number
  missing: number
  invalid: number
}

export interface InferenceResult {
  request: InferenceRequest
  counts: InferenceCounts[]
  outsideGroups: number
  excluded: number
  estimate: number | null
  interval: { lower: number | null; upper: number | null } | null
  degrees: number | null
  t: number | null
  p: number | null
  logP: number | null
  effect: { definition: EffectDefinition; value: number | null } | null
  reason: InferenceReason | null
  warnings: InferenceWarning[]
}
