import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { position } from './chart-scale.ts'
import type { Domain } from './chart-scale.ts'
import type { NumericSummary } from './dataset.ts'
import type { InferenceResult } from './inference-contract.ts'
import { formatNumber } from './locale.ts'
import type { Locale } from './locale.ts'
import type { NumericQuality } from './quality.ts'
import type { ScatterData } from './scatter.ts'

const copy = {
  en: {
    histogram: 'Histogram', box: 'Box plot', scatter: 'Scatter plot', interval: 'Confidence interval plot',
    count: 'Count per bin', chartData: 'Scatter data', pairs: 'Complete pairs',
    points: 'All complete pairs are plotted. Identical pairs may overlap.',
    density: 'All complete pairs are counted in grid cells. Stronger gold indicates more pairs in that cell.',
    cells: 'Populated cells', maxCell: 'Most pairs in a cell', xAxis: 'Horizontal axis', yAxis: 'Vertical axis',
    binRule: 'Each range includes its upper edge. Only the first range includes its lower edge.',
    q1: 'First quartile', median: 'Median', q3: 'Third quartile', low: 'Lower whisker', high: 'Upper whisker',
    whiskers: 'Whiskers reach the outermost observations inside the IQR fences.',
    unassessed: 'Whiskers span the observed range. The IQR rule was not applied.',
    flagged: 'Hollow diamonds mark the most extreme potential outlier on each flagged side. See the counts below.',
    intervalUnavailable: 'A plot requires a finite estimate and both finite endpoints.',
  },
  ar: {
    histogram: 'المدرج التكراري', box: 'المخطط الصندوقي', scatter: 'مخطط التشتت', interval: 'مخطط فترة الثقة',
    count: 'العدد في كل فئة', chartData: 'بيانات التشتت', pairs: 'الأزواج المكتملة',
    points: 'تُعرض جميع الأزواج المكتملة. قد تتداخل الأزواج المتطابقة.',
    density: 'تُحسب جميع الأزواج المكتملة ضمن خلايا الشبكة. يدل اللون الذهبي الأوضح على مزيد من الأزواج في الخلية.',
    cells: 'الخلايا المأهولة', maxCell: 'أكبر عدد للأزواج في خلية', xAxis: 'المحور الأفقي', yAxis: 'المحور الرأسي',
    binRule: 'يشمل كل نطاق حدّه الأعلى. يشمل النطاق الأول فقط حدّه الأدنى.',
    q1: 'الربيع الأول', median: 'الوسيط', q3: 'الربيع الثالث', low: 'طرف الشارب الأدنى', high: 'طرف الشارب الأعلى',
    whiskers: 'تمتد الشوارب إلى أبعد المشاهدات داخل حدود المدى الربيعي.',
    unassessed: 'تمتد الشوارب عبر النطاق المرصود. لم تُطبّق قاعدة المدى الربيعي.',
    flagged: 'تُظهر العلامات المعيّنة الفارغة أشد القيم المتطرفة المحتملة على كل جانب محدد. تظهر الأعداد أدناه.',
    intervalUnavailable: 'يتطلب الرسم تقديرًا وحدّين قابلين للتمثيل العددي.',
  },
} as const

const left = 12
const right = 388
const top = 12
const bottom = 140
const xAt = (value: number, domain: Domain) => left + (right - left) * position(value, domain)
const yAt = (value: number, domain: Domain) => bottom - (bottom - top) * position(value, domain)
const number = (value: number, locale: Locale) => formatNumber(value, locale, 17)

function Plot({ name, description, height = 152, children }: { name: string; description?: string; height?: number; children: ReactNode }) {
  return <svg className="chart-plot" viewBox={`0 0 400 ${height}`} role="img" aria-label={name} aria-describedby={description}>
    {children}
  </svg>
}

function HorizontalRange({ domain, locale }: { domain: Domain; locale: Locale }) {
  const [min, max] = domain
  return <div className="chart-range" dir="ltr" data-single={min === max || undefined}>
    <bdi>{number(min, locale)}</bdi>{min !== max && <bdi>{number(max, locale)}</bdi>}
  </div>
}

