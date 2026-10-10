import { LIMITS } from '../../ai/protocol'
import type { IconName } from '../../ui/components/Icon'
import type { InsightInput, InsightKind, InsightSeverity } from '../../domain/insightsTypes'

/** Pure helpers for the assistant screens. */

/**
 * The budget picture the assistant reads. Özet and the assistant page both build
 * their suggestions from the same input, so both call this with the store's signals.
 */
export function assistantInput(src: InsightInput): InsightInput {
  return {
    accounts: src.accounts,
    expenses: src.expenses,
    categories: src.categories,
    recurring: src.recurring,
    budgets: src.budgets,
    today: src.today,
  }
}

/** Drawn icon for the kind of suggestion: due and limit alerts, card interest, KMH, spending pace. */
export function insightIcon(kind: InsightKind): IconName {
  switch (kind) {
    case 'statementDue':
    case 'cardNearLimit':
    case 'cashShortfall':
      return 'alert'
    case 'minimumInterest':
      return 'card'
    case 'kmhInterest':
      return 'bank'
    case 'budgetOver':
    case 'budgetPace':
    case 'monthPace':
    case 'categoryIncrease':
      return 'wallet'
    default:
      return 'info'
  }
}

export const QUICK_PROMPTS: string[] = [
  'Bu ay nasıl gidiyorum?',
  'Bütçe planıma uyuyor muyum?',
  'Kesime kadar neye dikkat etmeliyim?',
  'Asgari ödersem ne olur?',
  'Bugün hangi kartla ödemeliyim?',
]

export const DISCLAIMER = 'Tahmindir, finansal tavsiye değildir.'

export function severityTone(s: InsightSeverity): 'crit' | 'warn' | 'accent' {
  if (s === 'crit') return 'crit'
  if (s === 'warn') return 'warn'
  return 'accent'
}

export function severityLabel(s: InsightSeverity): string {
  if (s === 'crit') return 'Acil'
  if (s === 'warn') return 'Dikkat'
  return 'Öneri'
}

/** Services that may receive the chat. Shown on the consent screen. */
export const PROVIDERS: { name: string; note: string }[] = [
  { name: 'Google Gemini', note: 'Ücretsiz katman; gönderilen metni ürün geliştirmek için kullanabilir.' },
  { name: 'Groq', note: 'Ücretsiz katman; açık kaynak Llama modelini çalıştırır.' },
  { name: 'OpenRouter', note: 'İsteği ücretsiz bir açık modele iletir.' },
]

/** A message can be sent when it is not blank, fits the limit, and no reply is pending. */
export function canSend(text: string, busy: boolean): boolean {
  if (busy) return false
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= LIMITS.maxMessageChars
}
