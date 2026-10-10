import { computed } from '@preact/signals'
import { PROXY_URL } from '../../ai/client'
import { accounts, categories, expenses, recurring, today } from '../../data/store'
import { computeInsights } from '../../domain/insights'
import { budgetSummary } from '../../domain/insightsSummary'
import type { InsightInput } from '../../domain/insightsTypes'
import { go, route } from '../../ui/nav'
import { Button, EmptyState, Pill } from '../../ui/components/controls'
import { Icon } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import { severityLabel, severityTone, DISCLAIMER } from './assistantModel'
import { ChatPanel, resetChat } from './ChatPanel'
import { ConsentPanel } from './ConsentPanel'
import { assistantConsent, grantConsent, revokeConsent } from './consent'
import './assistant-page.css'

const input = computed<InsightInput>(() => ({
  accounts: accounts.value,
  expenses: expenses.value,
  categories: categories.value,
  recurring: recurring.value,
  today: today.value,
}))
const insights = computed(() => computeInsights(input.value))
const summary = computed(() => budgetSummary(input.value, insights.value))

function closeChat() {
  revokeConsent()
  resetChat()
  toast('Sohbet kapatıldı. Artık hiçbir veri gönderilmiyor.')
}

export function AssistantPage() {
  if (route.value !== 'assistant') return null

  const list = insights.value
  const sum = summary.value

  return (
    <div class="assistant-page">
      <header class="assistant-header">
        <Button variant="ghost" aria-label="Geri" onClick={() => go('home')}>
          <Icon name="back" size={22} />
        </Button>
        <div class="assistant-heading">
          <h1>Bütçe asistanı</h1>
          <p class="assistant-intro">Rakamları uygulama hesaplar. Asistan yalnızca açıklar.</p>
        </div>
      </header>

      <section class="assistant-section" aria-labelledby="assistant-insights">
        <h2 class="assistant-section-title" id="assistant-insights">
          Öneriler
        </h2>
        {list.length === 0 ? (
          <EmptyState title="Şu an öne çıkan bir durum yok">
            <p class="assistant-muted">Hesap ve ödemelerin eklendikçe burada öneriler çıkar.</p>
          </EmptyState>
        ) : (
          <ul class="assistant-insights">
            {list.map((item) => (
              <li key={item.id} class="assistant-card assistant-insight">
                <Pill tone={severityTone(item.severity)}>{severityLabel(item.severity)}</Pill>
                <p class="assistant-insight-title">
                  <strong>{item.title}</strong>
                </p>
                <p class="assistant-insight-body">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p class="assistant-note">Öneriler cihazında hesaplanır, internete bağlanmaz.</p>
      </section>

      <section class="assistant-section" aria-labelledby="assistant-chat">
        <h2 class="assistant-section-title" id="assistant-chat">
          Sohbet
        </h2>
        {PROXY_URL === null ? (
          <div class="assistant-card">
            <p class="assistant-body">Sohbet bu sürümde kapalı. Yukarıdaki öneriler yine de çalışır.</p>
          </div>
        ) : assistantConsent.value === null ? (
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

      <p class="assistant-disclaimer">{DISCLAIMER}</p>
    </div>
  )
}
