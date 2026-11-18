import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DatasetRevision, DatasetSession } from '../dataset-session.ts'
import { questionLimit } from '../intent/columns.ts'
import { formatNumber } from '../locale.ts'
import type { Locale } from '../locale.ts'
import type { AnalysisExecution } from '../router/contract.ts'
import { createAnalysisRouter } from '../router/execute.ts'
import { ConversationAnswer, replyLabel } from './answer.tsx'
import { conversationCopy } from './copy.ts'
import { questionExamples } from './examples.ts'

const turnLimit = 24
type Turn = { id: number; question: string; reply?: AnalysisExecution }

export function ConversationPanel({ session, revision, locale }: {
  session: DatasetSession; revision: DatasetRevision; locale: Locale
}) {
  const [router] = useState(() => createAnalysisRouter(session))
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [cleared, setCleared] = useState(false)
  const active = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const input = useRef<HTMLTextAreaElement>(null)
  const transcript = useRef<HTMLOListElement>(null)
  const t = conversationCopy[locale]
  const overLimit = draft.length > questionLimit
  const dataset = session.active()
  const examples = useMemo(() => dataset?.revision === revision ? questionExamples(dataset, locale) : [],
    [dataset, locale, revision])

  useLayoutEffect(() => () => {
    active.current?.abort()
    active.current = null
  }, [])

  const latestId = turns.at(-1)?.id
  const last = turns.at(-1)?.reply

  // Start the newest turn at the top of the log without moving page focus.
  useLayoutEffect(() => {
    const list = transcript.current
    const latest = list?.lastElementChild
    if (list && latest) list.scrollTop += latest.getBoundingClientRect().top - list.getBoundingClientRect().top - 4
  }, [latestId, last])

  async function submit(question: string, retryId?: number) {
    if (active.current || !question.trim() || question.length > questionLimit || session.active()?.revision !== revision) return
    const controller = new AbortController()
    const id = retryId ?? ++sequence.current
    active.current = controller
    setBusy(true)
    setCleared(false)
    if (retryId === undefined) setDraft('')
    setTurns(previous => [...previous.filter(turn => turn.id !== id), { id, question }].slice(-turnLimit))
    input.current?.focus()

    let reply: AnalysisExecution
    try {
      reply = await router.run(question, controller.signal)
    } catch {
      reply = { status: 'failed', stage: 'execution', revision, reason: 'engine' }
    }
    if (active.current !== controller || session.active()?.revision !== revision || reply.revision !== revision) return
    active.current = null
    setBusy(false)
    setTurns(previous => previous.map(turn => turn.id === id ? { ...turn, reply } : turn))
  }

  function edit(question: string) {
    setDraft(question)
    input.current?.focus()
  }

  function clear() {
    active.current?.abort()
    active.current = null
    setBusy(false)
    setCleared(true)
    setTurns([])
    setDraft('')
    input.current?.focus()
  }

  return <section id="conversation" className="panel workspace-section conversation-panel" aria-labelledby="conversation-title">
    <div className="conversation-header">
      <h2 id="conversation-title">{t.title}</h2>
      {(turns.length > 0 || draft.length > 0) && <button type="button" onClick={clear}>{t.clear}</button>}
    </div>
    {turns.length === 0 ? <p className="muted">{t.hint}</p> :
      <ol className="conversation-turns" ref={transcript} role="list" aria-label={t.transcript} tabIndex={0}>
        {turns.map(({ id, question, reply }) => <li key={id}>
          <p className="conversation-question"><strong>{t.you}</strong><bdi>{question}</bdi></p>
          <div className="conversation-reply" data-state={reply?.status ?? 'pending'}>
            <span className="conversation-speaker">{t.answer}</span>
            {reply ? <ConversationAnswer result={reply} locale={locale} /> : <p>{t.working}</p>}
            {id === latestId && (reply?.status === 'needs_clarification' || reply?.status === 'unsupported' ||
              reply?.status === 'cancelled' || (reply?.status === 'failed' && reply.stage === 'execution')) &&
              <button type="button" disabled={busy} onClick={() => edit(question)}>{t.editQuestion}</button>}
            {(reply?.status === 'cancelled' || (reply?.status === 'failed' && reply.stage === 'execution')) &&
              <button type="button" disabled={busy} onClick={() => { void submit(question, id) }}>{t.retry}</button>}
          </div>
        </li>)}
      </ol>}
    {examples.length > 0 && (turns.length === 0 || last?.status === 'unsupported') &&
      <div className="conversation-examples">
        <p id="conversation-examples-title" className="muted">{last ? t.moreExamples : t.examples}</p>
        <ul role="list" aria-labelledby="conversation-examples-title">
          {examples.map(question => <li key={question}>
            <button type="button" onClick={() => edit(question)}><bdi>{question}</bdi></button>
          </li>)}
        </ul>
      </div>}
    <form className="conversation-form" onSubmit={event => { event.preventDefault(); void submit(draft) }}>
      <label htmlFor="conversation-question">{t.label}</label>
      <textarea ref={input} id="conversation-question" rows={2} dir="auto" value={draft} maxLength={questionLimit + 1}
        placeholder={t.example} aria-invalid={overLimit || undefined}
        aria-describedby={overLimit ? 'conversation-keys conversation-limit' : 'conversation-keys'}
        onChange={event => setDraft(event.currentTarget.value.slice(0, questionLimit + 1))}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          void submit(draft)
        }} />
      {overLimit && <p id="conversation-limit" className="muted">{t.refusal.tooLong}</p>}
      <div className="conversation-actions">
        <span id="conversation-keys" className="muted">{t.keys}</span>
        {busy && <button type="button" onClick={() => { active.current?.abort(); input.current?.focus() }}>{t.cancel}</button>}
        <button className="primary" type="submit" disabled={busy || overLimit || !draft.trim()}>{t.send}</button>
      </div>
    </form>
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {busy ? t.working : last ? replyLabel(last, locale) : cleared ? t.cleared : t.ready}
      {latestId !== undefined && <> {t.label} {formatNumber(latestId, locale)}.</>}
    </p>
  </section>
}
