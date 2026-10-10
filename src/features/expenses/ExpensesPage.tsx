import { computed, signal } from '@preact/signals'
import { cycleKeyOf, formatMonth } from '../../domain/dates'
import { displayHue } from '../../domain/categories'
import { formatTLExact } from '../../domain/money'
import {
  accountById,
  accounts,
  categoryById,
  expenses,
  today,
} from '../../data/store'
import { openSheet, route } from '../../ui/nav'
import { Button, EmptyState } from '../../ui/components/controls'
import { Amount, figure } from '../../ui/components/Amount'
import { Icon } from '../../ui/components/Icon'
import { accountColors } from '../../ui/accountColor'
import {
  dayTotal,
  expensesByMonth,
  filterExpenses,
  groupExpensesByDay,
  categoryTotals,
  accountTotals,
  monthNavigation,
} from './expenseModel'
import './expenses-page.css'

const CATEGORY_PREVIEW = 6

// Start with current month
const currentMonth = computed(() => cycleKeyOf(today.value))
const monthOverride = signal<string | null>(null)
const selectedMonth = computed(() => monthOverride.value ?? currentMonth.value)

// Page-local filter state. Reset whenever the month changes.
const categoryFilter = signal<string | null>(null)
const accountFilter = signal<string | null>(null)
const showAllCategories = signal(false)
// Bumped on every filter change so the list cross-fades (remounted under a new key).
const listSwap = signal(0)

// Hash routes only match exact paths (nav.ts), so the month lives in state, not the URL.
function setSelectedMonth(key: string) {
  monthOverride.value = key === currentMonth.value ? null : key
  categoryFilter.value = null
  accountFilter.value = null
  showAllCategories.value = false
}

function toggleCategory(id: string) {
  categoryFilter.value = categoryFilter.value === id ? null : id
  listSwap.value++
}

function toggleAccount(id: string) {
  accountFilter.value = accountFilter.value === id ? null : id
  listSwap.value++
}

function clearFilters() {
  categoryFilter.value = null
  accountFilter.value = null
  listSwap.value++
}

const monthExpenses = computed(() => {
  const filtered = expensesByMonth(expenses.value, selectedMonth.value)
  return filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
})

// Breakdowns always describe the whole month; filters narrow the figure and the list only.
const visibleExpenses = computed(() =>
  filterExpenses(monthExpenses.value, {
    categoryId: categoryFilter.value ?? undefined,
    accountId: accountFilter.value ?? undefined,
  }),
)

const visibleTotal = computed(() => dayTotal(visibleExpenses.value))
const visibleCount = computed(() => visibleExpenses.value.length)
const isFiltered = computed(() => categoryFilter.value !== null || accountFilter.value !== null)

const topCategories = computed(() => {
  const totals = categoryTotals(monthExpenses.value)
  if (totals.size === 0) return []

  const max = Math.max(...Array.from(totals.values()))
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([catId, amount]) => ({
      catId,
      amount,
      name: categoryById.value.get(catId)?.name ?? 'Diğer',
      hue: categoryById.value.get(catId)?.hue ?? 160,
      ratio: max > 0 ? amount / max : 0,
    }))
})

const categoryRows = computed(() =>
  showAllCategories.value ? topCategories.value : topCategories.value.slice(0, CATEGORY_PREVIEW),
)

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
  return groupExpensesByDay(visibleExpenses.value)
})

const nav = computed(() => monthNavigation(selectedMonth.value))
const colors = computed(() => accountColors(accounts.value))

