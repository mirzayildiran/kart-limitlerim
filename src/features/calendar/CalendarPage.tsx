import { useState } from 'preact/hooks'
import { daysBetween, formatShort, startOfDay } from '../../domain/dates'
import { formatTL } from '../../domain/money'
import { accounts, newId, recurring, saveExpense, saveRecurring, statements, today } from '../../data/store'
import { accountColors } from '../../ui/accountColor'
import { openSheet } from '../../ui/nav'
import { Button, EmptyState, Pill } from '../../ui/components/controls'
import { figure } from '../../ui/components/Amount'
import { Icon, type IconName } from '../../ui/components/Icon'
import { toast } from '../../ui/components/toast'
import type { RecurringPayment } from '../../domain/types'
import { SOON_DAYS } from '../../domain/statement'
import {
  accountName,
  buildTimeline,
  dayOfMonthLabel,
  dayTotal,
  groupByDay,
  monthlyRecurringTotal,
  pendingOccurrences,
  periodSummary,
  TIMELINE_DAYS,
  type PendingOccurrence,
  type TimelineDay,
  type TimelineEvent,
} from './calendarModel'
import './calendar-page.css'

const ICON: Record<TimelineEvent['kind'], IconName> = { cut: 'card', due: 'alert', recurring: 'repeat' }

/** Signed amount text: "~" when the figure is an estimate, then the figure with its ₺. */
const amountText = (amount: number, estimated: boolean) => `${estimated ? '~' : ''}${formatTL(amount)}`

/** One agenda row: wallet-coloured medallion, text, amount, and a pill for due dates. */
function EventRow({ e, now, slot, onOpen }: { e: TimelineEvent; now: Date; slot: number; onOpen: () => void }) {
  const left = daysBetween(e.date, now)
  const isDue = e.kind === 'due'
  return (
    <li>
      <button type="button" class="calendar-row" onClick={onOpen}>
        <span class="calendar-medal" data-slot={slot} aria-hidden="true">
          <Icon name={ICON[e.kind]} size={18} />
        </span>
        <span class="calendar-row-text">
          <span class="calendar-row-title">{e.title}</span>
          {e.detail && <span class="calendar-row-detail">{e.detail}</span>}
        </span>
        <span class="calendar-row-end">
          {e.amount != null && (
            <span class="calendar-row-amount num">{figure(amountText(e.amount, e.estimated))}</span>
          )}
          {isDue && left < 0 && <Pill tone="crit">{-left} gün geçti</Pill>}
          {isDue && left >= 0 && left <= SOON_DAYS && (
            <Pill tone="warn">{left === 0 ? 'Bugün son gün' : `${left} gün kaldı`}</Pill>
          )}
        </span>
      </button>
    </li>
  )
}

