import { describe, it, expect } from 'vitest'
import { statementItems } from '../../domain/power'
import type { Account, CardAccount, BalanceAccount, Kurus, RecurringPayment } from '../../domain/types'
import {
  buildTimeline,
  dayLabel,
  dayOfMonthLabel,
  groupByDay,
  monthlyRecurringTotal,
  pendingOccurrences,
} from './calendarModel'

/** Tests use invented data only. "Today" is 10 Oct 2026 (a Saturday). */
const TODAY = new Date(2026, 9, 10)

const card: CardAccount = {
  id: 'card_a',
  kind: 'card',
  name: 'Örnek Bank',
  limit: 1_000_000 as Kurus,
  available: 500_000 as Kurus,
  updatedAt: 0,
  createdAt: 0,
  lines: [
    {
      id: 'l1',
      label: 'Ana',
      cutDay: 15,
      dueOffsetDays: 10,
      cycle: '2026-09',
      statementDebt: 300_000 as Kurus,
      minimumDue: 30_000 as Kurus,
      dueDate: '2026-10-20',
      payment: 'unpaid',
    },
    {
      id: 'l2',
      label: 'Sanal',
      cutDay: 25,
      dueOffsetDays: 10,
      cycle: '2026-09',
      payment: 'full',
    },
  ],
}

const demoCard: CardAccount = {
  id: 'card_b',
  kind: 'card',
  name: 'Demo Kart',
  limit: 200_000 as Kurus,
  available: 200_000 as Kurus,
  updatedAt: 0,
  createdAt: 0,
  lines: [{ id: 'd1', label: 'Tek', cutDay: 3, dueOffsetDays: 10, cycle: null, payment: 'unpaid' }],
}

const bank: BalanceAccount = {
  id: 'bank_1',
  kind: 'bank',
  name: 'Test Banka',
  balance: 5_000_000 as Kurus,
  updatedAt: 0,
  createdAt: 0,
}

const accounts: Account[] = [card, demoCard, bank]

const rec = (over: Partial<RecurringPayment>): RecurringPayment => ({
  id: 'rec_x',
  name: 'Test',
  amount: 10_000 as Kurus,
  categoryId: 'diger',
  accountId: 'bank_1',
  dayOfMonth: 1,
  startDate: '2026-01-01',
  end: { type: 'never' },
  active: true,
  handledThrough: null,
  createdAt: 0,
  ...over,
})

const kira = rec({ id: 'rec_kira', name: 'Kira', amount: 2_500_000 as Kurus, dayOfMonth: 5, startDate: '2026-01-05', handledThrough: '2026-09-05' })
const netflix = rec({ id: 'rec_net', name: 'Netflix', amount: 19_900 as Kurus, accountId: 'card_a', dayOfMonth: 12, startDate: '2026-06-01' })
const taksit = rec({ id: 'rec_tak', name: 'Telefon taksit', amount: 50_000 as Kurus, dayOfMonth: 1, startDate: '2026-08-01', end: { type: 'count', count: 3 } })
const pasif = rec({ id: 'rec_pas', name: 'Pasif abonelik', amount: 99_900 as Kurus, dayOfMonth: 20, startDate: '2026-01-20', active: false })
const recurring = [kira, netflix, taksit, pasif]

describe('pendingOccurrences', () => {
  const pending = pendingOccurrences(recurring, TODAY)

  it('lists due, unhandled charges oldest first', () => {
    expect(pending.map((p) => `${p.name}:${p.iso}`)).toEqual([
      'Netflix:2026-06-12',
      'Netflix:2026-07-12',
      'Telefon taksit:2026-08-01',
      'Netflix:2026-08-12',
      'Telefon taksit:2026-09-01',
      'Netflix:2026-09-12',
      'Telefon taksit:2026-10-01',
      'Kira:2026-10-05',
    ])
  })

  it('never includes inactive payments', () => {
    expect(pending.some((p) => p.name === 'Pasif abonelik')).toBe(false)
  })

  it('skips occurrences up to handledThrough', () => {
    const net = pendingOccurrences([{ ...netflix, handledThrough: '2026-08-12' }], TODAY)
    expect(net.map((p) => p.iso)).toEqual(['2026-09-12'])
  })

  it('does not list a charge that is still in the future', () => {
    const future = pendingOccurrences([rec({ dayOfMonth: 20, startDate: '2026-11-01' })], TODAY)
    expect(future).toEqual([])
  })

  it('counts a count-limited payment from its start, not from the handled date', () => {
    const tak = pendingOccurrences([{ ...taksit, handledThrough: '2026-08-01' }], TODAY)
    expect(tak.map((p) => p.iso)).toEqual(['2026-09-01', '2026-10-01'])
  })
})

