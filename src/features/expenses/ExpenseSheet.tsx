import { useEffect, useState } from 'preact/hooks'
import { toIso } from '../../domain/dates'
import { formatTL, formatTLExact } from '../../domain/money'
import type { Account, Expense, IsoDate, Kurus } from '../../domain/types'
import { createCategory, newId, removeExpense, saveExpense } from '../../data/store'
import {
  activeCategories,
  accountById,
  cards,
  categoryById,
  kmhAccounts,
  liquidAccounts,
  today,
} from '../../data/store'
import { closeSheet, openSheet } from '../../ui/nav'
import {
  Button,
  Choice,
  ConfirmButton,
  Field,
  MoneyField,
  Pill,
  Switch,
  TextField,
} from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { toast } from '../../ui/components/toast'
import type { SheetRequest } from '../../ui/nav'
import {
  interestNudge,
  previewAvailable,
  validateCategoryName,
} from './expenseModel'
import './expense-sheet.css'

export interface ExpenseSheetProps {
  request: Extract<SheetRequest, { type: 'expense' }>
}

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

function canFocusAccount(account: Account): boolean {
  if (account.kind === 'card' || account.kind === 'kmh') {
    return account.available > 0
  }
  if (account.kind === 'bank' || account.kind === 'cash') {
    return account.balance > 0
  }
  return false
}

function getAccountBalance(account: Account): Kurus {
  if (account.kind === 'card' || account.kind === 'kmh') {
    return account.available
  }
  return account.balance
}

