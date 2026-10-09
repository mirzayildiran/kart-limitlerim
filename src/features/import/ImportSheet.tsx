import type { TargetedEvent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { formatShort, fromIso } from '../../domain/dates'
import { formatTLExact } from '../../domain/money'
import type { Account, IsoDate, Kurus } from '../../domain/types'
import {
  accountById,
  activeCategories,
  cards,
  expenses,
  importExpenses,
  kmhAccounts,
  liquidAccounts,
  newId,
  rules,
  saveRule,
  today,
} from '../../data/store'
import { closeSheet } from '../../ui/nav'
import type { SheetRequest } from '../../ui/nav'
import { Button, Choice, EmptyState, MoneyField, Pill, Switch, TextField } from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { toast } from '../../ui/components/toast'
import { merchantKey, suggestCategory } from '../../ocr/categorize'
import { parsePage } from '../../ocr/parse'
import { recognize, releaseOcr } from '../../ocr/engine'
import type { OcrProgress, ParsedTxn } from '../../ocr/types'
import {
  buildDrafts,
  buildExpenses,
  learnRules,
  mergeAcrossImages,
  selectedRows,
  splitTxns,
  summarize,
  type DraftRow,
  isImportable,
} from './importModel'
import './import-sheet.css'

export interface ImportSheetProps {
  request: Extract<SheetRequest, { type: 'import' }>
}

const MAX_IMAGES = 10
const LAST_ACCOUNT_KEY = 'kl:lastImportAccount'

type Step = 'pick' | 'reading' | 'review'

interface ImageResult {
  txns: ParsedTxn[]
  error: string | null
}

function readLastAccount(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY)
  } catch {
    return null
  }
}

function rememberAccount(id: string): void {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, id)
  } catch {
    // Storage unavailable: the default account is used next time.
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Bilinmeyen bir hata oluştu.'
}

function stageText(p: OcrProgress | null): string {
  if (!p) return 'Hazırlanıyor…'
  switch (p.stage) {
    case 'loading':
      return 'Okuma aracı hazırlanıyor (ilk seferde biraz sürer)…'
    case 'preparing':
      return 'Görüntü hazırlanıyor…'
    case 'reading':
      return `Okunuyor… %${Math.round(p.progress * 100)}`
    case 'done':
      return 'Okuma tamamlandı.'
  }
}