export function CalendarPage() {
  const now = startOfDay(today.value)
  const all = accounts.value
  const rec = recurring.value
  const colors = accountColors(all)
  const pending = pendingOccurrences(rec, now)
  const days: TimelineDay[] = groupByDay(buildTimeline(all, statements.value, rec, now), now)
  const summary = periodSummary(days)
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

  const openEvent = (e: TimelineEvent) => {
    if (e.target.type === 'recurring') openSheet({ type: 'recurring', id: e.target.id })
    else openSheet({ type: 'accountDetail', id: e.accountId })
  }

  return (
    <div class="calendar-page">
      <header class="calendar-header">
        <h1>Takvim</h1>
      </header>

      {pending.length > 0 && (
        <section class="calendar-section" aria-labelledby="calendar-pending-title">
          <h2 class="calendar-section-title" id="calendar-pending-title">
            Bekleyen düzenli ödemeler
          </h2>
          <ul class="calendar-pending">
            {pending.map((p) => {
              const isOldest = oldestOf.get(p.recurringId) === p
              const key = `${p.recurringId}:${p.iso}`
              return (
                <li key={key} class="calendar-pending-item">
                  <div class="calendar-pending-top">
                    <div class="calendar-row-text">
                      <span class="calendar-row-title">{p.name}</span>
                      <span class="calendar-row-detail">
                        {formatShort(p.date)} · {accountName(all, p.accountId)}
                      </span>
                    </div>
                    <span class="calendar-row-amount num">{figure(formatTL(p.amount))}</span>
                  </div>
                  <div class="calendar-pending-actions">
                    <Button
                      variant="ghost"
                      class="calendar-pending-skip"
                      disabled={!isOldest || busy !== null}
                      onClick={() => handleSkip(p)}
                    >
                      Atla
                    </Button>
                    <Button
                      variant="primary"
                      class="calendar-pending-add"
                      disabled={!isOldest || busy !== null}
                      onClick={() => handleAdd(p)}
                    >
                      Ekle
                    </Button>
                  </div>
                  {!isOldest && <p class="calendar-hint">Önce daha eski ödemeyi işle.</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section class="calendar-section" aria-labelledby="calendar-timeline-title">
        <div class="calendar-section-head">
          <h2 class="calendar-section-title" id="calendar-timeline-title">
            Önümüzdeki {TIMELINE_DAYS} gün
          </h2>
          {days.length > 0 && (
            <span class="calendar-summary-total">
              <span class="calendar-summary-figure num">{figure(amountText(summary.total, summary.estimated))}</span>{' '}
              çıkacak
            </span>
          )}
        </div>
        {days.length === 0 ? (
          <p class="calendar-empty">Önümüzdeki {TIMELINE_DAYS} günde ödeme ya da kesim yok.</p>
        ) : (
          <>
            <p class="calendar-caption">
              {summary.payments} ödeme · {summary.cuts} kesim
            </p>
            {days.map((day) => {
              const total = dayTotal(day)
              const hasAmount = day.events.some((e) => e.amount != null)
              return (
                <section key={day.iso} class="calendar-day">
                  <div class="calendar-day-head">
                    <h3 class={`calendar-day-title${day.label === 'Bugün' ? ' is-today' : ''}`}>{day.label}</h3>
                    {hasAmount && (
                      <span class="calendar-day-total num">{figure(amountText(total.total, total.estimated))}</span>
                    )}
                  </div>
                  <div class="calendar-card">
                    <ul class="calendar-card-list">
                      {day.events.map((e) => (
                        <EventRow key={e.id} e={e} now={now} slot={colors.get(e.accountId) ?? 1} onOpen={() => openEvent(e)} />
                      ))}
                    </ul>
                  </div>
                </section>
              )
            })}
          </>
        )}
      </section>

      <section class="calendar-section" aria-labelledby="calendar-recurring-title">
        <div class="calendar-section-head">
          <h2 class="calendar-section-title" id="calendar-recurring-title">
            Düzenli ödemeler
          </h2>
          {rec.length > 0 && <span class="calendar-meta num">Aylık toplam {formatTL(monthly)}</span>}
        </div>
        <div class="calendar-card">
          {rec.length === 0 ? (
            <div class="calendar-card-empty">
              <EmptyState title="Henüz düzenli ödeme yok">
                <p>Kira, fatura ya da abonelik ekle; her ay hatırlatılır.</p>
              </EmptyState>
            </div>
          ) : (
            <ul class="calendar-card-list">
              {rec.map((r) => (
                <li key={r.id}>
                  <button type="button" class="calendar-row" onClick={() => openSheet({ type: 'recurring', id: r.id })}>
                    <span class="calendar-medal" data-slot={colors.get(r.accountId) ?? 1} aria-hidden="true">
                      <Icon name="repeat" size={18} />
                    </span>
                    <span class="calendar-row-text">
                      <span class="calendar-row-title">
                        {r.name}
                        {!r.active && <Pill>Pasif</Pill>}
                      </span>
                      <span class="calendar-row-detail">
                        {dayOfMonthLabel(r.dayOfMonth)} · {accountName(all, r.accountId)}
                      </span>
                    </span>
                    <span class="calendar-row-end">
                      <span class="calendar-row-amount num">{figure(formatTL(r.amount))}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" class="calendar-add" onClick={() => openSheet({ type: 'recurring' })}>
            <Icon name="plus" size={18} />
            Düzenli ödeme ekle
          </button>
        </div>
      </section>
    </div>
  )
}
