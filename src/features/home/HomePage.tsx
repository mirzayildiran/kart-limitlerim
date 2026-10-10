import { computed } from '@preact/signals'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { cycleKeyOf, formatLong, formatShort } from '../../domain/dates'
import { displayHue } from '../../domain/categories'
import { formatTL, formatTLExact, spokenTL } from '../../domain/money'
import { byMostAvailable } from '../../domain/power'
import type { Account, Kurus } from '../../domain/types'
import {
  accounts,
  accountById,
  budgets,
  categories,
  categoryById,
  forecast,
  power,
  recurring,
  runwayDays,
  statements,
  today,
  expenses,
  loadDemoData,
} from '../../data/store'
import { openSheet, go } from '../../ui/nav'
import { Button, Pill } from '../../ui/components/controls'
import { Amount, figure } from '../../ui/components/Amount'
import { Icon } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import { acceptRestore, dismissRestore, restoreOffer } from '../../data/autoBackupRuntime'
import { computeInsights } from '../../domain/insights'
import { assistantInput } from '../assistant/assistantModel'
import { RecurringDueBanner } from './RecurringDueBanner'
import { Runway } from './Runway'
import { Wallet, accountColors } from './Wallet'
import './home-page.css'

const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short' })
const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Günaydın'
  if (hour >= 11 && hour < 17) return 'İyi günler'
  return 'İyi akşamlar'
}

/** Number of budget suggestions, from the same input the assistant page uses. */
const assistantCount = computed(
  () =>
    computeInsights(
      assistantInput({
        accounts: accounts.value,
        expenses: expenses.value,
        categories: categories.value,
        recurring: recurring.value,
        budgets: budgets.value,
        today: today.value,
      }),
    ).length,
)

/** The status line opens the budget assistant; it names the suggestion count when there is more than one. */
function renderTopbar(status: { text: string; tone: 'ok' | 'warn' | 'crit' } | undefined, suggestions: number): JSX.Element {
  const chevron = (
    <span class="home-status-chevron" aria-hidden="true">
      <Icon name="chevron" size={16} />
    </span>
  )
  return (
    <header class="home-topbar">
      <h1 class="home-greeting">{greeting(new Date().getHours())}</h1>
      <time class="home-date" dateTime={today.value.toISOString()}>
        {dateFormatter.format(today.value)}
      </time>
      {status ? (
        <button type="button" class={`home-status is-${status.tone}`} onClick={() => go('assistant')}>
          <span class="home-status-dot" aria-hidden="true" />
          <span class="home-status-text">
            {status.text}
            {suggestions > 1 && <span class="home-status-more"> · {suggestions} öneri</span>}
          </span>
          {chevron}
        </button>
      ) : (
        suggestions > 0 && (
          <button type="button" class="home-status is-muted" onClick={() => go('assistant')}>
            <span class="home-status-text">Bütçe asistanı · {suggestions} öneri</span>
            {chevron}
          </button>
        )
      )}
    </header>
  )
}

/** One plain sentence on how things stand, most urgent first. */
function homeStatus(): { text: string; tone: 'ok' | 'warn' | 'crit' } {
  const items = statements.value
  const overdue = items.filter((i) => i.view.status === 'overdue').length
  if (overdue > 0) return { text: `${overdue} ödemenin tarihi geçti, önce onlara bakalım.`, tone: 'crit' }
  const f = forecast.value
  if (f.cashAfter < 0) return { text: 'Asgariler için nakit yetmiyor, ödemeden önce plan yap.', tone: 'crit' }
  const soon = items.find((i) => i.view.status === 'today' || i.view.status === 'soon')
  if (soon) {
    const d = soon.view.daysLeft
    return { text: d === 0 ? `${soon.account.name} için bugün son ödeme günü.` : `${soon.account.name} son ödemesine ${d} gün var.`, tone: 'warn' }
  }
  return { text: `Kesime ${f.days} gün var, her şey yolunda.`, tone: 'ok' }
}

