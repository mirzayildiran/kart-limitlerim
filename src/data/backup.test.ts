import { describe, it, expect } from 'vitest'
import { BACKUP_SCHEMA, BackupError, MAX_BACKUP_BYTES, checkBackupSize, MAX_BACKUP_CHARS, MAX_RECORDS, makeBackup, migrate, parseBackup, serializeBackup } from './backup'
import demoRaw from './demo-backup.json'
import type { Snapshot } from './db'

const snapshot = (): Snapshot => ({
  accounts: [{ id: 'acc-bank', kind: 'bank', name: 'Örnek Banka', balance: 250000, updatedAt: 1, createdAt: 1 }],
  expenses: [],
  categories: [{ id: 'cat-market', name: 'Market', hue: 120, builtin: true, order: 1 }],
  recurring: [],
  rules: [],
  budgets: [{ categoryId: 'cat-market', monthly: 500000 }],
})

/** A backup file as an older app version wrote it: no budgets key. */
const legacyText = () => {
  const s = snapshot()
  const data = { accounts: s.accounts, expenses: s.expenses, categories: s.categories, recurring: s.recurring, rules: s.rules }
  return JSON.stringify({ app: 'kart-limitlerim', schema: 1, exportedAt: '2026-01-01T00:00:00.000Z', data })
}

const withBudgets = (budgets: unknown) =>
  JSON.stringify({
    app: 'kart-limitlerim',
    schema: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: { ...snapshot(), budgets },
  })

describe('parseBackup budgets', () => {
  it('accepts an older backup without budgets and returns an empty list', () => {
    const backup = parseBackup(legacyText())
    expect(backup.data.budgets).toEqual([])
    expect(backup.data.accounts).toHaveLength(1)
  })

  it('accepts a valid backup with budgets', () => {
    const backup = parseBackup(withBudgets([{ categoryId: 'cat-market', monthly: 500000 }]))
    expect(backup.data.budgets).toEqual([{ categoryId: 'cat-market', monthly: 500000 }])
  })

  it('rejects budgets that are not an array', () => {
    expect(() => parseBackup(withBudgets('x'))).toThrow(BackupError)
    expect(() => parseBackup(withBudgets('x'))).toThrow('Yedek dosyası eksik ya da bozuk.')
    expect(() => parseBackup(withBudgets(null))).toThrow('Yedek dosyası eksik ya da bozuk.')
  })

  it('drops invalid budget entries and keeps the last duplicate', () => {
    const backup = parseBackup(
      withBudgets([
        { categoryId: '', monthly: 100 },
        { categoryId: 'cat-a', monthly: 0 },
        { categoryId: 'cat-b', monthly: 1.5 },
        { categoryId: 'cat-c', monthly: '5' },
        null,
        { monthly: 300 },
        { categoryId: 'cat-d', monthly: 300 },
        { categoryId: 'cat-d', monthly: 400 },
      ]),
    )
    expect(backup.data.budgets).toEqual([{ categoryId: 'cat-d', monthly: 400 }])
  })

  it('round-trips a backup made by makeBackup', () => {
    const original = makeBackup(snapshot(), new Date('2026-03-04T05:06:07.000Z'))
    const parsed = parseBackup(JSON.stringify(original))
    expect(parsed).toEqual(original)
  })
})

describe('checkBackupSize', () => {
  it('refuses a file over the byte limit before reading it', () => {
    expect(() => checkBackupSize(MAX_BACKUP_BYTES)).not.toThrow()
    expect(() => checkBackupSize(MAX_BACKUP_BYTES + 1)).toThrow('fazla büyük')
  })
})

describe('parseBackup size limit', () => {
  it('rejects text over MAX_BACKUP_CHARS before parsing it', () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_CHARS + 1))).toThrow(BackupError)
  })
})

/** A current-schema file with one list replaced or one record changed. */
const fileWith = (patch: (data: Record<string, unknown[]>) => void, top: Record<string, unknown> = {}) => {
  const data = structuredClone(demoRaw.data) as unknown as Record<string, unknown[]>
  data.budgets = []
  patch(data)
  return JSON.stringify({ app: 'kart-limitlerim', schema: BACKUP_SCHEMA, exportedAt: '2026-10-10T00:00:00.000Z', data, ...top })
}
const set = (list: string, i: number, field: string, value: unknown) => (d: Record<string, unknown[]>) => {
  const item = d[list][i] as Record<string, unknown>
  if (value === undefined) delete item[field]
  else item[field] = value
}

describe('backup schema version', () => {
  it('writes the current schema and the same text for the automatic and the manual copy', () => {
    const now = new Date('2026-10-10T10:00:00.000Z')
    const text = serializeBackup(snapshot(), now)
    expect(JSON.parse(text).schema).toBe(BACKUP_SCHEMA)
    expect(text).toBe(JSON.stringify(makeBackup(snapshot(), now), null, 2))
  })

  it('migrates a schema 1 file to the current schema', () => {
    const backup = parseBackup(legacyText())
    expect(backup.schema).toBe(BACKUP_SCHEMA)
    expect(backup.data.budgets).toEqual([])
  })

  it('migrate leaves a current file alone and fills budgets for schema 1', () => {
    const data = { accounts: [], budgets: [{ categoryId: 'a', monthly: 1 }] }
    expect(migrate(BACKUP_SCHEMA, data)).toBe(data)
    expect(migrate(1, { accounts: [] })).toEqual({ accounts: [], budgets: [] })
  })

  it('reads the sample data (schema 1) without losing a record', () => {
    const backup = parseBackup(JSON.stringify(demoRaw))
    for (const key of ['accounts', 'expenses', 'categories', 'recurring', 'rules'] as const) {
      expect(backup.data[key]).toHaveLength(demoRaw.data[key].length)
    }
    expect(backup.data.accounts[0]).toMatchObject(demoRaw.data.accounts[0])
  })

  it.each([
    ['a newer schema', { schema: BACKUP_SCHEMA + 1 }, 'daha yeni bir sürümüyle'],
    ['schema 0', { schema: 0 }, 'eksik ya da bozuk'],
    ['a text schema', { schema: '2' }, 'eksik ya da bozuk'],
    ['a missing export date', { exportedAt: undefined }, 'dışa aktarma tarihi'],
    ['a bad export date', { exportedAt: 'dün' }, 'dışa aktarma tarihi'],
    ['another app', { app: 'baska' }, 'Kart Limitlerim yedeği değil'],
    ['data as a list', { data: [] }, 'eksik ya da bozuk'],
  ])('rejects %s', (_name, top, message) => {
    expect(() => parseBackup(fileWith(() => {}, top))).toThrow(message)
  })

  it('rejects JSON that is not an object', () => {
    for (const text of ['null', '[]', '"yedek"', '42']) expect(() => parseBackup(text)).toThrow('yedeği değil')
  })
})

