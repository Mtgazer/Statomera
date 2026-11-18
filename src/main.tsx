import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalysisError, analyzeFile } from './analysis.ts'
import type { AnalysisErrorCode, AnalysisResult } from './analysis.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import './styles.css'

type Status =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'error'; error: AnalysisErrorCode }
  | { phase: 'complete'; result: AnalysisResult }

function Results({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const metrics = [
    ['rows', t.rows, result.rows],
    ['columns', t.columns, result.headers.length],
    ['valid', t.valid, result.valid],
    ['blank', t.blank, result.missing[result.salaryIndex]],
    ['invalid', t.invalid, result.invalid],
  ] as const

  return <>
    <section aria-labelledby="summary-title" className="panel summary">
      <h2 id="summary-title">{t.summary}</h2>
      <div className="result"><span>{t.mean}</span><strong data-testid="mean"
        data-value={result.mean ?? undefined}>{result.mean === null ? t.unavailable : number(result.mean)}</strong></div>
      <p className="muted">{t.method}</p>
      <dl className="metrics">{metrics.map(([id, label, value]) =>
        <div key={id}><dt>{label}</dt><dd data-testid={id}>{number(value)}</dd></div>,
      )}</dl>
    </section>
    <section aria-labelledby="preview-title" className="panel">
      <h2 id="preview-title">{t.preview}</h2>
      {result.preview.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label={t.preview}>
        <table><caption>{t.firstRows}</caption><thead><tr>{result.headers.map((header, index) =>
          <th scope="col" key={index}><bdi>{header}</bdi></th>,
        )}</tr></thead><tbody>{result.preview.map((row, index) =>
          <tr key={index}>{row.map((value, cell) => <td key={cell}><bdi>{value}</bdi></td>)}</tr>,
        )}</tbody></table>
      </div> : <p className="muted">{t.noRows}</p>}
    </section>
    <section aria-labelledby="quality-title" className="panel">
      <h2 id="quality-title">{t.quality}</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.quality}>
        <table><thead><tr><th scope="col">{t.column}</th><th scope="col">{t.missing}</th></tr></thead>
          <tbody>{result.headers.map((header, index) =>
            <tr key={index}><th scope="row"><bdi>{header}</bdi></th><td>{number(result.missing[index])}</td></tr>,
          )}</tbody>
        </table>
      </div>
      {result.rejected.length > 0 && <>
        <h3>{t.rejected}</h3>
        <ul className="rejected">{result.rejected.map(({ record, value }) =>
          <li key={record}>{t.record} {number(record)} <bdi>{value}</bdi></li>,
        )}</ul>
      </>}
    </section>
  </>
}

function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number }>()
  const job = useRef<AbortController | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const choose = useRef<HTMLButtonElement>(null)
  const t = messages[locale]

  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = theme
  }, [locale, theme])

  useEffect(() => () => job.current?.abort(), [])

  async function start(file: File) {
    job.current?.abort()
    const controller = new AbortController()
    job.current = controller
    setFileInfo({ name: file.name, size: file.size })
    setStatus({ phase: 'busy' })
    performance.clearMeasures('askora:analysis')
    const startTime = performance.now()
    try {
      const result = await analyzeFile(file, controller.signal)
      if (job.current !== controller) return
      performance.measure('askora:analysis', {
        start: startTime, end: performance.now(), detail: result.timings,
      })
      setStatus({ phase: 'complete', result })
    } catch (error) {
      if (job.current !== controller) return
      setStatus({ phase: 'error', error: error instanceof AnalysisError ? error.code : 'engine' })
    } finally {
      if (job.current === controller) job.current = null
    }
  }

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <span className="wordmark" lang="en" dir="ltr">askora</span>
        <div className="preferences">
          <label><span>{t.language}</span>
            <select value={locale} onChange={event => setLocale(event.target.value as Locale)}>
              <option value="en" lang="en">English</option><option value="ar" lang="ar">العربية</option>
            </select>
          </label>
          <label><span>{t.theme}</span>
            <select value={theme} onChange={event => setTheme(event.target.value as typeof theme)}>
              <option value="dark">{t.dark}</option><option value="light">{t.light}</option>
            </select>
          </label>
        </div>
      </div>
    </header>
    <main>
      <h1>{t.title}</h1>
      <section className="panel intake" aria-labelledby="upload-title">
        <div>
          <h2 id="upload-title">{t.upload}</h2>
          <p id="upload-guidance" className="muted">{t.guidance}</p>
        </div>
        <div className="actions">
          <input ref={picker} type="file" accept=".csv,text/csv" hidden onChange={event => {
            const selected = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (selected) void start(selected)
          }} />
          <button ref={choose} className="primary" type="button" aria-describedby="upload-guidance"
            onClick={() => picker.current?.click()}>{t.choose}</button>
          {status.phase === 'busy' && <button type="button" onClick={() => {
            job.current?.abort()
            choose.current?.focus()
          }}>{t.cancel}</button>}
        </div>
        <div className="file-status">
          {fileInfo && <p className="file-info"><bdi>{fileInfo.name}</bdi>
            <bdi className="muted">{formatNumber(fileInfo.size, locale)} {t.bytes}</bdi></p>}
          <p className="muted">{t.privacy}</p>
        </div>
      </section>
      <div role="status" aria-atomic="true">
        {status.phase === 'busy' && <p className="notice">{t.busy}</p>}
        {status.phase === 'complete' && <span className="sr-only">{t.summary}</span>}
        {status.phase === 'error' && status.error === 'cancelled' && <p className="notice">{t.errors.cancelled}</p>}
      </div>
      {status.phase === 'error' && status.error !== 'cancelled' &&
        <p role="alert" className="notice error">{t.errors[status.error]}</p>}
      {status.phase === 'complete' && <Results result={status.result} locale={locale} />}
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
