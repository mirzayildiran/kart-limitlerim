import { computed } from '@preact/signals'
import { PROXY_URL } from '../../ai/client'
import { accounts, budgets, categories, expenses, recurring, today } from '../../data/store'
import { computeInsights } from '../../domain/insights'
import { budgetSummary } from '../../domain/insightsSummary'
import type { Insight, InsightInput, InsightTarget } from '../../domain/insightsTypes'
import { accountColors } from '../../ui/accountColor'
import { go, openSheet, route } from '../../ui/nav'
import { Button, EmptyState, Pill } from '../../ui/components/controls'
import { Icon } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import { assistantInput, DISCLAIMER, dueTag, insightIcon, severityLabel } from './assistantModel'
import { BudgetPlan } from './BudgetPlan'
import { ChatPanel, resetChat } from './ChatPanel'
import { ConsentPanel } from './ConsentPanel'
import { assistantConsent, grantConsent, revokeConsent } from './consent'
import './assistant-page.css'

const input = computed<InsightInput>(() =>
  assistantInput({
    accounts: accounts.value,
    expenses: expenses.value,
    categories: categories.value,
    recurring: recurring.value,
    budgets: budgets.value,
    today: today.value,
  }),
)
const insights = computed(() => computeInsights(input.value))
const summary = computed(() => budgetSummary(input.value, insights.value))

function closeChat() {
  revokeConsent()
  resetChat()
  toast('Sohbet kapatıldı. Artık hiçbir veri gönderilmiyor.')
}

/** Opens what a suggestion points to: a statement or account sheet, or a page. */
function openTarget(target: InsightTarget) {
  if (target.type === 'expenses') go('expenses')
  else if (target.type === 'calendar') go('calendar')
  else if (target.type === 'statement') {
    openSheet({ type: 'statement', accountId: target.accountId, lineIndex: target.lineIndex })
  } else openSheet({ type: 'accountDetail', id: target.accountId })
}

/** One suggestion. With a destination the whole row is the button; without one it is plain text. */
function InsightRow({ item, medal }: { item: Insight; medal: number | undefined }) {
  const sev = item.severity === 'info' ? null : severityLabel(item.severity)
  const tag = item.dueInDays === undefined ? null : dueTag(item.dueInDays)
  const target = item.target
  const content = (
    <>
      <span class={`assistant-medal${medal === undefined ? ' is-plain' : ''}`} data-slot={medal} aria-hidden="true">
        <Icon name={insightIcon(item.kind)} size={18} />
      </span>
      <span class="assistant-insight-text">
        <span class="assistant-insight-title">
          {sev && <span class="sr-only">{sev}: </span>}
          {item.title}
        </span>
        <span class="assistant-insight-body">{item.body}</span>
      </span>
      {tag && (
        <span class="assistant-insight-tag" aria-hidden="true">
          <Pill tone={tag.tone}>{tag.label}</Pill>
        </span>
      )}
      {target && (
        <span class="assistant-insight-chevron" aria-hidden="true">
          <Icon name="chevron" size={16} />
        </span>
      )}
    </>
  )

  return (
    <li class="assistant-insight" data-severity={item.severity}>
      {target ? (
        <button type="button" class="assistant-insight-hit" onClick={() => openTarget(target)}>
          {content}
        </button>
      ) : (
        <div class="assistant-insight-hit is-static">{content}</div>
      )}
    </li>
  )
}

export function AssistantPage() {
  if (route.value !== 'assistant') return null

  const list = insights.value
  const sum = summary.value
  const slots = accountColors(accounts.value)

  return (
    <div class="assistant-page">
      <header class="assistant-header">
        <Button variant="ghost" class="assistant-back" aria-label="Geri" onClick={() => go('home')}>
          <Icon name="back" size={22} />
        </Button>
        <div class="assistant-heading">
          <h1>Bütçe asistanı</h1>
          <p class="assistant-intro">Rakamları uygulama hesaplar. Asistan yalnızca açıklar.</p>
        </div>
      </header>

      <section class="assistant-section" aria-labelledby="assistant-insights">
        <div class="assistant-section-head">
          <h2 class="assistant-section-title" id="assistant-insights">
            Öneriler
          </h2>
          <span class="assistant-count num">{list.length} öneri</span>
        </div>
        {list.length === 0 ? (
          <EmptyState title="Şu an öne çıkan bir durum yok">
            <p class="assistant-muted">Hesap ve ödemelerin eklendikçe burada öneriler çıkar.</p>
          </EmptyState>
        ) : (
          /* One slate container; rows arrive crit → warn → info from computeInsights. */
          <ul class="assistant-list">
            {list.map((item) => (
              <InsightRow
                key={item.id}
                item={item}
                medal={item.accountId === undefined ? undefined : slots.get(item.accountId)}
              />
            ))}
          </ul>
        )}
        <p class="assistant-note">Öneriler cihazında hesaplanır, internete bağlanmaz.</p>
      </section>

      <section class="assistant-section" aria-labelledby="assistant-budget">
        <h2 class="assistant-section-title" id="assistant-budget">
          Bütçe planı
        </h2>
        <BudgetPlan />
      </section>

      {PROXY_URL === null ? (
        <p class="assistant-quiet">Sohbet şu an kullanılamıyor. Yukarıdaki öneriler yine de çalışır.</p>
      ) : (
        <section class="assistant-section" aria-labelledby="assistant-chat">
          <h2 class="assistant-section-title" id="assistant-chat">
            Sohbet
          </h2>
          {assistantConsent.value === null ? (
            <ConsentPanel summary={sum} onAccept={grantConsent} />
          ) : (
            <>
              <ChatPanel summary={sum} />
              <Button variant="ghost" block onClick={closeChat}>
                Sohbeti kapat
              </Button>
            </>
          )}
        </section>
      )}

      <p class="assistant-disclaimer">{DISCLAIMER}</p>
    </div>
  )
}
