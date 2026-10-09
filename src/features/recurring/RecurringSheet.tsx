import { useEffect, useState } from 'preact/hooks'
import { toIso } from '../../domain/dates'
import type { RecurringPayment } from '../../domain/types'
import {
  activeCategories,
  cards,
  kmhAccounts,
  liquidAccounts,
  newId,
  recurring,
  removeRecurring,
  saveRecurring,
  today,
} from '../../data/store'
import { closeSheet } from '../../ui/nav'
import type { SheetRequest } from '../../ui/nav'
import { Button, Choice, ConfirmButton, MoneyField, Switch, TextField } from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { toast } from '../../ui/components/toast'
import {
  buildRecurring,
  hasErrors,
  previewLine,
  validateDraft,
  type EndKind,
  type RecurringDraft,
} from './recurringForm'
import './recurring-sheet.css'

/** Rendered by SheetHost while `sheet.value.type === 'recurring'`. */
export interface RecurringSheetProps {
  request: Extract<SheetRequest, { type: 'recurring' }>
}

function initialDraft(existing: RecurringPayment | undefined): RecurringDraft {
  const end = existing?.end
  const accountDefault = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value][0]?.id ?? null
  return {
    name: existing?.name ?? '',
    amount: existing?.amount ?? null,
    accountId: existing?.accountId ?? accountDefault,
    categoryId: existing?.categoryId ?? activeCategories.value[0]?.id ?? null,
    dayText: String(existing?.dayOfMonth ?? today.value.getDate()),
    startDate: existing?.startDate ?? toIso(today.value),
    endKind: end?.type ?? 'never',
    untilDate: end?.type === 'until' ? end.date : toIso(new Date(today.value.getFullYear() + 1, today.value.getMonth(), today.value.getDate())),
    countText: end?.type === 'count' ? String(end.count) : '12',
    active: existing?.active ?? true,
  }
}

const END_OPTIONS: { value: EndKind; label: string }[] = [
  { value: 'never', label: 'Süresiz' },
  { value: 'until', label: 'Tarihte' },
  { value: 'count', label: 'Sayıda' },
]

export function RecurringSheet({ request }: RecurringSheetProps) {
  const existing = request.id ? recurring.value.find((r) => r.id === request.id) : undefined
  const [draft, setDraft] = useState<RecurringDraft>(() => initialDraft(existing))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)

  // The payment was removed elsewhere while the sheet was open.
  useEffect(() => {
    if (request.id && !existing) closeSheet()
  }, [request.id, existing])

  const patch = (p: Partial<RecurringDraft>) => setDraft((d) => ({ ...d, ...p }))
  const errors = validateDraft(draft)
  const shown = attempted ? errors : {}

  const accountOptions = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value].map((a) => ({ value: a.id, label: a.name }))
  const categoryOptions = activeCategories.value.map((c) => ({ value: c.id, label: c.name }))

  const preview = buildRecurring(draft, {
    id: existing?.id ?? 'preview',
    createdAt: existing?.createdAt ?? 0,
    handledThrough: existing?.handledThrough ?? null,
  })

  const handleSave = async () => {
    setAttempted(true)
    if (hasErrors(errors)) return
    const payment = buildRecurring(draft, {
      id: existing?.id ?? newId('rec'),
      createdAt: existing?.createdAt ?? Date.now(),
      handledThrough: existing?.handledThrough ?? null,
    })
    if (!payment) return
    setBusy(true)
    try {
      await saveRecurring(payment)
      toast('Düzenli ödeme kaydedildi')
      closeSheet()
    } catch {
      toast('Düzenli ödeme kaydedilemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await removeRecurring(existing.id)
      toast('Düzenli ödeme silindi')
      closeSheet()
    } catch {
      toast('Düzenli ödeme silinemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={true}
      title={existing ? 'Düzenli ödemeyi düzenle' : 'Düzenli ödeme ekle'}
      onClose={closeSheet}
      footer={
        <div class="recurring-footer">
          <Button variant="primary" block type="button" disabled={busy} onClick={handleSave}>
            Kaydet
          </Button>
          {existing && (
            <ConfirmButton label="Sil" confirmLabel="Silmek için tekrar dokun" onConfirm={handleDelete} />
          )}
        </div>
      }
    >
      <div class="recurring-sheet">
        <TextField
          label="Ad"
          value={draft.name}
          onChange={(v) => patch({ name: v })}
          placeholder="Örn. Netflix"
          error={shown.name}
        />

        <MoneyField
          label="Tutar"
          value={draft.amount}
          onChange={(v) => patch({ amount: v })}
          error={shown.amount}
        />

        <div class="recurring-choice">
          {accountOptions.length === 0 ? (
            <p class="recurring-empty">Önce bir kart ya da hesap ekle.</p>
          ) : (
            <Choice<string>
              legend="Hangi hesaptan"
              options={accountOptions}
              value={draft.accountId}
              onChange={(v) => patch({ accountId: v })}
            />
          )}
          {shown.account && <p class="field-error" role="alert">{shown.account}</p>}
        </div>

        <div class="recurring-choice">
          <Choice<string>
            legend="Kategori"
            options={categoryOptions}
            value={draft.categoryId}
            onChange={(v) => patch({ categoryId: v })}
          />
          {shown.category && <p class="field-error" role="alert">{shown.category}</p>}
        </div>

        <div class="recurring-row">
          <TextField
            label="Ayın kaçında"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={draft.dayText}
            onChange={(v) => patch({ dayText: v })}
            hint="Ay kısaysa ayın son gününe alınır"
            error={shown.day}
          />
          <TextField
            label="Başlangıç"
            type="date"
            value={draft.startDate}
            onChange={(v) => patch({ startDate: v })}
            error={shown.startDate}
          />
        </div>

        <Choice<EndKind>
          legend="Bitiş"
          look="segment"
          options={END_OPTIONS}
          value={draft.endKind}
          onChange={(v) => patch({ endKind: v })}
        />

        {draft.endKind === 'until' && (
          <TextField
            label="Bitiş tarihi"
            type="date"
            value={draft.untilDate}
            onChange={(v) => patch({ untilDate: v })}
            error={shown.until}
          />
        )}

        {draft.endKind === 'count' && (
          <TextField
            label="Kaç kez"
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.countText}
            onChange={(v) => patch({ countText: v })}
            hint="Taksitler için toplam ödeme sayısı"
            error={shown.count}
          />
        )}

        <Switch
          label="Aktif"
          checked={draft.active}
          onChange={(v) => patch({ active: v })}
          hint="Kapalıysa takvimde görünmez, otomatik hesaplanmaz"
        />

        {preview && (
          <p class="recurring-preview num" role="status">
            {previewLine(preview, today.value)}
          </p>
        )}
      </div>
    </Sheet>
  )
}
