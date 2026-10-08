import { sheet } from '../ui/nav'
import { AccountSheet } from './accounts/AccountSheet'
import { AccountDetailSheet } from './accounts/AccountDetailSheet'
import { StatementSheet } from './statements/StatementSheet'
import { ExpenseSheet } from './expenses/ExpenseSheet'
import { RecurringSheet } from './recurring/RecurringSheet'
import { CategorySheet } from './categories/CategorySheet'
import { ImportSheet } from './import/ImportSheet'

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
