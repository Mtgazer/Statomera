import { IntervalChart } from './charts.tsx'
import { useLayoutEffect, useRef, useState } from 'react'
import { AnalysisError } from './analysis.ts'
import type { AnalysisErrorCode } from './analysis.ts'
import { columnLabel } from './column-label.ts'
import type { ColumnProfile } from './dataset.ts'
import { confidenceLevels, inferenceMethods } from './inference-contract.ts'
import type { ConfidenceLevel, EffectDefinition, InferenceMethod, InferenceReason,
  InferenceRequest, InferenceResult, InferenceWarning } from './inference-contract.ts'
import { numericValue } from './infer.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'

export const inferenceTitle = { en: 'Statistical inference', ar: 'الاستدلال الإحصائي' }
export type RunInference = (request: InferenceRequest, signal: AbortSignal) => Promise<InferenceResult>

const copy = {
  en: {
    method: 'Inference method', column: 'Outcome column', second: 'Matched column', grouping: 'Grouping column',
    groupA: 'Group A', groupB: 'Group B', choose: 'Choose a group', level: 'Confidence level',
    nullMean: 'Null mean', nullHint: 'Enter a finite decimal value in the outcome’s units.',
    run: 'Run inference', busy: 'Calculating…', empty: 'An active numerical column is required.',
    chooseGroups: 'Choose two distinct categories. Up to eight frequent categories per text or Boolean column are available.',
    assumptions: 'Assumptions', estimate: 'Estimate', interval: 'Confidence interval',
    test: 'Two-sided hypothesis test', t: 't statistic', df: 'Degrees of freedom', p: 'p-value',
    effect: 'Standardized effect size', undefined: 'Unavailable', valid: 'Valid', missing: 'Missing', invalid: 'Invalid',
    counts: 'Observation counts', sample: 'Sample', pairs: 'Matched pairs', outside: 'Outside selected groups',
    excludedTotal: 'Total excluded', values: 'Values', pairedOrder: 'Difference = outcome minus matched column, within each row.',
    welchOrder: 'Difference = group A mean minus group B mean. Each row belongs to at most one selected group.',
    pairedNull: 'Null mean difference is 0.',
    interpretation: 'The p-value measures how unusual a statistic this extreme or more extreme would be under the null model. A smaller p-value provides stronger evidence against that model under the assumptions. Use the estimate and interval to judge practical importance. Observational comparisons cannot establish causation.',
    intervalHelp: 'The interval estimates the population mean or mean difference under the stated assumptions.',
    methods: { meanInterval: 'Mean confidence interval', oneSample: 'One-sample t-test',
      welch: 'Welch independent t-test', paired: 'Paired t-test' },
    designs: {
      meanInterval: 'Observations are independent and representative. With small samples, the population should be approximately normal.',
      oneSample: 'Observations are independent and representative. With small samples, the population should be approximately normal.',
      welch: 'The groups and observations are independent. Small groups should be approximately normal. Group variances may differ.',
      paired: 'Rows define meaningful matched pairs. Differences are independent across pairs and should be approximately normal for a small sample.',
    },
    effects: {
      cohenD: 'Cohen’s d = (sample mean − null mean) / sample standard deviation.',
      pairedDz: 'Paired dᶻ = mean paired difference / standard deviation of paired differences.',
      averageVarianceD: 'Mean difference divided by the square root of the unweighted average of group sample variances.',
    },
    warnings: {
      smallSample: 'At least one sample has fewer than 30 eligible observations. Check normality, skew and unusual values.',
      excluded: 'The calculation uses eligible records only. Review whether exclusions could affect the comparison.',
      constantGroup: 'One group has zero observed variance. Check the measurement and group assumptions before interpretation.',
      outOfRange: 'At least one result exceeds the finite numerical range.',
      pUnderflow: 'The p-value is below the binary64 range and is shown as an upper bound.',
      roundedToZero: 'A nonzero estimate, interval endpoint, or statistic rounded to zero at binary64 precision.',
    },
    reasons: {
      insufficient: 'At least two eligible observations per sample, or two complete pairs, are required.',
      zeroVariance: 'The standard error is zero, so t-based inference is unavailable.',
      distribution: 'The Student t calculation did not converge to a usable value.',
    },
  },
  ar: {
    method: 'طريقة الاستدلال', column: 'عمود القياس', second: 'العمود المقترن', grouping: 'عمود المجموعات',
    groupA: 'المجموعة أ', groupB: 'المجموعة ب', choose: 'اختر مجموعة', level: 'مستوى الثقة',
    nullMean: 'المتوسط المفترض', nullHint: 'أدخل عددًا عشريًا محدودًا بوحدة القياس نفسها.',
    run: 'نفّذ الاستدلال', busy: 'جارٍ الحساب…', empty: 'يتطلب الاستدلال عمودًا رقميًا مطبّقًا.',
    chooseGroups: 'اختر فئتين مختلفتين. تتوفر حتى ثماني فئات شائعة لكل عمود نصي أو منطقي.',
    assumptions: 'الافتراضات', estimate: 'التقدير', interval: 'فترة الثقة',
    test: 'اختبار فرضية ثنائي الطرف', t: 'إحصاء t', df: 'درجات الحرية', p: 'القيمة الاحتمالية',
    effect: 'حجم الأثر المعياري', undefined: 'غير متاح', valid: 'صالح', missing: 'مفقود', invalid: 'غير صالح',
    counts: 'أعداد المشاهدات', sample: 'العينة', pairs: 'الأزواج المتطابقة', outside: 'خارج المجموعتين المحددتين',
    excludedTotal: 'إجمالي المستبعد', values: 'القيم', pairedOrder: 'الفرق = القياس ناقص القيمة المقترنة في الصف نفسه.',
    welchOrder: 'الفرق = متوسط المجموعة أ ناقص متوسط المجموعة ب. ينتمي كل صف إلى مجموعة محددة واحدة على الأكثر.',
    pairedNull: 'الفرق المفترض بين المتوسطين يساوي صفرًا.',
    interpretation: 'تعبّر القيمة الاحتمالية عن احتمال مشاهدة إحصاء بهذه الدرجة من التطرف أو أكثر وفق نموذج الفرضية الصفرية. تشير القيمة الاحتمالية الأصغر إلى دليل أقوى ضد هذا النموذج وفق الافتراضات. قيّم الأهمية العملية بالرجوع إلى التقدير وفترة الثقة. المقارنات الرصدية لا تثبت السببية.',
    intervalHelp: 'تقدّر الفترة متوسط المجتمع أو الفرق بين المتوسطين وفق الافتراضات المذكورة.',
    methods: { meanInterval: 'فترة ثقة للمتوسط', oneSample: 'اختبار t لعينة واحدة',
      welch: 'اختبار ويلش لعينتين مستقلتين', paired: 'اختبار t للأزواج المتطابقة' },
    designs: {
      meanInterval: 'المشاهدات مستقلة وممثلة للمجتمع. عند صغر العينة يُفترض أن توزيع المجتمع قريب من الطبيعي.',
      oneSample: 'المشاهدات مستقلة وممثلة للمجتمع. عند صغر العينة يُفترض أن توزيع المجتمع قريب من الطبيعي.',
      welch: 'المجموعتان ومشاهداتهما مستقلة. في المجموعات الصغيرة يُفترض أن التوزيع قريب من الطبيعي. يمكن أن يختلف التباين بين المجموعتين.',
      paired: 'يمثل كل صف زوجًا ذا معنى. الفروق مستقلة بين الأزواج ويُفترض أنها قريبة من التوزيع الطبيعي عند صغر العينة.',
    },
    effects: {
      cohenD: 'حجم أثر كوهين d = (متوسط العينة − المتوسط المفترض) ÷ الانحراف المعياري للعينة.',
      pairedDz: 'حجم الأثر للأزواج dᶻ = متوسط فروق الأزواج ÷ الانحراف المعياري لهذه الفروق.',
      averageVarianceD: 'فرق المتوسطين مقسومًا على الجذر التربيعي للمتوسط غير المرجّح لتبايني العينتين.',
    },
    warnings: {
      smallSample: 'تحتوي عينة واحدة على الأقل على أقل من ٣٠ مشاهدة مؤهلة. افحص التوزيع والالتواء والقيم غير المعتادة.',
      excluded: 'يستخدم الحساب السجلات المؤهلة فقط. راجع أثر الاستبعادات المحتمل على المقارنة.',
      constantGroup: 'التباين المرصود في إحدى المجموعتين يساوي صفرًا. تحقّق من القياس وافتراضات المجموعتين قبل التفسير.',
      outOfRange: 'تتجاوز نتيجة واحدة على الأقل المجال العددي المحدود.',
      pUnderflow: 'القيمة الاحتمالية أدنى من المجال العددي المتاح وتُعرض كحد أعلى.',
      roundedToZero: 'قُرّب تقدير أو حد فترة أو إحصاء غير صفري إلى الصفر بدقة التمثيل العددي.',
    },
    reasons: {
      insufficient: 'يلزم وجود مشاهدتين مؤهلتين على الأقل لكل عينة أو زوجين مكتملين.',
      zeroVariance: 'الخطأ المعياري يساوي صفرًا، لذا يتعذر الاستدلال بتوزيع t.',
      distribution: 'لم يصل حساب توزيع t إلى قيمة قابلة للاستخدام.',
    },
  },
} satisfies Record<Locale, {
  methods: Record<InferenceMethod, string>; designs: Record<InferenceMethod, string>
  effects: Record<EffectDefinition, string>; warnings: Record<InferenceWarning, string>; reasons: Record<InferenceReason, string>
} & Record<string, unknown>>

