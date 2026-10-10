import { describe, it, expect } from 'vitest'
import { barRatio, hasForecast, shownRemaining, statusLabel, statusTone, unplannedCategories } from './budgetPlanModel'
import type { Category, CategoryBudget, Kurus } from '../../domain/types'

/** Tests use invented data only. */

const cat = (id: string, overrides: Partial<Category> = {}): Category => ({
  id,
  name: `Kategori ${id}`,
  hue: 120,
  builtin: false,
  order: 0,
  ...overrides,
})

describe('statusLabel and statusTone', () => {
  it('labels each status in Turkish', () => {
    expect(statusLabel('ok')).toBe('Yolunda')
    expect(statusLabel('near')).toBe('Hedefe yakın')
    expect(statusLabel('pace')).toBe('Bu hızla aşılır')
    expect(statusLabel('over')).toBe('Aşıldı')
  })

  it('maps ok to ok, near and pace to warn, over to crit', () => {
    expect(statusTone('ok')).toBe('ok')
    expect(statusTone('near')).toBe('warn')
    expect(statusTone('pace')).toBe('warn')
    expect(statusTone('over')).toBe('crit')
  })
})

describe('barRatio', () => {
  it('is the share of the target spent', () => {
    expect(barRatio({ spent: 25_000 as Kurus, monthly: 100_000 as Kurus })).toBe(0.25)
  })

  it('caps at 1 when the target is exceeded', () => {
    expect(barRatio({ spent: 150_000 as Kurus, monthly: 100_000 as Kurus })).toBe(1)
  })

  it('is 0 when nothing is spent', () => {
    expect(barRatio({ spent: 0 as Kurus, monthly: 100_000 as Kurus })).toBe(0)
  })

  it('is 0 when the target is zero or negative', () => {
    expect(barRatio({ spent: 5_000 as Kurus, monthly: 0 as Kurus })).toBe(0)
    expect(barRatio({ spent: 5_000 as Kurus, monthly: -100 as Kurus })).toBe(0)
  })
})

describe('unplannedCategories', () => {
  it('returns active categories without a budget, in the given order', () => {
    const categories = [cat('c3', { order: 0 }), cat('c1', { order: 1 }), cat('c2', { order: 2 })]
    const budgets: CategoryBudget[] = [{ categoryId: 'c1', monthly: 100_000 as Kurus }]
    expect(unplannedCategories(categories, budgets).map((c) => c.id)).toEqual(['c3', 'c2'])
  })

  it('leaves out archived categories', () => {
    const categories = [cat('c1'), cat('c2', { archived: true })]
    expect(unplannedCategories(categories, []).map((c) => c.id)).toEqual(['c1'])
  })

  it('returns every active category when there is no plan', () => {
    const categories = [cat('c1'), cat('c2')]
    expect(unplannedCategories(categories, [])).toEqual(categories)
  })

  it('returns nothing when every category has a target', () => {
    const categories = [cat('c1')]
    const budgets: CategoryBudget[] = [{ categoryId: 'c1', monthly: 1_000 as Kurus }]
    expect(unplannedCategories(categories, budgets)).toEqual([])
  })
})

describe('hasForecast', () => {
  it('needs at least seven days into the month', () => {
    expect(hasForecast({ daysPassed: 6 })).toBe(false)
    expect(hasForecast({ daysPassed: 7 })).toBe(true)
  })
})

describe('shownRemaining', () => {
  it('subtracts the whole-lira figures the user sees', () => {
    expect(shownRemaining({ spent: 159_150, monthly: 400_000 })).toBe(240_800)
  })
  it('is negative when over the target', () => {
    expect(shownRemaining({ spent: 247_800, monthly: 150_000 })).toBe(-97_800)
  })
})