function EndCap({ x, y, size = 8 }: { x: number; y: number; size?: number }) {
  return <line className="chart-line" x1={x} x2={x} y1={y - size} y2={y + size} />
}

export function DistributionCharts({ numeric, quality, locale }: {
  numeric: NumericSummary; quality: NumericQuality; locale: Locale
}) {
  const t = copy[locale]
  const domain: Domain = [numeric.min, numeric.max]
  const summary = useId()
  const { box, bins, outliers } = quality
  const countMax = Math.max(...bins.map(({ count }) => count))
  const q1 = xAt(box.q1, domain)
  const q3 = xAt(box.q3, domain)
  const a = xAt(box.lowWhisker, domain)
  const z = xAt(box.highWhisker, domain)
  const assessed = outliers.status === 'assessed'
  const marks = assessed ? [
    ...(outliers.below ? [numeric.min] : []), ...(outliers.above ? [numeric.max] : []),
  ] : []
  return <div className="distribution-charts">
    <figure className="chart">
      <figcaption>{t.histogram}</figcaption>
      <p id={`${summary}-histogram`} className="chart-legend">{t.count} · <bdi>{number(0, locale)} – {number(countMax, locale)}</bdi></p>
      <Plot name={t.histogram} description={`${summary}-histogram`}>
        <path className="chart-axis" d={`M${left} ${top}V${bottom}H${right} M${left} ${top}H${right}`} />
        {bins.map(({ upper, count }, index) => {
          const x1 = xAt(index ? bins[index - 1].upper : numeric.min, domain)
          const x2 = xAt(upper, domain)
          const y = yAt(count, [0, countMax])
          return x1 !== x2
            ? <rect key={upper} className="chart-bar" x={x1} y={y} width={x2 - x1} height={bottom - y} />
            : <line key={upper} className="chart-line" x1={x1} x2={x1} y1={y} y2={bottom} />
        })}
      </Plot>
      <HorizontalRange domain={domain} locale={locale} />
    </figure>
    <figure className="chart">
      <figcaption>{t.box}</figcaption>
      <Plot name={t.box} description={`${summary}-box`} height={66}>
        <path className="chart-axis" d={`M${left} 58H${right}`} />
        <line className="chart-line" x1={a} x2={z} y1="32" y2="32" />
        <EndCap x={a} y={32} /><EndCap x={z} y={32} />
        <rect className="chart-box" x={q1} y="20" width={q3 - q1} height="24" />
        <EndCap x={xAt(numeric.median, domain)} y={32} size={12} />
        {marks.map(value => {
          const x = xAt(value, domain)
          return <path key={value} className="chart-outlier" d={`M${x} 26l6 6-6 6-6-6Z`} />
        })}
      </Plot>
      <HorizontalRange domain={domain} locale={locale} />
      <p id={`${summary}-box`} className="chart-legend">{assessed ? t.whiskers : t.unassessed} {marks.length > 0 && t.flagged}</p>
      <dl className="chart-keys">
        {([[t.low, box.lowWhisker], [t.q1, box.q1], [t.median, numeric.median], [t.q3, box.q3], [t.high, box.highWhisker]] as const)
          .map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{number(value, locale)}</bdi></dd></div>)}
      </dl>
    </figure>
  </div>
}

function gridSpan(index: number, edges: number[], domain: Domain) {
  const a = position(index ? edges[index - 1] : domain[0], domain)
  const b = position(edges[index], domain)
  return [a, b - a] as const
}