describe('backup record check', () => {
  it('drops fields it does not know at every level', () => {
    const text = fileWith(
      (d) => {
        Object.assign(d.accounts[0] as object, { pin: '1234' })
        Object.assign((d.accounts[0] as { lines: object[] }).lines[0], { cvv: '000' })
        Object.assign(d.expenses[0] as object, { html: '<img>' })
      },
      { extra: true },
    )
    const out = JSON.stringify(parseBackup(text))
    expect(out).not.toMatch(/pin|cvv|html|extra/)
  })

  it('fills fields older versions did not write', () => {
    const backup = parseBackup(
      fileWith((d) => {
        for (const f of ['note', 'installments', 'source', 'affectsAccount', 'createdAt', 'recurringId']) {
          delete (d.expenses[0] as Record<string, unknown>)[f]
        }
        delete (d.categories[0] as Record<string, unknown>).builtin
      }),
    )
    expect(backup.data.expenses[0]).toMatchObject({ note: '', installments: 1, source: 'manual', affectsAccount: true, createdAt: 0, recurringId: null })
    expect(backup.data.categories[0].builtin).toBe(false)
  })

  it.each([
    ['accounts', 0, 'limit', '40000', '1. hesap, limit geçersiz'],
    ['accounts', 0, 'kind', 'kripto', 'hesap türü'],
    ['accounts', 0, 'available', 1.5, 'kullanılabilir limit'],
    ['accounts', 0, 'available', Number.MAX_SAFE_INTEGER, 'kullanılabilir limit'],
    ['accounts', 0, 'name', undefined, 'hesap adı'],
    ['accounts', 0, 'name', 'x'.repeat(201), 'hesap adı'],
    ['accounts', 0, 'lines', 'yok', 'kartlar'],
    ['accounts', 0, 'id', '', 'kimlik'],
    ['accounts', 0, 'rateOverride', { contractual: '3', late: 3 }, 'akdi faiz'],
    ['expenses', 2, 'amount', null, '3. harcama, tutar geçersiz'],
    ['expenses', 0, 'date', '2026-13-01', 'tarih'],
    ['expenses', 0, 'date', '11.09.2026', 'tarih'],
    ['expenses', 0, 'installments', 0, 'taksit sayısı'],
    ['expenses', 0, 'source', 'bot', 'kaynak'],
    ['expenses', 0, 'note', 5, 'not'],
    ['categories', 0, 'hue', 400, 'renk'],
    ['recurring', 0, 'dayOfMonth', 32, 'ödeme günü'],
    ['recurring', 0, 'end', { type: 'until' }, 'bitiş tarihi'],
    ['recurring', 0, 'startDate', null, 'başlangıç tarihi'],
    ['rules', 0, 'pattern', 3, 'kural metni'],
  ])('rejects %s[%i].%s = %j', (list, i, field, value, message) => {
    expect(() => parseBackup(fileWith(set(list, i, field, value)))).toThrow(message)
  })

  it('rejects a bad card line field', () => {
    const line = (patch: object) => fileWith((d) => Object.assign((d.accounts[0] as { lines: object[] }).lines[0], patch))
    expect(() => parseBackup(line({ cutDay: 0 }))).toThrow('kesim günü')
    expect(() => parseBackup(line({ payment: 'paid' }))).toThrow('ödeme durumu')
    expect(() => parseBackup(line({ cycle: '2026-1' }))).toThrow('ekstre dönemi')
    expect(() => parseBackup(line({ dueDate: 'yarın' }))).toThrow('son ödeme tarihi')
    expect(() => parseBackup(line({ interestHistory: [{ cycle: '2026-09', amount: -1, source: 'estimate' }] }))).toThrow('faiz tutarı')
  })

  it('rejects a record that is not an object', () => {
    expect(() => parseBackup(fileWith((d) => (d.expenses[0] = 'harcama')))).toThrow('1. harcama')
    expect(() => parseBackup(fileWith((d) => (d.rules[0] = null)))).toThrow('1. kural')
  })

  it('rejects a list longer than MAX_RECORDS', () => {
    const text = fileWith((d) => (d.rules = Array.from({ length: MAX_RECORDS + 1 }, (_, i) => ({ id: `r${i}`, pattern: 'a', categoryId: 'c', hits: 0 }))))
    expect(() => parseBackup(text)).toThrow('fazla büyük')
  })

  it('rejects a missing list', () => {
    expect(() => parseBackup(fileWith((d) => delete (d as Record<string, unknown>).recurring))).toThrow('eksik ya da bozuk')
  })
})
