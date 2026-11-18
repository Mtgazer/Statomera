import type { ActiveDataset } from '../dataset-session.ts'
import { parseAnalysisIntent } from '../intent/parse.ts'
import type { Locale } from '../locale.ts'
import { validateRoute } from '../router/validation.ts'

const prompts = {
  en: { rows: 'How many rows are there?', missing: 'Are there missing values?', mean: 'What is the mean of' },
  ar: { rows: 'ما عدد الصفوف؟', missing: 'هل توجد قيم مفقودة؟', mean: 'ما متوسط' },
}

export function questionExamples(active: ActiveDataset, locale: Locale): string[] {
  const t = prompts[locale]
  const schema = active.profile.columns.map(({ id, sourceName, type }) => ({ id, sourceName, type }))

  function resolve(question: string) {
    const parsed = parseAnalysisIntent(question, schema)
    if (parsed.status !== 'resolved') return undefined
    const route = validateRoute(parsed.intent, active)
    return 'reason' in route ? undefined : route
  }

  const examples: string[] = []
  if (resolve(t.rows)?.operation === 'rowCount') examples.push(t.rows)
  if (resolve(t.missing)?.operation === 'missingCount') examples.push(t.missing)
  // Choose one usable numerical example. Exact quoting preserves the original label.
  for (const { id, sourceName, type, numeric } of active.profile.columns) {
    if (type !== 'numeric' || !numeric?.count || !sourceName) continue
    const quotes = [['"', '"'], ['“', '”'], ['«', '»']].find(([, end]) => !sourceName.includes(end))
    if (!quotes) continue
    const [open, close] = quotes
    const question = `${t.mean} ${open}${sourceName}${close}${locale === 'ar' ? '؟' : '?'}`
    const route = resolve(question)
    if (route?.operation === 'mean' && route.columns[0]?.id === id) {
      examples.push(question)
      break
    }
  }
  return examples
}
