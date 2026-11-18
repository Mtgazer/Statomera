import { BlobReader, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from '@zip.js/zip.js/index-native.js'
import { read, SSF, utils } from 'xlsx'
import type { CellObject } from 'xlsx'
import { CsvError, decodeCsv, limits } from './csv.ts'
import type { CsvOptions, Dataset, DatasetProfile, SourceCell } from './dataset.ts'
import { normalizeColumns } from './normalize.ts'

const maxExpanded = 12 * 1024 * 1024
const maxEntry = 4 * 1024 * 1024
const maxEntries = 256
const zipOptions = { useWebWorkers: false, useCompressionStream: true } as const
const absent = { text: '', kind: 'missing' } as const

// Repackage only checked XML parts. SheetJS receives bounded stored entries,
// never the original compressed workbook or unchecked ZIP sizes.
async function checkedWorkbook(file: Blob) {
  const reader = new ZipReader(new BlobReader(file), zipOptions)
  const writer = new ZipWriter(new Uint8ArrayWriter(), zipOptions)
  const names = new Set<string>()
  let entries = 0
  let expanded = 0
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (++entries > maxEntries) throw new CsvError('expandedLimit')
      if (entry.directory) continue
      const name = entry.filename
      if (entry.encrypted || ![0, 8].includes(entry.compressionMethod) || names.has(name) ||
          !/^(?:[\w.-]+\/)*[\w.\[\]-]+$/.test(name) || name.split('/').some(part => part === '.' || part === '..')) {
        throw new CsvError('xlsxShape')
      }
      names.add(name)
      if (name.toLowerCase().includes('vbaproject')) throw new CsvError('xlsxShape')
      if (entry.uncompressedSize > maxEntry || expanded + entry.uncompressedSize > maxExpanded) {
        throw new CsvError('expandedLimit')
      }
      const chunks: Uint8Array[] = []
      let size = 0
      await entry.getData(new WritableStream<Uint8Array>({
        write(chunk) {
          size += chunk.byteLength
          expanded += chunk.byteLength
          if (size > maxEntry || expanded > maxExpanded) throw new CsvError('expandedLimit')
          if (size > entry.uncompressedSize) throw new CsvError('xlsxShape')
          chunks.push(chunk)
        },
      }), { ...zipOptions, checkSignature: true, checkOverlappingEntry: true })
      if (size !== entry.uncompressedSize) throw new CsvError('xlsxShape')
      if (!/\.(xml|rels)$/i.test(name)) continue
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      const xml = decodeCsv(bytes.buffer)
      if (xml.includes('\0') || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new CsvError('xlsxShape')
      await writer.add(name, new Uint8ArrayReader(bytes), { ...zipOptions, level: 0, dataDescriptor: false })
    }
    if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) throw new CsvError('xlsxShape')
    return await writer.close()
  } finally {
    await reader.close()
  }
}

function convert(cell: CellObject, date1904: boolean): SourceCell {
  const value = cell.v
  if (value == null || cell.t === 'z') {
    if (cell.f) throw new CsvError('xlsxShape')
    return absent
  }
  let result: SourceCell
  if (cell.t === 'n' && typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new CsvError('xlsxShape')
    if (cell.z && SSF.is_date(cell.z)) {
      const date = SSF.parse_date_code(value, { date1904 })
      if (!date || value % 1 !== 0 || date.y < 1 || date.y > 9999 ||
          date.m < 1 || date.d < 1 || (date.y === 1900 && date.m === 2 && date.d === 29)) {
        throw new CsvError('xlsxShape')
      }
      result = { text: [String(date.y).padStart(4, '0'), String(date.m).padStart(2, '0'),
        String(date.d).padStart(2, '0')].join('-'), kind: 'date' }
    } else {
      result = { text: String(value), kind: 'numeric' }
    }
  } else if (cell.t === 'b' && typeof value === 'boolean') {
    result = { text: String(value), kind: 'boolean' }
  } else if (cell.t === 's' && typeof value === 'string') {
    result = { text: value, kind: 'text' }
  } else {
    // Spreadsheet errors are preserved as explicit invalid observations.
    if (cell.t === 'e') result = { text: cell.w ?? '#ERROR!', kind: 'invalid' }
    else throw new CsvError('xlsxShape')
  }
  if (result.text.length > limits.field) throw new CsvError('fieldLimit')
  return result
}

export async function normalizeXlsx(
  file: Blob, options: CsvOptions, listWorksheets: (workbook: NonNullable<DatasetProfile['workbook']>) => void,
): Promise<Dataset> {
  try {
    const bytes = await checkedWorkbook(file)
    const names = read(bytes, { type: 'array', bookSheets: true }).SheetNames
    if (!names.length || names.length > 64 || new Set(names).size !== names.length || names.some(name => !name || name.length > 31)) {
      throw new CsvError('xlsxShape')
    }
    const selected = options.worksheet ?? 0
    if (!Number.isInteger(selected) || selected < 0 || selected >= names.length) throw new CsvError('worksheet')
    listWorksheets({ names, selected })
    const workbook = read(bytes, { type: 'array', sheets: [selected], cellNF: true,
      cellFormula: true, cellHTML: false, sheetStubs: true })
    const sheetName = names[selected]
    const sheet = Object.hasOwn(workbook.Sheets, sheetName) ? workbook.Sheets[sheetName] : undefined
    if (!sheet || sheet['!merges']?.length) throw new CsvError('xlsxShape')
    const used = new Map<number, Map<number, SourceCell>>()
    let firstRow = Infinity
    let firstColumn = Infinity
    let lastRow = -1
    let lastColumn = -1
    for (const [key, cell] of Object.entries(sheet)) {
      if (key.startsWith('!')) continue
      const value = convert(cell, workbook.Workbook?.WBProps?.date1904 === true)
      if (value === absent) continue
      const { r, c } = utils.decode_cell(key)
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= 1048576 || c < 0 || c >= 16384) throw new CsvError('xlsxShape')
      firstRow = Math.min(firstRow, r)
      firstColumn = Math.min(firstColumn, c)
      lastRow = Math.max(lastRow, r)
      lastColumn = Math.max(lastColumn, c)
      let row = used.get(r)
      if (!row) {
        row = new Map()
        used.set(r, row)
      }
      row.set(c, value)
    }
    if (!used.size) throw new CsvError('empty')
    const width = lastColumn - firstColumn + 1
    const hasHeader = options.header === 'first-row'
    const start = firstRow + Number(hasHeader)
    if (width > limits.columns) throw new CsvError('columnLimit')
    if (lastRow - start + 1 > limits.rows) throw new CsvError('rowLimit')
    if ((lastRow - start + 1) * width > limits.cells) throw new CsvError('cellLimit')
    const rowAt = (r: number) => Array.from({ length: width }, (_, i) => used.get(r)?.get(firstColumn + i) ?? absent)
    const labels = rowAt(firstRow).map(cell => typeof cell === 'string' ? cell : cell.text)
    return {
      source: 'structured', columns: normalizeColumns(labels, hasHeader, options.duplicateHeaders),
      *records() { for (let r = start; r <= lastRow; r++) yield rowAt(r) },
    }
  } catch (error) {
    if (error instanceof CsvError) throw error
    throw new CsvError('xlsxShape')
  }
}
