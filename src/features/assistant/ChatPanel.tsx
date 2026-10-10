import { signal } from '@preact/signals'
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import { askAssistant, AssistantError, errorMessage } from '../../ai/client'
import { LIMITS, type AssistantErrorCode, type ChatMessage } from '../../ai/protocol'
import type { BudgetSummary } from '../../domain/insightsTypes'
import { Button } from '../../ui/components/controls'
import { canSend, DISCLAIMER, QUICK_PROMPTS } from './assistantModel'
import './chat-panel.css'

/**
 * Chat state lives only in memory while the app is open. It is never stored
 * and is cleared with resetChat() when the user closes the chat.
 */
type ChatEntry = ChatMessage & { provider?: string }

const messages = signal<ChatEntry[]>([])
const busy = signal(false)
const error = signal<AssistantErrorCode | null>(null)

/** Bumped on reset so a reply that arrives after closing the chat is dropped. */
let generation = 0

export function resetChat(): void {
  generation++
  messages.value = []
  busy.value = false
  error.value = null
}

interface Props {
  summary: BudgetSummary
}

/** Asks the model with the current history, which must end with the user's message. */
async function request(summary: BudgetSummary): Promise<void> {
  const gen = generation
  busy.value = true
  error.value = null
  try {
    const history = messages.value.map(({ role, text }) => ({ role, text }))
    const reply = await askAssistant(summary, history)
    if (gen !== generation) return
    messages.value = [...messages.value, { role: 'assistant', text: reply.text, provider: reply.provider }]
  } catch (err) {
    if (gen !== generation) return
    error.value = err instanceof AssistantError ? err.code : 'unavailable'
  } finally {
    if (gen === generation) busy.value = false
  }
}

function send(summary: BudgetSummary, raw: string): void {
  if (!canSend(raw, busy.value)) return
  const text = raw.trim()
  messages.value = [...messages.value, { role: 'user', text }]
  void request(summary)
}

export function ChatPanel({ summary }: Props) {
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const endRef = useRef<HTMLDivElement>(null)
  const list = messages.value
  const pending = busy.value
  const failure = error.value

  useEffect(() => {
    const el = endRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'end' })
  }, [list.length, pending, failure])

  function submit(text: string) {
    if (!canSend(text, busy.value)) return
    send(summary, text)
    setDraft('')
  }

  return (
    <div class="chat-panel">
      <div class="chat-log" role="log" aria-live="polite">
        {list.length === 0 && (
          <div class="chat-intro">
            <p class="chat-intro-text">Bütçen hakkında soru sor. Örnekler:</p>
            <div class="chat-chips">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" class="chat-chip" disabled={pending} onClick={() => submit(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {list.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} class="chat-bubble chat-bubble-user">
              <p class="chat-text">{m.text}</p>
            </div>
          ) : (
            <div key={i} class="chat-bubble chat-bubble-assistant">
              <p class="chat-text">{m.text}</p>
              <p class="chat-foot">
                {DISCLAIMER}
                {m.provider ? ` · ${m.provider}` : ''}
              </p>
            </div>
          ),
        )}

        {pending && (
          <div class="chat-bubble chat-bubble-assistant" aria-busy="true">
            <p class="chat-text">Yazıyor…</p>
          </div>
        )}

        {failure && (
          <div class="chat-error" role="alert">
            <p class="chat-error-text">{errorMessage(failure)}</p>
            <Button variant="secondary" onClick={() => void request(summary)} disabled={pending}>
              Yeniden dene
            </Button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div class="chat-composer">
        <label class="chat-label" for={inputId}>
          Mesajın
        </label>
        <textarea
          id={inputId}
          class="chat-input"
          rows={2}
          maxLength={LIMITS.maxMessageChars}
          placeholder="Örneğin: Bu ay markete çok mu harcadım?"
          value={draft}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              e.preventDefault()
              submit(draft)
            }
          }}
        />
        <Button variant="primary" block disabled={!canSend(draft, pending)} onClick={() => submit(draft)}>
          Gönder
        </Button>
      </div>
    </div>
  )
}
