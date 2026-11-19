import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { columnLabel } from './column-label.ts'
import { ConversationAnswer } from './conversation/answer.tsx'
import type { ColumnProfile, DatasetProfile } from './dataset.ts'
import type { InferenceResult } from './inference-contract.ts'
import { InferenceOutput, inferenceCopy } from './inference-panel.tsx'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import { ColumnQuality, ColumnSummary } from './quality-results.tsx'
import type { AnalysisExecution } from './router/contract.ts'
import type { StatisticResult } from './statistics-contract.ts'
import { StatisticEvidence, StatisticPlot, statisticCopy } from './statistics-panel.tsx'

export type ReportQuestion = Extract<AnalysisExecution, { status: 'completed' | 'unavailable' }>
export type ReportFindings = {
  statistic?: StatisticResult
  inference?: InferenceResult
  question?: ReportQuestion
}

function Counts({ entries, locale }: { entries: ReadonlyArray<readonly [string, number]>; locale: Locale }) {
  return <dl className="metrics">{entries.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd><bdi>{formatNumber(value, locale)}</bdi></dd></div>,
  )}</dl>
}

function Finding({ title, children }: { title: string; children: ReactNode }) {
  return <div className="report-finding" role="group" aria-label={title}>
    <p className="report-finding-title">{title}</p>
    {children}
  </div>
}

function InferenceFinding({ result, label, locale }: {
  result: InferenceResult; label: (id: string) => string; locale: Locale
}) {
  const t = inferenceCopy[locale]
  const { request } = result
  return <Finding title={t.methods[request.method]}>
    <dl className="report-inputs">
      <div><dt>{t.column}</dt><dd><bdi>{label(request.column)}</bdi></dd></div>
      {request.second !== undefined && <div><dt>{t.second}</dt><dd><bdi>{label(request.second)}</bdi></dd></div>}
      {request.groupColumn !== undefined && <div><dt>{t.grouping}</dt><dd><bdi>{label(request.groupColumn)}</bdi></dd></div>}
      {request.nullMean !== undefined && <div><dt>{t.nullMean}</dt><dd><bdi>{formatNumber(request.nullMean, locale, 17)}</bdi></dd></div>}
      <div><dt>{t.level}</dt><dd><bdi>{new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', {
        style: 'percent',
      }).format(request.level / 100)}</bdi></dd></div>
    </dl>
    {request.method === 'paired' && <p>{t.pairedOrder} {t.pairedNull}</p>}
    {request.method === 'welch' && <p>{t.welchOrder} {t.pairedNull}</p>}
    <p className="muted"><strong>{t.assumptions}</strong> {t.designs[request.method]}</p>
    <InferenceOutput result={result} locale={locale} />
  </Finding>
}

function ColumnFinding({ column, rows, locale }: { column: ColumnProfile; rows: number; locale: Locale }) {
  const t = messages[locale]
  return <Finding title={columnLabel(column, locale)}>
    <p>{t.type} · {t.types[column.inferredType]}</p>
    {column.override && <p>{t.schemaOverride} · {t.types[column.override]}</p>}
    <Counts locale={locale} entries={[[t.validCells, column.valid], [t.blanks, column.blank],
      [t.marked, column.markedMissing], [t.invalidCells, column.invalid]]} />
    <ColumnSummary column={column} locale={locale} />
    <ColumnQuality column={column} rows={rows} locale={locale} />
  </Finding>
}

export function Report({ dataset, filename, format, worksheet, counts, locale, findings, onClear }: {
  dataset: DatasetProfile
  filename: string
  format?: string
  worksheet?: string
  counts: { blank: number; marked: number; invalid: number }
  locale: Locale
  findings: ReportFindings
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [columnId, setColumnId] = useState('')
  const summary = useRef<HTMLElement>(null)
  const { statistic, inference, question } = findings
  const { columns, rows } = dataset
  const column = columns.find(item => item.id === columnId)
  const label = (id: string) => {
    const item = columns.find(item => item.id === id)
    return item ? columnLabel(item, locale) : id
  }
  const t = messages[locale]

  return <section id="analytical-report" tabIndex={-1} aria-labelledby="report-title" className="panel workspace-section report-panel">
    <h2 id="report-title">{t.reportTitle}</h2>
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary ref={summary}>{t.reportOpen}</summary>
      {open && <div className="report-body">
        <h3>{t.reportContext}</h3>
        <div className="section-heading">
          <p className="dataset-name"><bdi>{filename}</bdi></p>
          <dl className="source-meta">
            <div><dt>{t.fileFormat}</dt><dd><bdi>{format}</bdi></dd></div>
            {worksheet && <div><dt>{t.worksheet}</dt><dd><bdi>{worksheet}</bdi></dd></div>}
          </dl>
        </div>
        <Counts locale={locale} entries={[[t.rows, rows], [t.columns, columns.length], [t.blanks, counts.blank],
          [t.marked, counts.marked], [t.invalidCells, counts.invalid], [t.duplicateRows, dataset.duplicateRows]]} />
        {rows === 0 && <p>{t.noRows}</p>}
        <p className="muted">{t.reportScope}</p>
        <p className="muted">{t.reportHelp}</p>
        <div className="report-controls">
          <label>{t.reportColumn}<select value={columnId} onChange={event => setColumnId(event.currentTarget.value)}>
            <option value="">{t.reportNoColumn}</option>
            {columns.map(item => <option value={item.id} key={item.id}>{columnLabel(item, locale)}</option>)}
          </select></label>
          {(column || statistic || inference || question) && <button type="button" onClick={() => {
            summary.current?.focus()
            setColumnId('')
            onClear()
          }}>{t.reportClear}</button>}
        </div>
        {!column && !statistic && !inference && !question && <p className="muted">{t.reportEmpty}</p>}
        {column && <ColumnFinding column={column} rows={rows} locale={locale} />}
        {statistic && <Finding title={statisticCopy[locale].operations[statistic.operation]}>
          <p className="muted">{t.columns} · {statistic.columns.map((id, index) =>
            <span key={id}>{index > 0 && ' · '}<bdi>{label(id)}</bdi></span>,
          )}</p>
          <StatisticEvidence result={statistic} locale={locale} />
          <StatisticPlot result={statistic} columns={columns} locale={locale} />
        </Finding>}
        {inference && <InferenceFinding result={inference} label={label} locale={locale} />}
        {question && <Finding title={t.reportQuestion}><ConversationAnswer result={question} locale={locale} expandAssumptions /></Finding>}
      </div>}
    </details>
  </section>
}
