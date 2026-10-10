import { useEffect, useId, useState } from 'preact/hooks'
import { computed } from '@preact/signals'
import type { SheetRequest } from '../../ui/nav'
import { closeSheet } from '../../ui/nav'
import { Sheet } from '../../ui/components/Sheet'
import { Button, MoneyField, TextField, Choice } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { saveAccount, today, accountById } from '../../data/store'
import { formatLong, toIso } from '../../domain/dates'
import { formatPercent, formatTLExact } from '../../domain/money'
import { viewStatement, rollToCurrentCycle } from '../../domain/statement'
import { figure } from '../../ui/components/Amount'
import {
  initStatementFormState,
  validateStatementForm,
  isStatementFormValid,
  updateStatementLine,
  getMinimumHint,
  interestBoxTitle,
  minimumBelowEstimate,
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
  const interestTitleId = useId()

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

  // One commit path: the payment segment sets the state, "Kaydet" validates and saves it.
  const handleSave = async () => {
    const newErrors = validateStatementForm(formState)
    setErrors(newErrors)

    if (!isStatementFormValid(newErrors)) return

    setViewState('saving')
    try {
      const newLines = [...account.lines]
      newLines[lineIndex] = updateStatementLine(line, formState, cycle)

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
  const minimumLow = minimumBelowEstimate(formState, account.limit)
  const preview = statementInterestPreview(formState, account, view)

  const footer = (
    <Button variant="primary" block type="button" disabled={viewState !== 'form'} onClick={handleSave}>
      {viewState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
    </Button>
  )

  return (
    <Sheet open title="Ekstre" subtitle={`${account.name} · ${line.label}`} onClose={closeSheet} footer={footer}>
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
        {minimumLow && !errors.minimumDue && (
          <p class="statement-minimum-warn">Girdiğin asgari tahminin altında. Ekstrendeki tutarı kontrol et.</p>
        )}

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

        {preview.kind === 'paidFull' && (
          <p class="statement-interest statement-interest-ok">Tamamını ödediğin için bu ekstrede faiz işlemez.</p>
        )}
        {preview.kind === 'charge' && (
          <section class="statement-interest" aria-labelledby={interestTitleId}>
            <h3 class="statement-interest-title" id={interestTitleId}>
              {interestBoxTitle(preview.scenario)}
            </h3>
            <p class="statement-interest-figure num">~{figure(formatTLExact(preview.total))}</p>
            <dl class="statement-interest-rows">
              <div class="statement-interest-row">
                <dt>Akdi faiz · aylık {formatPercent(preview.rate)}</dt>
                <dd class="num">{figure(formatTLExact(preview.contractual))}</dd>
              </div>
              {preview.late > 0 && (
                <div class="statement-interest-row">
                  <dt>
                    Gecikme faizi · aylık {formatPercent(preview.lateRate)}
                    <span class="statement-interest-when">Son ödeme geçer ve asgari eksik kalırsa</span>
                  </dt>
                  <dd class="num">{figure(formatTLExact(preview.late))}</dd>
                </div>
              )}
              <div class="statement-interest-row">
                <dt>KKDF + BSMV</dt>
                <dd class="num">{figure(formatTLExact(preview.taxes))}</dd>
              </div>
              {preview.minimumScenario !== null && (
                <div class="statement-interest-row statement-interest-alt">
                  <dt>Yalnız asgariyi ödersen</dt>
                  <dd class="num">~{figure(formatTLExact(preview.minimumScenario))}</dd>
                </div>
              )}
            </dl>
            <p class="statement-interest-reassure">Tamamını son ödemeye kadar ödersen faiz işlemez.</p>
          </section>
        )}
      </div>
    </Sheet>
  )
}
