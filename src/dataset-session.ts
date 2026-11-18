import type { CsvOptions, DatasetProfile } from './dataset.ts'

/** An in-memory identity. The ordinal is advisory across workspace instances. */
export type DatasetRevision = Readonly<{ ordinal: number }>

type Selection = Readonly<{
  file: File
  options: CsvOptions
  revision: DatasetRevision
  signal: AbortSignal
}>

export type ActiveDataset<Profile extends DatasetProfile = DatasetProfile> = Selection & { readonly profile: Profile }

export function createDatasetSession<Profile extends DatasetProfile = DatasetProfile>() {
  let ordinal = 0
  let selected: Selection | null = null
  let active: ActiveDataset<Profile> | null = null
  let lifetime: AbortController | null = null

  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) listener()
  }

  function clear() {
    const hadActive = active !== null
    selected = null
    active = null
    const previous = lifetime
    lifetime = null
    previous?.abort()
    if (hadActive) notify()
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
    publish(selection: Selection, profile: Profile): boolean {
      // Each revision can publish exactly one verified profile.
      if (selected !== selection || active) return false
      active = Object.freeze({ ...selection, profile })
      notify()
      return true
    },
    selection: () => selected,
    active: () => active,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    clear,
  }
}

export type DatasetSession<Profile extends DatasetProfile = DatasetProfile> = ReturnType<typeof createDatasetSession<Profile>>
