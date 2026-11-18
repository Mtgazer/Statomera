import { useState } from 'react'
import { distinctLimit, schemaTypes } from './dataset.ts'
import type { SchemaType } from './dataset.ts'
import type { AnalysisResult } from './analysis.ts'
import type { ColumnProfile, RejectedValue } from './dataset.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'

import { columnLabel } from './column-label.ts'
import { ColumnQuality, QualityReports } from './quality-results.tsx'
import { InferencePanel, inferenceTitle } from './inference-panel.tsx'
import type { RunInference } from './inference-panel.tsx'
import { StatisticsPanel, statisticsTitle } from './statistics-panel.tsx'
import type { RunStatistic } from './statistics-panel.tsx'
import { Preview } from './preview.tsx'

function Rejected({ values, locale, title }: { values: RejectedValue[]; locale: Locale; title: string }) {
  if (!values.length) return null
  return <>
    <h3>{title}</h3>
    <ul className="rejected">{values.map(({ record, value }) =>
      <li key={record}>{messages[locale].record} {formatNumber(record, locale)} <bdi>{value}</bdi></li>,
    )}</ul>
  </>
}

function ProfileDetails({ column, rows, locale, salary, open, onToggle }: {
  column: ColumnProfile; rows: number; locale: Locale; salary: boolean; open: boolean; onToggle: () => void
}) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const { numeric, frequency, warnings, rejected } = column

  return <details className="column-details" open={open}>
    <summary onClick={event => { event.preventDefault(); onToggle() }}>{t.details}</summary>
    {open && <>
      <p className="distinct-line"><span>{t.distinctValues}</span> <strong>{column.distinct === null
        ? t.distinctCap(number(distinctLimit)) : number(column.distinct)}</strong></p>
      {warnings.map(warning => <p className="muted" key={warning}>{t.warnings[warning]}</p>)}
      {numeric && <dl className="profile-statistics">
        {([['count', numeric.count], ['meanValue', numeric.mean], ['min', numeric.min],
          ['max', numeric.max], ['median', numeric.median]] as const).map(([label, value]) =>
          <div key={label}><dt>{t[label]}</dt><dd>{number(value)}</dd></div>,
        )}
      </dl>}
      {frequency && frequency.entries.length > 0 && <>
        <table><caption>{t.frequency}</caption>
          <thead><tr><th scope="col">{t.value}</th><th scope="col">{t.count}</th></tr></thead>
          <tbody>{frequency.entries.map(({ value, count }) =>
            <tr key={value}><th scope="row"><bdi>{value}</bdi></th><td>{number(count)}</td></tr>,
          )}</tbody>
        </table>
        {frequency.omitted > 0 && <p className="muted">{t.otherCategories} {number(frequency.omitted)}</p>}
    </>}
    <ColumnQuality column={column} rows={rows} locale={locale} />
    {!salary && <Rejected values={rejected} locale={locale} title={t.invalidExamples} />}
    </>}
  </details>
}