export function ScatterChart({ data, total, labels, locale }: {
  data: ScatterData; total: number; labels: readonly [string, string]; locale: Locale
}) {
  const t = copy[locale]
  const [table, setTable] = useState(false)
  const legend = useId()
  const axes = useId()
  const names = [t.xAxis, t.yAxis] as const
  const most = data.kind === 'density' ? Math.max(...data.cells.map(({ count }) => count)) : 0
  const cellRange = (index: number, edges: number[], min: number) => {
    const from = index ? edges[index - 1] : min
    const to = edges[index]
    return from === to ? number(to, locale) : `${number(from, locale)} – ${number(to, locale)}`
  }
  return <figure className="chart chart-scatter">
    <figcaption>{t.scatter}</figcaption>
    <p id={legend} className="chart-legend"><bdi>{number(total, locale)}</bdi> {t.pairs} · {data.kind === 'points' ? t.points : t.density}</p>
    <Plot name={t.scatter} description={`${legend} ${axes}`} height={212}>
      <path className="chart-axis" d={`M${left} ${top}V200H${right}`} />
      {data.kind === 'points' ? data.points.map(([x, y], index) =>
        <circle key={index} className="chart-point" cx={xAt(x, data.x)}
          cy={200 - (200 - top) * position(y, data.y)} r="3.6" />,
      ) : data.cells.map(({ x, y, count }) => {
        const [startX, width] = gridSpan(x, data.xEdges, data.x)
        const [startY, height] = gridSpan(y, data.yEdges, data.y)
        return <rect key={`${x}:${y}`} className="chart-density" x={left + startX * (right - left) - (width ? 0 : 1)}
          y={200 - (startY + height) * (200 - top) - (height ? 0 : 1)} width={width * (right - left) || 2}
          height={height * (200 - top) || 2} fillOpacity={0.2 + 0.8 * count / most} />
      })}
    </Plot>
    <HorizontalRange domain={data.x} locale={locale} />
    <dl id={axes} className="chart-keys">
      <div><dt>{names[0]}</dt><dd><bdi>{labels[0]}</bdi></dd></div>
      <div><dt>{names[1]}</dt><dd><bdi>{labels[1]}</bdi> · <bdi>{number(data.y[0], locale)}{data.y[0] !== data.y[1] &&
        ` – ${number(data.y[1], locale)}`}</bdi></dd></div>
      {data.kind === 'density' && <div><dt>{t.maxCell}</dt><dd><bdi>{number(most, locale)}</bdi></dd></div>}
    </dl>
    <details onToggle={event => setTable(event.currentTarget.open)}>
      <summary>{t.chartData}</summary>
      {table && <>
        {data.kind === 'density' && <p className="chart-legend">{t.binRule}</p>}
        <div className="table-scroll chart-table" tabIndex={0} role="region" aria-label={t.chartData}>
          <table aria-label={data.kind === 'density' ? t.cells : t.pairs}>
            <thead><tr><th scope="col"><bdi>{labels[0]}</bdi></th><th scope="col"><bdi>{labels[1]}</bdi></th>
              {data.kind === 'density' && <th scope="col">{t.pairs}</th>}</tr></thead>
            <tbody>{data.kind === 'points' ? data.points.map(([x, y], index) =>
              <tr key={index}><td>{number(x, locale)}</td><td>{number(y, locale)}</td></tr>,
            ) : data.cells.map(({ x, y, count }) =>
              <tr key={`${x}:${y}`}><td><bdi>{cellRange(x, data.xEdges, data.x[0])}</bdi></td>
                <td><bdi>{cellRange(y, data.yEdges, data.y[0])}</bdi></td><td>{number(count, locale)}</td></tr>,
            )}</tbody>
          </table>
        </div>
      </>}
    </details>
  </figure>
}

export function IntervalChart({ result, level, locale, description }: { result: InferenceResult; level: string; locale: Locale; description: string }) {
  const t = copy[locale]
  const { interval, estimate } = result
  if (!interval) return null
  if (interval.lower === null || interval.upper === null || estimate === null) return <p className="muted">{t.intervalUnavailable}</p>

  const domain: Domain = [interval.lower, interval.upper]
  const a = xAt(domain[0], domain)
  const b = xAt(domain[1], domain)
  return <figure className="chart chart-interval">
    <Plot name={`${t.interval} ${level}`} description={description} height={60}>
      <path className="chart-axis" d={`M${left} 50H${right}`} />
      <line className="chart-line" x1={a} x2={b} y1="26" y2="26" />
      <EndCap x={a} y={26} /><EndCap x={b} y={26} />
      <circle className="chart-point" cx={xAt(estimate, domain)} cy="26" r="6" />
    </Plot>
  </figure>
}
