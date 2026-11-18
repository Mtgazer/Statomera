import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalysisError, analyzeFile } from './analysis.ts'
import type { AnalysisErrorCode, AnalysisResult } from './analysis.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import { commonMissingMarkers, defaultCsvOptions } from './dataset.ts'
import type { CsvOptions } from './dataset.ts'
import { Results } from './results.tsx'
import './styles.css'

type Status =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'error'; error: AnalysisErrorCode }
  | { phase: 'complete'; result: AnalysisResult }

function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const [options, setOptions] = useState(defaultCsvOptions)
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
      const result = await analyzeFile(file, controller.signal, options)
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
        <details className="import-options">
          <summary>{t.importOptions}</summary>
          <p className="muted">{t.applyOnImport}</p>
          <div className="import-fields">
            <label>{t.delimiter}
              <select value={options.delimiter} onChange={event =>
                setOptions({ ...options, delimiter: event.target.value as CsvOptions['delimiter'] })}>
                <option value="auto">{t.auto}</option>
                <option value=",">{t.comma}</option>
                <option value=";">{t.semicolon}</option>
                <option value={'\t'}>{t.tab}</option>
              </select>
            </label>
            <label><input type="checkbox" checked={options.header === 'first-row'} onChange={event =>
              setOptions({ ...options, header: event.target.checked ? 'first-row' : 'none' })} />{t.firstHeader}</label>
            <label><input type="checkbox" checked={options.duplicateHeaders === 'disambiguate'} onChange={event =>
              setOptions({ ...options, duplicateHeaders: event.target.checked ? 'disambiguate' : 'reject' })} />{t.keepDuplicateHeaders}</label>
            <label><input type="checkbox" checked={options.missingMarkers.length > 0} onChange={event =>
              setOptions({ ...options, missingMarkers: event.target.checked ? commonMissingMarkers : [] })} />{t.recognizeMarkers}</label>
          </div>
        </details>
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
