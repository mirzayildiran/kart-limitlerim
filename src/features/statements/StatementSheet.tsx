import type { SheetRequest } from '../../ui/nav'

/** Owned by the "accounts" task. Rendered by SheetHost while `sheet.value.type === 'statement'`. */
export interface StatementSheetProps {
  request: Extract<SheetRequest, { type: 'statement' }>
}

export function StatementSheet(_props: StatementSheetProps) {
  return null
}
