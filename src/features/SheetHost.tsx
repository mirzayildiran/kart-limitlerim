import { lazy } from '../lazy'
import { sheet } from '../ui/nav'

// Sheets are not needed for the first screen; ImportSheet alone pulls in the OCR engine.
const AccountSheet = lazy(() => import('./accounts/AccountSheet').then((m) => m.AccountSheet))
const AccountDetailSheet = lazy(() => import('./accounts/AccountDetailSheet').then((m) => m.AccountDetailSheet))
const StatementSheet = lazy(() => import('./statements/StatementSheet').then((m) => m.StatementSheet))
const ExpenseSheet = lazy(() => import('./expenses/ExpenseSheet').then((m) => m.ExpenseSheet))
const RecurringSheet = lazy(() => import('./recurring/RecurringSheet').then((m) => m.RecurringSheet))
const CategorySheet = lazy(() => import('./categories/CategorySheet').then((m) => m.CategorySheet))
const ImportSheet = lazy(() => import('./import/ImportSheet').then((m) => m.ImportSheet))

export function SheetHost() {
  const req = sheet.value
  if (!req) return null

  switch (req.type) {
    case 'account':
      return <AccountSheet request={req} />
    case 'accountDetail':
      return <AccountDetailSheet request={req} />
    case 'statement':
      return <StatementSheet request={req} />
    case 'expense':
      return <ExpenseSheet request={req} />
    case 'recurring':
      return <RecurringSheet request={req} />
    case 'category':
      return <CategorySheet request={req} />
    case 'import':
      return <ImportSheet request={req} />
  }
}
