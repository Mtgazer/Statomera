import { messages } from './locale.ts'
import type { Locale } from './locale.ts'

export function ReportAction({ locale, added, onAdd }: { locale: Locale; added: boolean; onAdd: () => void }) {
  const t = messages[locale]
  return <button className="report-add" type="button" aria-controls="analytical-report" aria-disabled={added}
    onClick={() => { if (!added) onAdd() }}>{added ? t.reportIncluded : t.reportAdd}</button>
}
