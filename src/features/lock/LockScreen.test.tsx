import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const biometric = vi.hoisted(() => ({
  isAvailable: vi.fn(async () => ({ isAvailable: true })),
  verifyIdentity: vi.fn(async () => {}),
}))
vi.mock('@capgo/capacitor-native-biometric', () => ({ NativeBiometric: biometric }))

const { LockScreen } = await import('./LockScreen')
const { locked, unlockResult } = await import('../../platform/lock')

function showLocked() {
  locked.value = true
  unlockResult.value = null
  render(<LockScreen />)
  return screen.getByRole('button', { name: /Face ID ile aç/ })
}

describe('LockScreen', () => {
  beforeEach(() => {
    biometric.isAvailable.mockResolvedValue({ isAvailable: true })
    biometric.verifyIdentity.mockReset()
  })

  it('covers the app as a dialog, makes #app inert and focuses the unlock button', () => {
    const button = showLocked()
    expect(screen.getByRole('dialog', { name: 'Kart Limitlerim' })).toBeTruthy()
    expect(document.getElementById('app')!.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(button)
    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it('opens on ok and releases the app', async () => {
    biometric.verifyIdentity.mockResolvedValue(undefined)
    fireEvent.click(showLocked())
    await waitFor(() => expect(locked.value).toBe(false))
    expect(unlockResult.value).toBe('ok')
    await waitFor(() => expect(document.getElementById('app')!.hasAttribute('inert')).toBe(false))
  })

  it('says the prompt was closed on cancelled', async () => {
    biometric.verifyIdentity.mockRejectedValue({ code: '16' })
    fireEvent.click(showLocked())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Doğrulama kapatıldı. Açmak için yeniden dokun.'))
    expect(locked.value).toBe(true)
  })

  it('says Face ID did not match on failed', async () => {
    biometric.verifyIdentity.mockRejectedValue({ code: '10' })
    fireEvent.click(showLocked())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Face ID ile doğrulanamadı. Tekrar dene ya da iPhone şifreni kullan.'),
    )
    expect(locked.value).toBe(true)
  })

  it('shows a busy state while verifying and clears the old message', async () => {
    let finish = () => {}
    biometric.verifyIdentity.mockRejectedValueOnce({ code: '10' })
    const button = showLocked()
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''))
    biometric.verifyIdentity.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
    fireEvent.click(button)
    await waitFor(() => expect(button.textContent).toContain('Doğrulanıyor'))
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('')
    await waitFor(() => expect(biometric.verifyIdentity).toHaveBeenCalledTimes(2))
    await act(async () => finish())
    await waitFor(() => expect(locked.value).toBe(false))
  })
})
