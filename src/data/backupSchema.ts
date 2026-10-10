import type {
  Account,
  CardLine,
  Category,
  Expense,
  InterestRecord,
  MerchantRule,
  RateOverride,
  RecurrenceEnd,
  RecurringPayment,
} from '../domain/types'

/**
 * Record-level check for backup files. Each reader rebuilds a record from known fields only, so
 * unknown keys never reach IndexedDB. Fields that older app versions did not write get the same
 * default the app uses today; a field of the wrong type is an error, never a silent guess.
 */

export class RecordError extends Error {}

type Raw = Record<string, unknown>

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const CYCLE = /^\d{4}-(0[1-9]|1[0-2])$/
/** Far above any real value (1 billion lira); keeps sums well inside safe integers. */
const MAX_KURUS = 100_000_000_000
const MAX_ID = 128
const MAX_NAME = 200
const MAX_NOTE = 2_000

function fail(field: string): never {
  throw new RecordError(field)
}

function rec(v: unknown, field: string): Raw {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(field)
  return v as Raw
}

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) fail(field)
  return v
}

function id(v: unknown, field = 'kimlik'): string {
  const s = str(v, field, MAX_ID)
  if (s === '') fail(field)
  return s
}

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(field)
  return v
}

const kurus = (v: unknown, field: string, min = -MAX_KURUS) => int(v, field, min, MAX_KURUS)

function optKurus(v: unknown, field: string): number | null {
  return v === undefined || v === null ? null : kurus(v, field)
}

function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(field)
  return v
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') fail(field)
  return v
}

function date(v: unknown, field: string): string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) fail(field)
  return v
}

function optDate(v: unknown, field: string): string | null {
  return v === undefined || v === null ? null : date(v, field)
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(v as T)) fail(field)
  return v as T
}

/** Epoch ms; older records may lack it. */
const time = (v: unknown, field: string) => (v === undefined ? 0 : num(v, field, 0, 8.64e15))

function rateOverride(v: unknown): RateOverride | null {
  if (v === undefined || v === null) return null
  const r = rec(v, 'faiz oranı')
  return { contractual: num(r.contractual, 'akdi faiz', 0, 100), late: num(r.late, 'gecikme faizi', 0, 100) }
}

function interestRecord(v: unknown): InterestRecord {
  const r = rec(v, 'faiz geçmişi')
  return {
    cycle: cycle(r.cycle),
    amount: kurus(r.amount, 'faiz tutarı', 0),
    source: oneOf(r.source, ['estimate', 'statement'] as const, 'faiz kaynağı'),
  }
}

function cycle(v: unknown): string {
  if (typeof v !== 'string' || !CYCLE.test(v)) fail('ekstre dönemi')
  return v
}

function cardLine(v: unknown): CardLine {
  const r = rec(v, 'kart')
  const line: CardLine = {
    id: id(r.id),
    label: str(r.label ?? '', 'kart adı', MAX_NAME),
    cutDay: int(r.cutDay, 'kesim günü', 1, 31),
    dueOffsetDays: int(r.dueOffsetDays ?? 10, 'son ödeme aralığı', 0, 60),
    subLimit: optKurus(r.subLimit, 'kart alt limiti'),
    cycle: r.cycle === undefined || r.cycle === null ? null : cycle(r.cycle),
    statementDebt: optKurus(r.statementDebt, 'ekstre borcu'),
    minimumDue: optKurus(r.minimumDue, 'asgari ödeme'),
    dueDate: optDate(r.dueDate, 'son ödeme tarihi'),
    payment: oneOf(r.payment ?? 'unpaid', ['unpaid', 'partial', 'minimum', 'full'] as const, 'ödeme durumu'),
    paidAmount: optKurus(r.paidAmount, 'ödenen tutar'),
  }
  if (r.interestCharged !== undefined) line.interestCharged = optKurus(r.interestCharged, 'işlenen faiz')
  if (r.interestHistory !== undefined) {
    if (!Array.isArray(r.interestHistory)) fail('faiz geçmişi')
    line.interestHistory = r.interestHistory.map(interestRecord)
  }
  return line
}

