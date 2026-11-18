import type { CsvOptions, DatasetProfile } from './dataset.ts'

/** An in-memory identity. The ordinal is advisory across workspace instances. */
export type DatasetRevision = Readonly<{ ordinal: number }>

type Selection = Readonly<{
  file: File
  options: CsvOptions
  revision: DatasetRevision
  signal: AbortSignal
}>

export type ActiveDataset = Selection & { readonly profile: DatasetProfile }

export function createDatasetSession() {
  let ordinal = 0
  let selected: Selection | null = null
  let active: ActiveDataset | null = null
  let lifetime: AbortController | null = null

  function clear() {
    selected = null
    active = null
    const previous = lifetime
    lifetime = null
    previous?.abort()
  }

  return {
    begin(file: File, options: CsvOptions): Selection {
      clear()
      lifetime = new AbortController()
      const fixedOptions = Object.freeze({
        ...options,
        missingMarkers: Object.freeze([...options.missingMarkers]),
        schemaOverrides: options.schemaOverrides && Object.freeze({ ...options.schemaOverrides }),
      })
      selected = Object.freeze({
        file, options: fixedOptions, revision: Object.freeze({ ordinal: ++ordinal }), signal: lifetime.signal,
      })
      return selected
    },
    publish(selection: Selection, profile: DatasetProfile): boolean {
      // Each revision can publish exactly one verified profile.
      if (selected !== selection || active) return false
      active = Object.freeze({ ...selection, profile })
      return true
    },
    selection: () => selected,
    active: () => active,
    clear,
  }
}

export type DatasetSession = ReturnType<typeof createDatasetSession>
