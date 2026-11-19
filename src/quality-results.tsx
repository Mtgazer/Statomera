import { Suspense } from 'react'
import { DistributionCharts } from './chart-views.tsx'
import { distinctLimit } from './dataset.ts'
import type { ColumnProfile, DatasetProfile } from './dataset.ts'
import { columnLabel } from './column-label.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import type { QualityFinding } from './quality.ts'

const qualityMessages = {
  en: {
    rate: 'Missing rate',
    ofRecords: 'of all records',
    noRecords: 'Unavailable (no records)',
    patterns: 'Missingness patterns',
    patternsHelp: 'Groups records by which columns contain blanks or configured markers. Invalid values are excluded from missingness. Up to eight tracked patterns are shown.',
    noMissing: 'No missing cells',
    otherPatterns: 'Other missingness patterns',
    matchingRecords: 'Records',
    missingColumns: 'Columns with missing values',
    duplicates: 'Exact duplicate frequencies',
    duplicateHelp: 'Each group contains identical source records. Counts include the first occurrence. Repeated values in a single column can occur in distinct records.',
    duplicateReview: 'Review the duplicate groups in context.',
    occurrences: 'Occurrences per group',
    groups: 'Groups',
    frequencyCount: 'Frequency',
    distribution: 'Distribution of valid values',
    binsHelp: 'Ranges start at the observed minimum. Each row includes its upper bound. The next range starts above that bound.',
    upperBound: 'Upper bound',
    outlierMethod: 'Potential outliers · 1.5 × interquartile range',
    lowerFence: 'Lower fence',
    upperFence: 'Upper fence',
    below: 'Below the lower fence',
    above: 'Above the upper fence',
    unavailable: {
      smallSample: 'At least eight valid values are needed for this check.',
      constant: 'All valid values are identical.',
      zeroIqr: 'The middle half has zero spread. Outliers were not assessed.',
      range: 'The fences exceed the supported numeric range. Outliers were not assessed.',
    },
    findings: {
      missing: 'Review missing observations.',
      substantialMissing: 'At least 20% of records are missing a value in this column. Review coverage before analysis.',
      invalid: 'Check the rejected values against the active column type.',
      ambiguous: 'Confirm the column type and interpretation.',
      outliers: 'Inspect the flagged observations in context. Unusual values can be valid.',
      constant: 'All valid observations share one value.',
      lowVariation: 'One value accounts for at least 95% of the valid observations.',
    },
  },
  ar: {
    rate: 'نسبة القيم المفقودة',
    ofRecords: 'من جميع السجلات',
    noRecords: 'غير متاحة لعدم وجود سجلات',
    patterns: 'أنماط القيم المفقودة',
    patternsHelp: 'تُجمّع السجلات حسب الأعمدة التي تحتوي على فراغات أو علامات فقدان محددة. تُستثنى القيم غير الصالحة من حساب الفقدان. يُعرض ما يصل إلى ثمانية أنماط متتبّعة.',
    noMissing: 'لا توجد خلايا مفقودة',
    otherPatterns: 'أنماط فقدان أخرى',
    matchingRecords: 'السجلات',
    missingColumns: 'الأعمدة ذات القيم المفقودة',
    duplicates: 'تكرارات السجلات المتطابقة',
    duplicateHelp: 'تضم كل مجموعة سجلات متطابقة في المصدر، ويشمل العدد الظهور الأول. قد تتكرر قيمة في عمود واحد ضمن سجلات مختلفة.',
    duplicateReview: 'راجع مجموعات السجلات المتكررة في سياقها.',
    occurrences: 'مرات الظهور لكل مجموعة',
    groups: 'المجموعات',
    frequencyCount: 'التكرار',
    distribution: 'توزيع القيم الصالحة',
    binsHelp: 'تبدأ النطاقات من أصغر قيمة مرصودة. يشمل كل صف حدّه الأعلى، ويبدأ النطاق التالي فوق ذلك الحد.',
    upperBound: 'الحد الأعلى',
    outlierMethod: 'قيم متطرفة محتملة · ١٫٥ × المدى الربيعي',
    lowerFence: 'الحد السفلي للكشف',
    upperFence: 'الحد العلوي للكشف',
    below: 'أقل من الحد السفلي',
    above: 'أعلى من الحد العلوي',
    unavailable: {
      smallSample: 'يلزم ثماني قيم صالحة على الأقل لهذا الفحص.',
      constant: 'جميع القيم الصالحة متطابقة.',
      zeroIqr: 'مدى النصف الأوسط يساوي صفرًا. لم تُقيَّم القيم المتطرفة.',
      range: 'تتجاوز حدود الكشف المجال العددي المدعوم. لم تُقيَّم القيم المتطرفة.',
    },
    findings: {
      missing: 'راجع القيم المفقودة.',
      substantialMissing: 'تفتقد ٢٠٪ على الأقل من السجلات إلى قيمة في هذا العمود. راجع اكتمال البيانات قبل التحليل.',
      invalid: 'راجع القيم المرفوضة وفق نوع العمود المطبّق.',
      ambiguous: 'تحقق من نوع العمود وطريقة تفسيره.',
      outliers: 'افحص القيم المحددة في سياقها. قد تكون القيم غير المعتادة صالحة.',
      constant: 'لجميع القيم الصالحة القيمة نفسها.',
      lowVariation: 'تمثل قيمة واحدة ٩٥٪ على الأقل من القيم الصالحة.',
    },
  },
} satisfies Record<Locale, { findings: Record<QualityFinding, string> } & Record<string, unknown>>

