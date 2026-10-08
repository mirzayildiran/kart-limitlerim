import type { SheetRequest } from '../../ui/nav'

/** Owned by the "account-detail" task. Rendered by SheetHost while `sheet.value.type === 'accountDetail'`. */
export interface AccountDetailSheetProps {
  request: Extract<SheetRequest, { type: 'accountDetail' }>
}

export function AccountDetailSheet(_props: AccountDetailSheetProps) {
  return null
}
