import { dailyInterestCost, lifetimeInterest, projectedInterest } from '../../domain/interest'
import { viewStatement } from '../../domain/statement'
import type { CardAccount, KmhAccount, Kurus } from '../../domain/types'
import { formatShort } from '../../domain/dates'
import { CURRENT_RATES } from '../../domain/rates'

export interface InterestPanelData {
  totalInterest: Kurus
  historyCycles: number
  currentProjected: Kurus | null
  dailyCosts: { lineIndex: number; cost: Kurus }[]
  lineProjections: {
    lineIndex: number
    label: string
    projectedAsEntered: Kurus
    projectedMinimum: Kurus | null
    payment: string
  }[]
}

export interface HistoryItem {
  cycle: string
  amount: Kurus
  source: 'estimate' | 'statement'
}

/**
 * Derive the interest panel data for a card account.
 * Returns null if there's no interest to display.
 */
export function cardInterestPanelData(account: CardAccount, today: Date): InterestPanelData | null {
  const lifetime = lifetimeInterest(account, today)

  // Collect daily costs per line
  const dailyCosts: { lineIndex: number; cost: Kurus }[] = []
  for (let i = 0; i < account.lines.length; i++) {
    const cost = dailyInterestCost(account, i, today)
    if (cost !== null) {
      dailyCosts.push({ lineIndex: i, cost })
    }
  }

  // Collect projections per line with debt, excluding paid-in-full
  const lineProjections: InterestPanelData['lineProjections'] = []
  for (let i = 0; i < account.lines.length; i++) {
    const line = account.lines[i]
    const view = viewStatement(line, today)
    const projAsEntered = projectedInterest(account, i, today, 'asEntered')
    if (projAsEntered !== null && projAsEntered.total > 0 && view.payment !== 'full') {
      const projMinimum = projectedInterest(account, i, today, 'minimum')
      lineProjections.push({
        lineIndex: i,
        label: line.label,
        projectedAsEntered: projAsEntered.total,
        projectedMinimum: projMinimum?.total ?? null,
        payment: view.payment,
      })
    }
  }

  return {
    totalInterest: lifetime.total,
    historyCycles: lifetime.cycles,
    currentProjected: lifetime.currentProjected,
    dailyCosts,
    lineProjections,
  }
}

/**
 * Collect all interest history records from all lines, newest first.
 * Limits to max 12 records, with a note about older ones if more exist.
 */
export function interestHistory(account: CardAccount): { records: HistoryItem[]; older: number } {
  const all: HistoryItem[] = []
  for (const line of account.lines) {
    const history = line.interestHistory ?? []
    for (const record of history) {
      all.push({ cycle: record.cycle, amount: record.amount, source: record.source })
    }
  }

  // Sort newest first (cycles are YYYY-MM strings, so string sort works)
  all.sort((a, b) => b.cycle.localeCompare(a.cycle))

  const shown = all.slice(0, 12)
  const older = Math.max(0, all.length - 12)

  return { records: shown, older }
}

/**
 * KMH daily interest calculation.
 * Daily cost = used × contractualRate / 100 / 30 × 1.30 (with taxes)
 */
export function kmhDailyCost(account: Pick<KmhAccount, 'limit' | 'available' | 'rateOverride'>): Kurus | null {
  const used = account.limit - account.available
  if (used <= 0) return null

  const rate = account.rateOverride?.contractual ?? CURRENT_RATES.cash.contractual
  const daily = Math.round((used * rate) / 100 / 30 * 1.3)
  return daily
}

export type StatementRowData = {
  lineIndex: number
  label: string
  cutShort: string
  dueShort: string
  dueIsExact: boolean
  debt: Kurus | null
  status: 'paid' | 'overdue' | 'today' | 'soon' | 'upcoming'
  statusLabel: string
}

/**
 * Derive statement row data from lines using viewStatement for current state.
 * Status labels and color tones match the home screen.
 */
export function statementRows(account: CardAccount, today: Date): StatementRowData[] {
  return account.lines.map((line, lineIndex) => {
    const view = viewStatement(line, today)
    let statusLabel: string
    let status: 'paid' | 'overdue' | 'today' | 'soon' | 'upcoming'

    if (view.status === 'paid') {
      status = 'paid'
      statusLabel = 'Ödendi'
    } else if (view.status === 'overdue') {
      status = 'overdue'
      statusLabel = `${-view.daysLeft} gün geçti`
    } else if (view.status === 'today') {
      status = 'today'
      statusLabel = 'Bugün son gün'
    } else if (view.status === 'soon') {
      status = 'soon'
      statusLabel = `${view.daysLeft} gün kaldı`
    } else {
      status = 'upcoming'
      statusLabel = `${view.daysLeft} gün kaldı`
    }

    return {
      lineIndex,
      label: line.label,
      cutShort: formatShort(view.cut),
      dueShort: formatShort(view.due),
      dueIsExact: view.dueIsExact,
      debt: view.statementDebt,
      status,
      statusLabel,
    }
  })
}

/**
 * The line under the interest figure, saying what the figure is made of.
 * No history and no running estimate → "Henüz faiz kaydı yok".
 */
export function interestSourceLine(historyCycles: number, hasCurrentEstimate: boolean): string {
  if (historyCycles > 0 && hasCurrentEstimate) return `Geçmiş ${historyCycles} ekstre + bu ekstrenin tahmini`
  if (historyCycles > 0) return `Geçmiş ${historyCycles} ekstre`
  if (hasCurrentEstimate) return 'Bu ekstrenin tahmini'
  return 'Henüz faiz kaydı yok'
}

/** A monthly rate as Turkish text: 4.25 → "%4,25". */
export function formatRate(rate: number): string {
  return `%${rate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
}

/**
 * Where the rate behind an interest estimate comes from. `override` is the user's own
 * monthly contractual rate; otherwise the TCMB ceiling in force (`effective` date) is used.
 */
export function rateCaption(opts: { override: number | null; contractual: number; effective: string; cash?: boolean }): string {
  const tail = 'KKDF ve BSMV dahil. Tahmindir; kesin tutar ekstrendedir.'
  if (opts.override !== null) return `Oran: senin girdiğin aylık ${formatRate(opts.override)} akdi. ${tail}`
  const source = opts.cash ? 'TCMB azami nakit çekme oranı' : 'TCMB azami oranları'
  return `Oran: ${source} (${opts.effective}), aylık ${formatRate(opts.contractual)} akdi. ${tail}`
}

/** Primary action of the detail sheet: add an expense paid from this account. */
export function addExpenseLabel(kind: 'card' | 'kmh' | 'bank' | 'cash'): string {
  if (kind === 'card') return 'Bu karttan harcama ekle'
  if (kind === 'cash') return 'Nakitten harcama ekle'
  return 'Bu hesaptan harcama ekle'
}
