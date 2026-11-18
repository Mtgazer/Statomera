import { useState } from 'react'
import type { CellQuality, DatasetProfile } from './dataset.ts'
import { formatNumber, messages } from './locale.ts'
import type { Locale } from './locale.ts'
import { columnLabel } from './column-label.ts'

type Filter = 'all' | 'missing' | 'invalid'
type Sort = 'source' | 'ascending' | 'descending'

export function Preview({ result, locale, selected, onSelect }: {
  result: DatasetProfile
  locale: Locale
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('source')
  const t = messages[locale]
  const number = (value: number) => formatNumber(value, locale)
  const selectedColumn = result.columns.find(column => column.id === selected)
  const query = search.trim().normalize('NFC').toLocaleLowerCase(locale)
  const rows = result.preview.map((cells, index) => ({ cells, index, quality: result.previewQuality[index] }))
    .filter(({ cells, quality }) =>
      (!query || cells.some(cell => cell.normalize('NFC').toLocaleLowerCase(locale).includes(query))) &&
      (filter === 'all' || quality.some(value => filter === 'invalid' ? value === 'invalid' : value === 'blank' || value === 'marked')),
    )
  if (sort !== 'source' && selectedColumn) {
    const collator = new Intl.Collator(locale)
    const index = selectedColumn.index
    rows.sort((a, b) => (sort === 'ascending' ? 1 : -1) * collator.compare(a.cells[index], b.cells[index]))
  }

  const qualityLabel = (value: CellQuality) => value === 'blank' ? t.blankCell
    : value === 'marked' ? t.markedCell : t.invalidCell

  return <section id="dataset-preview" tabIndex={-1} aria-labelledby="preview-title" className="panel workspace-section">
    <div className="section-heading">
      <div><h2 id="preview-title">{t.preview}</h2><p id="preview-scope" className="muted">{t.previewScope}</p></div>
      {selectedColumn && <p className="muted">{t.selectedColumn} <bdi>{columnLabel(selectedColumn, locale)}</bdi></p>}
    </div>
    {result.preview.length ? <>
      <div className="preview-controls">
        <label>{t.previewSearch}<input type="search" aria-describedby="preview-scope" maxLength={256} value={search}
          onChange={event => setSearch(event.currentTarget.value)} /></label>
        <label>{t.previewFilter}<select aria-describedby="preview-scope" value={filter} onChange={event => setFilter(event.currentTarget.value as Filter)}>
          <option value="all">{t.allRows}</option><option value="missing">{t.withMissing}</option>
          <option value="invalid">{t.withInvalid}</option>
        </select></label>
        <label>{t.previewSort}<select aria-describedby="preview-scope" value={selectedColumn ? sort : 'source'} disabled={!selectedColumn}
          onChange={event => setSort(event.currentTarget.value as Sort)}>
          <option value="source">{t.sourceOrder}</option><option value="ascending">{t.ascending}</option>
          <option value="descending">{t.descending}</option>
        </select></label>
      </div>
      <p className="muted preview-count" role="status">{t.previewRows(number(rows.length), number(result.preview.length))}</p>
      <p className="muted table-scroll-hint">{t.scrollHint}</p>
      <div className="table-scroll preview-table" tabIndex={0} role="region" aria-label={t.previewTable}>
        <table><caption className="sr-only">{t.firstRows}</caption>
          <thead><tr><th scope="col">{t.record}</th>{result.columns.map(column =>
            <th scope="col" key={column.id} aria-sort={column.id === selected && sort !== 'source' ? sort : undefined}>
              <button type="button" className="column-button" aria-pressed={column.id === selected}
                onClick={() => onSelect(column.id)}><bdi>{columnLabel(column, locale)}</bdi></button>
            </th>,
          )}</tr></thead>
          <tbody>{rows.map(({ cells, quality, index }) =>
            <tr key={index}><th scope="row">{number(index + 1)}</th>{cells.map((value, cell) =>
              <td key={cell} data-selected={result.columns[cell].id === selected || undefined}>
                {value && <bdi>{value}</bdi>}
                {quality[cell] !== 'valid' && <span className="cell-status" data-quality={quality[cell]}>{qualityLabel(quality[cell])}</span>}
              </td>,
            )}</tr>,
          )}</tbody>
        </table>
      </div>
      {!rows.length && <p className="muted preview-count">{t.noPreviewMatches}</p>}
    </> : <p className="muted">{t.noRows}</p>}
  </section>
}