export function QualityReports({ result, locale }: { result: DatasetProfile; locale: Locale }) {
  const t = qualityMessages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const { duplicateFrequency, missingPatterns } = result
  return <div className="quality-reports">
    <details>
      <summary>{t.patterns}</summary>
      <p className="muted">{t.patternsHelp}</p>
      <table aria-label={t.patterns}>
        <thead><tr><th scope="col">{t.missingColumns}</th><th scope="col">{t.matchingRecords}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{t.noMissing}</th><td>{number(missingPatterns.complete)}</td></tr>
          {missingPatterns.entries.map(({ columns, count }) =>
            <tr key={columns.join(',')}><th scope="row">{columns.map((index, position) =>
              <span key={index}>{position > 0 && (locale === 'ar' ? '، ' : ', ')}
                <bdi>{columnLabel(result.columns[index], locale)}</bdi></span>,
            )}</th><td>{number(count)}</td></tr>,
          )}
          {missingPatterns.other > 0 && <tr><th scope="row">{t.otherPatterns}</th><td>{number(missingPatterns.other)}</td></tr>}
        </tbody>
      </table>
    </details>
    <details>
      <summary>{t.duplicates} <bdi>({number(duplicateFrequency.groups)})</bdi></summary>
      <p className="muted">{t.duplicateHelp}</p>
      {duplicateFrequency.groups > 0 && <>
        <p>{t.duplicateReview}</p>
        <div className="table-scroll duplicate-frequencies" tabIndex={0} role="region" aria-label={t.duplicates}>
          <table aria-label={t.duplicates}>
            <thead><tr><th scope="col">{t.occurrences}</th><th scope="col">{t.groups}</th></tr></thead>
            <tbody>{duplicateFrequency.entries.map(({ occurrences, groups }) =>
              <tr key={occurrences}><th scope="row">{number(occurrences)}</th><td>{number(groups)}</td></tr>,
            )}</tbody>
          </table>
        </div>
      </>}
    </details>
  </div>
}

export function ColumnSummary({ column, locale }: { column: ColumnProfile; locale: Locale }) {
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const { numeric, frequency, warnings } = column
  return <>
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
  </>
}

export function ColumnQuality({ column, rows, locale }: { column: ColumnProfile; rows: number; locale: Locale }) {
  const t = qualityMessages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const boundary = (value: number) => formatNumber(value, locale, 17)
  const { distribution, missingRate, findings } = column
  const percentage = missingRate === null ? null : new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', {
    style: 'percent', maximumSignificantDigits: 4,
  }).format(missingRate)
  const assessment = distribution?.outliers
  return <>
    <p>{t.rate} <strong data-testid="missing-rate">{percentage ?? t.noRecords}</strong>
      {percentage !== null && <> <bdi>({number(column.blank + column.markedMissing)} / {number(rows)})</bdi> {t.ofRecords}</>}
    </p>
    {findings.length > 0 && <ul className="quality-findings">{findings.map(finding =>
      <li key={finding}>{t.findings[finding]}</li>,
    )}</ul>}
    {distribution && column.numeric && <>
      <Suspense fallback={<p className="muted">{messages[locale].chartLoading}</p>}>
        <DistributionCharts numeric={column.numeric} quality={distribution} locale={locale} />
      </Suspense>
      <h3>{t.outlierMethod}</h3>
      {assessment?.status === 'assessed'
        ? <dl className="profile-statistics">
          {([[t.lowerFence, boundary(assessment.lower)], [t.upperFence, boundary(assessment.upper)],
            [t.below, number(assessment.below)], [t.above, number(assessment.above)]] as const).map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>,
          )}
        </dl>
        : assessment && <p className="muted">{t.unavailable[assessment.status]}</p>}
      <p className="muted">{t.binsHelp}</p>
      <table>
        <caption>{t.distribution} <bdi>({number(column.valid)})</bdi></caption>
        <thead><tr><th scope="col">{t.upperBound}</th><th scope="col">{t.frequencyCount}</th></tr></thead>
        <tbody>{distribution.bins.map(({ upper, count }) =>
          <tr key={upper}><th scope="row">{boundary(upper)}</th><td>{number(count)}</td></tr>,
        )}</tbody>
      </table>
    </>}
  </>
}
