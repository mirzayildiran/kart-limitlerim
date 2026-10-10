import { useId } from 'preact/hooks'
import { displayHue } from '../../domain/categories'
import type { Category } from '../../domain/types'
import { Icon } from './Icon'
import { rovingRadioKey } from './roving'
import './category-picker.css'

export interface CategoryPickerProps {
  /** Visible label above the chips, e.g. "Kategori". */
  label: string
  /** Categories to offer, in order (usually `activeCategories.value`). */
  categories: Category[]
  value: string | null
  onChange: (id: string) => void
  /** When given, a trailing "Yeni" chip (drawn plus icon) calls it, e.g. to reveal an inline name field. */
  onNew?: () => void
  /** Whatever onNew reveals is currently shown (sets aria-expanded on the "Yeni" chip). */
  newOpen?: boolean
  /** Shown under the chips in rose. */
  error?: string | null
}

/**
 * Category choice as wrapping chips (≥44 px): the category's colour only as a dot
 * (Owned Colour Rule), the selected chip in the lime "you are here" wash with a check.
 * Semantics: role="radiogroup" with role="radio" chips, roving tabindex, arrow keys move
 * the selection; the "Yeni" chip is a plain button after the group.
 * Shared by ExpenseSheet and RecurringSheet.
 */
export function CategoryPicker({ label, categories, value, onChange, onNew, newOpen, error }: CategoryPickerProps) {
  const id = useId()
  const hasSelection = categories.some((c) => c.id === value)

  return (
    <div class="category-picker">
      <span class="field-label" id={`${id}-l`}>
        {label}
      </span>
      <div class="category-picker-items">
        {/* display: contents, so the radios and the "Yeni" chip wrap as one row. */}
        <div
          class="category-picker-group"
          role="radiogroup"
          aria-labelledby={`${id}-l`}
          aria-describedby={error ? `${id}-e` : undefined}
          aria-invalid={error ? true : undefined}
          onKeyDown={(e) => {
            const i = rovingRadioKey(e, e.currentTarget)
            if (i !== null && categories[i]) onChange(categories[i].id)
          }}
        >
          {categories.map((c, i) => {
            const on = c.id === value
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (!hasSelection && i === 0) ? 0 : -1}
                class={`category-picker-chip${on ? ' is-selected' : ''}`}
                onClick={() => onChange(c.id)}
              >
                <span class="category-picker-dot cat-color" style={{ '--h': displayHue(c.hue) }} aria-hidden="true" />
                <span class="category-picker-name">{c.name}</span>
                {on && <Icon name="check" size={16} class="category-picker-check" />}
              </button>
            )
          })}
        </div>
        {onNew && (
          <button type="button" class="category-picker-chip category-picker-new" aria-expanded={newOpen} onClick={onNew}>
            <Icon name="plus" size={16} class="category-picker-plus" />
            Yeni
          </button>
        )}
      </div>
      {error && (
        <p class="field-error" id={`${id}-e`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
