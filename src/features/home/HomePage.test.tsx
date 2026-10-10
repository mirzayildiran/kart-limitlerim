import { fireEvent, render, screen, within } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBackup } from '../../data/backup'
import { restoreOffer } from '../../data/autoBackupRuntime'
import { accounts } from '../../data/store'
import type { Account } from '../../domain/types'
import { sheet } from '../../ui/nav'
import { HomePage } from './HomePage'

const bank = { id: 'b', kind: 'bank', name: 'Örnek Banka', balance: 100_000, updatedAt: 0, createdAt: 0 } as Account

const backup = makeBackup(
  { accounts: [bank, { ...bank, id: 'b2' }], expenses: [], categories: [], recurring: [], rules: [], budgets: [] },
  new Date(2026, 9, 9, 12),
)

/** The page's actionable buttons, in reading order. */
const buttons = () => screen.getAllByRole('button').map((b) => b.textContent?.trim())

describe('HomePage first launch', () => {
  afterEach(() => {
    restoreOffer.value = null
    accounts.value = []
    sheet.value = null
  })

  it('opens with "Cüzdanını kuralım", Kart ekle as the primary action and no restore offer', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Cüzdanını kuralım' })).toBeTruthy()
    expect(screen.queryByText('Önceki verilerin bulundu')).toBeNull()
    const add = screen.getByRole('button', { name: 'Kart ekle' })
    expect(add.className).toContain('btn-primary')
    expect(screen.getByText('Verilerin yalnızca bu cihazda. Hesap yok.')).toBeTruthy()
  })

  it('opens the card sheet from Kart ekle', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Kart ekle' }))
    expect(sheet.value).toEqual({ type: 'account', kind: 'card' })
  })

  it('puts the restore offer first and makes the first-launch content secondary', () => {
    restoreOffer.value = backup
    render(<HomePage />)
    const offer = screen.getByRole('region', { name: 'Önceki verilerin bulundu' })
    const welcome = screen.getByRole('region', { name: 'Ya da baştan başla' })
    // The offer comes before the welcome section in reading order.
    expect(offer.compareDocumentPosition(welcome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(offer).getByText(/2/).textContent).toBe('2')
    const actions = buttons()
    expect(actions.indexOf('Geri yükle')).toBeLessThan(actions.indexOf('Kart ekle'))
    expect(screen.getByRole('button', { name: 'Kart ekle' }).className).toContain('btn-secondary')
    expect(screen.getByRole('button', { name: 'Örnek verilerle dene' }).className).toContain('btn-ghost')
  })

  it('"Şimdi değil" removes the offer and brings the first-launch content back', () => {
    restoreOffer.value = backup
    render(<HomePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Şimdi değil' }))
    expect(screen.queryByText('Önceki verilerin bulundu')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Cüzdanını kuralım' })).toBeTruthy()
    expect(localStorage.getItem('kl:autobackup-dismissed')).toBe(backup.exportedAt)
  })

  it('shows no first-launch content once there is an account', () => {
    accounts.value = [bank]
    render(<HomePage />)
    expect(screen.queryByRole('heading', { name: 'Cüzdanını kuralım' })).toBeNull()
  })
})
