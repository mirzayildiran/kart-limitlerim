import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import type { Account, CardAccount, KmhAccount, BalanceAccount } from '../../domain/types'
import { formatTL, formatTLExact } from '../../domain/money'
import { formatMonth } from '../../domain/dates'
import { CURRENT_RATES } from '../../domain/rates'
import { accountById, accounts, today } from '../../data/store'
import { accountColors } from '../../ui/accountColor'
import { openSheet, closeSheet, type SheetRequest } from '../../ui/nav'
import { Button, Pill } from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { LimitStrip } from '../../ui/components/LimitStrip'
import { Amount } from '../../ui/components/Amount'
import { cardInterestPanelData, interestHistory, kmhDailyCost, statementRows } from './detailModel'
import { rateFor } from '../../domain/interest'
import './account-detail.css'

function isCard(a: Account): a is CardAccount {
  return a.kind === 'card'
}

function isKmh(a: Account): a is KmhAccount {
  return a.kind === 'kmh'
}

function isBalanceAccount(a: Account): a is BalanceAccount {
  return a.kind === 'bank' || a.kind === 'cash'
}

function renderCardContent(account: CardAccount): JSX.Element {
  const t = today.value
  const data = cardInterestPanelData(account, t)

  // Calculate available and used
  const available = account.available
  const used = account.limit - available

  return (
    <>
      {/* LimitStrip + stats */}
      <LimitStrip
        name={account.name}
        available={available}
        limit={account.limit}
        tone="card"
        slot={accountColors(accounts.value).get(account.id)}
      />

      <div class="account-detail-stats">
        <div class="stat-cell">
          <span class="stat-label">Kullanılabilir</span>
          <Amount value={available} size="md" />
        </div>
        <div class="stat-cell">
          <span class="stat-label">Limit</span>
          <Amount value={account.limit} size="md" />
        </div>
        <div class="stat-cell">
          <span class="stat-label">Kullanılan</span>
          <Amount value={used} size="md" tone="muted" />
        </div>
      </div>

      {/* Interest panel */}
      {data && (
        <div class="interest-panel">
          <h3>İşleyen faiz</h3>

          <Amount value={data.totalInterest + (data.currentProjected ?? 0)} exact size="xl" tone="crit" />
          <span class="interest-sub">
            Bu kartta toplam işleyen faiz
          </span>

          {data.historyCycles > 0 || data.currentProjected !== null ? (
            <p class="interest-sub">
              {data.historyCycles} ekstre geçmişi
              {data.currentProjected !== null ? ' + bu ekstre tahmini' : ''}
            </p>
          ) : (
            <p class="interest-sub">Henüz faiz kaydı yok</p>
          )}

          {/* Daily costs */}
          {data.dailyCosts.length > 0 && (
            <div class="interest-line">
              <strong>
                Borcun her gün ~{formatTLExact(data.dailyCosts.reduce((s, d) => s + d.cost, 0))} faiz işletiyor.
              </strong>
            </div>
          )}

          {/* Line projections */}
          {data.lineProjections.map((proj) => (
            <div key={proj.lineIndex} class="interest-line">
              <strong>{proj.label}:</strong> bu ekstrede ~{formatTLExact(proj.projectedAsEntered)}
              {(proj.payment === 'unpaid' || proj.payment === 'partial') && proj.projectedMinimum !== null && (
                <>
                  {' '}
                  yalnız asgariyi ödersen ~{formatTLExact(proj.projectedMinimum)}
                </>
              )}
            </div>
          ))}

          {/* Nudge message */}
          <div class="interest-nudge">
            {used > 0 ? (
              <>
                Tamamını ödersen bu faiz işlemez. Yeni harcama, ödemediğin borcun üstüne eklenir.
              </>
            ) : (
              <>
                Ekstreni tamamen ödüyorsun; faiz işlemiyor.
              </>
            )}
          </div>

          {/* Rate caption */}
          <div class="interest-caption">
            {account.rateOverride ? (
              <>
                Oran: senin girdiğin aylık %{account.rateOverride.contractual} akdi. KKDF ve BSMV dahil. Tahmindir; kesin tutar ekstrendedir.
              </>
            ) : (
              <>
                {(() => {
                  let debt: number = used
                  for (const line of account.lines) {
                    if ((line.statementDebt ?? 0) > 0) {
                      debt = line.statementDebt ?? used
                      break
                    }
                  }
                  const rate = rateFor(account, debt)
                  return (
                    <>
                      Oranlar: TCMB azami oranları ({CURRENT_RATES.effective}), aylık %{rate.contractual} akdi. KKDF ve BSMV dahil. Tahmindir; kesin tutar ekstrendedir.
                    </>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Statements list */}
      {account.lines.length > 0 && (
        <div class="statements-section">
          <h3>Ekstreler</h3>
          {statementRows(account, t).map((row) => {
            const pillTone = row.status === 'paid' ? 'ok' : row.status === 'overdue' ? 'crit' : row.status === 'upcoming' ? 'neutral' : 'warn'
            return (
              <button
                key={account.lines[row.lineIndex].id}
                type="button"
                class="statement-row"
                onClick={() => openSheet({ type: 'statement', accountId: account.id, lineIndex: row.lineIndex })}
              >
                <span class="statement-left">
                  <span class="statement-label">{row.label}</span>
                  <span class="statement-dates">
                    Kesim {row.cutShort} · son ödeme {row.dueIsExact ? '' : '~'}{row.dueShort}
                  </span>
                </span>
                <span class="statement-right">
                  {row.debt !== null && row.debt > 0 && (
                    <span class="statement-debt">{formatTL(row.debt)}</span>
                  )}
                  <Pill tone={pillTone}>{row.statusLabel}</Pill>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Interest history */}
      {(() => {
        const hist = interestHistory(account)
        return hist.records.length > 0 ? (
          <div class="history-section">
            <h3>Faiz geçmişi</h3>
            {hist.records.map((rec) => (
              <div key={rec.cycle} class="history-item">
                <span class="history-cycle">{formatMonth(rec.cycle)}</span>
                <div class="history-right">
                  <span class="history-amount">{formatTLExact(rec.amount)}</span>
                  {rec.source === 'estimate' && <Pill tone="neutral">tahmini</Pill>}
                </div>
              </div>
            ))}
            {hist.older > 0 && <p class="history-older">+{hist.older} eski ekstre</p>}
          </div>
        ) : null
      })()}
    </>
  )
}

function renderKmhContent(account: KmhAccount): JSX.Element {
  const available = account.available
  const used = account.limit - available
  const dailyCost = kmhDailyCost(account)

  return (
    <>
      <LimitStrip
        name={account.name}
        available={available}
        limit={account.limit}
        tone="kmh"
        slot={accountColors(accounts.value).get(account.id)}
      />

      <div class="account-detail-stats">
        <div class="stat-cell">
          <span class="stat-label">Kullanılabilir</span>
          <Amount value={available} size="md" />
        </div>
        <div class="stat-cell">
          <span class="stat-label">Limit</span>
          <Amount value={account.limit} size="md" />
        </div>
        <div class="stat-cell">
          <span class="stat-label">Kullanılan</span>
          <Amount value={used} size="md" tone="muted" />
        </div>
      </div>

      {dailyCost !== null && (
        <div class="interest-panel">
          <h3>İşleyen faiz</h3>
          <Amount value={dailyCost} exact size="xl" tone="crit" />
          <span class="interest-sub">KMH borcun her gün faiz işletiyor</span>

          <div class="interest-line">
            Aylık tahmini: ~{formatTLExact(dailyCost * 30)}
          </div>

          <div class="interest-caption">
            Oran: TCMB azami nakit çekme oranı ({CURRENT_RATES.effective}), aylık %{CURRENT_RATES.cash.contractual}.
            {account.rateOverride ? ' senin girdiğin oran' : ''}.
            KKDF ve BSMV dahil. Tahmindir; kesin tutar ekstrendedir.
          </div>
        </div>
      )}
    </>
  )
}

function renderBalanceContent(account: BalanceAccount): JSX.Element {
  return (
    <div class="balance-content">
      <div class="balance-value">
        <Amount value={account.balance} size="hero" />
      </div>
      {account.note && <p class="balance-note">{account.note}</p>}
    </div>
  )
}

export interface AccountDetailSheetProps {
  request: Extract<SheetRequest, { type: 'accountDetail' }>
}

function AccountDetailSheetImpl({ request }: AccountDetailSheetProps): JSX.Element | null {
  const [open, setOpen] = useState(true)
  const byId = accountById.value
  const account = byId.get(request.id)

  if (!account) {
    closeSheet()
    return null
  }

  const handleClose = () => {
    setOpen(false)
    closeSheet()
  }

  const handleEdit = () => {
    closeSheet()
    openSheet({ type: 'account', id: account.id })
  }

  return (
    <Sheet
      open={open}
      title={account.name}
      onClose={handleClose}
      footer={
        <Button variant="primary" block onClick={handleEdit}>
          Düzenle
        </Button>
      }
    >
      {isCard(account) && renderCardContent(account)}
      {isKmh(account) && renderKmhContent(account)}
      {isBalanceAccount(account) && renderBalanceContent(account)}
    </Sheet>
  )
}

export function AccountDetailSheet(props: AccountDetailSheetProps): JSX.Element | null {
  return <AccountDetailSheetImpl {...props} />
}
