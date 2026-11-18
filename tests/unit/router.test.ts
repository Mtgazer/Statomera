import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { AnalysisError } from '../../src/analysis.ts'
import { questionExamples } from '../../src/conversation/examples.ts'
import { createDatasetSession } from '../../src/dataset-session.ts'
import { defaultCsvOptions } from '../../src/dataset.ts'
import type { CsvOptions } from '../../src/dataset.ts'
import { calculateInference } from '../../src/inference.ts'
import { missingPolicy, normalizeCsv } from '../../src/normalize.ts'
import { profileDataset } from '../../src/profile.ts'
import { createAnalysisRouter } from '../../src/router/execute.ts'
import type { AnalysisExecution, PreparedAnalysis } from '../../src/router/contract.ts'
import { calculateStatistic } from '../../src/statistics.ts'
import type { StatisticOperation } from '../../src/statistics-contract.ts'

type Engines = NonNullable<Parameters<typeof createAnalysisRouter>[1]>

const salary = readFileSync(new URL('../fixtures/salary.csv', import.meta.url), 'utf8')
const reference = JSON.parse(readFileSync(new URL('../reference/inference-scipy.json', import.meta.url), 'utf8'))

function setup(overrides: Partial<Engines> = {}) {
  const session = createDatasetSession()
  const calls: string[] = []
  const workers: Engines = {
    async statistic(file, _signal, options, request) {
      calls.push(request.operation)
      return calculateStatistic(normalizeCsv(await file.text(), options), missingPolicy(options.missingMarkers),
        options.schemaOverrides ?? {}, request)
    },
    async inference(file, _signal, options, request) {
      calls.push(request.method)
      return calculateInference(normalizeCsv(await file.text(), options), missingPolicy(options.missingMarkers),
        options.schemaOverrides ?? {}, request)
    },
    ...overrides,
  }
  function publish(text: string, options: CsvOptions = defaultCsvOptions, file = new File([text], 'data.csv')) {
    const selection = session.begin(file, options)
    const profile = profileDataset(normalizeCsv(text, selection.options), missingPolicy(selection.options.missingMarkers),
      undefined, selection.options.schemaOverrides)
    assert.ok(session.publish(selection, profile))
    return selection
  }
  return { session, calls, publish, router: createAnalysisRouter(session, workers) }
}

function verified(result: AnalysisExecution) {
  assert.ok(result.status === 'completed' || result.status === 'unavailable', JSON.stringify(result))
  return result.evidence
}

test('profile routes preserve unit, count, presence and missing definitions without worker calls', async () => {
  const { publish, router, calls } = setup()
  publish('salary,group\n10,A\n10,A\n20,B\nNA,B\n"",B\nbad,C', { ...defaultCsvOptions, missingMarkers: ['NA'] })
  const subjects = [
    ['How many rows?', 6, 'rows'], ['How many columns?', 2, 'columns'],
    ['Are there missing values?', true, 'cells'], ['How many missing values in salary?', 2, 'cells'],
    ['How many invalid values in salary?', 1, 'cells'], ['How many duplicate rows?', 1, 'rows'],
    ['Are there duplicate rows?', true, 'rows'], ['Are there invalid values in group?', false, 'cells'],
  ] as const
  for (const [question, value, unit] of subjects) {
    const evidence = verified(await router.run(question))
    assert.equal(evidence.source, 'datasetProfile')
    assert.equal(evidence.value, value)
    assert.equal(evidence.unit, unit)
  }
  const evidence = verified(await router.run('Are there missing values?'))
  assert.equal(evidence.source, 'datasetProfile')
  assert.deepEqual(evidence.missing, { blank: 1, marked: 1 })
  assert.deepEqual(calls, [])
})

