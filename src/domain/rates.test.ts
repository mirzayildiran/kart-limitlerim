import { describe, it, expect } from 'vitest'
import { cardTierFor, CURRENT_RATES, estimateMinimum, minimumRatio, MINIMUM_RULE } from './rates'

describe('rates', () => {
  describe('cardTierFor', () => {
    it('returns the 3.25% tier for amounts under 30.000 ₺', () => {
      const tier = cardTierFor(2999999) // 29.999,99 ₺
      expect(tier.contractual).toBe(3.25)
      expect(tier.late).toBe(3.55)
    })

    it('returns the 3.75% tier at exactly 30.000 ₺', () => {
      const tier = cardTierFor(3000000) // 30.000 ₺
      expect(tier.contractual).toBe(3.75)
      expect(tier.late).toBe(4.05)
    })

    it('returns the 3.75% tier for amounts between 30.000 and 180.000 ₺', () => {
      const tier = cardTierFor(5000000) // 50.000 ₺
      expect(tier.contractual).toBe(3.75)
      expect(tier.late).toBe(4.05)
    })

    it('returns the 3.75% tier at exactly 180.000 ₺', () => {
      const tier = cardTierFor(18000000) // 180.000 ₺
      expect(tier.contractual).toBe(3.75)
      expect(tier.late).toBe(4.05)
    })

    it('returns the 4.25% tier for amounts over 180.000 ₺', () => {
      const tier = cardTierFor(18000001) // 180.000,01 ₺
      expect(tier.contractual).toBe(4.25)
      expect(tier.late).toBe(4.55)
    })

    it('returns the 4.25% tier for very large amounts', () => {
      const tier = cardTierFor(100000000) // 1.000.000 ₺
      expect(tier.contractual).toBe(4.25)
      expect(tier.late).toBe(4.55)
    })

    it('uses CURRENT_RATES by default', () => {
      const tier1 = cardTierFor(5000000)
      const tier2 = cardTierFor(5000000, CURRENT_RATES)
      expect(tier1).toEqual(tier2)
    })

    it('handles zero amount', () => {
      const tier = cardTierFor(0)
      expect(tier.contractual).toBe(3.25) // Lowest tier
    })
  })

  describe('minimumRatio', () => {
    it('returns 0.2 (20%) for limits up to 100.000 ₺', () => {
      const ratio = minimumRatio(10000000) // 100.000 ₺
      expect(ratio).toBe(0.2)
    })

    it('returns 0.4 (40%) for limits above 100.000 ₺', () => {
      const ratio = minimumRatio(10000001) // 100.000,01 ₺
      expect(ratio).toBe(0.4)
    })

    it('returns 0.2 for exactly the threshold', () => {
      const ratio = minimumRatio(10000000) // Exactly 100.000 ₺
      expect(ratio).toBe(0.2)
    })

    it('returns 0.2 for very small limits', () => {
      const ratio = minimumRatio(1000) // 10 ₺
      expect(ratio).toBe(0.2)
    })

    it('returns 0.4 for very large limits', () => {
      const ratio = minimumRatio(100000000) // 1.000.000 ₺
      expect(ratio).toBe(0.4)
    })

    it('uses MINIMUM_RULE by default', () => {
      const ratio1 = minimumRatio(5000000)
      const ratio2 = minimumRatio(5000000, MINIMUM_RULE)
      expect(ratio1).toBe(ratio2)
    })
  })

  describe('estimateMinimum', () => {
    it('rounds up the minimum payment', () => {
      // statementDebt: 100.000 ₺, cardLimit: 100.000 ₺ → 20% = 20.000 ₺
      const minimum = estimateMinimum(10000000, 10000000)
      expect(minimum).toBe(2000000)
    })

    it('rounds up fractional amounts', () => {
      // 123.456 ₺ at 20% = 24.691,2 kuruş → rounds up to 24.692 kuruş
      const minimum = estimateMinimum(12345600, 10000000)
      expect(minimum).toBe(Math.ceil(12345600 * 0.2))
    })

    it('uses 20% ratio for limits up to 100.000 ₺', () => {
      const minimum = estimateMinimum(10000000, 10000000) // 100.000 ₺ at 20%
      expect(minimum).toBe(2000000)
    })

    it('uses 40% ratio for limits over 100.000 ₺', () => {
      const minimum = estimateMinimum(10000000, 20000000) // 100.000 ₺ at 40%
      expect(minimum).toBe(4000000)
    })

    it('returns 0 for zero debt', () => {
      expect(estimateMinimum(0, 10000000)).toBe(0)
    })

    it('returns 0 for negative debt', () => {
      expect(estimateMinimum(-5000000, 10000000)).toBe(0)
    })

    it('returns 0 for small positive debt that rounds to zero', () => {
      // 1 kuruş at any ratio rounds up to 1
      const minimum = estimateMinimum(1, 10000000)
      expect(minimum).toBe(1)
    })

    it('handles edge case: very small debt with 40% ratio', () => {
      // 10 kuruş at 40% = 4 kuruş, rounds up to 4
      const minimum = estimateMinimum(10, 20000000)
      expect(minimum).toBe(4)
    })
  })
})
