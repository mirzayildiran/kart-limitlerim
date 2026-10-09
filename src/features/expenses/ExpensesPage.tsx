import { computed, signal } from '@preact/signals'
import { cycleKeyOf, formatMonth } from '../../domain/dates'
import { formatTL, formatTLExact } from '../../domain/money'
import {
  accountById,
  categoryById,
  expenses,
  today,
} from '../../data/store'
import { openSheet, route } from '../../ui/nav'
import { Button, EmptyState } from '../../ui/components/controls'
import {
  expensesByMonth,
  groupExpensesByDay,
  categoryTotals,
  accountTotals,
  monthNavigation,
} from './expenseModel'
import './expenses-page.css'

// Start with current month
const currentMonth = computed(() => cycleKeyOf(today.value))
const monthOverride = signal<string | null>(null)
const selectedMonth = computed(() => monthOverride.value ?? currentMonth.value)

// Hash routes only match exact paths (nav.ts), so the month lives in state, not the URL.
function setSelectedMonth(key: string) {
  monthOverride.value = key === currentMonth.value ? null : key
}

const monthExpenses = computed(() => {
  const filtered = expensesByMonth(expenses.value, selectedMonth.value)
  return filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
})

const monthTotal = computed(() => {
  return monthExpenses.value.reduce((sum, e) => sum + e.amount, 0)
})

const monthCount = computed(() => monthExpenses.value.length)

const topCategories = computed(() => {
  const totals = categoryTotals(monthExpenses.value)
  if (totals.size === 0) return []

  const max = Math.max(...Array.from(totals.values()))
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([catId, amount]) => ({
      catId,
      amount,
      name: categoryById.value.get(catId)?.name ?? 'Unknown',
      ratio: max > 0 ? amount / max : 0,
    }))
})

const accountBreakdown = computed(() => {
  const totals = accountTotals(monthExpenses.value)
  if (totals.size === 0) return []

  return Array.from(totals.entries())
    .map(([accId, amount]) => ({
      accId,
      amount,
      name: accountById.value.get(accId)?.name ?? 'Silinmiş hesap',
    }))
    .sort((a, b) => b.amount - a.amount)
})

const groupedExpenses = computed(() => {
  return groupExpensesByDay(monthExpenses.value)
})

const nav = computed(() => monthNavigation(selectedMonth.value))

export function ExpensesPage() {
  // Only render if this is the active route
  if (route.value !== 'expenses') return null

  return (
    <div class="expenses-page">
      <header class="expenses-header">
        <h1>Harcamalar</h1>
        <div class="expenses-month-nav">
          <button
            type="button"
            class="expenses-nav-btn"
            onClick={() => setSelectedMonth(nav.value.prev)}
            aria-label="Önceki ay"
          >
            ‹
          </button>
          <span class="expenses-month-label">{formatMonth(selectedMonth.value)}</span>
          <button
            type="button"
            class="expenses-nav-btn"
            disabled={nav.value.next === null}
            onClick={() => nav.value.next && setSelectedMonth(nav.value.next)}
            aria-label="Sonraki ay"
          >
            ›
          </button>
        </div>
      </header>

      {monthCount.value === 0 ? (
        <div class="expenses-empty-wrapper">
          <EmptyState title="Bu ay harcama yok">
            <Button
              variant="primary"
              onClick={() => openSheet({ type: 'expense' })}
            >
              Harcama ekle
            </Button>
          </EmptyState>
        </div>
      ) : (
        <div class="expenses-content">
          {/* Month summary */}
          <section class="expenses-summary">
            <div class="expenses-summary-total">
              <div class="expenses-summary-amount num">
                {formatTL(monthTotal.value)}
              </div>
              <div class="expenses-summary-label">
                {monthCount.value} {monthCount.value === 1 ? 'harcama' : 'harcama'}
              </div>
            </div>
          </section>

          {/* Category breakdown */}
          {topCategories.value.length > 0 && (
            <section class="expenses-categories">
              <h2 class="expenses-section-title">Kategoriler</h2>
              <div class="expenses-category-bars">
                {topCategories.value.map((cat) => (
                  <div key={cat.catId} class="expenses-category-item">
                    <div class="expenses-category-bar">
                      <div
                        class="expenses-category-fill"
                        style={{ width: `${cat.ratio * 100}%` }}
                      />
                    </div>
                    <div class="expenses-category-info">
                      <span class="expenses-category-name">{cat.name}</span>
                      <span class="expenses-category-amount num">
                        {formatTLExact(cat.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Account breakdown */}
          {accountBreakdown.value.length > 0 && (
            <section class="expenses-accounts">
              <h2 class="expenses-section-title">Kaynağa göre</h2>
              <div class="expenses-account-list">
                {accountBreakdown.value.map((acc) => (
                  <div key={acc.accId} class="expenses-account-item">
                    <span class="expenses-account-name">{acc.name}</span>
                    <span class="expenses-account-amount num">
                      {formatTLExact(acc.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Expenses by day */}
          <section class="expenses-list">
            {groupedExpenses.value.map((group) => (
              <div key={group.date} class="expenses-day-group">
                <h3 class="expenses-day-header">{group.day}</h3>
                <div class="expenses-day-items">
                  {group.expenses.map((exp) => {
                    const catName = categoryById.value.get(exp.categoryId)?.name ?? 'Unknown'
                    const accName = accountById.value.get(exp.accountId)?.name ?? 'Silinmiş hesap'
                    const installmentText = exp.installments > 1 ? ` · ${exp.installments} taksit` : ''

                    return (
                      <button
                        key={exp.id}
                        type="button"
                        class="expenses-item"
                        onClick={() => openSheet({ type: 'expense', expense: exp })}
                      >
                        <div class="expenses-item-main">
                          <div class="expenses-item-label">
                            {exp.note || catName}
                          </div>
                          <div class="expenses-item-sub">
                            {catName} · {accName}
                            {installmentText}
                          </div>
                        </div>
                        <div class="expenses-item-amount num">
                          {formatTLExact(exp.amount)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* Add expense button */}
          <div class="expenses-add-button">
            <Button
              variant="primary"
              block
              onClick={() => openSheet({ type: 'expense' })}
            >
              Harcama ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