/** Expenses for the current month */
const thisMonthExpenses = computed(() => {
  const key = cycleKeyOf(today.value)
  return expenses.value.filter((e) => e.date.startsWith(key)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
})

/** Sum of this month's expenses */
const thisMonthTotal = computed(() => thisMonthExpenses.value.reduce((sum, e) => sum + e.amount, 0))

/** Top 3 expense categories for this month */
const topCategories = computed(() => {
  const byCategory = new Map<string, Kurus>()
  for (const e of thisMonthExpenses.value) {
    byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amount)
  }
  return Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([catId, amount]) => ({ catId, amount }))
})

/** 4 most recent expenses */
const recentExpenses = computed(() => thisMonthExpenses.value.slice(0, 4))

/** Spending power split by account, each in its wallet colour. */
function renderSpread(list: Account[], colors: Map<string, number>, total: Kurus): JSX.Element | null {
  if (total <= 0) return null
  const parts = list
    .map((a) => ({ a, value: a.kind === 'card' || a.kind === 'kmh' ? Math.max(0, a.available) : Math.max(0, a.balance) }))
    .filter((p) => p.value > 0)
  return (
    <div class="home-spread" role="img" aria-label={`Hesaplara göre dağılım: ${parts.map((p) => `${p.a.name} ${spokenTL(p.value)}`).join(', ')}`}>
      {parts.map(({ a, value }, i) => (
        <span
          key={a.id}
          class="home-spread-seg"
          data-slot={colors.get(a.id) ?? 1}
          style={{ flex: value / total, '--i': i }}
        />
      ))}
    </div>
  )
}

function HeroFigure({ value }: { value: Kurus }) {
  const prev = useRef(value)
  const [change, setChange] = useState<{ delta: Kurus; key: number } | null>(null)

  // Acknowledge a change (an expense saved, a limit updated): the figure settles in and the delta floats off.
  useEffect(() => {
    if (prev.current === value) return
    const delta = value - prev.current
    prev.current = value
    setChange({ delta, key: Date.now() })
    const t = setTimeout(() => setChange(null), 1800)
    return () => clearTimeout(t)
  }, [value])

  return (
    <p class="home-hero-figure">
      <span key={change?.key ?? 0} class={change ? 'home-hero-value is-changed' : 'home-hero-value'}>
        <Amount value={value} size="hero" />
      </span>
      {change && (
        <span key={`d${change.key}`} class={`home-hero-delta num${change.delta < 0 ? ' is-down' : ' is-up'}`} aria-live="polite">
          {figure(`${change.delta < 0 ? '−' : '+'}${formatTL(Math.abs(change.delta))}`)}
        </span>
      )}
    </p>
  )
}

function renderCashStatus(forecast_: typeof forecast.value): JSX.Element {
  const short = forecast_.cashAfter < 0
  const overdue = statements.value.filter((i) => i.view.status === 'overdue').length
  const notes = [
    overdue > 0 ? `${overdue} ödeme gecikti` : null,
    forecast_.unknownMinimums > 0 ? `${forecast_.unknownMinimums} ekstre bekleniyor` : null,
  ].filter(Boolean)
  return (
    <section class={`home-cash${short || overdue > 0 ? ' is-short' : ''}`} aria-label="Ödemelerden sonra nakit">
      <p class="home-cash-title">
        {short ? (
          <>
            Asgariler için <span class="num">{figure(formatTL(-forecast_.cashAfter))}</span> eksik
          </>
        ) : (
          <>
            Ödemelerden sonra <span class="num">{figure(formatTL(forecast_.cashAfter))}</span> nakit kalıyor
          </>
        )}
      </p>
      <p class="home-cash-sub">
        {notes.length > 0 ? notes.join(' · ') : `${formatShort(forecast_.until)} tarihine kadar nakit, banka ve boş KMH: ${formatTL(forecast_.cashAvailable)}`}
      </p>
    </section>
  )
}

