import type { SheetRequest } from '../../ui/nav'

/** Owned by the "expenses" task. Rendered by SheetHost while `sheet.value.type === 'expense'`. */
export interface ExpenseSheetProps {
  request: Extract<SheetRequest, { type: 'expense' }>
}

export function ExpenseSheet(_props: ExpenseSheetProps) {
  return null
}
