import { computed } from '@preact/signals'
import type { JSX } from 'preact'
import { cycleKeyOf, formatShort } from '../../domain/dates'
import { formatTL, formatTLExact } from '../../domain/money'
import type { Kurus } from '../../domain/types'
import {
  accounts,
  accountById,
  cards,
  categoryById,
  forecast,
  kmhAccounts,
  liquidAccounts,
  power,
  statements,
  today,
  expenses,
} from '../../data/store'
import { openSheet, go } from '../../ui/nav'
import { Button, EmptyState, Pill } from '../../ui/components/controls'
import { LimitStrip } from '../../ui/components/LimitStrip'
import { Amount } from '../../ui/components/Amount'
import { RecurringDueBanner } from './RecurringDueBanner'
import './home-page.css'

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

function renderTopbar(): JSX.Element {
  return (
    <header class="home-topbar">
      <span class="home-app-name">Kart Limitlerim</span>
      <time class="home-date" dateTime={today.value.toISOString()}>
        {dateFormatter.format(today.value)}
      </time>
    </header>
  )
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

function renderRibbon(power_: typeof power.value): JSX.Element | null {
  const total = power_.total
  if (total <= 0) return null

  const cardShare = power_.cards / total
  const kmhShare = power_.kmh / total
  const liquidShare = power_.liquid / total

  return (
    <div class="home-ribbon">
      <div class="home-ribbon-bar">
        {power_.cards > 0 && <div class="home-ribbon-segment home-ribbon-card" style={{ flex: cardShare }} />}
        {power_.kmh > 0 && <div class="home-ribbon-segment home-ribbon-kmh" style={{ flex: kmhShare }} />}
        {power_.liquid > 0 && <div class="home-ribbon-segment home-ribbon-cash" style={{ flex: liquidShare }} />}
      </div>
      <div class="home-ribbon-legend">
        <div class="home-ribbon-legend-item">
          <span class="home-ribbon-legend-head">
            <span class="home-ribbon-legend-dot home-ribbon-card" />
            <span>Kartlar</span>
          </span>
          <span class="home-ribbon-legend-amount num">{formatTL(power_.cards)}</span>
        </div>
        <div class="home-ribbon-legend-item">
          <span class="home-ribbon-legend-head">
            <span class="home-ribbon-legend-dot home-ribbon-kmh" />
            <span>KMH</span>
          </span>
          <span class="home-ribbon-legend-amount num">{formatTL(power_.kmh)}</span>
        </div>
        <div class="home-ribbon-legend-item">
          <span class="home-ribbon-legend-head">
            <span class="home-ribbon-legend-dot home-ribbon-cash" />
            <span>Nakit</span>
          </span>
          <span class="home-ribbon-legend-amount num">{formatTL(power_.liquid)}</span>
        </div>
      </div>
    </div>
  )
}

function renderOutlookTiles(forecast_: typeof forecast.value): JSX.Element {
  const powerAfter = forecast_.powerAfter
  const cashAfter = forecast_.cashAfter
  const cashAfterIsNegative = cashAfter < 0

  const minimumShorfall = cashAfterIsNegative ? -cashAfter : 0

  return (
    <div class="home-outlook">
      <div class="home-outlook-tile">
        <Amount value={powerAfter} size="xl" />
        <div class="home-outlook-label">Kesime kadar</div>
        <div class="home-outlook-sub">
          {formatShort(forecast_.until)} · {forecast_.days} gün{forecast_.recurringCount > 0 ? ' · düzenli ödemeler düşüldü' : ''}
        </div>
      </div>
      <div class="home-outlook-tile">
        <Amount value={cashAfter} size="xl" tone={cashAfterIsNegative ? 'crit' : 'default'} />
        <div class="home-outlook-label">Ödemelerden sonra nakit</div>
        <div class="home-outlook-sub">
          {cashAfterIsNegative && minimumShorfall > 0 && (
            <>
              <div>asgariler için {formatTL(minimumShorfall)} eksik</div>
              {forecast_.unknownMinimums > 0 && <div>{forecast_.unknownMinimums} ekstre tutarı bekleniyor</div>}
            </>
          )}
          {!cashAfterIsNegative && forecast_.unknownMinimums > 0 && <div>{forecast_.unknownMinimums} ekstre tutarı bekleniyor</div>}
        </div>
      </div>
    </div>
  )
}

function renderCardSection(): JSX.Element | null {
  const cardsValue = cards.value
  if (cardsValue.length === 0) return null

  const powerValue = power.value

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>Kredi kartları</h2>
        <div class="home-section-meta">
          {formatTL(powerValue.cards)} / {formatTL(powerValue.cardLimit)}
        </div>
      </div>
      <div class="home-section-content">
        {cardsValue.map((card) => {
          const share = card.limit > 0 ? Math.min(1, Math.max(0, card.available / card.limit)) : 0
          const subText = card.limit <= 0 ? 'Limit girilmedi' : `Limit ${formatTL(card.limit)} · %${Math.round(share * 100)} boş`
          return (
            <LimitStrip
              key={card.id}
              name={card.name}
              sub={subText}
              available={card.available}
              limit={card.limit}
              onClick={() => openSheet({ type: 'accountDetail', id: card.id })}
            />
          )
        })}
        <button
          type="button"
          class="home-add-button"
          onClick={() => openSheet({ type: 'account', kind: 'card' })}
        >
          + Kart ekle
        </button>
      </div>
    </section>
  )
}

