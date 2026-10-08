import { useEffect, useState } from 'preact/hooks'
import { computed } from '@preact/signals'
import type { SheetRequest } from '../../ui/nav'
import { closeSheet } from '../../ui/nav'
import { Sheet } from '../../ui/components/Sheet'
import { Button, MoneyField, TextField, Choice } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { saveAccount, today, accountById } from '../../data/store'
import { formatLong, toIso } from '../../domain/dates'
import { formatTLExact } from '../../domain/money'
import { viewStatement, rollToCurrentCycle } from '../../domain/statement'
import {
  initStatementFormState,
  validateStatementForm,
  isStatementFormValid,
  updateStatementLine,
  getMinimumHint,
  statementInterestPreview,
  type StatementFormState,
  type StatementFormErrors,
} from './statementForm'
import './statementsheet.css'

export interface StatementSheetProps {
  request: Extract<SheetRequest, { type: 'statement' }>
}

type ViewState = 'form' | 'saving'

export function StatementSheet({ request }: StatementSheetProps) {
  const { accountId, lineIndex } = request
  const account = computed(() => accountById.value.get(accountId)).value
  const line = account && account.kind === 'card' ? account.lines[lineIndex] : null
  const currentLine = line ? rollToCurrentCycle(line, today.value) : null

  const [formState, setFormState] = useState<StatementFormState>(() => initStatementFormState(currentLine ?? line!))
  const [errors, setErrors] = useState<StatementFormErrors>({})
  const [viewState, setViewState] = useState<ViewState>('form')

  // Redirect if account or line not found
  useEffect(() => {
    if (!account || !line) {
      closeSheet()
    }
  }, [account, line])

  if (!account || account.kind !== 'card' || !line || !currentLine) {
    return null
  }

  const view = viewStatement(currentLine, today.value)
  const cycle = view.cycle
  const title = `${account.name} · ${line.label}`

  const handleQuickSave = async (payment: 'minimum' | 'full') => {
    const newForm: StatementFormState = {
      ...formState,
      payment: payment === 'minimum' ? 'minimum' : 'full',
      paidAmount: payment === 'minimum' ? (formState.minimumDue ?? 0) : (formState.statementDebt ?? 0),
    }
    await performSave(newForm)
  }

  const handleSave = async () => {
    const newErrors = validateStatementForm(formState)
    setErrors(newErrors)

    if (!isStatementFormValid(newErrors)) return

    await performSave(formState)
  }

  const performSave = async (form: StatementFormState) => {
    setViewState('saving')
    try {
      const newLines = [...account.lines]
      const newLine = updateStatementLine(line, form, cycle)
      newLines[lineIndex] = newLine

      await saveAccount({ ...account, lines: newLines })
      toast('Ekstre kaydedildi')
      closeSheet()
    } catch (err) {
      console.error(err)
      setViewState('form')
      toast('Kaydedilemedi. Tekrar dene.')
    }
  }

  const paymentOptions = [
    { value: 'unpaid' as const, label: 'Ödenmedi' },
    { value: 'partial' as const, label: 'Kısmi' },
    { value: 'minimum' as const, label: 'Asgari' },
    { value: 'full' as const, label: 'Tamamı' },
  ]

  const estimatedDueDate = view.due
  const dueDateString = toIso(estimatedDueDate)

  const minimumHint = getMinimumHint(formState.statementDebt, account.limit)

  const footer = (
    <div class="statement-sheet-footer">
      <div class="statement-sheet-actions">
        <Button
          type="button"
          block
          variant="secondary"
          disabled={viewState !== 'form'}
          onClick={() => handleQuickSave('minimum')}
        >
          Asgariyi ödedim
        </Button>
        <Button
          type="button"
          block
          variant="secondary"
          disabled={viewState !== 'form'}
          onClick={() => handleQuickSave('full')}
        >
          Tamamını ödedim
        </Button>
      </div>
      <Button
        variant="primary"
        block
        type="button"
        disabled={viewState !== 'form'}
        onClick={handleSave}
      >
        {viewState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
      </Button>
    </div>
  )

  return (
    <Sheet open title={title} onClose={closeSheet} footer={footer}>
      <div class="statement-sheet">
        <div class="statement-summary">
          <p>
            <span>Kesim {formatLong(view.cut)}</span>
            <span>Sonraki kesim {formatLong(view.nextCut)}</span>
          </p>
        </div>

        <MoneyField
          label="Dönem borcu (ekstre tutarı)"
          value={formState.statementDebt}
          onChange={(v) => setFormState({ ...formState, statementDebt: v })}
          error={errors.statementDebt}
        />

        <MoneyField
          label="Asgari ödeme"
          value={formState.minimumDue}
          onChange={(v) => setFormState({ ...formState, minimumDue: v })}
          hint={minimumHint || undefined}
          error={errors.minimumDue}
        />

        <TextField
          label="Son ödeme tarihi"
          type="date"
          value={formState.dueDate || dueDateString}
          onChange={(v) => setFormState({ ...formState, dueDate: v })}
          error={errors.dueDate}
        />

        <Choice
          legend="Ödeme durumu"
          options={paymentOptions}
          value={formState.payment}
          onChange={(v) => setFormState({ ...formState, payment: v })}
          look="segment"
        />

        {formState.payment === 'partial' && (
          <MoneyField
            label="Ödenen tutar"
            value={formState.paidAmount}
            onChange={(v) => setFormState({ ...formState, paidAmount: v })}
            error={errors.paidAmount}
          />
        )}

        <MoneyField
          label="Ekstredeki faiz tutarı (varsa)"
          value={formState.interestCharged}
          onChange={(v) => setFormState({ ...formState, interestCharged: v })}
          hint="Ekstrende geçen dönemden faiz yazıyorsa gir; toplam faiz hesabı bunu kullanır."
        />

        {(() => {
          const preview = statementInterestPreview(formState, account, view)
          if (preview.kind === 'none') return null
          if (preview.kind === 'paidFull') {
            return (
              <div class="statement-interest statement-interest-ok">
                Tamamını ödediğin için bu ekstrede faiz işlemez.
              </div>
            )
          }
          return (
            <div class="statement-interest">
              <p class="statement-interest-title">Bu ekstrede işleyecek faiz: ~{formatTLExact(preview.total)}</p>
              <p class="statement-interest-detail">
                Akdi {formatTLExact(preview.contractual)} + gecikme {formatTLExact(preview.late)} + vergiler{' '}
                {formatTLExact(preview.taxes)} · aylık %{preview.rate}
              </p>
              {preview.minimumScenario !== null && (
                <p class="statement-interest-minimum">Yalnız asgariyi ödersen: ~{formatTLExact(preview.minimumScenario)}</p>
              )}
            </div>
          )
        })()}
      </div>
    </Sheet>
  )
}
