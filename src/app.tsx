import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnalysisError, analyzeFile, analyzeInference, analyzeStatistic } from './analysis.ts'
import type { AnalysisErrorCode, AnalysisResult } from './analysis.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import { commonMissingMarkers, defaultCsvOptions } from './dataset.ts'
import { ConversationPanel } from './conversation/panel.tsx'
import type { DatasetSession } from './dataset-session.ts'
import type { CsvOptions, SchemaType } from './dataset.ts'
import type { RunInference } from './inference-panel.tsx'
import type { RunStatistic } from './statistics-panel.tsx'
import { Results } from './results.tsx'
import './styles.css'

type Status =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'error'; error: AnalysisErrorCode }

export function App({ session }: { session: DatasetSession<AnalysisResult> }) {
  const [locale, setLocale] = useState<Locale>('en')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const active = useSyncExternalStore(session.subscribe, session.active)
  const [workbook, setWorkbook] = useState<AnalysisResult['workbook']>()
  const [options, setOptions] = useState(defaultCsvOptions)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number }>()
  const job = useRef<AbortController | null>(null)
  const overrideFocus = useRef<string | null>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const choose = useRef<HTMLButtonElement>(null)
  const t = messages[locale]

  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = theme
  }, [locale, theme])

  useEffect(() => () => {
    job.current?.abort()
    session.clear()
  }, [session])

  useLayoutEffect(() => {
    if (!overrideFocus.current) return
    if (status.phase === 'busy') cancelButton.current?.focus()
    if (active) {
      if (document.activeElement === document.body) document.getElementById(`schema-${overrideFocus.current}`)?.focus()
      overrideFocus.current = null
    }
    if (status.phase === 'error' && document.activeElement === document.body) retryButton.current?.focus()
  }, [active, status])

  function updateOverride(id: string, type: SchemaType | 'auto') {
    const current = session.selection()
    if (!current) return
    const schemaOverrides = { ...current.options.schemaOverrides, [id]: type === 'auto' ? undefined : type }
    if (type === 'auto') delete schemaOverrides[id]
    overrideFocus.current = id
    void start(current.file, { ...current.options, schemaOverrides })
  }

  const runStatistic: RunStatistic = (request, signal) => {
    const current = session.active()
    if (!current) return Promise.reject(new AnalysisError('engine'))
    return analyzeStatistic(current.file, signal, current.options, request)
  }

  const runInference: RunInference = (request, signal) => {
    const current = session.active()
    if (!current) return Promise.reject(new AnalysisError('engine'))
    return analyzeInference(current.file, signal, current.options, request)
  }

  async function start(file: File, importOptions: CsvOptions) {
    job.current?.abort()
    const controller = new AbortController()
    job.current = controller
    const selection = session.begin(file, importOptions)
    setFileInfo({ name: file.name, size: file.size })
    setStatus({ phase: 'busy' })
    performance.clearMeasures('askora:analysis')
    const startTime = performance.now()
    try {
      const result = await analyzeFile(file, controller.signal, selection.options, value => {
        if (job.current === controller) setWorkbook(value)
      })
      if (job.current !== controller || !session.publish(selection, result)) return
      performance.measure('askora:analysis', {
        start: startTime, end: performance.now(), detail: result.timings,
      })
      setStatus({ phase: 'idle' })
    } catch (error) {
      if (job.current !== controller) return
      setStatus({ phase: 'error', error: error instanceof AnalysisError ? error.code : 'engine' })
    } finally {
      if (job.current === controller) job.current = null
    }
  }

  return <>
    <a href="#workspace-main" className="skip-link">{t.skipLink}</a>
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
    <main id="workspace-main" tabIndex={-1}>
      <h1>{t.title}</h1>
      <section className="panel intake" aria-labelledby="upload-title">
        <div>
          <h2 id="upload-title">{t.upload}</h2>
          <p id="upload-guidance" className="muted">{t.guidance}</p>
        </div>
        <div className="actions">
          <input ref={picker} type="file" accept=".csv,.json,.xlsx" hidden onChange={event => {
            const selected = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (selected) {
              overrideFocus.current = null
              setWorkbook(undefined)
              void start(selected, options)
            }
          }} />
          <button ref={choose} className="primary" type="button" aria-describedby="upload-guidance"
            onClick={() => picker.current?.click()}>{t.choose}</button>
          {status.phase === 'busy' && <button ref={cancelButton} type="button" onClick={() => {
            job.current?.abort()
            choose.current?.focus()
          }}>{t.cancel}</button>}
          {status.phase === 'error' && overrideFocus.current && <button ref={retryButton} type="button" onClick={() => {
            const current = session.selection()
            if (current) void start(current.file, current.options)
          }}>{t.retry}</button>}
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
          {fileInfo && status.phase !== 'idle' && !active && <p className="file-info"><bdi>{fileInfo.name}</bdi>
            <bdi className="muted">{formatNumber(fileInfo.size, locale)} {t.bytes}</bdi></p>}
          {workbook && (active || status.phase !== 'idle') && <label className="worksheet-select">{t.worksheet}
            <select disabled={status.phase === 'busy'} value={workbook.selected} onChange={event => {
              const current = session.selection()
              if (current) {
                overrideFocus.current = null
                void start(current.file, { ...current.options, worksheet: Number(event.currentTarget.value),
                  schemaOverrides: undefined })
              }
            }}>
              {workbook.names.map((name, index) => <option key={index} value={index}>{name}</option>)}
            </select>
          </label>}
          <p className="muted">{t.privacy}</p>
        </div>
      </section>
      <div role="status" aria-atomic="true">
        {status.phase === 'busy' && <p className="notice">{t.busy}</p>}
        {active && <span className="sr-only">{t.summary}</span>}
        {status.phase === 'error' && status.error === 'cancelled' && <p className="notice">{t.errors.cancelled}</p>}
      </div>
      {status.phase === 'error' && status.error !== 'cancelled' &&
        <p role="alert" className="notice error">{t.errors[status.error]}</p>}
      {active && <Results result={active.profile} locale={locale} filename={active.file.name} onOverride={updateOverride} onStatistic={runStatistic} onInference={runInference}
        conversation={<ConversationPanel key={active.revision.ordinal} session={session} revision={active.revision} locale={locale} />} />}
    </main>
  </>
}
