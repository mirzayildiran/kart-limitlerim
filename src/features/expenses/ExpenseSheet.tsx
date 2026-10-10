import { useState } from 'preact/hooks'
import { addDays, toIso } from '../../domain/dates'
import { formatTL, formatTLExact } from '../../domain/money'
import type { Expense, IsoDate, Kurus } from '../../domain/types'
import {
  accountById,
  accounts,
  activeCategories,
  cards,
  categoryById,
  createCategory,
  kmhAccounts,
  liquidAccounts,
  newId,
  removeExpense,
  saveExpense,
  today,
} from '../../data/store'
import { accountColors } from '../../ui/accountColor'
import { closeSheet, openSheet } from '../../ui/nav'
import type { SheetRequest } from '../../ui/nav'
import { Button, Choice, ConfirmButton, Field, MoneyField, Pill, Switch, TextField } from '../../ui/components/controls'
import { AccountPicker, accountFree } from '../../ui/components/AccountPicker'
import { CategoryPicker } from '../../ui/components/CategoryPicker'
import { Sheet } from '../../ui/components/Sheet'
import { Icon } from '../../ui/components/Icon'
import { figure } from '../../ui/components/Amount'
import { toast } from '../../ui/components/toast'
import { installmentPreview, interestNudgeAmount, previewAvailable, validateCategoryName } from './expenseModel'
import './expense-sheet.css'

export interface ExpenseSheetProps {
  request: Extract<SheetRequest, { type: 'expense' }>
}

const INSTALLMENT_COUNTS = [2, 3, 6, 9, 12]

function getLastUsedAccountId(): string | null {
  try {
    return localStorage.getItem('kl:lastAccount')
  } catch {
    return null
  }
}

