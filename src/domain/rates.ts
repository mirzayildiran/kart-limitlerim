import type { IsoDate, Kurus } from './types'

/**
 * Regulatory caps used for interest and minimum-payment estimates.
 *
 * Sources (verified 2026-10-08):
 * - TCMB, "Kredi Kartı İşlemlerinde Uygulanacak Azami Faiz Oranları", row 1/10/2026.
 *   https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Bankacilik+Verileri/Kredi_Karti_Islemlerinde_Uygulanacak_Azami_Faiz_Oranlari
 *   Announced on the fifth-from-last business day of each month. The cash
 *   withdrawal column also applies to KMH (kredili mevduat hesabı).
 * - BDDK decision 11581 (1 Oct 2026): minimum payment is 20% of the statement
 *   debt for card limits up to 100.000 ₺, 40% above.
 *
 * Banks may charge less than these caps; users can override per account.
 */

export interface RateTier {
  /** Upper bound of statement debt for this tier; null = no bound. */
  upTo: Kurus | null
  /** TCMB wording: "30.000 TL altında" is exclusive, "30.000-180.000 TL arasında" inclusive. */
  inclusive: boolean
  contractual: number
  late: number
}

export interface RateTable {
  effective: IsoDate
  source: string
  /** Monthly reference rate (%), cap for restructured card debt. */
  reference: number
  cardTiers: RateTier[]
  /** Cash withdrawals and KMH. */
  cash: { contractual: number; late: number }
  foreignCurrency: { contractual: number; late: number }
}

export const RATES_2026_10: RateTable = {
  effective: '2026-10-01',
  source: 'TCMB azami kredi kartı faiz oranları',
  reference: 3.11,
  cardTiers: [
    { upTo: 3_000_000, inclusive: false, contractual: 3.25, late: 3.55 },
    { upTo: 18_000_000, inclusive: true, contractual: 3.75, late: 4.05 },
    { upTo: null, inclusive: false, contractual: 4.25, late: 4.55 },
  ],
  cash: { contractual: 4.25, late: 4.55 },
  foreignCurrency: { contractual: 2.98, late: 3.28 },
}

export const CURRENT_RATES = RATES_2026_10

/** Taxes charged on interest for consumer cards and KMH. */
export const INTEREST_TAXES = { kkdf: 0.15, bsmv: 0.15 } as const

export function cardTierFor(statementDebt: Kurus, table: RateTable = CURRENT_RATES): RateTier {
  const fits = (t: RateTier) => t.upTo === null || (t.inclusive ? statementDebt <= t.upTo : statementDebt < t.upTo)
  return table.cardTiers.find(fits) ?? table.cardTiers[table.cardTiers.length - 1]
}

export interface MinimumRule {
  effective: IsoDate
  source: string
  /** Card limit threshold (inclusive) for the lower ratio. */
  threshold: Kurus
  lowRatio: number
  highRatio: number
}

export const MINIMUM_RULE: MinimumRule = {
  effective: '2026-10-01',
  source: 'BDDK karar no. 11581',
  threshold: 10_000_000,
  lowRatio: 0.2,
  highRatio: 0.4,
}

export function minimumRatio(cardLimit: Kurus, rule: MinimumRule = MINIMUM_RULE): number {
  return cardLimit <= rule.threshold ? rule.lowRatio : rule.highRatio
}

/** Estimated minimum payment when the statement doesn't state one. */
export function estimateMinimum(statementDebt: Kurus, cardLimit: Kurus, rule: MinimumRule = MINIMUM_RULE): Kurus {
  if (statementDebt <= 0) return 0
  return Math.ceil(statementDebt * minimumRatio(cardLimit, rule))
}
