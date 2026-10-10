import { useEffect, useRef, useState } from 'preact/hooks'
import { activeCategories, budgets, categories, categoryById, expenses, saveBudget, today } from '../../data/store'
import { budgetProgress, monthPace, type BudgetRow } from '../../domain/budget'
import { formatTL } from '../../domain/money'
import type { Kurus } from '../../domain/types'
import { Button, MoneyField, Pill } from '../../ui/components/controls'
import { Amount } from '../../ui/components/Amount'
import { toast } from '../../ui/components/toast'
import { barRatio, hasForecast, shownRemaining, statusLabel, statusTone, unplannedCategories } from './budgetPlanModel'
import './budget-plan.css'

interface EditorProps {
  categoryId: string
  name: string
  /** The saved target, or null when the category has none yet. */
  current: Kurus | null
  onDone: () => void
}

/** Inline editor for one category's monthly target. Only one is open at a time. */
function BudgetEditor({ categoryId, name, current, onDone }: EditorProps) {
  const [value, setValue] = useState<Kurus | null>(current)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])

  async function commit(next: Kurus | null) {
    setBusy(true)
    try {
      await saveBudget(categoryId, next)
      toast(next === null ? 'Hedef kaldırıldı.' : 'Hedef kaydedildi.')
      onDone()
    } catch {
      toast('Kaydedilemedi. Yeniden dene.')
      setBusy(false)
    }
  }

  const canSave = value !== null && value > 0 && !busy

  return (
    <div class="budget-plan-editor" ref={box}>
      <MoneyField label={`${name} için aylık hedef`} value={value} onChange={setValue} />
      <div class="budget-plan-editor-actions">
        <Button variant="primary" block disabled={!canSave} onClick={() => void commit(value)}>
          Kaydet
        </Button>
        <Button variant="secondary" block disabled={busy} onClick={onDone}>
          Vazgeç
        </Button>
      </div>
      {current !== null && (
        <Button variant="danger" disabled={busy} onClick={() => void commit(null)}>
          Hedefi kaldır
        </Button>
      )}
    </div>
  )
}

function RowBody({ row, onEdit }: { row: BudgetRow; onEdit: () => void }) {
  const ratio = barRatio(row)
  return (
    <>
      <div
        class="budget-plan-bar"
        role="progressbar"
        aria-valuenow={row.usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.name} bütçesi`}
      >
        <span class={`budget-plan-fill budget-plan-fill-${row.status}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p class="budget-plan-meta">
        <span class="num">
          {formatTL(row.spent)} / {formatTL(row.monthly)}
        </span>
        <span>
          {shownRemaining(row) >= 0 ? (
            <>
              Kalan <span class="num">{formatTL(shownRemaining(row))}</span>
            </>
          ) : (
            <>
              <span class="num">{formatTL(-shownRemaining(row))}</span> aşıldı
            </>
          )}
        </span>
      </p>
      {row.status === 'pace' && (
        <p class="budget-plan-line">
          Ay sonu tahmini <span class="num">{formatTL(row.projected)}</span>
        </p>
      )}
      <div class="budget-plan-actions">
        <Button variant="ghost" onClick={onEdit}>
          Düzenle
        </Button>
      </div>
    </>
  )
}

export function BudgetPlan() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const pace = monthPace(expenses.value, today.value)
  const rows = budgetProgress(expenses.value, budgets.value, categories.value, today.value)
  const unplanned = unplannedCategories(activeCategories.value, budgets.value)
  const editingCategory = editingId === null ? null : (categoryById.value.get(editingId) ?? null)
  const editingInRows = rows.some((r) => r.categoryId === editingId)
  const editingBudget = budgets.value.find((b) => b.categoryId === editingId)?.monthly ?? null

  function openEditor(categoryId: string) {
    setAdding(false)
    setEditingId(categoryId)
  }

  return (
    <div class="budget-plan">
      <div class="assistant-card budget-plan-month">
        <p class="budget-plan-label">Bu ay</p>
        <Amount value={pace.spent} size="xl" />
        {hasForecast(pace) ? (
          <p class="budget-plan-line">
            Ay sonu tahmini: <span class="num">{formatTL(pace.projected)}</span>
          </p>
        ) : (
          <p class="budget-plan-line">Ay sonu tahmini için birkaç gün daha gerekli.</p>
        )}
        {pace.lastMonthTotal > 0 && (
          <p class="budget-plan-line">
            Geçen ay toplam: <span class="num">{formatTL(pace.lastMonthTotal)}</span>
          </p>
        )}
        <p class="budget-plan-note">Tahminler bugüne kadarki günlük ortalamaya dayanır.</p>
      </div>

      {rows.length > 0 && (
        <ul class="budget-plan-list">
          {rows.map((row) => (
            <li key={row.categoryId} class="assistant-card budget-plan-row">
              <div class="budget-plan-head">
                <span class="budget-plan-name cat-color" style={{ '--h': categoryById.value.get(row.categoryId)?.hue ?? 160 }}>
                  <span class="budget-plan-swatch" aria-hidden="true" />
                  {row.name}
                </span>
                <Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill>
              </div>
              {editingId === row.categoryId ? (
                <BudgetEditor
                  key={row.categoryId}
                  categoryId={row.categoryId}
                  name={row.name}
                  current={row.monthly}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <RowBody row={row} onEdit={() => openEditor(row.categoryId)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {editingCategory !== null && !editingInRows && (
        <div class="assistant-card budget-plan-row">
          <BudgetEditor
            key={editingCategory.id}
            categoryId={editingCategory.id}
            name={editingCategory.name}
            current={editingBudget}
            onDone={() => setEditingId(null)}
          />
        </div>
      )}

      {budgets.value.length === 0 && (
        <p class="assistant-muted budget-plan-empty">
          Kategorilere aylık hedef koy; asistan gidişatı bu hedeflere göre değerlendirsin.
        </p>
      )}

      {unplanned.length > 0 && (
        <div class="budget-plan-add">
          <Button variant="secondary" block aria-expanded={adding} onClick={() => setAdding(!adding)}>
            Kategori için hedef ekle
          </Button>
          {adding && (
            <div class="budget-plan-chips">
              {unplanned.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  class="budget-plan-chip cat-color"
                  style={{ '--h': c.hue }}
                  onClick={() => openEditor(c.id)}
                >
                  <span class="budget-plan-swatch" aria-hidden="true" />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