export function ExpenseSheet({ request }: ExpenseSheetProps) {
  const isEdit = !!request.expense
  const oldExpense = request.expense ?? null

  const [amount, setAmount] = useState<Kurus | null>(oldExpense?.amount ?? null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(oldExpense?.categoryId ?? null)
  const [date, setDate] = useState<string>(oldExpense?.date ?? toIso(today.value))
  const [note, setNote] = useState<string>(oldExpense?.note ?? '')
  const [installments, setInstallments] = useState<string>(String(oldExpense?.installments ?? 1))
  const [affectsAccount, setAffectsAccount] = useState<boolean>(oldExpense?.affectsAccount ?? true)
  const [newCatName, setNewCatName] = useState<string>('')
  const [showNewCat, setShowNewCat] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [newCatError, setNewCatError] = useState<string | null>(null)

  // Initialize accountId on mount
  useEffect(() => {
    if (accountId !== null) return

    let id: string | null = null

    // Use request.accountId if provided
    if (request.accountId) {
      id = request.accountId
    }
    // Use the last used account if available
    else {
      const lastUsed = getLastUsedAccountId()
      if (lastUsed && accountById.value.has(lastUsed)) {
        id = lastUsed
      }
    }

    // Fall back to the first card, then KMH, then liquid (all pre-sorted by most available)
    if (!id) {
      const allAccounts = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value]
      if (allAccounts.length > 0) {
        id = allAccounts[0].id
      }
    }

    if (id) {
      setAccountId(id)
    }
  }, [])

  // Plain expressions: signals read during render subscribe this component.
  const selectedAccount = accountId ? accountById.value.get(accountId) ?? null : null
  const selectedCategory = categoryId ? categoryById.value.get(categoryId) ?? null : null
  const availableBefore = selectedAccount ? getAccountBalance(selectedAccount) : null
  const availableAfter =
    selectedAccount && amount !== null
      ? previewAvailable(
          oldExpense,
          {
            id: oldExpense?.id ?? 'temp',
            amount,
            categoryId: categoryId ?? '',
            accountId: selectedAccount.id,
            date,
            note,
            affectsAccount,
            installments: parseInt(installments, 10),
            source: oldExpense?.source ?? 'manual',
            createdAt: oldExpense?.createdAt ?? Date.now(),
          },
          selectedAccount,
          getAccountBalance(selectedAccount),
        )
      : null

  const interestText =
    selectedAccount && amount !== null && (selectedAccount.kind === 'card' || selectedAccount.kind === 'kmh')
      ? interestNudge(selectedAccount, amount)
      : null

  const categoryOptions = [
    ...activeCategories.value.map((c) => ({ value: c.id, label: c.name })),
    { value: '__new__', label: '+ Yeni' },
  ]

  // Pre-sorted store signals: cards, then KMH, then liquid; most available first.
  const accountOptions = [...cards.value, ...kmhAccounts.value, ...liquidAccounts.value].map((a) => ({
    account: a,
    canFocus: canFocusAccount(a),
  }))

  const amountError = amount === null ? 'Tutarı yaz, örneğin 250.' : amount <= 0 ? 'Tutar sıfırdan büyük olmalı.' : null
  const accountError = accountId === null ? 'Önce bir kart ya da hesap ekle.' : null

  const handleCategoryChange = async (value: string) => {
    if (value === '__new__') {
      setShowNewCat(true)
    } else {
      setCategoryId(value)
      setShowNewCat(false)
    }
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
    } catch (e) {
      setNewCatError('Kategori oluşturulamadı.')
    }
  }

  const handleSave = async () => {
    if (!selectedAccount || amount === null || !categoryId) return

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
    } catch (e) {
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
    } catch (e) {
      toast('Harcama silinemedi. Tekrar dene.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenAccountSheet = () => {
    openSheet({ type: 'account', kind: 'card' })
  }

  const isValid = amount !== null && accountId !== null && categoryId !== null
  const afterIsNegative = (availableAfter ?? 0) < 0

  return (
    <Sheet
      open={true}
      title={isEdit ? 'Harcamayı düzenle' : 'Harcama ekle'}
      onClose={closeSheet}
      footer={
        <div class="expense-sheet-footer">
          <Button
            variant="primary"
            block
            type="button"
            disabled={!isValid || isSaving}
            onClick={handleSave}
          >
            Kaydet
          </Button>
          {isEdit && (
            <ConfirmButton
              label="Harcamayı sil"
              confirmLabel="Silmek için tekrar dokun"
              onConfirm={handleDelete}
            />
          )}
        </div>
      }
    >
      <div class="expense-sheet">
        <MoneyField
          label="Tutar"
          value={amount}
          onChange={setAmount}
          error={amountError}
          autofocus
        />

        <Field label="Nereden ödedin?" error={accountError}>
          {() => (
            <div class="expense-account-chips">
              {accountOptions.length === 0 ? (
                <div class="expense-account-empty">
                  <p>Henüz kart ya da hesap eklemediniz.</p>
                  <Button type="button" variant="primary" onClick={handleOpenAccountSheet}>
                    Kart Ekle
                  </Button>
                </div>
              ) : (
                <div class="expense-account-scroll">
                  {accountOptions.map(({ account: acct, canFocus }) => (
                    <label key={acct.id} class={`expense-chip ${!canFocus ? 'is-disabled' : ''}`}>
                      <input
                        type="radio"
                        name="account"
                        value={acct.id}
                        checked={accountId === acct.id}
                        onChange={() => setAccountId(acct.id)}
                      />
                      <span class="expense-chip-name">{acct.name}</span>
                      <span class="expense-chip-balance num">
                        {formatTL(getAccountBalance(acct))}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="Kategori">
          {() => (
            <div>
              <Choice<string>
                legend="Kategori"
                hideLegend
                options={categoryOptions}
                value={categoryId}
                onChange={handleCategoryChange}
                look="chips"
              />
              {showNewCat && (
                <div class="expense-new-category">
                  <TextField
                    label="Kategori adı"
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
                    Ekle
                  </Button>
                </div>
              )}
            </div>
          )}
        </Field>

        <div class="expense-date-note">
          <TextField
            label="Tarih"
            type="date"
            value={date}
            onChange={setDate}
          />
          <TextField
            label="Not"
            value={note}
            onChange={setNote}
            placeholder="Örn. Yemek siparişi"
          />
        </div>

        {selectedAccount?.kind === 'card' && (
          <Choice<string>
            legend="Taksit"
            value={installments}
            onChange={setInstallments}
            options={[1, 2, 3, 6, 9, 12].map((n) => ({
              value: String(n),
              label: n === 1 ? 'Tek çekim' : `${n}`,
              name: n === 1 ? 'Tek çekim' : `${n} taksit`,
            }))}
            look="segment"
          />
        )}

        <Switch
          label="Limitten / bakiyeden düş"
          checked={affectsAccount}
          onChange={setAffectsAccount}
        />

        {selectedAccount && availableBefore !== null && availableAfter !== null && (
          <div class={`expense-preview ${afterIsNegative ? 'is-negative' : ''}`}>
            <span>
              {selectedAccount.name} kullanılabilir{' '}
              {selectedAccount.kind === 'card' || selectedAccount.kind === 'kmh' ? 'limit' : 'bakiye'}
            </span>
            <span class="num">
              {formatTL(availableBefore)} → {formatTL(availableAfter)}
            </span>
            {afterIsNegative && <Pill tone="crit">(yetersiz)</Pill>}
          </div>
        )}

        {interestText && (
          <div class="expense-interest-nudge">
            <Pill tone="crit">{interestText}</Pill>
          </div>
        )}
      </div>
    </Sheet>
  )
}
