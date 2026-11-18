import { confidenceLevels } from '../inference-contract.ts'
import type { ConfidenceLevel } from '../inference-contract.ts'
import { numericValue } from '../infer.ts'
import { columnLookup, groupValue, languageOf, prepare, questionLimit, quotedValue, validSchema } from './columns.ts'
import type { AnalysisIntent, Clarification, Convention, DescriptiveOperation, IntentColumn,
  IntentLanguage, IntentOperation, IntentResult, KnownIntentInputs, UnsupportedReason } from './contract.ts'

const requestPrefix = /^(?:(?:(?:could|would|can) you )?(?:please(?:,|،)? )?(?:what(?: is|'s) (?:the )?|calculate (?:(?:the|a|an) )?|compute (?:the )?|show me (?:the )?|give me (?:the )?)|(?:please(?:,|،)? |(?:من فضلك|لو سمحت)(?:،|,)? )|(?:ايه|ما هو|ما هي|ما|احسب|احسبلي|احسب لي|طلعلي|طلع لي|اوجد) )/u
const connector = / (?:and|with|و|مع) | و(?=[\p{L}§])/gu

const descriptive: readonly [RegExp, DescriptiveOperation | 'variance' | 'sd', Convention?][] = [
  [/^(?:sample (?:standard deviation|sd)|(?:الانحراف المعياري|انحراف معياري) للعينة)(?: |$)/u, 'sampleSd', 'sample'],
  [/^(?:population (?:standard deviation|sd)|(?:الانحراف المعياري|انحراف معياري) للمجتمع)(?: |$)/u, 'populationSd', 'population'],
  [/^(?:sample variance|(?:تباين|التباين) العينة)(?: |$)/u, 'sampleVariance', 'sample'],
  [/^(?:population variance|(?:تباين|التباين) المجتمع)(?: |$)/u, 'populationVariance', 'population'],
  [/^(?:standard deviation|sd|الانحراف المعياري|انحراف معياري)(?: |$)/u, 'sd'],
  [/^(?:variance|التباين|تباين)(?: |$)/u, 'variance'],
  [/^(?:average|mean|المتوسط|متوسط|المعدل|معدل)(?: |$)/u, 'mean'],
  [/^(?:median|الوسيط|وسيط)(?: |$)/u, 'median'],
  [/^(?:minimum(?: value)?|min|lowest value|اصغر(?: قيمة)?|اقل(?: قيمة)?|الحد الادني)(?: |$)/u, 'min'],
  [/^(?:maximum(?: value)?|max|highest value|اكبر(?: قيمة)?|اعلي(?: قيمة)?|الحد الاقصي)(?: |$)/u, 'max'],
  [/^(?:sum|total(?: of)?|مجموع|المجموع|اجمالي)(?: |$)/u, 'sum'],
  [/^(?:count(?: of)?(?: (?:valid |numeric )?(?:values|observations))?|how many (?:valid|numeric) (?:values|observations)|عدد (?:القيم|المشاهدات) (?:الصالحة|الرقمية))(?: |$)/u, 'count'],
]

const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}\\p{Pc}])(?:${alternatives})(?![\\p{L}\\p{M}\\p{N}\\p{Pc}])`, 'u')
const exclusions: readonly [RegExp, UnsupportedReason][] = [
  [word('delete|remove|drop|overwrite|impute|fill|deduplicate|truncate|insert|update|alter|احذف|امسح|عدل|استبدل|احلال'), 'dataModification'],
  [word('caus(?:e|es|ed|al|ation)|lead to|يسبب|سببية|يؤدي الي'), 'causal'],
  [word('predict|prediction|forecast(?:ing)?|توقع|تنبؤ|تنبيا'), 'forecast'],
  [word('anova|regression|chi[ -]square|spearman|kendall|mann[ -]whitney|bayesian|انحدار|كاي تربيع'), 'unsupportedOperation'],
  [word('group(?:ed)? by|per group|where|filtered by|after filtering|after [12][0-9]{3}|before [12][0-9]{3}|بينما|حسب كل|لكل مجموعة|بعد تصفية|one[ -]sided|one[ -]tailed|احادي الطرف'), 'unsupportedQualifier'],
]
const multiple = word('(?:and|then|ثم|وكمان|وبعدين) (?:calculate|compute|show|find|give|what|how many|mean|average|median|sum|count|minimum|maximum|min|max|correlation|variance|standard deviation|احسب|متوسط|مجموع|الوسيط|اقل|اكبر|ارتباط)|(?:اكبر|اقل|اصغر) و(?:اكبر|اقل|اصغر)')
const stripLink = (value?: string) => value?.trim().replace(/^(?:(?:of|for|in|on) (?:the )?|(?:في|من|ل) +|ل(?=عمود |متوسط ))/u, '').trim()

type Lookup = ReturnType<typeof columnLookup>

function samplePair(body: string | undefined, lookup: Lookup): {
  columns: [IntentColumn, IntentColumn] | undefined
  issues: Clarification[]
} {
  if (!body) return { columns: undefined, issues: [{ reason: 'missingColumn', role: 'first' }, { reason: 'missingColumn', role: 'second' }] }
  const candidates = Array.from(body.matchAll(connector), match =>
    [body.slice(0, match.index).trim(), body.slice(match.index + match[0].length).trim()] as const)
  if (!candidates.length) candidates.push([body, ''])
  const successes: [IntentColumn, IntentColumn][] = []
  let best: Clarification[] | undefined
  let bestScore = -1
  for (const [a, b] of candidates) {
    const x = lookup(a, 'first', 'numeric')
    const y = lookup(b, 'second', 'numeric')
    if ('column' in x && 'column' in y) {
      if (x.column.id !== y.column.id) successes.push([x.column, y.column])
      else if (bestScore < 4) {
        best = [{ reason: 'distinctColumns' }]
        bestScore = 4
      }
      continue
    }
    const issues = [...('issue' in x ? [x.issue] : []), ...('issue' in y ? [y.issue] : [])]
    const score = [x, y].reduce((sum, item) => sum + ('column' in item ? 2 : 'options' in item.issue ? 1 : 0), 0)
    if (score > bestScore) {
      best = issues
      bestScore = score
    }
  }
  if (successes.length === 1) return { columns: successes[0], issues: [] }
  if (successes.length > 1) {
    const options = [...new Map(successes.flat().map(column => [column.id, column])).values()]
    return { columns: undefined, issues: [{ reason: 'ambiguousColumnPair', options }] }
  }
  return { columns: undefined, issues: best! }
}

function parseConfidence(...candidates: (string | undefined)[]):
  { confidence?: ConfidenceLevel; issue?: Clarification } {
  const levels = candidates.filter(value => value !== undefined).map(numericValue)
  if (!levels.length) return {}
  if (levels.some(level => !confidenceLevels.includes(level as ConfidenceLevel))) {
    return { issue: { reason: 'invalidConfidence' } }
  }
  if (new Set(levels).size > 1) return { issue: { reason: 'conflictingConfidence' } }
  return { confidence: levels[0] as ConfidenceLevel }
}

export function parseAnalysisIntent(question: string, schema: readonly IntentColumn[]): IntentResult {
  let language: IntentLanguage = 'unknown'
  const unsupported = (reason: UnsupportedReason): IntentResult => ({ status: 'unsupported', language, reason })
  const resolved = (intent: AnalysisIntent): IntentResult => ({ status: 'resolved', language, intent })
  const clarifyUsing = (operation: IntentOperation, issues: Clarification[], known?: KnownIntentInputs): IntentResult =>
    ({ status: 'needs_clarification', language, operation, issues, ...(known && Object.keys(known).length && { known }) })
  const clarify = (operation: IntentOperation, ...issues: Clarification[]) => clarifyUsing(operation, issues)

  if (typeof question !== 'string') return unsupported('invalidText')
  if (question.length > questionLimit) return unsupported('tooLong')
  const prepared = prepare(question)
  if (!prepared) return unsupported('invalidText')
  language = prepared.language
  if (!prepared.text) return unsupported('empty')
  if (language === 'unknown' || /[\p{Script=Han}\p{Script=Cyrillic}\p{Script=Devanagari}]/u.test(prepared.text)) {
    return unsupported('unsupportedLanguage')
  }
  if (!validSchema(schema)) return unsupported('invalidSchema')
  let text = prepared.text.replace(requestPrefix, '').replace(requestPrefix, '').trim()
  const egyptianMean = /^(.+) كام متوسطها$/u.exec(text)
  const arabicCount = /(?:^(?:كام|قد ايه) +|(?: |^)كام$)/u.test(text)
  if (arabicCount) text = text.replace(/^(?:كام|قد ايه) +| كام$/gu, '').trim()
  for (const [pattern, reason] of exclusions) if (pattern.test(text)) return unsupported(reason)
  if (/[;؛|{}<>]/u.test(text) || word('ignore (?:all |previous |prior )?instructions|run (?:sql|python|javascript)|execute (?:sql|python|javascript)').test(text)) {
    return unsupported('unsupportedOperation')
  }
  if (multiple.test(text) || /[,،] +(?:calculate|mean|sum|median|min|max|احسب|متوسط)(?![\p{L}\p{N}_])/u.test(text)) return unsupported('multipleOperations')

  const lookup = columnLookup(schema, prepared.quotes)
  const mode = /^(?:are there|is there|هل|فيه|في|هل توجد|هل يوجد)/u.test(text) ? 'presence' : 'count'
  const quality = text.replace(/^(?:(?:are there|is there) (?:any )?|how many |(?:هل (?:توجد|يوجد)|هل|فيه|عدد) )/u, '')
    .replace(/ (?:are there|in (?:the )?dataset|في البيانات|عندي)$/u, '')

  if (/^(?:(?:count|number of) (?:the )?)?(?:rows|records|صف|صفوف|الصفوف|السجلات|سجل|سجلات)$/u.test(quality)) {
    return resolved({ kind: 'profile', operation: 'rowCount', mode: 'count' })
  }
  if (/^(?:(?:count|number of) (?:the )?)?(?:columns|الاعمدة|اعمدة|عمود|العمود)$/u.test(quality)) {
    return resolved({ kind: 'profile', operation: 'columnCount', mode: 'count' })
  }
  if (/^(?:duplicate (?:rows|records)|duplicates|صفوف مكررة|سجلات مكررة|الصفوف المكررة|التكرارات|تكرارات)$/u.test(quality)) {
    return resolved({ kind: 'profile', operation: 'duplicateRowCount', mode })
  }
  const cells = /^(?<term>missing values?|null values?|empty cells?|invalid values?|فراغات|خانات فاضية|قيم (?:ناقصة|ناقـصة|مفقودة|فاضية|غير صالحة)|قيمة (?:ناقصة|مفقودة|فاضية|غير صالحة)|القيم (?:المفقودة|الناقصة|غير الصالحة))(?:(?: (?:are )?(?:in|في|ل)) (?<column>.+))?$/u.exec(quality)?.groups
  if (cells) {
    const operation = /invalid|غير صالح/u.test(cells.term) ? 'invalidCount' : 'missingCount'
    if (!cells.column) return resolved({ kind: 'profile', operation, mode })
    const value = lookup(cells.column, 'column', 'any')
    return 'issue' in value ? clarify(operation, value.issue)
      : resolved({ kind: 'profile', operation, mode, column: value.column })
  }

  const correlation = /^(?:(?:is there (?:a )?)?(?:pearson )?correlation|(?:هل (?:يوجد|فيه) )?(?:معامل )?(?:الارتباط|ارتباط)(?: بيرسون)?)(?: (?:between|of|بين) (.+))?$/u.exec(text)
  if (correlation) {
    const pair = samplePair(correlation[1], lookup)
    return pair.columns ? resolved({ kind: 'descriptive', operation: 'pearson', columns: pair.columns })
      : clarify('pearson', ...pair.issues)
  }

  const confidenceTail = / (?:at|with confidence|بمستوي ثقة|بنسبة) (\S+)%$/u.exec(text)
  const inferenceText = confidenceTail ? text.slice(0, confidenceTail.index) : text
  const meanInterval = /^(?:(\S+)% )?(?:confidence interval|فترة ثقة)(?: (.+))?$/u.exec(inferenceText)
  if (meanInterval) {
    const internal = /^(\S+)%(?: (.+))?$/u.exec(meanInterval[2] ?? '')
    const body = stripLink(internal ? internal[2] : meanInterval[2])
      ?.replace(/^(?:mean|average|متوسط|المتوسط|لمتوسط|للمتوسط)(?: of)?(?: |$)/u, '')
    const levels = parseConfidence(meanInterval[1], internal?.[1], confidenceTail?.[1])
    const column = lookup(body, 'column', 'numeric')
    if (levels.issue || 'issue' in column) return clarifyUsing('meanInterval',
      [levels.issue, 'issue' in column ? column.issue : undefined].filter(i => i !== undefined), {
        ...('column' in column && { columns: [column.column] }),
        ...(levels.confidence !== undefined && { confidence: levels.confidence }),
      })
    return resolved({ kind: 'inference', operation: 'meanInterval', column: column.column,
      ...(levels.confidence !== undefined && { confidence: levels.confidence }) })
  }

  const confidence = parseConfidence(undefined, confidenceTail?.[1])
  const withConfidence = confidence.confidence !== undefined ? { confidence: confidence.confidence } : {}
  const oneSample = /^(?:one[ -]sample t[ -]test|اختبار t (?:لعينة واحدة|لعينه واحده))(?: (?:for|of|on|في) (.+))?$/u.exec(inferenceText)
  const differs = /^(?:test whether (?:the )?(?:average|mean)|اختبر (?:اذا كان |هل )?(?:متوسط|المتوسط)) (.+?)(?: (?:differs(?: from)?|يختلف(?: عن)?)(?: (.+))?)$/u.exec(inferenceText)
  if (oneSample || differs) {
    const against = /^(.*?)(?: (?:against|versus|vs\.?|مقابل|ضد)(?: (.+))?)?$/u.exec(oneSample?.[1] ?? '')
    const column = lookup(differs?.[1] ?? against?.[1], 'column', 'numeric')
    const nullText = differs?.[2] ?? against?.[2]
    const nullMean = nullText === undefined ? null : numericValue(nullText)
    if ('issue' in column || nullMean === null || confidence.issue) {
      return clarifyUsing('oneSample', [
        'issue' in column ? column.issue : undefined,
        nullMean === null ? { reason: nullText === undefined ? 'missingNullMean' : 'invalidNullMean' } as const : undefined,
        confidence.issue,
      ].filter(i => i !== undefined), {
        ...withConfidence,
        ...('column' in column && { columns: [column.column] }),
        ...(nullMean !== null && { nullMean }),
      })
    }
    return resolved({ kind: 'inference', operation: 'oneSample', column: column.column, nullMean, ...withConfidence })
  }

  const paired = /^(?:paired t[ -]test|اختبار t (?:المقترن|للازواج))(?: (?:between|for|on|بين) (.+))?$/u.exec(inferenceText)
  if (paired) {
    const matching = / (?:matched by row|by row|row[ -]wise|حسب الصف|مطابقة حسب الصف|في الصف نفسه)$/u.exec(paired[1] ?? '')
    const pair = samplePair(matching ? paired[1].slice(0, matching.index) : paired[1], lookup)
    if (!pair.columns || !matching || confidence.issue) return clarifyUsing('paired', [
      ...pair.issues, ...(!matching ? [{ reason: 'rowMatching' } as const] : []), ...(confidence.issue ? [confidence.issue] : []),
    ], {
      ...withConfidence, ...(pair.columns && { columns: pair.columns }), ...(matching && { matching: 'sameRow' }),
    })
    return resolved({ kind: 'inference', operation: 'paired', columns: pair.columns, matching: 'sameRow', ...withConfidence })
  }

  const welch = /^(?:welch(?:'s)?(?: independent)?(?: two[ -]sample)? (?:t[ -])?test|اختبار ويلش)(?: (?:for|of|on|علي|لمتوسط) (.+))?$/u.exec(inferenceText)
  const namedComparison = /^compare (?:(?:the )?means of )?(.+) using welch(?:'s)? (?:t[ -])?test$/u.test(inferenceText)
  if (welch || namedComparison) {
    const inputs = /^(.*?)(?: (?:by|حسب|باستخدام عمود) (.*?))?(?: (?:comparing|بين) (§\d+§) (?:and|و) (§\d+§))?$/u.exec(welch?.[1] ?? '')!
    const column = lookup(inputs[1], 'column', 'numeric')
    const grouping = lookup(inputs[2], 'grouping', 'categorical')
    const issues: Clarification[] = []
    if ('issue' in column) issues.push(column.issue)
    if ('issue' in grouping) issues.push(grouping.issue)
    if (confidence.issue) issues.push(confidence.issue)
    const a = quotedValue(inputs[3] ?? '', prepared.quotes)
    const b = quotedValue(inputs[4] ?? '', prepared.quotes)
    if (a === undefined || b === undefined) issues.push({ reason: 'missingGroups' })
    if ('issue' in column || 'issue' in grouping || a === undefined || b === undefined || issues.length) {
      return clarifyUsing('welch', issues, {
        ...withConfidence, ...('column' in column && { columns: [column.column] }),
        ...('column' in grouping && { grouping: grouping.column }),
      })
    }
    const first = groupValue(a, grouping.column)
    const second = groupValue(b, grouping.column)
    if (first === null || second === null) return clarify('welch', { reason: 'missingGroups' })
    if (first === second) return clarify('welch', { reason: 'distinctGroups' })
    return resolved({ kind: 'inference', operation: 'welch', column: column.column, grouping: grouping.column,
      groups: [first, second], ...withConfidence })
  }

  if (/^(?:compare|قارن|مقارنة)(?: |$)/u.test(text)) return clarify('comparison', { reason: 'comparisonMethod' })
  if (egyptianMean) text = `متوسط ${egyptianMean[1]}`
  for (const [pattern, operation, convention] of descriptive) {
    const prefix = pattern.exec(text)
    if (!prefix) continue
    const column = lookup(stripLink(text.slice(prefix[0].length)), 'column', 'numeric')
    if (operation === 'sd' || operation === 'variance') {
      return clarifyUsing(operation, [{ reason: 'convention' }, ...('issue' in column ? [column.issue] : [])],
        'column' in column ? { columns: [column.column] } : undefined)
    }
    if ('issue' in column) return clarify(operation, column.issue)
    return resolved({ kind: 'descriptive', operation, column: column.column, ...(convention && { convention }) })
  }
  // Latin-script language labels are hints. Unrecognized Latin wording remains outside the grammar.
  if (languageOf(text) === 'unknown') return unsupported('unsupportedLanguage')
  return unsupported('unknownOperation')
}
