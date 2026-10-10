import { describe, it, expect } from 'vitest'
import { lockMessage } from './lockMessage'

describe('lockMessage', () => {
  it('says nothing before an attempt or after success', () => {
    expect(lockMessage(null)).toBe('')
    expect(lockMessage('ok')).toBe('')
  })

  it('tells a closed prompt apart from a failed one', () => {
    expect(lockMessage('cancelled')).toBe('Doğrulama kapatıldı. Açmak için yeniden dokun.')
    expect(lockMessage('failed')).toBe('Face ID ile doğrulanamadı. Tekrar dene ya da iPhone şifreni kullan.')
  })
})
