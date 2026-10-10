import { addDays, startOfDay } from './dates'
import { statementItems } from './power'
import type { Account } from './types'

/**
 * Card due-date reminders as plain data; src/platform/reminders.ts schedules them.
 * Text carries no amounts: notifications show on the lock screen.
 */

export interface Reminder {
  /** Stable per card line, due date and offset, so rescheduling replaces instead of duplicating. */
  id: number
  at: Date
  title: string
  body: string
  /** The card line it is about; tapping the notification opens its statement. */
  accountId: string
  lineIndex: number
}

/** Days before the due date to remind; 0 is the morning of the due date. */
export const REMINDER_OFFSETS: readonly number[] = [2, 0]
export const REMINDER_HOUR = 10

export function reminderPlan(accounts: Account[], now: Date): Reminder[] {
  const plan: Reminder[] = []
  for (const item of statementItems(accounts, startOfDay(now))) {
    if (item.view.status === 'paid') continue
    const { account, lineIndex } = item
    const name = account.lines.length > 1 ? `${account.name} ${account.lines[lineIndex].label}` : account.name
    for (const offset of REMINDER_OFFSETS) {
      const at = addDays(item.view.due, -offset)
      at.setHours(REMINDER_HOUR, 0, 0, 0)
      if (at <= now) continue
      const when = offset === 0 ? 'bugün' : offset === 1 ? 'yarın' : `${offset} gün sonra`
      plan.push({
        id: reminderId(`${account.id}:${lineIndex}:${+item.view.due}:${offset}`),
        at,
        title: `${name} son ödeme ${when}`,
        body: 'Ödemeyi yaptıysan uygulamada işaretle.',
        accountId: account.id,
        lineIndex,
      })
    }
  }
  return plan.sort((a, b) => +a.at - +b.at)
}

/** FNV-1a, folded to a positive 31-bit integer (the plugin's id type). */
export function reminderId(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) & 0x7fffffff
}