test('every descriptive operation equals direct verified engine output', async () => {
  const { publish, router } = setup()
  publish(salary)
  const operations: [string, StatisticOperation][] = [
    ['count', 'count'], ['sum', 'sum'], ['mean', 'mean'], ['median', 'median'],
    ['minimum', 'min'], ['maximum', 'max'], ['sample variance', 'sampleVariance'],
    ['population variance', 'populationVariance'], ['sample standard deviation', 'sampleSd'],
    ['population standard deviation', 'populationSd'],
  ]
  const dataset = normalizeCsv(salary, defaultCsvOptions)
  for (const [question, operation] of operations) {
    const evidence = verified(await router.run(question + ' of salary'))
    assert.equal(evidence.source, 'statisticsWorker')
    assert.deepEqual(evidence.result, calculateStatistic(dataset, () => false, {}, { operation, columns: ['column-2'] }))
  }
  const english = verified(await router.run('mean salary'))
  const arabic = verified(await router.run('متوسط المرتبات كام؟'))
  assert.equal(english.source, 'statisticsWorker')
  assert.equal(english.result.value, 20)
  assert.equal(english.result.valid, 3)
  assert.deepEqual(english, arabic)
  assert.deepEqual(verified(await router.run('mean salary')), english)
})

test('Pearson preserves complete-pair exclusions and constant-column reason without scatter rows', async () => {
  const { publish, router } = setup()
  publish('salary,age\n10,1\n20,2\n30,NA\n"",3\nbad,4', { ...defaultCsvOptions, missingMarkers: ['NA'] })
  const result = await router.run('correlation between salary and age')
  const evidence = verified(result)
  assert.equal(evidence.source, 'statisticsWorker')
  assert.deepEqual([evidence.result.value, evidence.result.valid, evidence.result.missingOnly, evidence.result.invalid], [1, 2, 2, 1])
  assert.equal('scatter' in evidence.result, false)
  publish('salary,age\n10,1\n10,2')
  const constant = await router.run('Pearson correlation between salary and age')
  assert.equal(constant.status, 'unavailable')
  assert.equal(constant.evidence.source, 'statisticsWorker')
  assert.equal(constant.evidence.result.reason, 'constantInput')
  assert.equal(constant.evidence.result.value, null)
})

test('inference routing matches SciPy references and exact direct engine evidence', async () => {
  const { publish, router } = setup()
  for (const fixture of reference.cases) {
    const { method, x, y, level, nullMean, expected } = fixture
    let csv = ['salary', ...x].join('\n')
    let question = method === 'meanInterval' ? `${level}% confidence interval for salary`
      : `one-sample t-test for salary against ${nullMean} at ${level}%`
    if (method === 'paired') {
      csv = ['salary,matched', ...x.map((v: number, i: number) => `${v},${y[i]}`)].join('\n')
      question = `paired t-test between salary and "matched" by row at ${level}%`
    }
    if (method === 'welch') {
      csv = ['salary,group', ...x.map((v: number) => `${v},علاج`), ...y.map((v: number) => `${v},ضبط`)].join('\n')
      question = `Welch t-test for salary by group comparing "علاج" and "ضبط" at ${level}%`
    }
    publish(csv)
    const routed = await router.run(question)
    assert.equal(routed.status, 'completed', question)
    assert.equal(routed.evidence.source, 'inferenceWorker')
    assert.equal(routed.evidence.confidence, 'explicit')
    assert.ok(routed.assumptions.length > 0)
    const result = routed.evidence.result
    assert.deepEqual(result, calculateInference(normalizeCsv(csv, defaultCsvOptions), () => false, {}, result.request))
    assert.equal(result.request.level, level)
    if (method === 'oneSample') assert.equal(result.request.nullMean, nullMean)
    if (method === 'paired') assert.equal(routed.evidence.matching, 'sameRow')
    for (const [value, target] of [[result.estimate, expected.estimate], [result.interval?.lower, expected.lower],
      [result.interval?.upper, expected.upper], [result.degrees, expected.degrees]]) {
      assert.ok(Math.abs(value - target) <= Math.max(2e-13, Math.abs(target) * 1e-10), question)
    }
  }
  publish(salary)
  const result = verified(await router.run('one-sample t-test for salary against 19.25'))
  assert.equal(result.source, 'inferenceWorker')
  assert.equal(result.confidence, 'default')
  assert.equal(result.result.request.level, 95)
  assert.equal(result.result.request.nullMean, 19.25)
})

