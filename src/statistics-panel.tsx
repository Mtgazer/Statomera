import { ReportAction } from './report-action.tsx'
import { ScatterChart } from './chart-views.tsx'
import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { AnalysisError } from './analysis.ts'
import type { AnalysisErrorCode } from './analysis.ts'
import { columnLabel } from './column-label.ts'
import type { ColumnProfile } from './dataset.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import { statisticMethods } from './statistics-contract.ts'
import type { StatisticMethod, StatisticOperation, StatisticRequest, StatisticResult, StatisticWarning, UndefinedStatistic } from './statistics-contract.ts'

export const statisticsTitle = { en: 'Descriptive statistics', ar: 'الإحصاءات الوصفية' }

export const statisticCopy = {
  en: {
    operation: 'Operation', first: 'Numerical column', second: 'Second numerical column',
    run: 'Calculate', busy: 'Calculating…', empty: 'Use a numeric schema for at least one column to calculate a statistic.',
    valid: 'Valid observations', pairs: 'Complete pairs', excluded: 'Excluded records',
    missing: 'Missing only', invalid: 'With invalid values', method: 'Method', result: 'Result',
    undefined: 'Undefined', pearsonHelp: 'Pearson measures linear association between paired values. It cannot establish causation.',
    operations: {
      count: 'Valid count', sum: 'Sum', mean: 'Mean', median: 'Median', min: 'Minimum', max: 'Maximum', range: 'Range',
      sampleVariance: 'Sample variance', populationVariance: 'Population variance',
      sampleSd: 'Sample standard deviation', populationSd: 'Population standard deviation',
      q1: 'First quartile (25th percentile)', q3: 'Third quartile (75th percentile)',
      p90: '90th percentile', p95: '95th percentile', pearson: 'Pearson correlation',
    },
    methods: {
      count: 'Number of eligible observations.', sum: 'Total of eligible values.',
      mean: 'Sum divided by the valid count.', extreme: 'Observed endpoint of eligible values.',
      range: 'Maximum minus minimum.', quantile: 'Type 7 linear interpolation at the zero-based rank (n − 1) × p.',
      sampleMoment: 'Centered squared deviations divided by n − 1.',
      populationMoment: 'Centered squared deviations divided by n.',
      sampleRoot: 'Square root of the variance with divisor n − 1.',
      populationRoot: 'Square root of the variance with divisor n.',
      pairedPearson: 'Centered cross-product divided by the geometric mean of the two centered sums of squares.',
    },
    pairedExclusion: 'For Pearson, both values in a record must be valid.',
    reasons: {
      noObservations: 'There are no eligible observations.', insufficientObservations: 'This operation needs at least two eligible observations.',
      constantInput: 'At least one column is constant among the complete pairs.',
      numericRange: 'The result exceeds the finite numeric range.',
    },
    warnings: {
      excluded: 'Missing and invalid values are excluded.',
      roundedToZero: 'A nonzero result is too small to represent and rounded to zero.',
    },
  },
  ar: {
    operation: 'العملية', first: 'العمود الرقمي', second: 'العمود الرقمي الثاني',
    run: 'احسب', busy: 'جارٍ الحساب…', empty: 'طبّق النوع الرقمي على عمود واحد على الأقل لحساب إحصاء.',
    valid: 'المشاهدات الصالحة', pairs: 'الأزواج المكتملة', excluded: 'السجلات المستبعدة',
    missing: 'فقدان فقط', invalid: 'تحتوي على قيم غير صالحة', method: 'الطريقة', result: 'النتيجة',
    undefined: 'غير معرّفة', pearsonHelp: 'يقيس بيرسون الارتباط الخطي بين القيم المزدوجة. ولا يثبت السببية.',
    operations: {
      count: 'عدد القيم الصالحة', sum: 'المجموع', mean: 'المتوسط', median: 'الوسيط', min: 'الحد الأدنى', max: 'الحد الأقصى', range: 'المدى',
      sampleVariance: 'تباين العينة', populationVariance: 'تباين المجتمع',
      sampleSd: 'الانحراف المعياري للعينة', populationSd: 'الانحراف المعياري للمجتمع',
      q1: 'الربيع الأول (المئين ٢٥)', q3: 'الربيع الثالث (المئين ٧٥)',
      p90: 'المئين ٩٠', p95: 'المئين ٩٥', pearson: 'ارتباط بيرسون',
    },
    methods: {
      count: 'عدد المشاهدات المؤهلة.', sum: 'مجموع القيم المؤهلة.',
      mean: 'المجموع مقسومًا على عدد القيم الصالحة.', extreme: 'القيمة الحدية المرصودة بين القيم المؤهلة.',
      range: 'الحد الأقصى مطروحًا منه الحد الأدنى.', quantile: 'استيفاء خطي من النوع السابع عند الرتبة التي تبدأ من الصفر (n − 1) × p.',
      sampleMoment: 'مجموع مربعات الانحرافات عن المتوسط مقسومًا على عدد القيم ناقص واحد.',
      populationMoment: 'مجموع مربعات الانحرافات عن المتوسط مقسومًا على عدد القيم.',
      sampleRoot: 'الجذر التربيعي للتباين المحسوب بقاسم يساوي عدد القيم ناقص واحد.',
      populationRoot: 'الجذر التربيعي للتباين المحسوب بقاسم يساوي عدد القيم.',
      pairedPearson: 'مجموع جداءات الانحرافات عن المتوسط مقسومًا على المتوسط الهندسي لمجموعَي مربعات الانحرافات.',
    },
    pairedExclusion: 'يتطلب معامل بيرسون قيمتين صالحتين في كل سجل.',
    reasons: {
      noObservations: 'لا توجد مشاهدات مؤهلة.', insufficientObservations: 'تتطلب هذه العملية مشاهدتين مؤهلتين على الأقل.',
      constantInput: 'قيم أحد العمودين على الأقل ثابتة ضمن الأزواج المكتملة.',
      numericRange: 'النتيجة خارج المجال العددي المحدود.',
    },
    warnings: {
      excluded: 'تُستبعد القيم المفقودة وغير الصالحة.',
      roundedToZero: 'النتيجة غير الصفرية أصغر من أن تُمثّل عدديًا، فقُرّبت إلى الصفر.',
    },
  },
} satisfies Record<Locale, {
  operations: Record<StatisticOperation, string>
  methods: Record<StatisticMethod, string>
  warnings: Record<StatisticWarning, string>
  reasons: Record<UndefinedStatistic, string>
} & Record<string, unknown>>

