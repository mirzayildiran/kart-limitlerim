import type { SheetRequest } from '../../ui/nav'

/** Owned by the "settings" task. Rendered by SheetHost while `sheet.value.type === 'category'`. */
export interface CategorySheetProps {
  request: Extract<SheetRequest, { type: 'category' }>
}

export function CategorySheet(_props: CategorySheetProps) {
  return null
}
