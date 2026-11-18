import { schemaTypes } from './dataset.ts'
import type { SchemaType } from './dataset.ts'
import type { AnalysisResult } from './analysis.ts'
import type { Column, ColumnProfile, RejectedValue } from './dataset.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'

function columnLabel(column: Column, locale: Locale) {
  const position = formatNumber(column.index + 1, locale)
  if (column.sourceName === null) return `${messages[locale].column} ${position}`
  return column.duplicateName ? `${column.sourceName} [${position}]` : column.sourceName
}

function Rejected({ values, locale, title }: { values: RejectedValue[]; locale: Locale; title: string }) {
  if (!values.length) return null
  return <>
    <h3>{title}</h3>
    <ul className="rejected">{values.map(({ record, value }) =>
      <li key={record}>{messages[locale].record} {formatNumber(record, locale)} <bdi>{value}</bdi></li>,
    )}</ul>
  </>
}

function ProfileDetails({ column, locale, salary }: { column: ColumnProfile; locale: Locale; salary: boolean }) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const { numeric, frequency, warnings, rejected } = column
  if (!numeric && !frequency?.entries.length && !warnings.length && (!rejected.length || salary)) return null

  return <details className="column-details">
    <summary>{t.details}</summary>
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
    {!salary && <Rejected values={rejected} locale={locale} title={t.invalidExamples} />}
  </details>
}

export function Results({ result, locale, onOverride }: {
  result: AnalysisResult
  locale: Locale
  onOverride: (id: string, type: SchemaType | 'auto') => void
}) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const salary = result.columns.find(column => column.id === result.salaryColumnId && column.type === 'numeric')
  const mean = salary?.numeric?.mean ?? null
  const metrics = [
    ['rows', t.rows, result.rows], ['columns', t.columns, result.columns.length],
    ['duplicate-rows', t.duplicateRows, result.duplicateRows],
    ...(salary ? [['valid', t.valid, salary.valid], ['blank', t.blank, salary.blank],
      ['invalid', t.invalid, salary.invalid]] as const : []),
  ] as const

  return <>
    <section aria-labelledby="summary-title" className="panel summary">
      <h2 id="summary-title">{t.summary}</h2>
      {salary && <>
        <div className="result"><span>{t.mean}</span><strong data-testid="mean"
          data-value={mean ?? undefined} data-reference-mean={result.referenceSalaryMean}>{mean === null ? t.unavailable : number(mean)}</strong></div>
        <p className="muted">{t.method}</p>
      </>}
      <dl className="metrics">{metrics.map(([id, label, value]) =>
        <div key={id}><dt>{label}</dt><dd data-testid={id}>{number(value)}</dd></div>,
      )}</dl>
    </section>
    <section aria-labelledby="preview-title" className="panel">
      <h2 id="preview-title">{t.preview}</h2>
      {result.preview.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label={t.preview}>
        <table><caption>{t.firstRows}</caption><thead><tr>{result.columns.map(column =>
          <th scope="col" key={column.id}><bdi>{columnLabel(column, locale)}</bdi></th>,
        )}</tr></thead><tbody>{result.preview.map((row, index) =>
          <tr key={index}>{row.map((value, cell) => <td key={cell}><bdi>{value}</bdi></td>)}</tr>,
        )}</tbody></table>
      </div> : <p className="muted">{t.noRows}</p>}
    </section>
    <section aria-labelledby="quality-title" className="panel">
      <h2 id="quality-title">{t.profiles}</h2>
      <p className="muted">{t.profileMethod} {t.ignoredMeaning}</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.profiles}>
        <table><thead><tr>{[t.column, t.type, t.blanks, t.marked, t.validCells, t.invalidCells, t.details, t.schemaOverride].map(label =>
          <th scope="col" key={label}>{label}</th>,
        )}</tr></thead><tbody>{result.columns.map(column =>
          <tr key={column.id}>
            <th scope="row"><bdi>{columnLabel(column, locale)}</bdi></th>
            <td>{t.types[column.type]}</td>
            {[column.blank, column.markedMissing, column.valid, column.invalid].map((count, index) =>
              <td key={index}>{number(count)}</td>,
            )}
            <td><ProfileDetails column={column} locale={locale} salary={column === salary} /></td>
            <td><select id={`schema-${column.id}`} className="schema-type"
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
  </>
}
