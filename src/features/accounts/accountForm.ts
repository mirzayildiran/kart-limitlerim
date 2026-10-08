/**
 * Pure form logic for account creation/editing.
 * Converts between form state and Account objects, with validation.
 */

import type { Account, AccountKind, CardAccount, CardLine, KmhAccount, BalanceAccount, RateOverride, Kurus } from '../../domain/types'

export interface CardFormState {
  kind: 'card'
  name: string
  available: Kurus | null
  limit: Kurus | null
  lines: CardLineFormState[]
  contractualRate: number | null
  lateRate: number | null
}

export interface CardLineFormState {
  id: string
  label: string
  cutDay: string
  dueOffsetDays: string
  subLimit: Kurus | null
}

export interface KmhFormState {
  kind: 'kmh'
  name: string
  available: Kurus | null
  limit: Kurus | null
  contractualRate: number | null
  lateRate: number | null
}

export interface BankFormState {
  kind: 'bank'
  name: string
  balance: Kurus | null
  note: string
}

export interface CashFormState {
  kind: 'cash'
  name: string
  balance: Kurus | null
}

export type FormState = CardFormState | KmhFormState | BankFormState | CashFormState

export interface FormErrors {
  name?: string
  available?: string
  limit?: string
  balance?: string
  note?: string
  lines?: Record<number, Record<string, string>>
  contractualRate?: string
  lateRate?: string
}

export function initFormState(account: Account | undefined, kind: AccountKind): FormState {
  if (account) {
    if (account.kind === 'card') {
      const acc = account as CardAccount
      return {
        kind: 'card',
        name: acc.name,
        available: acc.available,
        limit: acc.limit,
        lines: acc.lines.map((line) => ({
          id: line.id,
          label: line.label,
          cutDay: String(line.cutDay),
          dueOffsetDays: String(line.dueOffsetDays),
          subLimit: line.subLimit ?? null,
        })),
        contractualRate: acc.rateOverride?.contractual ?? null,
        lateRate: acc.rateOverride?.late ?? null,
      }
    }
    if (account.kind === 'kmh') {
      const acc = account as KmhAccount
      return {
        kind: 'kmh',
        name: acc.name,
        available: acc.available,
        limit: acc.limit,
        contractualRate: acc.rateOverride?.contractual ?? null,
        lateRate: acc.rateOverride?.late ?? null,
      }
    }
    if (account.kind === 'bank') {
      const acc = account as BalanceAccount
      return {
        kind: 'bank',
        name: acc.name,
        balance: acc.balance,
        note: acc.note ?? '',
      }
    }
    if (account.kind === 'cash') {
      const acc = account as BalanceAccount
      return {
        kind: 'cash',
        name: acc.name,
        balance: acc.balance,
      }
    }
  }

  if (kind === 'card') {
    return {
      kind: 'card',
      name: '',
      available: null,
      limit: null,
      lines: [{ id: '', label: 'Kredi kartı', cutDay: '1', dueOffsetDays: '10', subLimit: null }],
      contractualRate: null,
      lateRate: null,
    }
  }
  if (kind === 'kmh') {
    return {
      kind: 'kmh',
      name: '',
      available: null,
      limit: null,
      contractualRate: null,
      lateRate: null,
    }
  }
  if (kind === 'bank') {
    return {
      kind: 'bank',
      name: '',
      balance: null,
      note: '',
    }
  }
  return {
    kind: 'cash',
    name: 'Nakit',
    balance: null,
  }
}

