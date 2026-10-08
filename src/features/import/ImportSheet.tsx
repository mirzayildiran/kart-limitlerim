import type { SheetRequest } from '../../ui/nav'

/** Owned by the "import" task. Rendered by SheetHost while `sheet.value.type === 'import'`. */
export interface ImportSheetProps {
  request: Extract<SheetRequest, { type: 'import' }>
}

export function ImportSheet(_props: ImportSheetProps) {
  return null
}