export function readAccount(v: unknown): Account {
  const r = rec(v, 'hesap')
  const kind = oneOf(r.kind, ['card', 'kmh', 'bank', 'cash'] as const, 'hesap türü')
  const base = {
    id: id(r.id),
    name: str(r.name, 'hesap adı', MAX_NAME),
    ...(r.note === undefined ? {} : { note: str(r.note, 'not', MAX_NOTE) }),
    updatedAt: time(r.updatedAt, 'güncelleme zamanı'),
    createdAt: time(r.createdAt, 'oluşturma zamanı'),
  }
  if (kind === 'bank' || kind === 'cash') return { ...base, kind, balance: kurus(r.balance, 'bakiye') }
  const limited = {
    ...base,
    limit: kurus(r.limit, 'limit', 0),
    available: kurus(r.available, 'kullanılabilir limit'),
    rateOverride: rateOverride(r.rateOverride),
  }
  if (kind === 'kmh') return { ...limited, kind }
  if (!Array.isArray(r.lines)) fail('kartlar')
  return { ...limited, kind, lines: r.lines.map(cardLine) }
}

export function readExpense(v: unknown): Expense {
  const r = rec(v, 'harcama')
  return {
    id: id(r.id),
    amount: kurus(r.amount, 'tutar'),
    categoryId: id(r.categoryId, 'kategori'),
    accountId: id(r.accountId, 'hesap'),
    date: date(r.date, 'tarih'),
    note: str(r.note ?? '', 'not', MAX_NOTE),
    affectsAccount: bool(r.affectsAccount ?? true, 'hesaba yansıma'),
    installments: int(r.installments ?? 1, 'taksit sayısı', 1, 48),
    source: oneOf(r.source ?? 'manual', ['manual', 'screenshot', 'recurring'] as const, 'kaynak'),
    recurringId: r.recurringId === undefined || r.recurringId === null ? null : id(r.recurringId, 'düzenli ödeme'),
    createdAt: time(r.createdAt, 'oluşturma zamanı'),
  }
}

export function readCategory(v: unknown): Category {
  const r = rec(v, 'kategori')
  const category: Category = {
    id: id(r.id),
    name: str(r.name, 'kategori adı', MAX_NAME),
    hue: int(r.hue, 'renk', 0, 359),
    builtin: bool(r.builtin ?? false, 'yerleşik'),
    order: num(r.order ?? 0, 'sıra', -1e9, 1e9),
  }
  if (r.archived !== undefined) category.archived = bool(r.archived, 'arşiv')
  return category
}

function recurrenceEnd(v: unknown): RecurrenceEnd {
  const r = rec(v, 'bitiş')
  const type = oneOf(r.type, ['never', 'until', 'count'] as const, 'bitiş türü')
  if (type === 'until') return { type, date: date(r.date, 'bitiş tarihi') }
  if (type === 'count') return { type, count: int(r.count, 'tekrar sayısı', 1, 1200) }
  return { type }
}

export function readRecurring(v: unknown): RecurringPayment {
  const r = rec(v, 'düzenli ödeme')
  return {
    id: id(r.id),
    name: str(r.name, 'düzenli ödeme adı', MAX_NAME),
    amount: kurus(r.amount, 'tutar'),
    categoryId: id(r.categoryId, 'kategori'),
    accountId: id(r.accountId, 'hesap'),
    dayOfMonth: int(r.dayOfMonth, 'ödeme günü', 1, 31),
    startDate: date(r.startDate, 'başlangıç tarihi'),
    end: recurrenceEnd(r.end ?? { type: 'never' }),
    active: bool(r.active ?? true, 'etkin'),
    handledThrough: optDate(r.handledThrough, 'işlenen son tarih'),
    createdAt: time(r.createdAt, 'oluşturma zamanı'),
  }
}

export function readRule(v: unknown): MerchantRule {
  const r = rec(v, 'kural')
  return {
    id: id(r.id),
    pattern: str(r.pattern, 'kural metni', MAX_NAME),
    categoryId: id(r.categoryId, 'kategori'),
    hits: int(r.hits ?? 0, 'kullanım sayısı', 0, 1e9),
  }
}
