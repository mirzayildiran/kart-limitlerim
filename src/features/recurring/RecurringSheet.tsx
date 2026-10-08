import type { SheetRequest } from '../../ui/nav'

/** Owned by the "recurring" task. Rendered by SheetHost while `sheet.value.type === 'recurring'`. */
export interface RecurringSheetProps {
  request: Extract<SheetRequest, { type: 'recurring' }>
}

export function RecurringSheet(_props: RecurringSheetProps) {
  return null
}