export function Results({ result, locale, filename, onOverride, onStatistic, onInference }: {
  result: AnalysisResult
  locale: Locale
  filename: string
  onInference: RunInference
  onStatistic: RunStatistic
  onOverride: (id: string, type: SchemaType | 'auto') => void
}) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const [selected, setSelected] = useState<string | null>(null)
  const [opened, setOpened] = useState<string[]>([])
  function selectColumn(id: string) {
    setSelected(id)
    setOpened(ids => ids.includes(id) ? ids : [...ids, id])
  }

  const totals = result.columns.reduce((counts, column) => ({
    missing: counts.missing + column.blank + column.markedMissing,
    invalid: counts.invalid + column.invalid,
    uncertain: counts.uncertain + Number(column.warnings.some(warning => warning !== 'manyCategories')),
  }), { missing: 0, invalid: 0, uncertain: 0 })
  const detected = [...new Set(result.columns.map(column => column.inferredType))]
  const worksheet = result.workbook?.names[result.workbook.selected]
  const format = filename.split('.').at(-1)?.toUpperCase()
  const salary = result.columns.find(column => column.id === result.salaryColumnId && column.type === 'numeric')
  const mean = salary?.numeric?.mean ?? null
  const metrics = [
    ['rows', t.rows, result.rows], ['columns', t.columns, result.columns.length],
    ['duplicate-rows', t.duplicateRows, result.duplicateRows],
    ['missing-total', t.missingValues, totals.missing],
    ['invalid-total', t.invalidCells, totals.invalid],
    ...(salary ? [['valid', t.valid, salary.valid], ['blank', t.blank, salary.blank],
      ['invalid', t.invalid, salary.invalid]] as const : []),
  ] as const

  return <>
    <nav className="workspace-nav" aria-label={t.workspaceSections}>
      <a href="#dataset-overview">{t.overview}</a><a href="#dataset-preview">{t.preview}</a>
      <a href="#dataset-quality">{t.qualitySummary}</a><a href="#column-explorer">{t.explorer}</a>
      <a href="#descriptive-statistics">{statisticsTitle[locale]}</a>
      <a href="#statistical-inference">{inferenceTitle[locale]}</a>
    </nav>
    <section id="dataset-overview" aria-labelledby="summary-title" className="panel workspace-section overview-panel">
      <div className="section-heading">
        <div><h2 id="summary-title">{t.overview}</h2><p className="dataset-name"><bdi>{filename}</bdi></p></div>
        <dl className="source-meta">
          <div><dt>{t.fileFormat}</dt><dd><bdi>{format}</bdi></dd></div>
          {worksheet && <div><dt>{t.worksheet}</dt><dd><bdi>{worksheet}</bdi></dd></div>}
        </dl>
      </div>
      <p className="type-line"><span>{t.detectedTypes}</span>{detected.map(type =>
        <span key={type} className="type-tag">{t.types[type]}</span>,
      )}</p>
      {salary && <>
        <div className="result"><span>{t.mean}</span><strong data-testid="mean"
          data-value={mean ?? undefined} data-reference-mean={result.referenceSalaryMean}>{mean === null ? t.unavailable : number(mean)}</strong></div>
        <p className="muted">{t.method}</p>
      </>}
      <dl className="metrics">{metrics.map(([id, label, value]) =>
        <div key={id}><dt>{label}</dt><dd data-testid={id}>{number(value)}</dd></div>,
      )}</dl>
    </section>
    <Preview result={result} locale={locale} selected={selected} onSelect={selectColumn} />
    <section id="dataset-quality" aria-labelledby="quality-title" className="panel workspace-section">
      <div className="section-heading"><h2 id="quality-title">{t.qualitySummary}</h2>
        <a href="#column-explorer">{t.explorer}</a></div>
      <div className="quality-grid">
        {([
          [t.missingValues, totals.missing, t.missingHelp],
          [t.invalidCells, totals.invalid, t.invalidHelp],
          [t.duplicateRows, result.duplicateRows, t.repeatedHelp],
          [t.uncertainColumns, totals.uncertain, t.uncertainHelp],
        ] as const).map(([label, count, help]) =>
          <div className="quality-item" key={label}><strong>{number(count)}</strong>
            <span>{label}</span><p className="muted">{help}</p></div>,
        )}
      </div>
      <p className="muted quality-context">{t.ignoredMeaning}</p>
      <QualityReports result={result} locale={locale} />
    </section>
    <section id="column-explorer" aria-labelledby="explorer-title" className="panel workspace-section">
      <h2 id="explorer-title">{t.explorer}</h2>
      <p className="muted">{t.profileMethod}</p>
      <div className="table-scroll explorer-table" tabIndex={0} role="region" aria-label={t.profiles}>
        <table role="table"><thead role="rowgroup"><tr role="row">{[t.column, t.type, t.blanks, t.marked, t.validCells, t.invalidCells, t.details, t.schemaOverride].map(label =>
          <th role="columnheader" scope="col" key={label}>{label}</th>,
        )}</tr></thead><tbody role="rowgroup">{result.columns.map(column =>
          <tr role="row" key={column.id} data-selected={column.id === selected || undefined}>
            <th role="rowheader" scope="row"><button className="column-button" type="button" aria-pressed={column.id === selected}
              onClick={() => selectColumn(column.id)}><bdi>{columnLabel(column, locale)}</bdi></button></th>
            <td role="cell" data-label={t.type}>{t.types[column.inferredType]}</td>
            {[column.blank, column.markedMissing, column.valid, column.invalid].map((count, index) =>
              <td role="cell" key={index} data-label={[t.blanks, t.marked, t.validCells, t.invalidCells][index]}>{number(count)}</td>,
            )}
            <td role="cell"><ProfileDetails column={column} rows={result.rows} locale={locale} salary={column === salary}
              open={opened.includes(column.id)}
              onToggle={() => {
                setSelected(column.id)
                setOpened(ids => ids.includes(column.id) ? ids.filter(id => id !== column.id) : [...ids, column.id])
              }} /></td>
            <td role="cell" data-label={t.schemaOverride}><select id={`schema-${column.id}`} className="schema-type"
              aria-label={`${t.schemaOverride} · ${columnLabel(column, locale)}`}
              value={column.override ?? 'auto'}
              onChange={event => onOverride(column.id, event.currentTarget.value as SchemaType | 'auto')}>
              <option value="auto">{t.auto}</option>
              {schemaTypes.map(type => <option key={type} value={type}>{t.types[type]}</option>)}
            </select></td>
          </tr>,
        )}</tbody></table>
      </div>
      {salary && <Rejected values={salary.rejected} locale={locale} title={t.rejected} />}
    </section>
    <StatisticsPanel columns={result.columns} locale={locale} onRun={onStatistic} />
    <InferencePanel columns={result.columns} locale={locale} onRun={onInference} />
  </>
}