function decimalInput(text: string) {
  return numericValue(text.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15))
    .replace(/٫/g, '.').replace(/−/g, '-'))
}

function InferenceOutput({ result, locale }: { result: InferenceResult; locale: Locale }) {
  const t = copy[locale]
  const number = (value: number | null) => value === null ? t.undefined : formatNumber(value, locale, 17)
  const { request } = result
  const percent = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', { style: 'percent' }).format(request.level / 100)
  return <>
    <p className="statistic-answer">{t.estimate} <strong data-testid="inference-estimate"><bdi>{number(result.estimate)}</bdi></strong></p>
    {result.reason && <p>{t.reasons[result.reason]}</p>}
    {result.interval && <>
      <h3>{t.interval} <bdi>{percent}</bdi></h3>
      <p className="chart-range chart-interval-values" dir="ltr" data-testid="inference-interval">
        <bdi>{number(result.interval.lower)}</bdi><bdi>{number(result.interval.upper)}</bdi>
      </p>
      <IntervalChart result={result} level={percent} locale={locale} />
      <p className="muted">{t.intervalHelp}</p>
    </>}
    {request.method === 'meanInterval' && result.degrees !== null && <p>{t.df} <bdi>{number(result.degrees)}</bdi></p>}
    {request.method !== 'meanInterval' && result.degrees !== null && <>
      <h3>{t.test}</h3>
      <dl className="metrics">
        <div><dt>{t.t}</dt><dd><bdi>{number(result.t)}</bdi></dd></div>
        <div><dt>{t.df}</dt><dd><bdi>{number(result.degrees)}</bdi></dd></div>
        <div><dt>{t.p}</dt><dd data-testid="inference-p" data-value={result.p ?? undefined}><bdi>
          {result.warnings.includes('pUnderflow') ? '< ' + number(Number.MIN_VALUE) : number(result.p)}
        </bdi></dd></div>
      </dl>
      <p className="muted">{t.interpretation}</p>
    </>}
    {result.effect && <>
      <h3>{t.effect}</h3>
      <p><bdi>{number(result.effect.value)}</bdi> · {t.effects[result.effect.definition]}</p>
    </>}
    <table className="inference-counts">
      <caption>{t.counts}</caption>
      <thead><tr><th scope="col">{t.values}</th><th scope="col">{t.valid}</th><th scope="col">{t.missing}</th><th scope="col">{t.invalid}</th></tr></thead>
      <tbody>{result.counts.map((counts, i) =>
        <tr key={i}><th scope="row">{request.groups ? <bdi>{request.groups[i]}</bdi> : request.method === 'paired' ? t.pairs : t.sample}</th>
          <td>{number(counts.valid)}</td><td>{number(counts.missing)}</td><td>{number(counts.invalid)}</td></tr>,
      )}</tbody>
    </table>
    <p>{t.excludedTotal} <bdi>{number(result.excluded)}</bdi>
      {request.method === 'welch' && <> · {t.outside} <bdi>{number(result.outsideGroups)}</bdi></>}</p>
    {result.warnings.map(warning => <p className="muted" key={warning}>{t.warnings[warning]}</p>)}
  </>
}

