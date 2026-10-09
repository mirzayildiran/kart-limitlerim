import { describe, it, expect } from 'vitest'
import {
  buildDrafts,
  buildExpenses,
  defaultSelected,
  dedupeKey,
  isAlreadyRecorded,
  learnRules,
  mergeAcrossImages,
  selectedRows,
  splitTxns,
  summarize,
  type DraftRow,
} from './importModel'
import type { ParsedTxn } from '../../ocr/types'
import type { Expense, IsoDate, Kurus, MerchantRule } from '../../domain/types'

/** Invented data only. */

const txn = (overrides: Partial<ParsedTxn> = {}): ParsedTxn => ({
  date: '2026-10-02' as IsoDate,
  description: 'ORNEK MARKET',
  amount: 12550 as Kurus,
  direction: 'debit',
  pending: false,
  installment: null,
  bankCategory: null,
  confidence: 0.9,
  raw: 'ORNEK MARKET 125,50',
  ...overrides,
})

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp_test1',
  amount: 12550 as Kurus,
  categoryId: 'cat_food',
  accountId: 'acc_card1',
  date: '2026-10-02' as IsoDate,
  note: 'Test',
  affectsAccount: true,
  installments: 1,
  source: 'manual',
  createdAt: 1,
  ...overrides,
})

const draft = (overrides: Partial<DraftRow> = {}): DraftRow => ({
  uid: 'row-0',
  date: '2026-10-02' as IsoDate,
  amount: 10000 as Kurus,
  description: 'DENEME LOKANTA',
  categoryId: 'cat_food',
  suggestedCategoryId: 'cat_food',
  installments: 1,
  pending: false,
  lowConfidence: false,
  duplicate: false,
  selected: true,
  ...overrides,
})

describe('mergeAcrossImages', () => {
  it('keeps a transaction shown on two overlapping screenshots once', () => {
    const a = [txn({ description: 'ALFA' }), txn({ description: 'BETA', amount: 500 as Kurus })]
    const b = [txn({ description: '  alfa ' }), txn({ description: 'GAMMA', amount: 900 as Kurus })]
    const merged = mergeAcrossImages([a, b])
    expect(merged.map((t) => t.description)).toEqual(['ALFA', 'BETA', 'GAMMA'])
  })

  it('keeps two identical purchases from one image', () => {
    const same = [txn({ description: 'KAHVE' }), txn({ description: 'KAHVE' })]
    expect(mergeAcrossImages([same])).toHaveLength(2)
  })

  it('does not double count identical purchases already seen on both images', () => {
    const img = [txn({ description: 'KAHVE' }), txn({ description: 'KAHVE' })]
    expect(mergeAcrossImages([img, img])).toHaveLength(2)
  })

  it('keeps the extra copy when the second image shows one more of the same', () => {
    const one = [txn({ description: 'KAHVE' })]
    const two = [txn({ description: 'KAHVE' }), txn({ description: 'KAHVE' })]
    expect(mergeAcrossImages([one, two])).toHaveLength(2)
  })

  it('returns nothing for no images', () => {
    expect(mergeAcrossImages([])).toEqual([])
  })
})

describe('dedupeKey', () => {
  it('ignores case and extra whitespace in the description', () => {
    expect(dedupeKey(txn({ description: 'Ornek   Market' }))).toBe(dedupeKey(txn({ description: 'ornek market' })))
  })
})

describe('isAlreadyRecorded', () => {
  const list = [expense()]
  it('matches same account, date and amount', () => {
    expect(isAlreadyRecorded(txn(), 'acc_card1', list)).toBe(true)
  })
  it('ignores other accounts, dates and amounts', () => {
    expect(isAlreadyRecorded(txn(), 'acc_card2', list)).toBe(false)
    expect(isAlreadyRecorded(txn({ date: '2026-10-03' as IsoDate }), 'acc_card1', list)).toBe(false)
    expect(isAlreadyRecorded(txn({ amount: 1 as Kurus }), 'acc_card1', list)).toBe(false)
  })
  it('never matches a row without a date', () => {
    expect(isAlreadyRecorded(txn({ date: null }), 'acc_card1', [expense({ date: '' as IsoDate })])).toBe(false)
  })
})

describe('defaultSelected', () => {
  it('selects confident debits that are not duplicates', () => {
    expect(defaultSelected(txn(), false)).toBe(true)
  })
  it('does not select credits, low confidence, duplicates or undated rows', () => {
    expect(defaultSelected(txn({ direction: 'credit' }), false)).toBe(false)
    expect(defaultSelected(txn({ confidence: 0.49 }), false)).toBe(false)
    expect(defaultSelected(txn(), true)).toBe(false)
    expect(defaultSelected(txn({ date: null }), false)).toBe(false)
  })
  it('selects a confidence of exactly 0.5', () => {
    expect(defaultSelected(txn({ confidence: 0.5 }), false)).toBe(true)
  })
})

