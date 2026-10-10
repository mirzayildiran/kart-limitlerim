import { fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, Category, Expense } from '../../domain/types'

const saveExpense = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../../data/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/store')>()),
  saveExpense,
}))

const { accounts, categories, today } = await import('../../data/store')
const { sheet, sheetClosing } = await import('../../ui/nav')
const { ExpenseSheet } = await import('./ExpenseSheet')

const card: Account = {
  id: 'acc-kart',
  kind: 'card',
  name: 'Örnek Kart',
  limit: 5_000_000,
  available: 4_000_000,
  lines: [{ id: 'l', label: 'Kart', cutDay: 5, dueOffsetDays: 10, cycle: null, payment: 'unpaid' }],
  updatedAt: 0,
  createdAt: 0,
}
const market: Category = { id: 'market', name: 'Market', hue: 120, builtin: true, order: 0 }

function open() {
  render(<ExpenseSheet request={{ type: 'expense' }} />, { container: document.getElementById('app')! })
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent)

describe('ExpenseSheet validation', () => {
  beforeEach(() => {
    accounts.value = [card]
    categories.value = [market]
    today.value = new Date(2026, 9, 10)
    sheet.value = { type: 'expense' }
  })
  afterEach(() => {
    accounts.value = []
    categories.value = []
    saveExpense.mockClear()
  })

  it('shows no errors before the first save', () => {
    open()
    expect(screen.queryByText('Tutarı yaz, örneğin 250.')).toBeNull()
    expect(screen.queryByText('Bir kategori seç.')).toBeNull()
  })

  it('asks for an amount and a category, and saves nothing', () => {
    open()
    save()
    expect(screen.getByText('Tutarı yaz, örneğin 250.')).toBeTruthy()
    expect(screen.getByText('Bir kategori seç.')).toBeTruthy()
    expect(saveExpense).not.toHaveBeenCalled()
  })

  it('refuses a zero amount', () => {
    open()
    fireEvent.input(screen.getByRole('textbox', { name: 'Tutar' }), { target: { value: '0' } })
    save()
    expect(screen.getByText('Tutar sıfırdan büyük olmalı.')).toBeTruthy()
    expect(saveExpense).not.toHaveBeenCalled()
  })

  it('asks to add an account when there is none', () => {
    accounts.value = []
    open()
    save()
    expect(alerts()).toContain('Önce bir kart ya da hesap ekle.')
    expect(saveExpense).not.toHaveBeenCalled()
  })

  it('saves a valid expense on the preselected card for today', async () => {
    open()
    fireEvent.input(screen.getByRole('textbox', { name: 'Tutar' }), { target: { value: '1.250,50' } })
    fireEvent.click(screen.getByRole('radio', { name: /Market/ }))
    save()
    await vi.waitFor(() => expect(saveExpense).toHaveBeenCalledTimes(1))
    const [old, saved] = saveExpense.mock.calls[0] as unknown as [Expense | null, Expense]
    expect(old).toBeNull()
    expect(saved).toMatchObject({ amount: 125_050, categoryId: 'market', accountId: 'acc-kart', date: '2026-10-10', installments: 1, affectsAccount: true })
    // The sheet starts its exit (or closes at once with reduced motion).
    await vi.waitFor(() => expect(sheet.value === null || sheetClosing.value).toBe(true))
  })
})