test('Welch uses uncapped exact group membership and distinguishes absent from invalid outcomes', async () => {
  const { publish, router } = setup()
  const groups = Array.from({ length: 1100 }, (_, index) => `1,Other${index}`).join('\n')
  publish(`salary,group\n10,Team\n20,Team\n30,team\n40,team\nbad,OnlyInvalid\nNA,Team\n${groups}`,
    { ...defaultCsvOptions, missingMarkers: ['NA'] })
  const complete = verified(await router.run('Welch test for salary by group comparing "Team" and "team"'))
  assert.equal(complete.source, 'inferenceWorker')
  assert.equal(complete.result.estimate, -20)
  assert.deepEqual(complete.result.counts, [{ valid: 2, missing: 1, invalid: 0 }, { valid: 2, missing: 0, invalid: 0 }])
  assert.equal(complete.result.outsideGroups, 1101)
  const missing = await router.run('Welch test for salary by group comparing "Team" and "TEAM"')
  assert.equal(missing.status, 'needs_clarification')
  assert.equal(missing.stage, 'validation')
  assert.deepEqual(missing.groups, ['TEAM'])
  const noOutcome = await router.run('Welch test for salary by group comparing "Team" and "OnlyInvalid"')
  assert.equal(noOutcome.status, 'unavailable')
  assert.equal(noOutcome.evidence.source, 'inferenceWorker')
  assert.equal(noOutcome.evidence.result.reason, 'insufficient')
  assert.equal((await router.run('Welch test for salary by group comparing "Team" and "Team"')).status, 'needs_clarification')
})

test('no worker starts for unresolved, stale, renamed, ineligible or fabricated candidates', async () => {
  const { publish, router, calls, session } = setup()
  assert.equal((await router.run('mean salary')).status, 'failed')
  const first = publish('salary,age\n10,1\n20,2')
  const old = router.prepare('mean salary')
  for (const question of ['mean', 'correlation between salary and missing', 'delete rows', 'one-sample t-test for salary']) {
    const result = await router.run(question)
    assert.ok(result.status === 'needs_clarification' || result.status === 'unsupported')
    assert.equal(result.stage, 'interpretation')
  }
  publish('salary,age\n10,1\n20,2', { ...defaultCsvOptions, schemaOverrides: { 'column-2': 'text' } }, first.file)
  const stale = await router.execute(old)
  assert.deepEqual(stale, { status: 'failed', stage: 'validation', revision: old.revision, reason: 'staleRevision' })
  const candidate = router.prepare('mean salary')
  const make = (intent: unknown) => ({ ...candidate, interpretation: { status: 'resolved', language: 'en', intent } } as PreparedAnalysis)
  const column = { id: 'column-1', sourceName: 'salary', type: 'numeric' }
  for (const [intent, reason] of [
    [{ kind: 'descriptive', operation: 'mean', column: { ...column, sourceName: 'Renamed' } }, 'changedColumn'],
    [{ kind: 'descriptive', operation: 'mean', column: { ...column, id: 'column-100' } }, 'unknownColumn'],
    [{ kind: 'descriptive', operation: 'mean', column: { id: 'column-2', sourceName: 'age', type: 'text' } }, 'ineligibleColumn'],
    [{ kind: 'descriptive', operation: 'p90', column }, 'unsupportedOperation'],
    [{ kind: 'descriptive', operation: 'pearson', columns: [column, column] }, 'distinctColumns'],
    [{ kind: 'inference', operation: 'oneSample', column }, 'invalidParameters'],
    [{ kind: 'inference', operation: 'meanInterval', column, confidence: 97 }, 'invalidParameters'],
    [{ kind: 'inference', operation: 'meanInterval', column, qualifier: 'group by' }, 'invalidIntent'],
  ] as const) {
    const invalid = await router.execute(make(intent))
    assert.equal(invalid.status, 'failed')
    assert.equal(invalid.stage, 'validation')
    assert.equal(invalid.reason, reason)
  }
  assert.equal((await router.execute({ ...candidate, revision: { ordinal: candidate.revision!.ordinal } })).status, 'failed')
  session.clear()
  assert.equal((await router.execute(candidate)).status, 'failed')
  assert.deepEqual(calls, [])
})

