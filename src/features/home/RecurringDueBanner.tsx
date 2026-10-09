import { formatTL } from '../../domain/money'
import { recurring, today } from '../../data/store'
import { go } from '../../ui/nav'
import { Button } from '../../ui/components/controls'
import { pendingOccurrences } from '../calendar/calendarModel'
import './recurring-due-banner.css'

/** Shows recurring charges that are due today and not yet handled. Hidden when there are none. */
export function RecurringDueBanner() {
  const due = pendingOccurrences(recurring.value, today.value)
  if (due.length === 0) return null

  const shown = due.slice(0, 2)

  return (
    <section class="recurring-due-banner" aria-label="Düzenli ödemeler">
      <p class="recurring-due-banner-title">Bugün işlenecek {due.length} düzenli ödeme var</p>
      <ul class="recurring-due-banner-list">
        {shown.map((item) => (
          <li key={`${item.recurringId}-${item.iso}`} class="recurring-due-banner-item">
            <span class="recurring-due-banner-name">{item.name}</span>
            <span class="recurring-due-banner-amount num">{formatTL(item.amount)}</span>
          </li>
        ))}
      </ul>
      <Button variant="secondary" block onClick={() => go('calendar')}>
        Takvimde gör
      </Button>
    </section>
  )
}