function renderExpenseSection(): JSX.Element | null {
  const thisMonthValue = thisMonthExpenses.value
  const monthTotalValue = thisMonthTotal.value
  const topCatsValue = topCategories.value
  const recentValue = recentExpenses.value
  const categoryByIdValue = categoryById.value
  const accountByIdValue = accountById.value

  if (thisMonthValue.length === 0) {
    return (
      <section class="home-section">
        <div class="home-section-header">
          <h2>Harcamalar</h2>
        </div>
        <div class="home-section-content">
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>Bu ayda harcama yok.</p>
        </div>
      </section>
    )
  }

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>Harcamalar</h2>
        <div class="home-section-meta">
          Bu ay <span class="num">{figure(formatTL(monthTotalValue))}</span>
        </div>
      </div>
      <div class="home-section-content">
        {topCatsValue.length > 0 && (
          <ul class="home-expenses-categories">
            {topCatsValue.map(({ catId, amount }) => {
              const cat = categoryByIdValue.get(catId)
              if (!cat) return null
              const shareOfTotal = monthTotalValue > 0 ? amount / monthTotalValue : 0
              return (
                <li key={catId} class="home-expenses-category cat-color" style={{ '--h': displayHue(cat.hue) }}>
                  <span class="home-expenses-category-label">{cat.name}</span>
                  <span class="home-expenses-category-amount num">{figure(formatTL(amount))}</span>
                  <span class="home-expenses-category-bar" aria-hidden="true">
                    <span class="home-expenses-category-fill" style={{ width: `${shareOfTotal * 100}%` }} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {recentValue.length > 0 && (
          <div class="home-expenses-list">
            {recentValue.map((expense) => {
              const cat = categoryByIdValue.get(expense.categoryId)
              const account = accountByIdValue.get(expense.accountId)
              const expenseDate = new Date(expense.date)
              return (
                <button
                  key={expense.id}
                  type="button"
                  class="home-expense-row"
                  onClick={() => openSheet({ type: 'expense', expense })}
                >
                  <span class="home-expense-row-left">
                    <span class="home-expense-row-label">{expense.note || cat?.name || 'Diğer'}</span>
                    <span class="home-expense-row-detail">
                      {account?.name} · {formatShort(expenseDate)}
                    </span>
                  </span>
                  <span class="home-expense-row-amount num">{figure(`−${formatTLExact(expense.amount)}`)}</span>
                </button>
              )
            })}
          </div>
        )}

        <Button variant="secondary" block onClick={() => go('expenses')}>
          Tümü
        </Button>
      </div>
    </section>
  )
}

function renderStatementsSection(colors: Map<string, number>): JSX.Element | null {
  const statementsValue = statements.value
  if (statementsValue.length === 0) return null

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>Ödemeler</h2>
      </div>
      <div class="home-section-content">
        {statementsValue.map((item) => {
          const account = item.account
          const view = item.view
          const lineLabel = account.lines.length > 1 ? ` ${item.account.lines[item.lineIndex].label}` : ''
          const minOutstanding = item.minimumOutstanding
          const minIsEst = item.minimumIsEstimate

          let statusPill: JSX.Element
          if (view.status === 'paid') {
            statusPill = <Pill tone="ok">Ödendi</Pill>
          } else if (view.status === 'overdue') {
            statusPill = <Pill tone="crit">{-view.daysLeft} gün geçti</Pill>
          } else if (view.status === 'today') {
            statusPill = <Pill tone="warn">Bugün son gün</Pill>
          } else {
            statusPill = <Pill tone="warn">{view.daysLeft} gün kaldı</Pill>
          }

          return (
            <button
              key={`${account.id}-${item.lineIndex}`}
              type="button"
              class="home-statement-row"
              data-slot={colors.get(account.id) ?? 1}
              onClick={() => openSheet({ type: 'statement', accountId: account.id, lineIndex: item.lineIndex })}
            >
              <span class="home-statement-date" aria-hidden="true">
                <span class="home-statement-day">{view.due.getDate()}</span>
                <span class="home-statement-month">{monthShort.format(view.due)}</span>
              </span>
              <span class="home-statement-row-left">
                <span class="home-statement-row-name">
                  {account.name}
                  {lineLabel}
                </span>
                <span class="home-statement-row-sub">
                  Kesim {formatShort(view.cut)} · son ödeme {view.dueIsExact ? '' : '~'}
                  {formatShort(view.due)}
                </span>
              </span>
              <span class="home-statement-row-right">
                <span class={`home-statement-row-amount num${minOutstanding == null ? ' is-warn' : ''}`}>
                  {minOutstanding == null ? 'Tutar girilmedi' : figure(`${minIsEst ? '~' : ''}${formatTL(minOutstanding)}`)}
                </span>
                <span class="home-statement-row-status">{statusPill}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function HomePage() {
  const accountsValue = accounts.value

  // Empty, but the iOS app's automatic backup still holds data (e.g. iOS cleared the web storage).
  const offer = restoreOffer.value
  if (accountsValue.length === 0 && offer) {
    const restore = async () => {
      try {
        await acceptRestore()
        toast('Verilerin geri yüklendi')
      } catch {
        toast('Geri yükleme tamamlanamadı. Tekrar dene.')
      }
    }
    const { accounts: savedAccounts, expenses: savedExpenses } = offer.data
    return (
      <div class="home-page">
        {renderTopbar(undefined, assistantCount.value)}
        <section class="home-welcome" aria-labelledby="home-restore-title">
          <h2 id="home-restore-title" class="home-welcome-title">
            Önceki verilerin bulundu
          </h2>
          <p class="home-welcome-text">
            Bu telefondaki otomatik yedekte {savedAccounts.length} hesap ve {savedExpenses.length} harcama var (son kayıt{' '}
            {formatLong(new Date(offer.exportedAt))}). Geri yükleyelim mi?
          </p>
          <div class="home-welcome-actions">
            <Button variant="primary" block onClick={restore}>
              Geri yükle
            </Button>
            <Button variant="ghost" block onClick={dismissRestore}>
              Şimdi değil
            </Button>
          </div>
        </section>
      </div>
    )
  }

  // Empty state: no accounts at all
  if (accountsValue.length === 0) {
    const tryDemo = async () => {
      try {
        await loadDemoData()
        toast('Örnek veriler yüklendi. Ayarlar → Tüm verileri sil ile temizleyebilirsin.', undefined, 6000)
      } catch {
        toast('Örnek veriler yüklenemedi. Tekrar dene.')
      }
    }

    return (
      <div class="home-page">
        {renderTopbar(undefined, assistantCount.value)}
        <section class="home-welcome" aria-labelledby="home-welcome-title">
          <div class="home-welcome-fan" aria-hidden="true">
            <span class="home-welcome-card" data-slot="2" />
            <span class="home-welcome-card" data-slot="5" />
            <span class="home-welcome-card" data-slot="4" />
          </div>
          <h2 id="home-welcome-title" class="home-welcome-title">
            Cüzdanını kuralım
          </h2>
          <p class="home-welcome-text">
            Kartlarını ekle; şu an ne kadar harcayabileceğini ve kesime kadar ne kalacağını hemen görelim.
          </p>
          <p class="home-welcome-privacy">
            <Icon name="lock" size={16} />
            Verilerin yalnızca bu cihazda. Hesap yok.
          </p>
          <div class="home-welcome-actions">
            <Button variant="primary" block onClick={() => openSheet({ type: 'account', kind: 'card' })}>
              Kart ekle
            </Button>
            <Button variant="secondary" block onClick={tryDemo}>
              Örnek verilerle dene
            </Button>
            <div class="home-welcome-more">
              <Button variant="ghost" onClick={() => openSheet({ type: 'account', kind: 'bank' })}>
                Nakit veya hesap ekle
              </Button>
              <Button variant="ghost" onClick={() => go('settings')}>
                Yedekten geri yükle
              </Button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const powerValue = power.value
  const forecastValue = forecast.value
  const colors = accountColors(accountsValue)
  const wallet = byMostAvailable(accountsValue)

  return (
    <div class="home-page">
      {renderTopbar(homeStatus(), assistantCount.value)}

      <section class="home-hero" aria-labelledby="home-hero-label">
        <h2 id="home-hero-label" class="home-hero-label">
          Harcama gücün
        </h2>
        <HeroFigure value={powerValue.total} />
        {renderSpread(wallet, colors, powerValue.total)}
      </section>

      <Wallet accounts={wallet} colors={colors} statements={statements.value} />

      <section class="home-runway" aria-labelledby="home-runway-label">
        <h2 id="home-runway-label" class="home-runway-label">
          Kesime kadar
        </h2>
        <Runway days={runwayDays.value} />
      </section>

      {renderCashStatus(forecastValue)}
      <RecurringDueBanner />

      {renderStatementsSection(colors)}
      {renderExpenseSection()}
    </div>
  )
}