function setLastUsedAccountId(id: string): void {
  try {
    localStorage.setItem('kl:lastAccount', id)
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/** Account the sheet opens on: the edited expense's, the requested one, the last used, else the first listed. */
function initialAccountId(request: ExpenseSheetProps['request']): string | null {
  const known = accountById.value
  const candidates = [request.expense?.accountId, request.accountId, getLastUsedAccountId()]
  for (const id of candidates) {
    if (id && known.has(id)) return id
  }
  // Pre-sorted store signals: cards, then KMH, then liquid; most available first.
  const first = cards.value[0] ?? kmhAccounts.value[0] ?? liquidAccounts.value[0]
  return first?.id ?? null
}

export function ExpenseSheet({ request }: ExpenseSheetProps) {
  const isEdit = !!request.expense
  const oldExpense = request.expense ?? null

  const [amount, setAmount] = useState<Kurus | null>(oldExpense?.amount ?? null)
  const [accountId, setAccountId] = useState<string | null>(() => initialAccountId(request))
  const [categoryId, setCategoryId] = useState<string | null>(oldExpense?.categoryId ?? null)
  const [date, setDate] = useState<string>(oldExpense?.date ?? toIso(today.value))
  const [note, setNote] = useState<string>(oldExpense?.note ?? '')
  const [installments, setInstallments] = useState<string>(String(oldExpense?.installments ?? 1))
  const [affectsAccount, setAffectsAccount] = useState<boolean>(oldExpense?.affectsAccount ?? true)
  const [newCatName, setNewCatName] = useState<string>('')
  const [showNewCat, setShowNewCat] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [newCatError, setNewCatError] = useState<string | null>(null)
  // Validation messages appear only after the first save attempt.
  const [submitted, setSubmitted] = useState<boolean>(false)

  // Plain expressions: signals read during render subscribe this component.
  const selectedAccount = accountId ? accountById.value.get(accountId) ?? null : null
  const selectedCategory = categoryId ? categoryById.value.get(categoryId) ?? null : null
  const isCard = selectedAccount?.kind === 'card'
  const isInstallment = isCard && installments !== '1'
  const availableBefore = selectedAccount ? accountFree(selectedAccount) : null
  const availableAfter =
    selectedAccount && amount !== null
      ? previewAvailable(
          oldExpense,
          {
            id: oldExpense?.id ?? 'temp',
            amount,
            categoryId: categoryId ?? '',
            accountId: selectedAccount.id,
            date: date as IsoDate,
            note,
            affectsAccount,
            installments: parseInt(installments, 10),
            source: oldExpense?.source ?? 'manual',
            createdAt: oldExpense?.createdAt ?? Date.now(),
          },
          selectedAccount,
          accountFree(selectedAccount),
        )
      : null

  const monthlyInterest =
    selectedAccount && amount !== null && (selectedAccount.kind === 'card' || selectedAccount.kind === 'kmh')
      ? interestNudgeAmount(selectedAccount, amount)
      : null

  // Pre-sorted store signals: cards, then KMH, then liquid; most available first.
  const accountList = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value]
  const colors = accountColors(accounts.value)

  const todayIso = toIso(today.value)
  const yesterdayIso = toIso(addDays(today.value, -1))

  const amountRaw = amount === null ? 'Tutarı yaz, örneğin 250.' : amount <= 0 ? 'Tutar sıfırdan büyük olmalı.' : null
  const accountRaw = accountId === null ? 'Önce bir kart ya da hesap ekle.' : null
  const categoryRaw = categoryId === null ? 'Bir kategori seç.' : null
  const dateRaw = date === '' ? 'Bir tarih seç.' : null
  const amountError = submitted ? amountRaw : null
  const accountError = submitted ? accountRaw : null
  const categoryError = submitted ? categoryRaw : null
  const dateError = submitted ? dateRaw : null

  const handleCategoryChange = (value: string) => {
    setCategoryId(value)
    setShowNewCat(false)
  }

  const handleAddCategory = async () => {
    setNewCatError(null)
    const validation = validateCategoryName(newCatName, activeCategories.value.map((c) => c.name))

    if (!validation.valid) {
      setNewCatError(validation.error)
      return
    }

    try {
      const newCat = await createCategory(newCatName)
      setCategoryId(newCat.id)
      setNewCatName('')
      setShowNewCat(false)
    } catch {
      setNewCatError('Kategori oluşturulamadı.')
    }
  }

  const handleSave = async () => {
    setSubmitted(true)
    if (!selectedAccount || amount === null || amount <= 0 || !categoryId || date === '') return

    setIsSaving(true)
    try {
      const expense: Expense = {
        id: oldExpense?.id ?? newId('exp'),
        amount,
        categoryId,
        accountId: selectedAccount.id,
        date: date as IsoDate,
        note,
        affectsAccount,
        installments: selectedAccount.kind === 'card' ? parseInt(installments, 10) : 1,
        source: oldExpense?.source ?? 'manual',
        recurringId: oldExpense?.recurringId ?? null,
        createdAt: oldExpense?.createdAt ?? Date.now(),
      }

      await saveExpense(oldExpense, expense)
      setLastUsedAccountId(selectedAccount.id)

      const categoryName = selectedCategory?.name ?? 'Harcama'
      if (isEdit) {
        toast('Harcama güncellendi')
      } else {
        toast(`${formatTLExact(amount)} ${categoryName} eklendi`, {
          label: 'Geri al',
          run: () => removeExpense(expense),
        })
      }

      closeSheet()
    } catch {
      toast('Harcama kaydedilemedi. Tekrar dene.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!oldExpense) return

    setIsSaving(true)
    try {
      await removeExpense(oldExpense)

      if (oldExpense.affectsAccount) {
        toast('Harcama silindi; tutar hesaba geri eklendi')
      } else {
        toast('Harcama silindi')
      }

      closeSheet()
    } catch {
      toast('Harcama silinemedi. Tekrar dene.')
    } finally {
      setIsSaving(false)
    }
  }

  const installmentText = isInstallment ? installmentPreview(amount, parseInt(installments, 10), affectsAccount) : null
  const afterIsNegative = (availableAfter ?? 0) < 0
  const hasLimit = selectedAccount?.kind === 'card' || selectedAccount?.kind === 'kmh'

  return (
    <Sheet
      open={true}
      title={isEdit ? 'Harcamayı düzenle' : 'Harcama ekle'}
      onClose={closeSheet}
      footer={
        <div class="expense-sheet-footer">
          <Button variant="primary" block type="button" disabled={isSaving} onClick={handleSave}>
            Kaydet
          </Button>
          {isEdit && <ConfirmButton label="Harcamayı sil" confirmLabel="Silmek için tekrar dokun" onConfirm={handleDelete} />}
        </div>
      }
    >
      <div class="expense-sheet">
        {!isEdit && (
          <Button type="button" variant="secondary" block onClick={() => openSheet({ type: 'import' })}>
            <Icon name="image" size={20} />
            Ekran görüntüsünden ekle
          </Button>
        )}

        {/* Only a new expense opens on the keyboard; editing opens on the heading. */}
        <MoneyField label="Tutar" value={amount} onChange={setAmount} error={amountError} size="hero" autofocus={!isEdit} />

        {accountList.length === 0 ? (
          <div class="expense-account-empty">
            <span class="field-label">Nereden ödedin?</span>
            <p>Henüz kart ya da hesap eklemedin.</p>
            <Button type="button" variant="secondary" onClick={() => openSheet({ type: 'account', kind: 'card' })}>
              <Icon name="plus" size={20} />
              Kart ya da hesap ekle
            </Button>
            {accountError && (
              <p class="field-error" role="alert">
                {accountError}
              </p>
            )}
          </div>
        ) : (
          <AccountPicker
            label="Nereden ödedin?"
            accounts={accountList}
            colors={colors}
            value={accountId}
            onChange={setAccountId}
            error={accountError}
          />
        )}

        <div class="expense-category">
          <CategoryPicker
            label="Kategori"
            categories={activeCategories.value}
            value={categoryId}
            onChange={handleCategoryChange}
            onNew={() => setShowNewCat(!showNewCat)}
            newOpen={showNewCat}
            error={categoryError}
          />
          {showNewCat && (
            <div class="expense-new-category">
              <TextField
                label="Yeni kategori adı"
                value={newCatName}
                onChange={setNewCatName}
                placeholder="Örn. Spor"
                error={newCatError}
              />
              <Button
                type="button"
                variant="secondary"
                block
                onClick={handleAddCategory}
                disabled={newCatName.trim().length === 0}
              >
                Kategoriyi ekle
              </Button>
            </div>
          )}
        </div>

        <Field label="Tarih" error={dateError}>
          {(id, desc) => (
            <div class="expense-date">
              <div class="expense-date-quick" role="group" aria-label="Hızlı tarih">
                {[
                  { iso: todayIso, text: 'Bugün' },
                  { iso: yesterdayIso, text: 'Dün' },
                ].map((d) => (
                  <button
                    key={d.text}
                    type="button"
                    class={`expense-date-chip${date === d.iso ? ' is-selected' : ''}`}
                    aria-pressed={date === d.iso}
                    onClick={() => setDate(d.iso)}
                  >
                    {date === d.iso && <Icon name="check" size={16} class="expense-date-check" />}
                    {d.text}
                  </button>
                ))}
              </div>
              <input
                id={id}
                class="input expense-date-input"
                type="date"
                value={date}
                aria-describedby={desc}
                aria-invalid={dateError ? true : undefined}
                onInput={(e) => setDate(e.currentTarget.value)}
              />
            </div>
          )}
        </Field>

        <TextField label="Not" value={note} onChange={setNote} placeholder="Örn. Yemek siparişi" />

        {isCard && (
          <div class="expense-installments">
            <Switch label="Taksitli" checked={isInstallment} onChange={(on) => setInstallments(on ? '2' : '1')} />
            {isInstallment && (
              <Choice<string>
                legend="Kaç taksit?"
                value={installments}
                onChange={setInstallments}
                options={INSTALLMENT_COUNTS.map((n) => ({ value: String(n), label: String(n), name: `${n} taksit` }))}
                look="chips"
              />
            )}
            {installmentText && <p class="expense-installment-preview num">{installmentText}</p>}
          </div>
        )}

        <div class="expense-effect">
          <Switch label="Limitten / bakiyeden düş" checked={affectsAccount} onChange={setAffectsAccount} />

          {selectedAccount && availableBefore !== null && availableAfter !== null && (
            <div class={`expense-preview${afterIsNegative ? ' is-negative' : ''}`}>
              <span class="expense-preview-label">
                {selectedAccount.name} kullanılabilir {hasLimit ? 'limit' : 'bakiye'}
              </span>
              <span class="expense-preview-figures num">
                <span class="expense-preview-before">{figure(formatTL(availableBefore))}</span>
                <span aria-hidden="true">→</span>
                <span class="sr-only">sonra</span>
                <span class="expense-preview-after">{figure(formatTL(availableAfter))}</span>
                {afterIsNegative && <Pill tone="crit">Yetersiz</Pill>}
              </span>
            </div>
          )}
        </div>

        {monthlyInterest !== null && (
          <p class="expense-interest">
            Bu harcamayı ödemeyip taşırsan ayda{' '}
            <strong class="expense-interest-figure num">~{figure(formatTLExact(monthlyInterest))}</strong> faiz işler (vergiler
            dahil).
          </p>
        )}
      </div>
    </Sheet>
  )
}