export function InferencePanel({ columns, locale, onRun }: { columns: ColumnProfile[]; locale: Locale; onRun: RunInference }) {
  const t = copy[locale]
  const common = messages[locale]
  const [method, setMethod] = useState<InferenceMethod>('meanInterval')
  const [level, setLevel] = useState<ConfidenceLevel>(95)
  const [firstId, setFirst] = useState('')
  const [secondId, setSecond] = useState('')
  const [groupId, setGroup] = useState('')
  const [groupA, setGroupA] = useState('')
  const [groupB, setGroupB] = useState('')
  const [nullText, setNull] = useState('0')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [error, setError] = useState<AnalysisErrorCode | null>(null)
  const active = useRef<AbortController | null>(null)
  const runButton = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => () => {
    active.current?.abort()
    active.current = null
  }, [])

  const numeric = columns.filter(col => col.type === 'numeric')
  const grouping = columns.filter(col => (col.frequency?.entries.length ?? 0) >= 2)
  const first = numeric.find(col => col.id === firstId) ?? numeric[0]
  const others = numeric.filter(col => col.id !== first?.id)
  const second = others.find(col => col.id === secondId) ?? others[0]
  const group = grouping.find(col => col.id === groupId) ?? grouping[0]
  const categories = group?.frequency?.entries ?? []
  const nullMean = decimalInput(nullText)
  const canRun = first && (method !== 'oneSample' || nullMean !== null) &&
    (method !== 'paired' || second) && (method !== 'welch' || (group && groupA && groupB && groupA !== groupB))

  function reset() {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setResult(null)
    setError(null)
  }

  async function calculate() {
    if (!canRun || active.current) return
    const request: InferenceRequest = { method, column: first.id, level }
    if (method === 'oneSample') request.nullMean = nullMean!
    if (method === 'paired') request.second = second.id
    if (method === 'welch') {
      request.groupColumn = group.id
      request.groups = [groupA, groupB]
    }
    const controller = new AbortController()
    active.current = controller
    setResult(null)
    setError(null)
    setBusy(true)
    try {
      const value = await onRun(request, controller.signal)
      if (active.current === controller) setResult(value)
    } catch (cause) {
      if (active.current === controller) setError(cause instanceof AnalysisError ? cause.code : 'engine')
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }

  function columnOptions(values: ColumnProfile[]) {
    return values.map(col => <option key={col.id} value={col.id}>{columnLabel(col, locale)}</option>)
  }

  return <section id="statistical-inference" aria-labelledby="inference-title" className="panel workspace-section">
    <h2 id="inference-title">{inferenceTitle[locale]}</h2>
    {!first ? <p className="muted">{t.empty}</p> : <>
      <form className="statistics-form" onSubmit={event => { event.preventDefault(); void calculate() }}>
        <label>{t.method}<select value={method} onChange={event => { reset(); setMethod(event.target.value as InferenceMethod) }}>
          {inferenceMethods.map(id => <option key={id} value={id}
            disabled={(id === 'paired' && numeric.length < 2) || (id === 'welch' && !group)}>{t.methods[id]}</option>)}
        </select></label>
        <label>{t.column}<select value={first.id} onChange={event => { reset(); setFirst(event.target.value) }}>
          {columnOptions(numeric)}
        </select></label>
        {method === 'paired' && <label>{t.second}<select value={second?.id ?? ''} onChange={event => { reset(); setSecond(event.target.value) }}>
          {columnOptions(others)}
        </select></label>}
        {method === 'welch' && <>
          <label>{t.grouping}<select value={group?.id ?? ''} onChange={event => {
            reset(); setGroup(event.target.value); setGroupA(''); setGroupB('')
          }}>{columnOptions(grouping)}</select></label>
          <label>{t.groupA}<select value={groupA} onChange={event => { reset(); setGroupA(event.target.value) }}>
            <option value="">{t.choose}</option>
            {categories.filter(({ value }) => value !== groupB).map(({ value }) => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>{t.groupB}<select value={groupB} onChange={event => { reset(); setGroupB(event.target.value) }}>
            <option value="">{t.choose}</option>
            {categories.filter(({ value }) => value !== groupA).map(({ value }) => <option key={value} value={value}>{value}</option>)}
          </select></label>
        </>}
        {method === 'oneSample' && <label>{t.nullMean}<input type="text" inputMode="decimal" value={nullText} maxLength={64}
          aria-invalid={nullMean === null} aria-describedby="inference-null-hint"
          onChange={event => { reset(); setNull(event.target.value) }} /></label>}
        <label>{t.level}<select value={level} onChange={event => { reset(); setLevel(Number(event.target.value) as ConfidenceLevel) }}>
          {confidenceLevels.map(value => <option key={value} value={value}>
            {new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', { style: 'percent' }).format(value / 100)}
          </option>)}
        </select></label>
        <div className="statistics-actions">
          <button ref={runButton} className="primary" type="submit" disabled={!canRun} aria-disabled={busy}>{t.run}</button>
          {busy && <button type="button" onClick={() => { reset(); setError('cancelled'); runButton.current?.focus() }}>
            {common.cancel}
          </button>}
        </div>
      </form>
      {method === 'oneSample' && <p id="inference-null-hint" className="muted">{t.nullHint}</p>}
      {method === 'paired' && <p>{t.pairedOrder} {t.pairedNull}</p>}
      {method === 'welch' && <p>{t.chooseGroups} {t.welchOrder} {t.pairedNull}</p>}
      <p><strong>{t.assumptions}</strong> {t.designs[method]}</p>
      <div role="status" aria-atomic="true">
        {busy && <p>{t.busy}</p>}
        {error && <p>{common.errors[error]}</p>}
        {result && <InferenceOutput result={result} locale={locale} />}
      </div>
    </>}
  </section>
}
