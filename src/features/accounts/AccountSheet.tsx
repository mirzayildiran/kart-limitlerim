import { useEffect, useState } from 'preact/hooks'
import { computed } from '@preact/signals'
import type { SheetRequest } from '../../ui/nav'
import { closeSheet } from '../../ui/nav'
import { Sheet } from '../../ui/components/Sheet'
import { Icon } from '../../ui/components/Icon'
import { Disclosure } from '../../ui/components/Disclosure'
import { Button, MoneyField, TextField, Choice, ConfirmButton } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { saveAccount, removeAccount, newId, accountById } from '../../data/store'
import { CURRENT_RATES } from '../../domain/rates'
import { formatTLExact } from '../../domain/money'
import type { Account, CardAccount } from '../../domain/types'
import {
  initFormState,
  validateForm,
  isFormValid,
  formStateToAccount,
  mergeLines,
  shouldWarnAvailable,
  type FormState,
  type CardFormState,
  type KmhFormState,
  type BankFormState,
  type CashFormState,
  type FormErrors,
} from './accountForm'
import './accountsheet.css'

export interface AccountSheetProps {
  request: Extract<SheetRequest, { type: 'account' }>
}

type ViewState = 'form' | 'saving' | 'error'

export function AccountSheet({ request }: AccountSheetProps) {
  const id = request.id
  const kind = request.kind ?? 'card'
  const account = computed(() => accountById.value.get(id ?? '')).value

  const [formState, setFormState] = useState<FormState>(() => initFormState(account, kind))
  const [errors, setErrors] = useState<FormErrors>({})
  const [viewState, setViewState] = useState<ViewState>('form')

  // When kind changes, reset form
  useEffect(() => {
    setFormState(initFormState(account, kind))
    setErrors({})
  }, [kind])

  const isEdit = id && account

  const title = isEdit ? (account?.name ?? 'Hesap') : 'Hesap ekle'

  const handleKindChange = (newKind: string) => {
    const newForm = initFormState(undefined, newKind as typeof kind)
    newForm.name = formState.name
    setFormState(newForm)
  }

  const handleSave = async () => {
    const newErrors = validateForm(formState)
    setErrors(newErrors)

    if (!isFormValid(newErrors)) return

    setViewState('saving')
    try {
      const accountId = id || newId('acc')
      const builtAccount = formStateToAccount(formState, accountId, isEdit ? account?.createdAt : undefined)

      // Merge with existing lines' statement/interest data if editing a card account
      let finalAccount: Account = builtAccount
      if (isEdit && account && account.kind === 'card' && formState.kind === 'card' && builtAccount.kind === 'card') {
        const cardAccount = account
        const formCardState = formState as CardFormState
        const merged = mergeLines(cardAccount.lines, formCardState.lines, newId)
        const cardBuilt = builtAccount as CardAccount
        finalAccount = { ...cardBuilt, lines: merged }
      }

      await saveAccount(finalAccount)
      toast(isEdit ? 'Kaydedildi' : 'Kaydedildi')
      closeSheet()
    } catch (err) {
      console.error(err)
      setViewState('form')
      toast('Kaydedilemedi. Tekrar dene.')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await removeAccount(id)
      toast(`${account?.name ?? 'Hesap'} silindi`)
      closeSheet()
    } catch (err) {
      console.error(err)
      toast('Silinemedi. Tekrar dene.')
    }
  }

  // Segment labels: one short word each so the row never wraps at 360 px.
  const kindDisplayNames = {
    card: 'Kart',
    kmh: 'KMH',
    bank: 'Hesap',
    cash: 'Nakit',
  }

  const footer = (
    <div class="account-sheet-footer">
      <Button
        variant="primary"
        block
        type="button"
        disabled={viewState !== 'form'}
        onClick={handleSave}
      >
        {viewState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
      </Button>
      {isEdit && (
        <ConfirmButton
          label="Hesabı sil"
          confirmLabel="Silmek için tekrar dokun"
          onConfirm={handleDelete}
        />
      )}
    </div>
  )

  return (
    <Sheet open title={title} onClose={closeSheet} footer={footer}>
      <div class="account-sheet">
        {!isEdit && (
          <Choice
            legend="Hesap türü"
            hideLegend
            look="segment"
            value={formState.kind}
            onChange={handleKindChange}
            options={['card', 'kmh', 'bank', 'cash'].map((k) => ({
              value: k,
              label: kindDisplayNames[k as keyof typeof kindDisplayNames],
            }))}
          />
        )}

        <TextField
          label="Adı"
          value={formState.name}
          onChange={(v) => setFormState({ ...formState, name: v })}
          placeholder={formState.kind === 'cash' ? 'Nakit' : 'Banka adı'}
          error={errors.name}
        />

        {formState.kind === 'card' && <CardFields state={formState as CardFormState} errors={errors} setFormState={setFormState} />}
        {formState.kind === 'kmh' && <KmhFields state={formState} errors={errors} setFormState={setFormState} />}
        {formState.kind === 'bank' && <BankFields state={formState} errors={errors} setFormState={setFormState} />}
        {formState.kind === 'cash' && <CashFields state={formState} errors={errors} setFormState={setFormState} />}
      </div>
    </Sheet>
  )
}

function CardFields({ state, errors, setFormState }: { state: CardFormState; errors: FormErrors; setFormState: (s: FormState) => void }) {
  const warning = shouldWarnAvailable(state.available, state.limit)

  return (
    <>
      <MoneyField
        label="Banka uygulamasında görünen boş limit"
        value={state.available}
        onChange={(v) => setFormState({ ...state, available: v })}
        hint="Kullanılabilir limit"
        error={errors.available}
      />
      <MoneyField
        label="Toplam limit"
        value={state.limit}
        onChange={(v) => setFormState({ ...state, limit: v })}
        error={errors.limit}
      />
      {warning && (
        <p class="card-sheet-warning">Kullanılabilir limit toplam limitten büyük görünüyor</p>
      )}

      <div class="card-lines">
        <label class="field-label">Kartlar</label>
        {state.lines.map((line, i) => (
          <div key={line.id} class="card-line">
            <TextField
              label="Kart adı"
              value={line.label}
              onChange={(v) => {
                const newLines = [...state.lines]
                newLines[i].label = v
                setFormState({ ...state, lines: newLines })
              }}
              placeholder="Kredi kartı"
              error={errors.lines?.[i]?.label}
            />
            <TextField
              label="Kesim günü"
              type="number"
              value={line.cutDay}
              onChange={(v) => {
                const newLines = [...state.lines]
                newLines[i].cutDay = v
                setFormState({ ...state, lines: newLines })
              }}
              min={1}
              max={31}
              error={errors.lines?.[i]?.cutDay}
            />
            <TextField
              label="Son ödeme, kesimden kaç gün sonra"
              type="number"
              value={line.dueOffsetDays}
              onChange={(v) => {
                const newLines = [...state.lines]
                newLines[i].dueOffsetDays = v
                setFormState({ ...state, lines: newLines })
              }}
              min={1}
              max={30}
              error={errors.lines?.[i]?.dueOffsetDays}
            />
            {state.lines.length >= 2 && (
              <MoneyField
                label="Alt limit (varsa)"
                value={line.subLimit}
                onChange={(v) => {
                  const newLines = [...state.lines]
                  newLines[i].subLimit = v
                  setFormState({ ...state, lines: newLines })
                }}
                hint="İsteğe bağlı"
                error={errors.lines?.[i]?.subLimit}
              />
            )}
            {state.lines.length >= 2 && (
              <button
                type="button"
                class="card-line-remove"
                onClick={() => {
                  const newLines = state.lines.filter((_, j) => j !== i)
                  setFormState({ ...state, lines: newLines })
                }}
                aria-label="Kartı kaldır"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          class="card-line-add"
          onClick={() => {
            const newLines = [...state.lines, { id: '', label: '', cutDay: '1', dueOffsetDays: '10', subLimit: null }]
            setFormState({ ...state, lines: newLines })
          }}
        >
          <Icon name="plus" size={18} />
          Aynı limite bağlı kart ekle
        </button>
        {state.lines.length >= 1 && (
          <p class="field-hint">İki kartın aynı müşteri limitini paylaşıyorsa ikisini de buraya ekle.</p>
        )}
      </div>

      <div class="rate-override">
        <Disclosure label="Faiz oranı">
          <TextField
            label="Aylık sözleşmeli oran"
            type="number"
            value={state.contractualRate ? String(state.contractualRate) : ''}
            onChange={(v) => setFormState({ ...state, contractualRate: v === '' ? null : parseFloat(v) })}
            placeholder="Boş bırakırsan TCMB azami oranı kullanılır"
            hint={`TCMB azami: ${formatTLExact(CURRENT_RATES.cardTiers[0].contractual * 100)}% ay`}
            error={errors.contractualRate}
            inputMode="numeric"
          />
          <TextField
            label="Aylık geç ödeme oranı"
            type="number"
            value={state.lateRate ? String(state.lateRate) : ''}
            onChange={(v) => setFormState({ ...state, lateRate: v === '' ? null : parseFloat(v) })}
            placeholder="Boş bırakırsan TCMB azami oranı kullanılır"
            error={errors.lateRate}
            inputMode="numeric"
          />
        </Disclosure>
      </div>
    </>
  )
}

function KmhFields({ state, errors, setFormState }: { state: KmhFormState; errors: FormErrors; setFormState: (s: FormState) => void }) {
  const warning = shouldWarnAvailable(state.available, state.limit)

  return (
    <>
      <MoneyField
        label="Kullanılabilir limit"
        value={state.available}
        onChange={(v) => setFormState({ ...state, available: v })}
        error={errors.available}
      />
      <MoneyField
        label="Toplam limit"
        value={state.limit}
        onChange={(v) => setFormState({ ...state, limit: v })}
        error={errors.limit}
      />
      {warning && (
        <p class="card-sheet-warning">Kullanılabilir limit toplam limitten büyük görünüyor</p>
      )}

      <div class="rate-override">
        <Disclosure label="Faiz oranı">
          <TextField
            label="Aylık sözleşmeli oran"
            type="number"
            value={state.contractualRate ? String(state.contractualRate) : ''}
            onChange={(v) => setFormState({ ...state, contractualRate: v === '' ? null : parseFloat(v) })}
            placeholder="Boş bırakırsan TCMB azami oranı kullanılır"
            hint={`TCMB azami: ${CURRENT_RATES.cash.contractual}% ay`}
            error={errors.contractualRate}
            inputMode="numeric"
          />
          <TextField
            label="Aylık geç ödeme oranı"
            type="number"
            value={state.lateRate ? String(state.lateRate) : ''}
            onChange={(v) => setFormState({ ...state, lateRate: v === '' ? null : parseFloat(v) })}
            placeholder="Boş bırakırsan TCMB azami oranı kullanılır"
            error={errors.lateRate}
            inputMode="numeric"
          />
        </Disclosure>
      </div>
    </>
  )
}

function BankFields({ state, errors, setFormState }: { state: BankFormState; errors: FormErrors; setFormState: (s: FormState) => void }) {
  return (
    <>
      <MoneyField
        label="Bakiye"
        value={state.balance}
        onChange={(v) => setFormState({ ...state, balance: v })}
        error={errors.balance}
      />
      <TextField
        label="Not"
        value={state.note}
        onChange={(v) => setFormState({ ...state, note: v })}
        placeholder="Örn. Havale / FAST"
      />
    </>
  )
}

function CashFields({ state, errors, setFormState }: { state: CashFormState; errors: FormErrors; setFormState: (s: FormState) => void }) {
  return (
    <MoneyField
      label="Elindeki nakit"
      value={state.balance}
      onChange={(v) => setFormState({ ...state, balance: v })}
      error={errors.balance}
    />
  )
}
