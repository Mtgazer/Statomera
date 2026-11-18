import type { ColumnProfile } from '../dataset.ts'
import type { ConfidenceLevel, InferenceMethod } from '../inference-contract.ts'
import type { StatisticOperation } from '../statistics-contract.ts'

export type IntentColumn = Pick<ColumnProfile, 'id' | 'sourceName' | 'type'>
export type IntentLanguage = 'en' | 'ar' | 'mixed' | 'unknown'
export type Convention = 'sample' | 'population'
export type DescriptiveOperation = Extract<StatisticOperation,
  'count' | 'sum' | 'mean' | 'median' | 'min' | 'max' | 'sampleSd' | 'populationSd' | 'sampleVariance' | 'populationVariance'>
export type ProfileOperation = 'rowCount' | 'columnCount' | 'missingCount' | 'invalidCount' | 'duplicateRowCount'

export type AnalysisIntent =
  | { kind: 'profile'; operation: 'rowCount' | 'columnCount'; mode: 'count' }
  | { kind: 'profile'; operation: 'duplicateRowCount'; mode: 'count' | 'presence' }
  | { kind: 'profile'; operation: 'missingCount' | 'invalidCount'; mode: 'count' | 'presence'; column?: IntentColumn }
  | { kind: 'descriptive'; operation: DescriptiveOperation; column: IntentColumn; convention?: Convention }
  | { kind: 'descriptive'; operation: 'pearson'; columns: [IntentColumn, IntentColumn] }
  | { kind: 'inference'; operation: 'meanInterval'; column: IntentColumn; confidence?: ConfidenceLevel }
  | { kind: 'inference'; operation: 'oneSample'; column: IntentColumn; nullMean: number; confidence?: ConfidenceLevel }
  | { kind: 'inference'; operation: 'paired'; columns: [IntentColumn, IntentColumn]; matching: 'sameRow'; confidence?: ConfidenceLevel }
  | { kind: 'inference'; operation: 'welch'; column: IntentColumn; grouping: IntentColumn; groups: [string, string]; confidence?: ConfidenceLevel }

export type IntentOperation = ProfileOperation | DescriptiveOperation | InferenceMethod | 'pearson' | 'comparison' | 'variance' | 'sd'
export type ColumnRole = 'column' | 'first' | 'second' | 'grouping'
export type Clarification =
  | { reason: 'missingColumn'; role: ColumnRole }
  | { reason: 'unknownColumn'; role: ColumnRole; reference: string }
  | { reason: 'ambiguousColumn' | 'ineligibleColumn'; role: ColumnRole; options: IntentColumn[] }
  | { reason: 'ambiguousColumnPair'; options: IntentColumn[] }
  | { reason: 'distinctColumns' | 'distinctGroups' | 'missingGroups' | 'comparisonMethod' | 'convention' | 'rowMatching' }
  | { reason: 'missingNullMean' | 'invalidNullMean' | 'invalidConfidence' | 'conflictingConfidence' }

export type UnsupportedReason = 'empty' | 'tooLong' | 'invalidText' | 'invalidSchema' | 'unsupportedLanguage' |
  'unknownOperation' | 'unsupportedOperation' | 'multipleOperations' | 'unsupportedQualifier' | 'dataModification' | 'causal' | 'forecast'

export type KnownIntentInputs = {
  columns?: IntentColumn[]
  grouping?: IntentColumn
  confidence?: ConfidenceLevel
  nullMean?: number
  matching?: 'sameRow'
}

export type IntentResult = { language: IntentLanguage } & (
  | { status: 'resolved'; intent: AnalysisIntent }
  | { status: 'needs_clarification'; operation: IntentOperation; issues: Clarification[]; known?: KnownIntentInputs }
  | { status: 'unsupported'; reason: UnsupportedReason }
)