export function ImportSheet(_props: ImportSheetProps) {
  const accountOptions = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value]
  const [step, setStep] = useState<Step>('pick')
  const [accountId, setAccountId] = useState<string | null>(() => {
    const last = readLastAccount()
    if (last && accountById.value.has(last)) return last
    return accountOptions[0]?.id ?? null
  })
  const [files, setFiles] = useState<File[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [results, setResults] = useState<ImageResult[]>([])
  const [rows, setRows] = useState<DraftRow[]>([])
  const [credits, setCredits] = useState<ParsedTxn[]>([])
  const [affects, setAffects] = useState(false)
  const [saving, setSaving] = useState(false)

  const runRef = useRef(0)

  // Stop any running read and free the OCR worker when the sheet closes.
  useEffect(() => {
    return () => {
      runRef.current++
      releaseOcr().catch(() => {})
    }
  }, [])

  // Reading loop: one image at a time. A new token (cancel, close) stops the loop.
  useEffect(() => {
    if (step !== 'reading') return
    const token = ++runRef.current
    const alive = () => runRef.current === token
    const acc: ImageResult[] = []

    const run = async () => {
      for (let i = 0; i < files.length; i++) {
        if (!alive()) return
        setIndex(i)
        setProgress({ stage: 'loading', progress: 0 })
        try {
          const page = await recognize(files[i], (p) => {
            if (alive()) setProgress(p)
          })
          if (!alive()) return
          const parsed = parsePage(page, today.value)
          acc.push({ txns: parsed.txns, error: null })
        } catch (err) {
          if (!alive()) return
          acc.push({ txns: [], error: messageOf(err) })
        }
      }
      if (!alive() || accountId === null) return

      const merged = mergeAcrossImages(acc.map((r) => r.txns))
      const { debits, credits: credit } = splitTxns(merged)
      const knownIds = new Set(activeCategories.value.map((c) => c.id))
      const fallback = activeCategories.value[0]?.id ?? ''
      const drafts = buildDrafts(debits, {
        accountId,
        expenses: expenses.value,
        suggest: (t) => {
          const s = suggestCategory(t.description, t.bankCategory, rules.value, activeCategories.value)
          return knownIds.has(s) ? s : fallback
        },
      })
      setResults(acc)
      setCredits(credit)
      setRows(drafts)
      setStep('review')
    }
    run()
  }, [step])

  // Thumbnail object URL for the image being read; revoked when it changes.
  useEffect(() => {
    if (step !== 'reading') return
    const file = files[index]
    if (!file) return
    const url = URL.createObjectURL(file)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [step, index, files])

  const startReading = (picked: File[]) => {
    if (accountId === null || picked.length === 0) return
    rememberAccount(accountId)
    setNotice(picked.length > MAX_IMAGES ? `En fazla ${MAX_IMAGES} görüntü okunur; ilk ${MAX_IMAGES} tanesini aldık.` : null)
    setFiles(picked.slice(0, MAX_IMAGES))
    setIndex(0)
    setProgress(null)
    setResults([])
    setStep('reading')
  }

  const onPick = (e: TargetedEvent<HTMLInputElement, Event>) => {
    const picked = Array.from(e.currentTarget.files ?? [])
    e.currentTarget.value = ''
    startReading(picked)
  }

  const backToPick = () => {
    runRef.current++
    setFiles([])
    setRows([])
    setCredits([])
    setResults([])
    setThumb(null)
    setProgress(null)
    setNotice(null)
    setStep('pick')
  }

  const updateRow = (uid: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))
  }

  const picked = selectedRows(rows)
  const summary = summarize(rows)
  const rowCount = rows.length
  const failed = results.map((r, i) => ({ n: i + 1, error: r.error })).filter((r) => r.error !== null)

  const save = async () => {
    if (accountId === null || saving || picked.length === 0) return
    const list = buildExpenses(rows, {
      accountId,
      affectsAccount: affects,
      now: Date.now(),
      makeId: () => newId('exp'),
    })
    setSaving(true)
    try {
      await importExpenses(list)
    } catch {
      setSaving(false)
      toast('Harcamalar eklenemedi. Tekrar dene.')
      return
    }
    // Learning is best effort: the expenses are already saved.
    const learned = learnRules(picked, rules.value, merchantKey, () => newId('rule'))
    for (const rule of learned) {
      try {
        await saveRule(rule)
      } catch {
        // Skip this rule; the next import can learn it again.
      }
    }
    toast(`${list.length} harcama eklendi`)
    closeSheet()
  }

  if (step === 'pick') {
    return (
      <Sheet open={true} title="Ekran görüntüsünden ekle" onClose={closeSheet}>
        <div class="import-sheet">
          {accountOptions.length === 0 ? (
            <EmptyState title="Önce bir kart ya da hesap ekle." />
          ) : (
            <>
              <div class="import-account">
                <Choice<string>
                  legend="Hangi kart/hesap?"
                  options={accountOptions.map((a: Account) => ({ value: a.id, label: a.name }))}
                  value={accountId}
                  onChange={setAccountId}
                  look="chips"
                />
              </div>
              <label class={`btn btn-primary import-drop ${accountId === null ? 'is-disabled' : ''}`}>
                <input
                  class="import-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={accountId === null}
                  onChange={onPick}
                />
                Ekran görüntülerini seç
              </label>
              {notice && <p class="import-note">{notice}</p>}
            </>
          )}
          <p class="import-privacy">Görüntüler bu telefonda okunur, hiçbir yere gönderilmez ve saklanmaz.</p>
        </div>
      </Sheet>
    )
  }

  if (step === 'reading') {
    const pct = progress ? Math.round(progress.progress * 100) : 0
    return (
      <Sheet open={true} title="Okunuyor" onClose={closeSheet}>
        <div class="import-sheet">
          <p class="import-count num">
            Görüntü {index + 1} / {files.length}
          </p>
          {thumb && <img class="import-thumb" src={thumb} alt={`Görüntü ${index + 1}`} />}
          <p class="import-stage" aria-live="polite">
            {stageText(progress)}
          </p>
          <div
            class="import-progress"
            role="progressbar"
            aria-label="Okuma ilerlemesi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <Button variant="ghost" block onClick={backToPick}>
            Vazgeç
          </Button>
        </div>
      </Sheet>
    )
  }

  // Review step
  return (
    <Sheet
      open={true}
      title="Kontrol et"
      onClose={closeSheet}
      footer={
        rowCount > 0 ? (
          <div class="import-foot">
            <p class="import-summary num" aria-live="polite">
              {summary.count} harcama seçildi · toplam {formatTLExact(summary.total)}
            </p>
            <Button variant="primary" block disabled={picked.length === 0 || saving} onClick={save}>
              Seçilenleri ekle
            </Button>
          </div>
        ) : undefined
      }
    >
      <div class="import-sheet">
        {failed.map((f) => (
          <p class="import-note is-error" key={f.n}>
            Görüntü {f.n} okunamadı: {f.error}
          </p>
        ))}

        {rowCount === 0 ? (
          <EmptyState title="Bu görüntüde harcama bulunamadı">
            <p>
              Bankanın 'Kart hareketleri' ekranının görüntüsünü dene; liste ekranın ortasında net görünsün.
            </p>
            <Button variant="secondary" block onClick={backToPick}>
              Başka görüntü seç
            </Button>
          </EmptyState>
        ) : (
          <>
            <ul class="import-rows">
              {rows.map((r) => (
                <li key={r.uid} class="import-row">
                  <div class="import-row-head">
                    <label class="import-check">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={!isImportable(r)}
                        onChange={(e) => updateRow(r.uid, { selected: e.currentTarget.checked })}
                      />
                      <span>Ekle</span>
                    </label>
                    <span class="import-pills">
                      {r.duplicate && <Pill tone="crit">Zaten kayıtlı</Pill>}
                      {r.pending && <Pill>Beklemede</Pill>}
                      {r.lowConfidence && <Pill tone="warn">Kontrol et</Pill>}
                    </span>
                  </div>
                  <div class="import-row-grid">
                    <TextField
                      label="Tarih"
                      type="date"
                      value={r.date ?? ''}
                      error={r.date === null ? 'Tarih gerekli.' : null}
                      onChange={(v) => updateRow(r.uid, { date: v === '' ? null : (v as IsoDate) })}
                    />
                    <MoneyField
                      label="Tutar"
                      value={r.amount}
                      error={r.amount === null || r.amount <= 0 ? 'Tutar gerekli.' : null}
                      onChange={(v: Kurus | null) => updateRow(r.uid, { amount: v })}
                    />
                  </div>
                  <TextField
                    label="Açıklama"
                    value={r.description}
                    onChange={(v) => updateRow(r.uid, { description: v })}
                  />
                  <Choice<string>
                    legend="Kategori"
                    hideLegend
                    options={activeCategories.value.map((c) => ({ value: c.id, label: c.name }))}
                    value={r.categoryId || null}
                    onChange={(v) => updateRow(r.uid, { categoryId: v })}
                    look="chips"
                  />
                </li>
              ))}
            </ul>

            {credits.length > 0 && (
              <details class="import-credits">
                <summary>Ödemeler ve iadeler ({credits.length})</summary>
                <p class="import-note">Bunlar harcama olarak eklenmez.</p>
                <ul>
                  {credits.map((c, i) => (
                    <li key={i} class="import-credit">
                      <span>{c.date ? formatShort(fromIso(c.date)) : 'Tarihsiz'}</span>
                      <span class="import-credit-desc">{c.description}</span>
                      <span class="num">{formatTLExact(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <Switch
              label="Kullanılabilir limitten de düş"
              checked={affects}
              onChange={setAffects}
              hint="Bankanın gösterdiği limitte bu harcamalar zaten düşülmüş olur. Limiti az önce güncellediysen kapalı bırak."
            />
          </>
        )}
      </div>
    </Sheet>
  )
}