export type RunStatistic = (request: StatisticRequest, signal: AbortSignal) => Promise<StatisticResult>

export function StatisticsPanel({ columns, locale, onRun, onReport, reported }: {
  columns: ColumnProfile[]; locale: Locale; onRun: RunStatistic; onReport: (result: StatisticResult) => void; reported?: StatisticResult
}) {
  const numeric = columns.filter(column => column.type === 'numeric')
  const t = statisticCopy[locale]
  const common = messages[locale]
  const [operation, setOperation] = useState<StatisticOperation>('mean')
  const [firstId, setFirst] = useState('')
  const [secondId, setSecond] = useState('')
  const [result, setResult] = useState<StatisticResult | null>(null)
  const [error, setError] = useState<AnalysisErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef<AbortController | null>(null)
  const runButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => () => {
    current.current?.abort()
    current.current = null
  }, [])

  const first = numeric.find(column => column.id === firstId) ?? numeric[0]
  const secondOptions = numeric.filter(column => column.id !== first?.id)
  const second = secondOptions.find(column => column.id === secondId) ?? secondOptions[0]
  const paired = operation === 'pearson'

  function reset() {
    current.current?.abort()
    current.current = null
    setBusy(false)
    setResult(null)
    setError(null)
  }

  async function calculate() {
    if (!first || (paired && !second) || current.current) return
    const controller = new AbortController()
    current.current = controller
    setResult(null)
    setError(null)
    setBusy(true)
    try {
      const ids = paired ? [first.id, second.id] : [first.id]
      const calculated = await onRun({ operation, columns: ids }, controller.signal)
      if (current.current === controller) setResult(calculated)
    } catch (cause) {
      if (current.current === controller) setError(cause instanceof AnalysisError ? cause.code : 'engine')
    } finally {
      if (current.current === controller) {
        current.current = null
        if (cancelButton.current?.matches(':focus')) runButton.current?.focus()
        setBusy(false)
      }
    }
  }

  return <section id="descriptive-statistics" tabIndex={-1} aria-labelledby="statistics-title" className="panel workspace-section">
    <h2 id="statistics-title">{statisticsTitle[locale]}</h2>
    {!first ? <p className="muted">{t.empty}</p> :
      <form className="statistics-form" onSubmit={event => { event.preventDefault(); void calculate() }}>
        <label>{t.operation}<select value={operation} onChange={event => {
          reset()
          setOperation(event.currentTarget.value as StatisticOperation)
        }}>
          {(Object.keys(statisticMethods) as StatisticOperation[]).map(id =>
            <option key={id} value={id} disabled={id === 'pearson' && numeric.length < 2}>{t.operations[id]}</option>,
          )}
        </select></label>
        <label>{t.first}<select value={first.id} onChange={event => { reset(); setFirst(event.currentTarget.value) }}>
          {numeric.map(column => <option key={column.id} value={column.id}>{columnLabel(column, locale)}</option>)}
        </select></label>
        {paired && <label>{t.second}<select value={second?.id ?? ''} onChange={event => { reset(); setSecond(event.currentTarget.value) }}>
          {secondOptions.map(column => <option key={column.id} value={column.id}>{columnLabel(column, locale)}</option>)}
        </select></label>}
        <div className="statistics-actions">
          <button ref={runButton} className="primary" type="submit" aria-disabled={busy}>{t.run}</button>
          {busy && <button ref={cancelButton} type="button" onClick={() => {
            reset()
            setError('cancelled')
            runButton.current?.focus()
          }}>{common.cancel}</button>}
        </div>
      </form>}
    <div role="status" aria-atomic="true" className="analysis-status">
      {busy && <p>{t.busy}</p>}
      {error && <p className={error === 'cancelled' ? undefined : 'error'}>{common.errors[error]}
        {(error === 'read' || error === 'engine') && <> {common.analysisRetry}</>}
      </p>}
      {result && <span className="sr-only">{result.reason ? common.analysisUnavailable : common.analysisReady}</span>}
    </div>
    {result && <div role="group" aria-label={common.analysisEvidence}><StatisticEvidence result={result} locale={locale} /></div>}
    {result && <StatisticPlot result={result} columns={columns} locale={locale} />}
    {result && <ReportAction locale={locale} added={result === reported} onAdd={() => onReport(result)} />}
  </section>
}

