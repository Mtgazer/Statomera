import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnalysisError, analyzeFile, analyzeInference, analyzeStatistic } from './analysis.ts'
import type { AnalysisErrorCode, AnalysisResult } from './analysis.ts'
import { formatNumber, messages, productName } from './locale.ts'
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
  | { phase: 'idle' | 'cleared' }
  | { phase: 'busy' }
  | { phase: 'error'; error: AnalysisErrorCode }

const worksheetId = 'import-worksheet'
const retryableErrors = new Set<AnalysisErrorCode>(['cancelled', 'read', 'engine', 'timeout'])
const importOptionErrors = new Set<AnalysisErrorCode>(['headers', 'delimiter', 'options'])

export function App({ session }: { session: DatasetSession<AnalysisResult> }) {
  const [locale, setLocale] = useState<Locale>('en')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const active = useSyncExternalStore(session.subscribe, session.active)
  const [workbook, setWorkbook] = useState<AnalysisResult['workbook']>()
  const [options, setOptions] = useState(defaultCsvOptions)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number }>()
  const job = useRef<AbortController | null>(null)
  const returnFocus = useRef<string | null>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const importDetails = useRef<HTMLDetailsElement>(null)
  const importSummary = useRef<HTMLElement>(null)
  const choose = useRef<HTMLButtonElement>(null)
  const t = messages[locale]
  const error = status.phase === 'error' ? status.error : undefined
  const recoverOptions = error !== undefined && importOptionErrors.has(error)
  const retryImport = error !== undefined && (retryableErrors.has(error) || returnFocus.current?.startsWith('schema-'))
  const importPending = status.phase === 'busy' || status.phase === 'error'

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
    const target = returnFocus.current
    if (!target) return
    const focused = document.activeElement
    if (active) {
      if (focused === document.body) document.getElementById(target)?.focus()
      returnFocus.current = null
    } else if (status.phase === 'busy' && (focused === document.body || focused?.id === target)) {
      cancelButton.current?.focus()
    } else if (status.phase === 'error' && focused === document.body) {
      if (target === worksheetId) document.getElementById(target)?.focus()
      else retryButton.current?.focus()
    }
  }, [active, status])

  function clearDataset() {
    const pending = job.current
    job.current = null
    pending?.abort()
    session.clear()
    returnFocus.current = null
    setWorkbook(undefined)
    setFileInfo(undefined)
    setStatus({ phase: 'cleared' })
    choose.current?.focus()
  }

  function reviewOptions() {
    if (!importDetails.current) return
    importDetails.current.open = true
    importSummary.current?.focus()
  }

  function retry(useNewOptions: boolean) {
    const current = session.selection()
    if (!current) return
    if (!returnFocus.current) choose.current?.focus()
    void start(current.file, useNewOptions ? { ...current.options, ...options } : current.options)
  }

  function updateOverride(id: string, type: SchemaType | 'auto') {
    const current = session.selection()
    if (!current) return
    const schemaOverrides = { ...current.options.schemaOverrides, [id]: type === 'auto' ? undefined : type }
    if (type === 'auto') delete schemaOverrides[id]
    returnFocus.current = `schema-${id}`
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
        <div className="brand-lockup">
          <img src={`${import.meta.env.BASE_URL}assets/statomera-mark.svg`} width="36" height="36" alt="" />
          <div className="brand-text">
            <bdi className="wordmark" lang="en" dir="ltr">{productName}</bdi>
            <span className="brand-descriptor">{t.brandDescriptor}</span>
          </div>
        </div>
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
              returnFocus.current = null
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
          {(active || importPending) && <button type="button" onClick={clearDataset}>{t.clearDataset}</button>}
          {retryImport && <button ref={retryButton} type="button" onClick={() => retry(false)}>{t.retry}</button>}
          {recoverOptions && <button type="button" onClick={reviewOptions}>{t.reviewImportOptions}</button>}
        </div>
        <details ref={importDetails} className="import-options">
          <summary ref={importSummary}>{t.importOptions}</summary>
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
          {recoverOptions && <button className="retry-options" type="button" onClick={() => retry(true)}>{t.retryWithOptions}</button>}
        </details>
        <div className="file-status">
          {fileInfo && importPending && !active && <p className="file-info"><bdi>{fileInfo.name}</bdi>
            <bdi className="muted">{formatNumber(fileInfo.size, locale)} {t.bytes}</bdi></p>}
          {workbook && (active || importPending) && <label className="worksheet-select">{t.worksheet}
            <select id={worksheetId} disabled={status.phase === 'busy'} value={workbook.selected} onChange={event => {
              const current = session.selection()
              if (current) {
                returnFocus.current = worksheetId
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
        {active && <span className="sr-only">{t.datasetReady(formatNumber(active.profile.rows, locale),
          formatNumber(active.profile.columns.length, locale))}</span>}
        {status.phase === 'cleared' && <p className="notice">{t.datasetCleared}</p>}
        {status.phase === 'error' && status.error === 'cancelled' && <p className="notice">{t.errors.cancelled}</p>}
      </div>
      {error !== undefined && error !== 'cancelled' &&
        <p role="alert" className="notice error">{t.errors[error]}</p>}
      {active && <Results key={active.revision.ordinal} result={active.profile} locale={locale} filename={active.file.name} onOverride={updateOverride} onStatistic={runStatistic} onInference={runInference}
        conversation={(onReport, reported) => <ConversationPanel session={session} revision={active.revision} locale={locale} onReport={onReport} reported={reported} />} />}
    </main>
  </>
}
