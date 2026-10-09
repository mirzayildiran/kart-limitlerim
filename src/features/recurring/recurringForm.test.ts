import { describe, it, expect } from 'vitest'
import type { Kurus } from '../../domain/types'
import { buildRecurring, isIsoDate, parseCount, parseDay, previewLine, validateDraft, type RecurringDraft } from './recurringForm'

/** Tests use invented data only. */

const draft = (over: Partial<RecurringDraft> = {}): RecurringDraft => ({
  name: 'Test abonelik',
  amount: 19_900 as Kurus,
  accountId: 'acc_1',
  categoryId: 'abonelik',
  dayText: '12',
  startDate: '2026-10-01',
  endKind: 'never',
  untilDate: '2027-10-01',
  countText: '12',
  active: true,
  ...over,
})

const base = { id: 'rec_1', createdAt: 1, handledThrough: null }

describe('parseDay and parseCount', () => {
  it('accepts whole numbers in range only', () => {
    expect(parseDay('1')).toBe(1)
    expect(parseDay('31')).toBe(31)
    expect(parseDay('0')).toBeNull()
    expect(parseDay('32')).toBeNull()
    expect(parseDay('2,5')).toBeNull()
    expect(parseCount('12')).toBe(12)
    expect(parseCount('0')).toBeNull()
    expect(parseCount('abc')).toBeNull()
  })
})

describe('isIsoDate', () => {
  it('rejects impossible dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('26-10-01')).toBe(false)
  })
})

describe('validateDraft', () => {
  it('passes a complete draft', () => {
    expect(validateDraft(draft())).toEqual({})
  })

  it('flags missing name, amount and account', () => {
    const e = validateDraft(draft({ name: '  ', amount: null, accountId: null }))
    expect(e.name).toBeDefined()
    expect(e.amount).toBeDefined()
    expect(e.account).toBeDefined()
  })

  it('rejects a zero amount and a day outside 1–31', () => {
    expect(validateDraft(draft({ amount: 0 as Kurus })).amount).toBeDefined()
    expect(validateDraft(draft({ dayText: '40' })).day).toBeDefined()
  })

  it('requires an end date after the start for "Tarihte" and a count for "Sayıda"', () => {
    expect(validateDraft(draft({ endKind: 'until', untilDate: '2026-09-01' })).until).toBeDefined()
    expect(validateDraft(draft({ endKind: 'until', untilDate: '2026-12-01' })).until).toBeUndefined()
    expect(validateDraft(draft({ endKind: 'count', countText: '0' })).count).toBeDefined()
  })
})

describe('buildRecurring', () => {
  it('returns null while the draft is invalid', () => {
    expect(buildRecurring(draft({ name: '' }), base)).toBeNull()
  })

  it('maps the end choice and keeps the base id, creation time and handled date', () => {
    const r = buildRecurring(
      draft({ name: ' Taksit ', endKind: 'count', countText: '6', dayText: '3' }),
      { id: 'rec_9', createdAt: 42, handledThrough: '2026-09-03' },
    )
    expect(r).toMatchObject({
      id: 'rec_9',
      name: 'Taksit',
      dayOfMonth: 3,
      end: { type: 'count', count: 6 },
      createdAt: 42,
      handledThrough: '2026-09-03',
    })
  })

  it('uses "never" when the end is open', () => {
    expect(buildRecurring(draft(), base)?.end).toEqual({ type: 'never' })
  })
})

describe('previewLine', () => {
  it('shows the next charge date and the monthly amount', () => {
    const r = buildRecurring(draft({ dayText: '12' }), base)!
    expect(previewLine(r, new Date(2026, 9, 10))).toBe('Sonraki: 12 Ekim · ayda 199 ₺')
  })

  it('says so when a count-limited payment has run out', () => {
    const r = buildRecurring(draft({ endKind: 'count', countText: '1', startDate: '2026-01-05', dayText: '5' }), base)!
    expect(previewLine(r, new Date(2026, 9, 10))).toBe('Bu düzenli ödeme artık tekrarlanmıyor')
  })
})
