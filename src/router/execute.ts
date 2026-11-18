import { AnalysisError, analyzeInference, analyzeStatistic } from '../analysis.ts'
import type { DatasetSession } from '../dataset-session.ts'
import type { DatasetProfile } from '../dataset.ts'
import type { IntentLanguage, ProfileOperation } from '../intent/contract.ts'
import { parseAnalysisIntent } from '../intent/parse.ts'
import type { AnalysisExecution, PreparedAnalysis, ProfileEvidence } from './contract.ts'
import { validateRoute } from './validation.ts'

type Engines = { statistic: typeof analyzeStatistic; inference: typeof analyzeInference }
const engines: Engines = { statistic: analyzeStatistic, inference: analyzeInference }
type Cancellation = Extract<AnalysisExecution, { status: 'cancelled' }>['reason']

function profileValue(profile: DatasetProfile, operation: ProfileOperation, mode: 'count' | 'presence', id?: string): ProfileEvidence {
  const columns = id === undefined ? profile.columns : profile.columns.filter(column => column.id === id)
  let unit: ProfileEvidence['unit'] = 'rows'
  let count: number
  let missing: ProfileEvidence['missing']
  switch (operation) {
    case 'rowCount': count = profile.rows; break
    case 'columnCount': count = profile.columns.length; unit = 'columns'; break
    case 'duplicateRowCount': count = profile.duplicateRows; break
    case 'invalidCount':
      unit = 'cells'
      count = columns.reduce((sum, column) => sum + column.invalid, 0)
      break
    case 'missingCount':
      unit = 'cells'
      missing = columns.reduce((sum, column) => ({
        blank: sum.blank + column.blank, marked: sum.marked + column.markedMissing,
      }), { blank: 0, marked: 0 })
      count = missing.blank + missing.marked
      break
    default: throw new AnalysisError('engine')
  }
  return { source: 'datasetProfile', mode, unit, count, value: mode === 'count' ? count : count > 0, ...(missing && { missing }) }
}

function languageHint(value: unknown): IntentLanguage {
  return value === 'en' || value === 'ar' || value === 'mixed' ? value : 'unknown'
}

/** One router per workspace. Only current prepared intents can start work. */
export function createAnalysisRouter(session: DatasetSession, workers: Engines = engines) {
  let pending: AbortController | null = null

  function prepare(question: string): PreparedAnalysis {
    const active = session.active()
    return {
      revision: active?.revision ?? null,
      interpretation: active ? parseAnalysisIntent(question, active.profile.columns.map(({ id, sourceName, type }) =>
        ({ id, sourceName, type }))) : null,
    }
  }

  async function execute(prepared: PreparedAnalysis, signal?: AbortSignal): Promise<AnalysisExecution> {
    const active = session.active()
    const revision = prepared?.revision ?? null
    if (!active || active.revision !== revision) {
      return { status: 'failed', stage: 'validation', revision, reason: revision ? 'staleRevision' : 'noDataset' }
    }
    if (signal?.aborted) return { status: 'cancelled', revision, reason: 'user' }

    // An old candidate never interrupts work on the current revision.
    pending?.abort('superseded' satisfies Cancellation)
    const controller = new AbortController()
    pending = controller
    const changed = () => controller.abort('datasetChanged' satisfies Cancellation)
    const cancelled = () => controller.abort('user' satisfies Cancellation)
    active.signal.addEventListener('abort', changed, { once: true })
    signal?.addEventListener('abort', cancelled, { once: true })
    if (active.signal.aborted) changed()
    if (signal?.aborted) cancelled()

    function stale(): Extract<AnalysisExecution, { status: 'cancelled' }> | undefined {
      if (controller.signal.aborted || session.active() !== active) return {
        status: 'cancelled', revision: active!.revision,
        reason: controller.signal.aborted ? controller.signal.reason as Cancellation : 'datasetChanged',
      }
    }

    try {
      const interpretation = prepared.interpretation
      if (interpretation?.status === 'needs_clarification') {
        return stale() ?? { status: 'needs_clarification', stage: 'interpretation', revision,
          language: languageHint(interpretation.language), operation: interpretation.operation,
          issues: interpretation.issues, ...(interpretation.known && { known: interpretation.known }) }
      }
      if (interpretation?.status === 'unsupported') {
        return stale() ?? { status: 'unsupported', stage: 'interpretation', revision,
          language: languageHint(interpretation.language), reason: interpretation.reason }
      }
      const route = validateRoute(interpretation?.status === 'resolved' ? interpretation.intent : undefined, active)
      if ('reason' in route) return { status: 'failed', stage: 'validation', revision, reason: route.reason }
      const provenance = { revision, language: languageHint(interpretation?.language), operation: route.operation,
        columns: route.columns, assumptions: route.assumptions }
      const interrupted = stale()
      if (interrupted) return interrupted

      if (route.kind === 'profile') return {
        status: 'completed', ...provenance,
        evidence: profileValue(active.profile, route.operation, route.mode, route.columns[0]?.id),
      }
      if (route.kind === 'descriptive') {
        const { scatter: _scatter, ...result } = await workers.statistic(active.file, controller.signal, active.options, route.request)
        return stale() ?? { status: result.reason ? 'unavailable' : 'completed', ...provenance,
          evidence: { source: 'statisticsWorker', result } }
      }
      const result = await workers.inference(active.file, controller.signal, active.options, route.request)
      const interruptedAfter = stale()
      if (interruptedAfter) return interruptedAfter
      // Welch uses the engine's exact membership and exclusion pass, including labels beyond the UI frequency cap.
      // Zero assigned observations means the group was absent. The engine exits before computing a test in that case.
      if (route.request.groups) {
        const groups = route.request.groups.filter((_label, index) => {
          const { valid, missing, invalid } = result.counts[index]
          return valid === 0 && missing === 0 && invalid === 0
        })
        if (groups.length) return { status: 'needs_clarification', stage: 'validation', revision, operation: 'welch',
          reason: 'absentGroups', groups, counts: result.counts, outsideGroups: result.outsideGroups, excluded: result.excluded }
      }
      return { status: result.reason ? 'unavailable' : 'completed', ...provenance, evidence: {
        source: 'inferenceWorker', result, confidence: route.confidence, ...(route.matching && { matching: route.matching }),
      } }
    } catch (error) {
      return stale() ?? {
        status: 'failed', stage: 'execution', revision,
        reason: error instanceof AnalysisError ? error.code : 'engine',
      }
    } finally {
      active.signal.removeEventListener('abort', changed)
      signal?.removeEventListener('abort', cancelled)
      if (pending === controller) pending = null
    }
  }

  return { prepare, execute, run: (question: string, signal?: AbortSignal) => execute(prepare(question), signal) }
}