describe('monthlyRecurringTotal', () => {
  it('sums only active payments', () => {
    expect(monthlyRecurringTotal(recurring)).toBe(2_500_000 + 19_900 + 50_000)
  })
})

describe('buildTimeline', () => {
  const statements = statementItems(accounts, TODAY)
  const timeline = buildTimeline(accounts, statements, recurring, TODAY)

  it('is sorted by date', () => {
    const isos = timeline.map((e) => e.iso)
    expect(isos).toEqual([...isos].sort())
  })

  it('shows the next cut of every card line, labelled when the card has several lines', () => {
    const cuts = timeline.filter((e) => e.kind === 'cut').map((e) => `${e.iso} ${e.title}`)
    expect(cuts).toContain('2026-10-15 Örnek Bank Ana kesim')
    expect(cuts).toContain('2026-10-25 Örnek Bank Sanal kesim')
    expect(cuts).toContain('2026-11-03 Demo Kart kesim')
  })

  it('shows unpaid statement due dates with the minimum, and paid ones not at all', () => {
    const due = timeline.find((e) => e.kind === 'due' && e.title === 'Örnek Bank Ana son ödeme')
    expect(due?.iso).toBe('2026-10-20')
    expect(due?.detail).toBe('Asgari 300 ₺')
    expect(timeline.some((e) => e.kind === 'due' && e.title.startsWith('Örnek Bank Sanal'))).toBe(false)
  })

  it('says the amount is pending when the minimum is not known and flags dues within 3 days', () => {
    const due = timeline.find((e) => e.kind === 'due' && e.title === 'Demo Kart son ödeme')
    expect(due?.iso).toBe('2026-10-13')
    expect(due?.detail).toBe('tutar bekleniyor')
    expect(due?.soon).toBe(true)
  })

  it('lists recurring charges with account name and amount, skipping paused and finished ones', () => {
    const net = timeline.find((e) => e.kind === 'recurring' && e.title.startsWith('Netflix'))
    expect(net).toMatchObject({ iso: '2026-10-12', title: 'Netflix · Örnek Bank', amount: 19_900, target: { type: 'recurring', id: 'rec_net' } })
    expect(timeline.some((e) => e.title.startsWith('Pasif'))).toBe(false)
    expect(timeline.some((e) => e.title.startsWith('Telefon'))).toBe(false)
  })

  it('stays within the window, counting today', () => {
    const short = buildTimeline(accounts, statements, recurring, TODAY, 5)
    expect(short.map((e) => e.iso)).toEqual(['2026-10-12', '2026-10-13', '2026-10-15'])
  })

  it('points statement events at their line', () => {
    const cut = timeline.find((e) => e.title === 'Örnek Bank Ana kesim')
    expect(cut?.target).toEqual({ type: 'statement', accountId: 'card_a', lineIndex: 0 })
  })
})

describe('dayLabel and groupByDay', () => {
  it('names today and tomorrow', () => {
    expect(dayLabel(new Date(2026, 9, 10), TODAY)).toBe('Bugün')
    expect(dayLabel(new Date(2026, 9, 11), TODAY)).toBe('Yarın')
  })

  it('writes other days as date and capitalised weekday', () => {
    expect(dayLabel(new Date(2026, 9, 12), TODAY)).toBe('12 Ekim, Pazartesi')
  })

  it('groups events by day in order', () => {
    const events = buildTimeline(accounts, statementItems(accounts, TODAY), recurring, TODAY, 5)
    const days = groupByDay(events, TODAY)
    expect(days.map((d) => d.iso)).toEqual(['2026-10-12', '2026-10-13', '2026-10-15'])
    expect(days[0].label).toBe('12 Ekim, Pazartesi')
    expect(days.every((d) => d.events.every((e) => e.iso === d.iso))).toBe(true)
  })
})

describe('dayOfMonthLabel', () => {
  it('avoids a Turkish suffix on the day number', () => {
    expect(dayOfMonthLabel(5)).toBe('Ayın 5. günü')
  })
})
