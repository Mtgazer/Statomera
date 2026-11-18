import type { Clarification, IntentColumn, IntentOperation, KnownIntentInputs } from '../intent/contract.ts'
import { InferenceOutput, inferenceCopy } from '../inference-panel.tsx'
import { formatNumber, messages } from '../locale.ts'
import type { Locale } from '../locale.ts'
import type { AnalysisExecution } from '../router/contract.ts'
import { StatisticEvidence, statisticCopy } from '../statistics-panel.tsx'
import { conversationCopy } from './copy.ts'

function operationName(operation: IntentOperation, locale: Locale) {
  const stats = statisticCopy[locale].operations
  if (Object.hasOwn(stats, operation)) return stats[operation as keyof typeof stats]
  const tests = inferenceCopy[locale].methods
  if (Object.hasOwn(tests, operation)) return tests[operation as keyof typeof tests]
  const local = conversationCopy[locale]
  return local[operation as 'rowCount' | 'columnCount' | 'duplicateRowCount' | 'missingCount' | 'invalidCount' | 'comparison' | 'variance' | 'sd']
}

function Columns({ columns }: { columns: IntentColumn[] }) {
  return <span>{columns.map((column, index) =>
    <span key={column.id}>{index > 0 && ' · '}<bdi>{column.sourceName ?? column.id}</bdi></span>,
  )}</span>
}

function percentage(level: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', { style: 'percent' }).format(level / 100)
}

function Issue({ issue, locale }: { issue: Clarification; locale: Locale }) {
  const t = conversationCopy[locale]
  return <li>
    {'role' in issue && <><strong>{t.role[issue.role]}</strong> · </>}
    {t.issue[issue.reason]}
    {'reference' in issue && <> <bdi>{issue.reference}</bdi></>}
    {'options' in issue && <> <Columns columns={issue.options} /></>}
  </li>
}

function KnownInputs({ inputs, locale }: { inputs: KnownIntentInputs; locale: Locale }) {
  const t = conversationCopy[locale]
  return <dl className="conversation-parameters" aria-label={t.known}>
    {inputs.columns?.length ? <div><dt>{t.answerColumns}</dt><dd><Columns columns={inputs.columns} /></dd></div> : null}
    {inputs.grouping && <div><dt>{t.role.grouping}</dt><dd><Columns columns={[inputs.grouping]} /></dd></div>}
    {inputs.confidence !== undefined && <div><dt>{t.confidence}</dt><dd><bdi>{percentage(inputs.confidence, locale)}</bdi></dd></div>}
    {inputs.nullMean !== undefined && <div><dt>{inferenceCopy[locale].nullMean}</dt>
      <dd><bdi>{formatNumber(inputs.nullMean, locale, 17)}</bdi></dd></div>}
    {inputs.matching === 'sameRow' && <div><dt>{t.sameRow}</dt><dd>{t.yes}</dd></div>}
  </dl>
}

export function replyLabel(result: AnalysisExecution, locale: Locale) {
  const t = conversationCopy[locale]
  return result.status === 'completed' ? t.answered
    : result.status === 'needs_clarification' ? t.clarification : t[result.status]
}