export function ExpensesPage() {
  // Only render if this is the active route
  if (route.value !== 'expenses') return null

  const catFilter = categoryFilter.value
  const accFilter = accountFilter.value
  const catName = catFilter ? (categoryById.value.get(catFilter)?.name ?? 'Diğer') : null
  const accName = accFilter ? (accountById.value.get(accFilter)?.name ?? 'Silinmiş hesap') : null
  const swapped = listSwap.value > 0

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
            <Icon name="back" size={20} />
          </button>
          <span class="expenses-month-label">{formatMonth(selectedMonth.value)}</span>
          <button
            type="button"
            class="expenses-nav-btn"
            disabled={nav.value.next === null}
            onClick={() => nav.value.next && setSelectedMonth(nav.value.next)}
            aria-label="Sonraki ay"
          >
            <Icon name="chevron" size={20} />
          </button>
        </div>
      </header>

      {monthExpenses.value.length === 0 ? (
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
          {/* Month summary: figure and count follow the active filter */}
          <section class="expenses-summary" aria-label="Toplam">
            <div class="expenses-summary-total">
              <div class="expenses-summary-amount">
                <Amount value={visibleTotal.value} size="hero" />
              </div>
              <div class="expenses-summary-label">{visibleCount.value} harcama</div>
              {isFiltered.value && (
                <div class="expenses-chips">
                  {catFilter && catName && (
                    <button
                      type="button"
                      class="expenses-chip"
                      aria-label={`${catName} filtresini kaldır`}
                      onClick={() => toggleCategory(catFilter)}
                    >
                      <span>{catName}</span>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                  {accFilter && accName && (
                    <button
                      type="button"
                      class="expenses-chip"
                      aria-label={`${accName} filtresini kaldır`}
                      onClick={() => toggleAccount(accFilter)}
                    >
                      <span>{accName}</span>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Category breakdown: toggles a category filter */}
          {topCategories.value.length > 0 && (
            <section class="expenses-categories">
              <h2 class="expenses-section-title">Kategoriler</h2>
              <div class="expenses-category-list">
                {categoryRows.value.map((cat) => {
                  const active = catFilter === cat.catId
                  return (
                    <button
                      key={cat.catId}
                      type="button"
                      class={`expenses-category cat-color${active ? ' is-active' : ''}`}
                      style={{ '--h': displayHue(cat.hue) }}
                      aria-pressed={active}
                      onClick={() => toggleCategory(cat.catId)}
                    >
                      <span class="expenses-category-name">{cat.name}</span>
                      <span class="expenses-category-end">
                        <Icon name="check" size={16} class="expenses-category-check" />
                        <span class="expenses-category-amount num">{figure(formatTLExact(cat.amount))}</span>
                      </span>
                      <span class="expenses-category-bar" aria-hidden="true">
                        <span class="expenses-category-fill" style={{ width: `${cat.ratio * 100}%` }} />
                      </span>
                    </button>
                  )
                })}
              </div>
              {topCategories.value.length > CATEGORY_PREVIEW && (
                <Button
                  variant="ghost"
                  block
                  aria-expanded={showAllCategories.value}
                  onClick={() => (showAllCategories.value = !showAllCategories.value)}
                >
                  {showAllCategories.value ? 'Daha az göster' : 'Tümünü göster'}
                </Button>
              )}
            </section>
          )}

          {/* Account breakdown: coloured tiles in each wallet colour, toggles an account filter */}
          {accountBreakdown.value.length > 0 && (
            <section class="expenses-accounts">
              <h2 class="expenses-section-title">Kaynağa göre</h2>
              <div class="expenses-account-grid">
                {accountBreakdown.value.map((acc) => {
                  const active = accFilter === acc.accId
                  return (
                    <button
                      key={acc.accId}
                      type="button"
                      class={`expenses-account${active ? ' is-active' : ''}`}
                      data-slot={colors.value.get(acc.accId) ?? 1}
                      aria-pressed={active}
                      onClick={() => toggleAccount(acc.accId)}
                    >
                      <span class="expenses-account-name">{acc.name}</span>
                      <Amount value={acc.amount} size="md" />
                      {active && <Icon name="check" size={16} class="expenses-account-check" />}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Expenses by day */}
          <section class="expenses-list" aria-labelledby="expenses-list-title">
            <h2 id="expenses-list-title" class="expenses-section-title">Liste</h2>
            {groupedExpenses.value.length === 0 ? (
              <div class="expenses-none">
                <p>Bu filtrede harcama yok</p>
                <Button variant="ghost" onClick={clearFilters}>
                  Filtreyi kaldır
                </Button>
              </div>
            ) : (
              // One slate container for the whole month; each day is a labelled section inside it.
              <div key={listSwap.value} class={`expenses-list-box${swapped ? ' is-swapped' : ''}`}>
                {groupedExpenses.value.map((group) => (
                  <section key={group.date} class="expenses-day" aria-labelledby={`expenses-day-${group.date}`}>
                    <div class="expenses-day-head">
                      <h3 id={`expenses-day-${group.date}`} class="expenses-day-header">{group.day}</h3>
                      <span class="expenses-day-total num">{figure(formatTLExact(dayTotal(group.expenses)))}</span>
                    </div>
                    <div>
                      {group.expenses.map((exp) => {
                        const cat = categoryById.value.get(exp.categoryId)
                        const itemCat = cat?.name ?? 'Diğer'
                        const itemAcc = accountById.value.get(exp.accountId)?.name ?? 'Silinmiş hesap'
                        const installmentText = exp.installments > 1 ? ` · ${exp.installments} taksit` : ''

                        return (
                          <button
                            key={exp.id}
                            type="button"
                            class="expenses-item"
                            onClick={() => openSheet({ type: 'expense', expense: exp })}
                          >
                            <span class="expenses-item-dot cat-color" style={{ '--h': displayHue(cat?.hue ?? 160) }} aria-hidden="true" />
                            <span class="expenses-item-main">
                              <span class="expenses-item-label">
                                {exp.note || itemCat}
                              </span>
                              <span class="expenses-item-sub">
                                {itemCat} · {itemAcc}
                                {installmentText}
                              </span>
                            </span>
                            <span class="expenses-item-amount num">
                              {figure(formatTLExact(exp.amount))}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
