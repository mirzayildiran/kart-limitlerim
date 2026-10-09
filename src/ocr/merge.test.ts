import { describe, expect, it } from 'vitest'
import type { OcrWord } from './types'
import {
  countAmountWords,
  dateColumnRect,
  iou,
  mergeWords,
  needsDateColumnPass,
} from './merge'

function word(text: string, x0: number, y0: number, x1: number, y1: number): OcrWord {
  return { text, x0, y0, x1, y1, confidence: 90 }
}

describe('dateColumnRect', () => {
  it('covers the left 17% of the width and the full height', () => {
    expect(dateColumnRect(1170, 2532)).toEqual({ left: 0, top: 0, width: 199, height: 2532 })
    expect(dateColumnRect(2000, 100)).toEqual({ left: 0, top: 0, width: 340, height: 100 })
  })
})

describe('iou', () => {
  const box = { x0: 0, y0: 0, x1: 10, y1: 10 }
  it('is 1 for identical boxes', () => {
    expect(iou(box, box)).toBe(1)
  })
  it('is 0 for disjoint boxes', () => {
    expect(iou(box, { x0: 20, y0: 20, x1: 30, y1: 30 })).toBe(0)
  })
  it('computes partial overlap', () => {
    // Intersection 5x10 = 50, union 100 + 100 - 50 = 150.
    expect(iou(box, { x0: 5, y0: 0, x1: 15, y1: 10 })).toBeCloseTo(50 / 150)
  })
  it('is 0 for zero-area boxes', () => {
    expect(iou({ x0: 1, y0: 1, x1: 1, y1: 1 }, { x0: 1, y0: 1, x1: 1, y1: 1 })).toBe(0)
  })
})

describe('needsDateColumnPass', () => {
  it('counts amount-like words', () => {
    const words = [word('125,50', 0, 0, 1, 1), word('TL', 0, 0, 1, 1), word('899.00', 0, 0, 1, 1)]
    expect(countAmountWords(words)).toBe(2)
    expect(needsDateColumnPass(words)).toBe(false)
  })
  it('runs once three amounts are found', () => {
    const words = ['12,50', '7,00', '340,99'].map((t) => word(t, 0, 0, 1, 1))
    expect(needsDateColumnPass(words)).toBe(true)
  })
})

describe('mergeWords', () => {
  const primary = [word('MIGROS', 60, 60, 240, 100), word('125,50', 800, 60, 930, 100)]

  it('adds extra words that do not overlap primary words, in reading order', () => {
    const extra = [word('8', 10, 200, 40, 240), word('Eki', 10, 250, 60, 280)]
    const merged = mergeWords(primary, extra)
    expect(merged.map((w) => w.text)).toEqual(['MIGROS', '125,50', '8', 'Eki'])
  })
  it('drops extra words overlapping a primary word above IoU 0.3', () => {
    const duplicate = [word('MIGROS', 62, 62, 238, 100)]
    expect(mergeWords(primary, duplicate)).toEqual(primary)
  })
  it('ignores blank extra words', () => {
    expect(mergeWords(primary, [word('  ', 10, 200, 40, 240)])).toEqual(primary)
  })
  it('keeps primary words untouched when there is nothing to add', () => {
    expect(mergeWords(primary, [])).toEqual(primary)
  })
})