export function ConversationAnswer({ result, locale }: { result: AnalysisExecution; locale: Locale }) {
  const t = conversationCopy[locale]
  const inference = inferenceCopy[locale]
  const count = (value: number) => formatNumber(value, locale)
  const heading = result.status === 'completed' ? null : <h3>{replyLabel(result, locale)}</h3>

  if (result.status === 'cancelled') return <>{heading}<p>{t.cancellation[result.reason]}</p>
    {result.reason === 'user' && <p className="muted">{t.retryHint}</p>}
  </>
  if (result.status === 'failed') return <>{heading}
    <p>{result.stage === 'validation' ? t.validation[result.reason] : messages[locale].errors[result.reason]}</p>
    {result.stage === 'execution' && <p className="muted">{t.retryHint}</p>}
  </>
  if (result.status === 'unsupported') return <>{heading}<p>{t.refusal[result.reason]}</p></>
  if (result.status === 'needs_clarification') {
    return result.stage === 'interpretation' ? <>
      {heading}
      <p>{operationName(result.operation, locale)}</p>
      <ul>{result.issues.map((issue, index) => <Issue key={index} issue={issue} locale={locale} />)}</ul>
      {result.known && <KnownInputs inputs={result.known} locale={locale} />}
      <p className="muted">{t.edit}</p>
    </> : <>
      {heading}<p>{t.missingGroup} {result.groups.map(label => <bdi key={label}> {label} </bdi>)}</p>
      <table className="inference-counts">
        <caption>{inference.counts}</caption>
        <thead><tr>{[inference.values, inference.valid, inference.missing, inference.invalid].map(name =>
          <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody>{result.counts.map(({ valid, missing, invalid }, index) => <tr key={index}>
          <th scope="row">{index === 0 ? inference.groupA : inference.groupB}</th>
          <td>{count(valid)}</td><td>{count(missing)}</td><td>{count(invalid)}</td>
        </tr>)}</tbody>
      </table>
      <p>{inference.excludedTotal} <bdi>{count(result.excluded)}</bdi> · {inference.outside} <bdi>{count(result.outsideGroups)}</bdi></p>
      <p className="muted">{t.edit}</p>
    </>
  }

  const { evidence } = result
  let next: string | undefined
  if (result.status === 'unavailable') {
    if (evidence.source === 'statisticsWorker' && evidence.result.reason) next = t.reviewValues[evidence.result.reason]
    if (evidence.source === 'inferenceWorker' && evidence.result.reason) next = t.reviewInference[evidence.result.reason]
  }
  return <>
    {heading}
    <h3>{operationName(result.operation, locale)}</h3>
    {result.columns.length > 0 && <p className="muted">{t.answerColumns} · <Columns columns={result.columns} /></p>}
    {evidence.source === 'datasetProfile' && <dl className="conversation-parameters">
      {typeof evidence.value === 'boolean' && <div><dt>{t.presence}</dt><dd>{evidence.value ? t.yes : t.no}</dd></div>}
      <div><dt>{t.count}</dt><dd><bdi>{count(evidence.count)}</bdi></dd></div>
      <div><dt>{t.scope}</dt><dd>{t[evidence.unit]}</dd></div>
      {evidence.missing && <>
        <div><dt>{t.blank}</dt><dd>{count(evidence.missing.blank)}</dd></div>
        <div><dt>{t.marked}</dt><dd>{count(evidence.missing.marked)}</dd></div>
      </>}
    </dl>}
    {result.operation === 'duplicateRowCount' && <p className="muted">{t.duplicatesNote}</p>}
    {evidence.source === 'statisticsWorker' && <StatisticEvidence result={evidence.result} locale={locale} />}
    {evidence.source === 'inferenceWorker' && <>
      <dl className="conversation-parameters">
        <div><dt>{t.confidence}</dt><dd><bdi>{percentage(evidence.result.request.level, locale)}</bdi>
          {' · '}{evidence.confidence === 'default' ? t.defaultLevel : t.confidenceExplicit}</dd></div>
        {evidence.result.request.nullMean !== undefined && <div><dt>{inference.nullMean}</dt>
          <dd><bdi>{formatNumber(evidence.result.request.nullMean, locale, 17)}</bdi></dd></div>}
        {evidence.matching === 'sameRow' && <div><dt>{t.sameRow}</dt><dd>{t.yes}</dd></div>}
      </dl>
      {evidence.matching === 'sameRow' && <p className="muted">{inference.pairedOrder} {inference.pairedNull}</p>}
      {evidence.result.request.method === 'welch' && <p className="muted">{inference.welchOrder} {inference.pairedNull}</p>}
      <InferenceOutput result={evidence.result} locale={locale} />
      {evidence.result.warnings.includes('pUnderflow') && evidence.result.logP !== null &&
        <p>{t.logP} · <bdi>{formatNumber(evidence.result.logP, locale, 17)}</bdi></p>}
    </>}
    {next && <p className="conversation-next">{next}</p>}
    {result.assumptions.length > 0 && <details className="conversation-assumptions">
      <summary>{t.assumptions}</summary>
      <ul>{result.assumptions.map(assumption => <li key={assumption}>{t.assumption[assumption]}</li>)}</ul>
    </details>}
  </>
}
