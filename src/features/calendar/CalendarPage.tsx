import { useState } from 'preact/hooks'
import { formatLong } from '../../domain/dates'
import { formatTL } from '../../domain/money'
import { accounts, newId, recurring, saveExpense, saveRecurring, statements, today } from '../../data/store'
import { openSheet } from '../../ui/nav'
import { Button, EmptyState, Pill } from '../../ui/components/controls'
import { Icon, type IconName } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import type { RecurringPayment } from '../../domain/types'
import {
  accountName,
  buildTimeline,
  dayOfMonthLabel,
  groupByDay,
  monthlyRecurringTotal,
  pendingOccurrences,
  TIMELINE_DAYS,
  type PendingOccurrence,
  type TimelineEvent,
} from './calendarModel'
import './calendar-page.css'

const ICON: Record<TimelineEvent['kind'], IconName> = { cut: 'card', due: 'alert', recurring: 'repeat' }

function EventRow({ e }: { e: TimelineEvent }) {
  return (
    <li>
      <button
        type="button"
        class={`cal-event cal-event-${e.kind}${e.soon ? ' is-soon' : ''}`}
        onClick={() => openSheet(e.target)}
      >
        <span class="cal-event-icon" aria-hidden="true">
          <Icon name={ICON[e.kind]} size={20} />
        </span>
        <span class="cal-event-text">
          <span class="cal-event-title">{e.title}</span>
          {e.detail && <span class="cal-event-detail">{e.detail}</span>}
        </span>
        {e.amount != null && <span class="cal-event-amount num">{formatTL(e.amount)}</span>}
      </button>
    </li>
  )
}

export function CalendarPage() {
  const now = today.value
  const all = accounts.value
  const rec = recurring.value
  const pending = pendingOccurrences(rec, now)
  const days = groupByDay(buildTimeline(all, statements.value, rec, now), now)
  const monthly = monthlyRecurringTotal(rec)
  const [busy, setBusy] = useState<string | null>(null)

  // Handling a charge also marks every earlier one as handled, so only the
  // oldest pending charge of each payment can be acted on.
  const oldestOf = new Map<string, PendingOccurrence>()
  for (const p of pending) if (!oldestOf.has(p.recurringId)) oldestOf.set(p.recurringId, p)

  const findPayment = (id: string): RecurringPayment | undefined => recurring.value.find((r) => r.id === id)

  const handleAdd = async (item: PendingOccurrence) => {
    const r = findPayment(item.recurringId)
    if (!r) return
    setBusy(`${item.recurringId}:${item.iso}`)
    try {
      await saveExpense(null, {
        id: newId('exp'),
        amount: r.amount,
        categoryId: r.categoryId,
        accountId: r.accountId,
        date: item.iso,
        note: r.name,
        affectsAccount: true,
        installments: 1,
        source: 'recurring',
        recurringId: r.id,
        createdAt: Date.now(),
      })
      await saveRecurring({ ...r, handledThrough: item.iso })
      toast(`${r.name} harcamaya eklendi`)
    } catch {
      toast('Harcama eklenemedi. Tekrar dene.')
    } finally {
      setBusy(null)
    }
  }

  const handleSkip = async (item: PendingOccurrence) => {
    const r = findPayment(item.recurringId)
    if (!r) return
    setBusy(`${item.recurringId}:${item.iso}`)
    try {
      await saveRecurring({ ...r, handledThrough: item.iso })
      toast(`${r.name} atlandı`)
    } catch {
      toast('Ödeme atlanamadı. Tekrar dene.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div class="calendar-page">
      <header class="calendar-header">
        <h1>Takvim</h1>
      </header>

      {pending.length > 0 && (
        <section class="cal-section" aria-labelledby="cal-pending-title">
          <div class="cal-section-head">
            <h2 id="cal-pending-title">Bekleyen düzenli ödemeler</h2>
          </div>
          <ul class="cal-list">
            {pending.map((p) => {
              const isOldest = oldestOf.get(p.recurringId) === p
              const key = `${p.recurringId}:${p.iso}`
              return (
                <li key={key} class="cal-pending">
                  <div class="cal-pending-top">
                    <div class="cal-item-text">
                      <span class="cal-item-title">{p.name}</span>
                      <span class="cal-item-detail">
                        {formatLong(p.date)} · {accountName(all, p.accountId)}
                      </span>
                    </div>
                    <span class="cal-item-amount num">{formatTL(p.amount)}</span>
                  </div>
                  <div class="cal-pending-actions">
                    <Button
                      variant="ghost"
                      disabled={!isOldest || busy !== null}
                      onClick={() => handleSkip(p)}
                    >
                      Atla
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!isOldest || busy !== null}
                      onClick={() => handleAdd(p)}
                    >
                      Ekle
                    </Button>
                  </div>
                  {!isOldest && <p class="cal-hint">Önce daha eski ödemeyi işle.</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section class="cal-section" aria-labelledby="cal-timeline-title">
        <div class="cal-section-head">
          <h2 id="cal-timeline-title">Önümüzdeki {TIMELINE_DAYS} gün</h2>
        </div>
        {days.length === 0 ? (
          <EmptyState title={`Önümüzdeki ${TIMELINE_DAYS} günde kayıt yok`}>
            <p>Kart kesim ve son ödeme tarihleri ile düzenli ödemeler burada görünür.</p>
          </EmptyState>
        ) : (
          days.map((day) => (
            <section key={day.iso} class="cal-day">
              <h3 class={`cal-day-title${day.label === 'Bugün' ? ' is-today' : ''}`}>{day.label}</h3>
              <ul class="cal-list">
                {day.events.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      <section class="cal-section" aria-labelledby="cal-recurring-title">
        <div class="cal-section-head">
          <h2 id="cal-recurring-title">Düzenli ödemeler</h2>
          {rec.length > 0 && <span class="cal-meta num">Aylık toplam {formatTL(monthly)}</span>}
        </div>
        {rec.length === 0 ? (
          <EmptyState title="Henüz düzenli ödeme yok">
            <p>Kira, fatura ya da abonelik ekle; her ay hatırlatılır.</p>
          </EmptyState>
        ) : (
          <ul class="cal-list">
            {rec.map((r) => (
              <li key={r.id}>
                <button type="button" class="cal-item" onClick={() => openSheet({ type: 'recurring', id: r.id })}>
                  <span class="cal-item-text">
                    <span class="cal-item-title">
                      {r.name}
                      {!r.active && <Pill>Pasif</Pill>}
                    </span>
                    <span class="cal-item-detail">
                      {dayOfMonthLabel(r.dayOfMonth)} · {accountName(all, r.accountId)}
                    </span>
                  </span>
                  <span class="cal-item-amount num">{formatTL(r.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button block type="button" variant="secondary" onClick={() => openSheet({ type: 'recurring' })}>
          + Düzenli ödeme ekle
        </Button>
      </section>
    </div>
  )
}