test('cancellation, supersession, replacement and worker failures settle deterministically', async () => {
  let signal!: AbortSignal
  const workers = {
    statistic: async (_file, job) => {
      signal = job
      return new Promise<never>((_, reject) => job.addEventListener('abort', () => reject(new AnalysisError('cancelled')), { once: true }))
    },
  } satisfies Partial<Engines>
  const { publish, router, session } = setup(workers)
  publish(salary)
  const user = new AbortController()
  const stopped = router.run('mean salary', user.signal)
  user.abort()
  assert.equal(signal.aborted, true)
  const cancelled = await stopped
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.reason, 'user')
  const older = router.run('mean salary')
  assert.equal((await router.run('How many rows?')).status, 'completed')
  const superseded = await older
  assert.equal(superseded.status, 'cancelled')
  assert.equal(superseded.reason, 'superseded')
  const running = router.run('mean salary')
  publish(salary)
  const replaced = await running
  assert.equal(replaced.status, 'cancelled')
  assert.equal(replaced.reason, 'datasetChanged')
  const clearing = router.run('mean salary')
  session.clear()
  assert.equal((await clearing).status, 'cancelled')

  const failed = setup({ statistic: async () => { throw new AnalysisError('read') } })
  failed.publish(salary)
  const result = await failed.router.run('mean salary')
  assert.equal(result.status, 'failed')
  assert.equal(result.stage, 'execution')
  assert.equal(result.reason, 'read')
})

test('localized examples resolve through the router with original and quoted column names', async () => {
  const { session, calls, publish, router } = setup()
  publish('note,إيراد,ايراد\nA,10,100\nB,30,300')
  const expected = [['en', 'What is the mean of "إيراد"?'], ['ar', 'ما متوسط "إيراد"؟']] as const
  for (const [locale, meanQuestion] of expected) {
    const examples = questionExamples(session.active()!, locale)
    assert.equal(examples.length, 3)
    assert.equal(examples[2], meanQuestion)
    for (const example of examples) assert.equal(router.prepare(example).interpretation?.status, 'resolved')
    const evidence = verified(await router.run(meanQuestion))
    assert.equal(evidence.source, 'statisticsWorker')
    assert.equal(evidence.result.value, 20)
  }
  assert.deepEqual(calls, ['mean', 'mean'])

  publish('"salary ""USD""",note\n10,A\n30,B')
  const quoted = questionExamples(session.active()!, 'en').at(-1)
  assert.equal(quoted, 'What is the mean of “salary "USD"”?')
  const quotedEvidence = verified(await router.run(quoted))
  assert.equal(quotedEvidence.source, 'statisticsWorker')
  assert.equal(quotedEvidence.result.value, 20)
})

test('examples omit ambiguous, overlong, unnamed, and ineligible measurement columns', () => {
  const { session, calls, publish } = setup()
  const text = `dup,dup,${'X'.repeat(512)}\n10,10,10\n20,20,20`
  publish(text, { ...defaultCsvOptions, duplicateHeaders: 'disambiguate' })
  assert.deepEqual(questionExamples(session.active()!, 'en'), ['How many rows are there?', 'Are there missing values?'])
  publish('salary\n10\n30', { ...defaultCsvOptions, schemaOverrides: { 'column-1': 'text' } })
  const arabic = ['ما عدد الصفوف؟', 'هل توجد قيم مفقودة؟']
  assert.deepEqual(questionExamples(session.active()!, 'ar'), arabic)
  publish('10\n30', { ...defaultCsvOptions, header: 'none' })
  assert.deepEqual(questionExamples(session.active()!, 'ar'), arabic)
  assert.deepEqual(calls, [])
})