function renderKmhSection(): JSX.Element | null {
  const kmhValue = kmhAccounts.value
  if (kmhValue.length === 0) return null

  const powerValue = power.value
  const kmhUsedValue = powerValue.kmhUsed
  const kmhUsedText = kmhUsedValue > 0 ? `${formatTL(kmhUsedValue)} kullanımda` : 'Kullanım yok'

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>KMH</h2>
        <div class="home-section-meta">{kmhUsedText}</div>
      </div>
      <div class="home-section-content">
        {kmhValue.map((kmh) => {
          const share = kmh.limit > 0 ? Math.min(1, Math.max(0, kmh.available / kmh.limit)) : 0
          const subText = kmh.limit <= 0 ? 'Limit girilmedi' : `Limit ${formatTL(kmh.limit)} · %${Math.round(share * 100)} boş`
          return (
            <LimitStrip
              key={kmh.id}
              name={kmh.name}
              sub={subText}
              available={kmh.available}
              limit={kmh.limit}
              tone="kmh"
              onClick={() => openSheet({ type: 'accountDetail', id: kmh.id })}
            />
          )
        })}
      </div>
      {kmhUsedValue > 0 && <div class="home-section-note">KMH faizi günlük işler.</div>}
    </section>
  )
}

function renderLiquidSection(): JSX.Element {
  const liquidValue = liquidAccounts.value
  const powerValue = power.value
  const totalLiquid = powerValue.liquid

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>Nakit ve hesaplar</h2>
        <div class="home-section-meta">{formatTL(totalLiquid)}</div>
      </div>
      <div class="home-section-content">
        {liquidValue.map((account) => (
          <div key={account.id} class="home-account-row">
            <div class="home-account-row-left">
              <div class="home-account-row-name">{account.name}</div>
              {account.note && <div class="home-account-row-note">{account.note}</div>}
            </div>
            <div class="home-account-row-balance num">{formatTL(account.balance)}</div>
          </div>
        ))}
        <button
          type="button"
          class="home-add-button"
          onClick={() => openSheet({ type: 'account', kind: 'bank' })}
        >
          + Hesap ekle
        </button>
      </div>
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
      </div>
      <div class="home-section-content">
        <div class="home-expenses-header">
          <div class="home-expenses-month">{formatTL(monthTotalValue)}</div>
          <div class="home-expenses-month-label">Bu ay</div>
        </div>

        {topCatsValue.length > 0 && (
          <div class="home-expenses-categories">
            {topCatsValue.map(({ catId, amount }) => {
              const cat = categoryByIdValue.get(catId)
              if (!cat) return null
              const shareOfTotal = monthTotalValue > 0 ? amount / monthTotalValue : 0
              return (
                <div key={catId} class="home-expenses-category">
                  <div class="home-expenses-category-bar">
                    <div class="home-expenses-category-fill" style={{ width: `${shareOfTotal * 100}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                  <div class="home-expenses-category-label">{cat.name}</div>
                </div>
              )
            })}
          </div>
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
                  <span class="home-expense-row-amount num">−{formatTLExact(expense.amount)}</span>
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

function renderStatementsSection(): JSX.Element | null {
  const statementsValue = statements.value
  if (statementsValue.length === 0) return null

  return (
    <section class="home-section">
      <div class="home-section-header">
        <h2>Asgari ödemeler</h2>
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
              onClick={() => openSheet({ type: 'statement', accountId: account.id, lineIndex: item.lineIndex })}
            >
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
                  {minOutstanding == null ? 'Tutar girilmedi' : `${minIsEst ? '~' : ''}${formatTL(minOutstanding)}`}
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

  // Empty state: no accounts at all
  if (accountsValue.length === 0) {
    return (
      <div class="home-page">
        {renderTopbar()}
        <EmptyState title="İlk kartını ekle">
          <p>Kartlarının limitini ve kullanılabilir limitini gir; uygulama ne kadar harcayabileceğini hesaplasın.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <Button variant="primary" block onClick={() => openSheet({ type: 'account', kind: 'card' })}>
              Kart ekle
            </Button>
            <Button variant="secondary" block onClick={() => openSheet({ type: 'account', kind: 'bank' })}>
              Nakit veya hesap ekle
            </Button>
            <Button variant="ghost" block onClick={() => go('settings')}>
              Yedekten geri yükle
            </Button>
          </div>
        </EmptyState>
      </div>
    )
  }

  const powerValue = power.value
  const forecastValue = forecast.value

  return (
    <div class="home-page">
      {renderTopbar()}
      <div class="home-hero">
        <div class="home-hero-eyebrow">Şu an harcayabileceğin</div>
        <Amount value={powerValue.total} size="hero" />
        {renderRibbon(powerValue)}
        {renderOutlookTiles(forecastValue)}
      </div>
      <RecurringDueBanner />

      {renderCardSection()}
      {renderKmhSection()}
      {renderLiquidSection()}
      {renderExpenseSection()}
      {renderStatementsSection()}
    </div>
  )
}
