import { LIMITS } from '../../ai/protocol'
import type { InsightSeverity } from '../../domain/insightsTypes'

/** Pure helpers for the assistant screens. */

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
  { name: 'Groq', note: 'Ücretsiz katman; açık ağırlıklı gpt-oss modelini çalıştırır.' },
  { name: 'OpenRouter', note: 'İsteği ücretsiz bir açık modele iletir.' },
]

/** A message can be sent when it is not blank, fits the limit, and no reply is pending. */
export function canSend(text: string, busy: boolean): boolean {
  if (busy) return false
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= LIMITS.maxMessageChars
}