describe('buildDrafts and splitTxns', () => {
  const txns = [
    txn({ description: 'ALFA' }),
    txn({ description: 'ODEME', direction: 'credit' }),
    txn({ description: 'DUSUK', confidence: 0.3 }),
    txn({ description: 'BEKLEYEN', pending: true, amount: 7700 as Kurus }),
    txn({ description: 'TAKSITLI', installment: { index: 1, count: 3 } }),
  ]

  it('splits debits from credits', () => {
    const { debits, credits } = splitTxns(txns)
    expect(debits).toHaveLength(4)
    expect(credits.map((t) => t.description)).toEqual(['ODEME'])
  })

  it('builds rows with defaults, flags and installments', () => {
    const { debits } = splitTxns(txns)
    const rows = buildDrafts(debits, {
      accountId: 'acc_card1',
      expenses: [expense()],
      suggest: () => 'cat_market',
    })
    const byName = Object.fromEntries(rows.map((r) => [r.description, r]))
    expect(byName['ALFA'].duplicate).toBe(true)
    expect(byName['ALFA'].selected).toBe(false)
    expect(byName['DUSUK'].lowConfidence).toBe(true)
    expect(byName['BEKLEYEN'].pending).toBe(true)
    expect(byName['BEKLEYEN'].selected).toBe(true)
    expect(byName['TAKSITLI'].installments).toBe(3)
    expect(rows.every((r) => r.categoryId === 'cat_market' && r.suggestedCategoryId === 'cat_market')).toBe(true)
    expect(new Set(rows.map((r) => r.uid)).size).toBe(rows.length)
  })
})

describe('summarize and selectedRows', () => {
  it('counts only selected rows that have a date and a positive amount', () => {
    const rows = [
      draft({ uid: 'a', amount: 10000 as Kurus }),
      draft({ uid: 'b', amount: 2550 as Kurus, selected: true }),
      draft({ uid: 'c', date: null, selected: true }),
      draft({ uid: 'd', amount: null, selected: true }),
      draft({ uid: 'e', amount: 0 as Kurus, selected: true }),
      draft({ uid: 'f', selected: false, amount: 99900 as Kurus }),
    ]
    expect(selectedRows(rows).map((r) => r.uid)).toEqual(['a', 'b'])
    expect(summarize(rows)).toEqual({ count: 2, total: 12550 })
  })
})

describe('buildExpenses', () => {
  it('builds screenshot expenses from selected rows', () => {
    let n = 0
    const rows = [
      draft({ uid: 'a', installments: 3 }),
      draft({ uid: 'b', selected: false }),
    ]
    const list = buildExpenses(rows, {
      accountId: 'acc_card9',
      affectsAccount: false,
      now: 1234,
      makeId: () => `exp_${++n}`,
    })
    expect(list).toEqual([
      {
        id: 'exp_1',
        amount: 10000,
        categoryId: 'cat_food',
        accountId: 'acc_card9',
        date: '2026-10-02',
        note: 'DENEME LOKANTA',
        affectsAccount: false,
        installments: 3,
        source: 'screenshot',
        recurringId: null,
        createdAt: 1234,
      },
    ])
  })
})

describe('learnRules', () => {
  const key = (d: string) => d.trim().toLowerCase()
  let n = 0
  const makeId = () => `rule_${++n}`

  it('creates a rule only when the category was changed from the suggestion', () => {
    const rows = [
      draft({ description: 'Kebap Evi', categoryId: 'cat_dining', suggestedCategoryId: 'cat_food' }),
      draft({ description: 'Market X', categoryId: 'cat_food', suggestedCategoryId: 'cat_food' }),
    ]
    const out = learnRules(rows, [], key, makeId)
    expect(out).toEqual([{ id: 'rule_1', pattern: 'kebap evi', categoryId: 'cat_dining', hits: 1 }])
  })

  it('updates an existing rule with the same pattern and adds a hit', () => {
    const existing: MerchantRule[] = [{ id: 'rule_old', pattern: 'kebap evi', categoryId: 'cat_food', hits: 4 }]
    const rows = [draft({ description: 'Kebap Evi', categoryId: 'cat_dining', suggestedCategoryId: 'cat_food' })]
    expect(learnRules(rows, existing, key, makeId)).toEqual([
      { id: 'rule_old', pattern: 'kebap evi', categoryId: 'cat_dining', hits: 5 },
    ])
  })

  it('skips rows whose merchant key is empty', () => {
    const rows = [draft({ description: '   ', categoryId: 'cat_dining', suggestedCategoryId: 'cat_food' })]
    expect(learnRules(rows, [], key, makeId)).toEqual([])
  })

  it('counts two changed rows with the same key as two hits', () => {
    const rows = [
      draft({ uid: 'a', description: 'Demo Cafe', categoryId: 'cat_dining', suggestedCategoryId: 'cat_food' }),
      draft({ uid: 'b', description: 'demo cafe', categoryId: 'cat_dining', suggestedCategoryId: 'cat_food' }),
    ]
    const out = learnRules(rows, [], key, makeId)
    expect(out).toHaveLength(1)
    expect(out[0].hits).toBe(2)
  })
})
