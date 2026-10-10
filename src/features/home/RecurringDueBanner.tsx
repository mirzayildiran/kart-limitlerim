import { figure } from '../../ui/components/Amount'
import { formatTL } from '../../domain/money'
import { recurring, today } from '../../data/store'
import { go } from '../../ui/nav'
import { Icon } from '../../ui/components/Icon'
import { pendingOccurrences } from '../calendar/calendarModel'
import './recurring-due-banner.css'

/** Shows recurring charges that are due today and not yet handled. Hidden when there are none. */
export function RecurringDueBanner() {
  const due = pendingOccurrences(recurring.value, today.value)
  if (due.length === 0) return null

  const total = due.reduce((sum, item) => sum + item.amount, 0)

  return (
    <button type="button" class="recurring-due-banner" onClick={() => go('calendar')}>
      <span class="recurring-due-banner-icon">
        <Icon name="repeat" size={18} />
      </span>
      <span class="recurring-due-banner-text">
        <span class="recurring-due-banner-title">Bugün {due.length} düzenli ödeme var</span>
        <span class="recurring-due-banner-sub">
          <span class="num">{figure(formatTL(total))}</span> henüz düşülmedi · {'Takvimde gör'}
        </span>
      </span>
      <Icon name="chevron" size={18} class="recurring-due-banner-chevron" />
    </button>
  )
}