export function validateForm(state: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!state.name || state.name.trim() === '') {
    errors.name = 'Adı gir'
  }

  if (state.kind === 'card') {
    const s = state as CardFormState
    if (s.available === null) {
      errors.available = 'Kullanılabilir limiti gir'
    } else if (s.available < 0) {
      errors.available = 'Negatif olamaz'
    }
    if (s.limit === null) {
      errors.limit = 'Toplam limiti gir'
    } else if (s.limit < 0) {
      errors.limit = 'Negatif olamaz'
    } else if (s.available !== null && s.available > s.limit && s.limit > 0) {
      // Not a blocking error, just a warning
    }

    if (!s.lines || s.lines.length === 0) {
      errors.lines = { 0: { _: 'En az bir kart lazım' } }
    } else {
      errors.lines = {}
      s.lines.forEach((line, i) => {
        const lineErr: Record<string, string> = {}
        if (!line.label || line.label.trim() === '') {
          lineErr.label = 'Adı gir'
        }
        const cutDay = parseInt(line.cutDay, 10)
        if (isNaN(cutDay) || cutDay < 1 || cutDay > 31) {
          lineErr.cutDay = '1–31 arasında'
        }
        const offset = parseInt(line.dueOffsetDays, 10)
        if (isNaN(offset) || offset < 1 || offset > 30) {
          lineErr.dueOffsetDays = '1–30 arasında'
        }
        if (line.subLimit !== null && line.subLimit < 0) {
          lineErr.subLimit = 'Negatif olamaz'
        }
        if (Object.keys(lineErr).length > 0) {
          errors.lines![i] = lineErr
        }
      })
      if (Object.keys(errors.lines).length === 0) {
        delete errors.lines
      }
    }
  }

  if (state.kind === 'kmh') {
    const s = state as KmhFormState
    if (s.available === null) {
      errors.available = 'Kullanılabilir limiti gir'
    } else if (s.available < 0) {
      errors.available = 'Negatif olamaz'
    }
    if (s.limit === null) {
      errors.limit = 'Toplam limiti gir'
    } else if (s.limit < 0) {
      errors.limit = 'Negatif olamaz'
    } else if (s.available !== null && s.available > s.limit && s.limit > 0) {
      // Warning only
    }
  }

  if (state.kind === 'bank') {
    const s = state as BankFormState
    if (s.balance === null) {
      errors.balance = 'Bakiyeyi gir'
    } else if (s.balance < 0) {
      errors.balance = 'Negatif olamaz'
    }
  }

  if (state.kind === 'cash') {
    const s = state as CashFormState
    if (s.balance === null) {
      errors.balance = 'Nakiti gir'
    } else if (s.balance < 0) {
      errors.balance = 'Negatif olamaz'
    }
  }

  if (state.kind === 'card' || state.kind === 'kmh') {
    const s = state as CardFormState | KmhFormState
    if (s.contractualRate !== null && (s.contractualRate < 0 || s.contractualRate > 50)) {
      errors.contractualRate = 'Geçerli yüzde gir'
    }
    if (s.lateRate !== null && (s.lateRate < 0 || s.lateRate > 50)) {
      errors.lateRate = 'Geçerli yüzde gir'
    }
  }

  return errors
}

export function isFormValid(errors: FormErrors): boolean {
  return Object.keys(errors).length === 0
}

export function formStateToAccount(state: FormState, id: string, createdAt?: number): Account {
  const now = createdAt ?? Date.now()
  const base = { id, createdAt: now, updatedAt: now, name: state.name.trim() }

  const rateOverride: RateOverride | null =
    (state.kind === 'card' || state.kind === 'kmh') && (state.contractualRate !== null || state.lateRate !== null)
      ? {
          contractual: state.contractualRate ?? 3.25,
          late: state.lateRate ?? 3.55,
        }
      : null

  if (state.kind === 'card') {
    const s = state as CardFormState
    const lines: CardLine[] = s.lines.map((lineForm) => ({
      id: lineForm.id,
      label: lineForm.label.trim(),
      cutDay: parseInt(lineForm.cutDay, 10),
      dueOffsetDays: parseInt(lineForm.dueOffsetDays, 10),
      subLimit: lineForm.subLimit,
      cycle: null,
      payment: 'unpaid',
      statementDebt: null,
      minimumDue: null,
      dueDate: null,
      paidAmount: null,
    }))
    return {
      ...base,
      kind: 'card',
      limit: s.limit!,
      available: s.available!,
      lines,
      rateOverride,
    } as CardAccount
  }

  if (state.kind === 'kmh') {
    const s = state as KmhFormState
    return {
      ...base,
      kind: 'kmh',
      limit: s.limit!,
      available: s.available!,
      rateOverride,
    } as KmhAccount
  }

  if (state.kind === 'bank') {
    const s = state as BankFormState
    return {
      ...base,
      kind: 'bank',
      balance: s.balance!,
      note: s.note || undefined,
    } as BalanceAccount
  }

  const s = state as CashFormState
  return {
    ...base,
    kind: 'cash',
    balance: s.balance!,
  } as BalanceAccount
}

export function shouldWarnAvailable(available: Kurus | null, limit: Kurus | null): boolean {
  return available !== null && limit !== null && available > limit && limit > 0
}
