import { describe, it, expect } from 'vitest'
import {
  estimatedDueDate,
  lastCut,
  nextCut,
  rollToCurrentCycle,
  viewStatement,
} from './statement'
import type { CardLine } from './types'

describe('statement', () => {
  describe('lastCut', () => {
    it('returns the cut day of this month when today is on or after cut day', () => {
      const today = new Date(2026, 9, 26) // October 26
      const result = lastCut(26, today)
      expect(result).toEqual(new Date(2026, 9, 26))
    })

    it('returns the cut day of previous month when today is before cut day', () => {
      const today = new Date(2026, 9, 25) // October 25
      const result = lastCut(26, today)
      expect(result).toEqual(new Date(2026, 8, 26)) // September 26
    })

    it('clamps cut day 31 in 30-day month (April)', () => {
      const today = new Date(2026, 3, 20) // April 20
      const result = lastCut(31, today)
      expect(result).toEqual(new Date(2026, 2, 31)) // March 31
    })

    it('clamps cut day 31 in February', () => {
      const today = new Date(2026, 1, 15) // February 15 (non-leap year)
      const result = lastCut(31, today)
      expect(result).toEqual(new Date(2026, 0, 31)) // January 31
    })

    it('handles January → previous December', () => {
      const today = new Date(2026, 0, 20) // January 20
      const result = lastCut(26, today)
      expect(result).toEqual(new Date(2025, 11, 26)) // December 26, 2025
    })
  })

  describe('nextCut', () => {
    it('returns the next cut after today', () => {
      const today = new Date(2026, 9, 26) // October 26 (cut day)
      const result = nextCut(26, today)
      expect(result).toEqual(new Date(2026, 10, 26)) // November 26
    })

    it('clamps cut day 31 in 30-day month', () => {
      const today = new Date(2026, 3, 15) // April 15
      const result = nextCut(31, today)
      expect(result).toEqual(new Date(2026, 3, 30)) // April 30 (31 clamped to 30)
    })
  })

  describe('estimatedDueDate', () => {
    it('adds offset days to cut date', () => {
      const cut = new Date(2026, 9, 26)
      const result = estimatedDueDate(cut, 10)
      expect(result).toEqual(new Date(2026, 10, 5))
    })

    it('adds offset days and moves to next business day if needed', () => {
      const cut = new Date(2026, 9, 23) // October 23
      const result = estimatedDueDate(cut, 3)
      // Oct 23 + 3 = Oct 26 (Sunday), nextBusinessDay = Oct 26
      expect(result).toEqual(new Date(2026, 9, 26))
    })

    it('handles offset that lands on weekend', () => {
      const cut = new Date(2026, 9, 24) // October 24
      const result = estimatedDueDate(cut, 1)
      // Oct 24 + 1 = Oct 25, nextBusinessDay moves to Monday if needed
      expect(result).toEqual(new Date(2026, 9, 26))
    })
  })

  describe('viewStatement', () => {
    const today = new Date(2026, 9, 20) // October 20

    it('marks statement as current when cycle matches lastCut', () => {
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-09', // Sep 26 is the last cut from Oct 20's perspective
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      // Oct 20: last cut was Sep 26 (cycle 2026-09), so this matches
      expect(result.current).toBe(true)
    })

    it('marks statement as current on cut day itself', () => {
      const today = new Date(2026, 9, 26) // Oct 26 (cut day)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10', // Current cycle
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.current).toBe(true)
    })

    it('resets stale cycle to unpaid with null amounts', () => {
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-08', // Old cycle
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'full',
      }
      const result = viewStatement(line, today)
      expect(result.current).toBe(false)
      expect(result.payment).toBe('unpaid')
      expect(result.statementDebt).toBeNull()
      expect(result.minimumDue).toBeNull()
    })

    it('uses exact dueDate only when cycle is current', () => {
      const lineStale: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-08',
        dueDate: '2026-09-15',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(lineStale, today)
      // Should use estimated, not exact
      expect(result.dueIsExact).toBe(false)
    })

    it('uses exact dueDate when cycle is current', () => {
      const today = new Date(2026, 9, 26)
      const lineCurrent: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        dueDate: '2026-11-05',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(lineCurrent, today)
      expect(result.dueIsExact).toBe(true)
      expect(result.due).toEqual(new Date(2026, 10, 5))
    })

    it('sets status to paid when payment is minimum or full', () => {
      const today = new Date(2026, 9, 26)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'minimum',
        paidAmount: 25000,
      }
      const result = viewStatement(line, today)
      expect(result.status).toBe('paid')
    })

    it('sets status to overdue when daysLeft < 0', () => {
      const today = new Date(2026, 10, 10) // Nov 10
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        dueDate: '2026-11-05', // Past due
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.status).toBe('overdue')
    })

    it('sets status to today when daysLeft === 0', () => {
      const today = new Date(2026, 10, 5) // Nov 5
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        dueDate: '2026-11-05',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.status).toBe('today')
    })

    it('sets status to soon when 0 < daysLeft <= SOON_DAYS', () => {
      const today = new Date(2026, 10, 4) // Nov 4, 1 day before due
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        dueDate: '2026-11-05',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.status).toBe('soon')
    })

    it('sets status to upcoming when daysLeft > SOON_DAYS', () => {
      const today = new Date(2026, 9, 26)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        dueDate: '2026-11-10',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.status).toBe('upcoming')
    })

    it('includes cutToday flag', () => {
      const today = new Date(2026, 9, 26)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'unpaid',
      }
      const result = viewStatement(line, today)
      expect(result.cutToday).toBe(true)
    })

    it('excludes paidAmount when cycle is stale', () => {
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-08',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'full',
        paidAmount: 123456,
      }
      const result = viewStatement(line, today)
      expect(result.paidAmount).toBeNull()
    })
  })

  describe('rollToCurrentCycle', () => {
    it('returns the same line when already on current cycle', () => {
      const today = new Date(2026, 9, 26)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-10',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'full',
      }
      const result = rollToCurrentCycle(line, today)
      expect(result).toBe(line) // Same reference
    })

    it('updates cycle and clears stale fields when on different cycle', () => {
      const today = new Date(2026, 9, 26) // Oct 26 (cut day)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-08', // Old cycle
        statementDebt: 123456,
        minimumDue: 25000,
        dueDate: '2026-09-15',
        payment: 'full',
        paidAmount: 50000,
      }
      const result = rollToCurrentCycle(line, today)
      expect(result).not.toBe(line) // New object
      expect(result.cycle).toBe('2026-10') // Updated to current cycle (Oct 26)
      expect(result.statementDebt).toBeNull()
      expect(result.minimumDue).toBeNull()
      expect(result.dueDate).toBeNull()
      expect(result.payment).toBe('unpaid')
      expect(result.paidAmount).toBeNull()
    })

    it('keeps id, label, cutDay, dueOffsetDays unchanged', () => {
      const today = new Date(2026, 9, 26)
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-08',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'full',
      }
      const result = rollToCurrentCycle(line, today)
      expect(result.id).toBe('card1')
      expect(result.label).toBe('My Card')
      expect(result.cutDay).toBe(26)
      expect(result.dueOffsetDays).toBe(10)
    })

    it('handles day 31 clamping in month with fewer days', () => {
      const today = new Date(2026, 3, 15) // April 15
      const line: CardLine = {
        id: 'card1',
        label: 'My Card',
        cutDay: 31,
        dueOffsetDays: 10,
        cycle: '2026-02',
        statementDebt: 123456,
        minimumDue: 25000,
        payment: 'full',
      }
      const result = rollToCurrentCycle(line, today)
      expect(result.cycle).toBe('2026-03')
    })
  })
})
