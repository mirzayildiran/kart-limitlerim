import type { SheetRequest } from '../../ui/nav'

/** Owned by the "accounts" task. Rendered by SheetHost while `sheet.value.type === 'account'`. */
export interface AccountSheetProps {
  request: Extract<SheetRequest, { type: 'account' }>
}

export function AccountSheet(_props: AccountSheetProps) {
  return null
}
