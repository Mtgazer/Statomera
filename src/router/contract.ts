import type { AnalysisErrorCode } from '../analysis.ts'
import type { DatasetRevision } from '../dataset-session.ts'
import type { InferenceResult } from '../inference-contract.ts'
import type { StatisticResult } from '../statistics-contract.ts'
import type { AnalysisIntent, IntentColumn, IntentLanguage, IntentResult } from '../intent/contract.ts'

export interface PreparedAnalysis {
  revision: DatasetRevision | null
  interpretation: IntentResult | null
}

export type ValidationReason = 'noDataset' | 'staleRevision' | 'invalidIntent' | 'unsupportedOperation' |
  'unknownColumn' | 'changedColumn' | 'ineligibleColumn' | 'distinctColumns' | 'invalidParameters'

export type ProfileEvidence = {
  source: 'datasetProfile'
  mode: 'count' | 'presence'
  unit: 'rows' | 'columns' | 'cells'
  count: number
  value: number | boolean
  missing?: { blank: number; marked: number }
}

export type Assumption = 'linearAssociation' | 'completePairs' | 'independentObservations' |
  'smallSampleNormality' | 'independentGroups' | 'unequalVariancesAllowed' |
  'meaningfulRowPairs' | 'independentDifferences' | 'smallSampleNormalDifferences' | 'twoSided'

type Provenance = {
  revision: DatasetRevision
  language: IntentLanguage
  operation: AnalysisIntent['operation']
  columns: IntentColumn[]
  assumptions: Assumption[]
}

type VerifiedEvidence =
  | ProfileEvidence
  | { source: 'statisticsWorker'; result: Omit<StatisticResult, 'scatter'> }
  | { source: 'inferenceWorker'; result: InferenceResult; confidence: 'explicit' | 'default'; matching?: 'sameRow' }

export type AnalysisExecution =
  | ({ status: 'completed' | 'unavailable'; evidence: VerifiedEvidence } & Provenance)
  | ({ stage: 'interpretation'; revision: DatasetRevision } & Exclude<IntentResult, { status: 'resolved' }>)
  | { status: 'needs_clarification'; stage: 'validation'; revision: DatasetRevision; operation: 'welch';
      reason: 'absentGroups'; groups: string[]; counts: InferenceResult['counts']; outsideGroups: number; excluded: number }
  | { status: 'failed'; stage: 'validation'; revision: DatasetRevision | null; reason: ValidationReason }
  | { status: 'failed'; stage: 'execution'; revision: DatasetRevision; reason: AnalysisErrorCode }
  | { status: 'cancelled'; revision: DatasetRevision; reason: 'user' | 'datasetChanged' | 'superseded' }
