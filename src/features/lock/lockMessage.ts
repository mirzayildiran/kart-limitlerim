import type { UnlockResult } from '../../platform/lock'

/** What the lock screen says after an unlock attempt; empty when there is nothing to say. */
export function lockMessage(result: UnlockResult | null): string {
  switch (result) {
    case 'cancelled':
      return 'Doğrulama kapatıldı. Açmak için yeniden dokun.'
    case 'failed':
      return 'Face ID ile doğrulanamadı. Tekrar dene ya da iPhone şifreni kullan.'
    default:
      return ''
  }
}