export function StatisticPlot({ result, columns, locale }: { result: StatisticResult; columns: ColumnProfile[]; locale: Locale }) {
  if (!result.scatter) return null
  const [firstId, secondId] = result.columns
  const first = columns.find(column => column.id === firstId)
  const second = columns.find(column => column.id === secondId)
  if (!first || !second) return null
  return <Suspense fallback={<p className="muted">{messages[locale].chartLoading}</p>}>
    <ScatterChart data={result.scatter} total={result.valid} locale={locale}
      labels={[columnLabel(first, locale), columnLabel(second, locale)]} />
  </Suspense>
}

export function StatisticEvidence({ result, locale }: { result: Omit<StatisticResult, 'scatter'>; locale: Locale }) {
  const t = statisticCopy[locale]
  const paired = result.operation === 'pearson'
  return <>
    <p className="statistic-answer">{t.result} <strong data-testid="statistic-value" data-value={result.value ?? undefined}>
      {result.value === null ? t.undefined : <bdi>{formatNumber(result.value, locale, 17)}</bdi>}
    </strong></p>
    {result.reason && <p>{t.reasons[result.reason]}</p>}
    <dl className="metrics">
      {([[paired ? t.pairs : t.valid, result.valid], [t.excluded, result.excluded],
        [t.missing, result.missingOnly], [t.invalid, result.invalid]] as const).map(([label, count]) =>
        <div key={label}><dt>{label}</dt><dd><bdi>{formatNumber(count, locale)}</bdi></dd></div>,
      )}
    </dl>
    <p className="muted"><strong>{t.method}</strong> {t.methods[result.method]}</p>
    {result.warnings.map(warning => <p className="muted evidence-warning" key={warning}>{t.warnings[warning]}{paired && warning === 'excluded' && ' ' + t.pairedExclusion}</p>)}
    {paired && <p className="muted">{t.pearsonHelp}</p>}
  </>
}
