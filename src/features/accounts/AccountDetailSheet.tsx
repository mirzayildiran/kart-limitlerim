import type { ComponentChildren, JSX } from 'preact'
import { useState } from 'preact/hooks'
import type { Account, CardAccount, KmhAccount, BalanceAccount, Kurus } from '../../domain/types'
import { formatTL, formatTLExact } from '../../domain/money'
import { formatMonth, fromIso } from '../../domain/dates'
import { CURRENT_RATES } from '../../domain/rates'
import { rateFor } from '../../domain/interest'
import { accountById, accounts, today } from '../../data/store'
import { accountColors } from '../../ui/accountColor'
import { openSheet, closeSheet, type SheetRequest } from '../../ui/nav'
import { Button, Pill } from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { Amount, figure } from '../../ui/components/Amount'
import { accountFree } from '../../ui/components/AccountPicker'
import {
  addExpenseLabel,
  cardInterestPanelData,
  interestHistory,
  interestSourceLine,
  kmhDailyCost,
  rateCaption,
  staleStatementLine,
  statementRows,
} from './detailModel'
import './account-detail.css'

const CAPTION = { card: 'Kullanılabilir', kmh: 'KMH kullanılabilir', bank: 'Banka bakiyesi', cash: 'Nakit' } as const
/** Window title: the account's type. The name is already on the card below it. */
const KIND_TITLE = { card: 'Kredi kartı', kmh: 'KMH', bank: 'Banka hesabı', cash: 'Nakit' } as const
const effectiveFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const RATES_SINCE = effectiveFmt.format(fromIso(CURRENT_RATES.effective))

function isCard(a: Account): a is CardAccount {
  return a.kind === 'card'
}

function isKmh(a: Account): a is KmhAccount {
  return a.kind === 'kmh'
}

function isBalanceAccount(a: Account): a is BalanceAccount {
  return a.kind === 'bank' || a.kind === 'cash'
}

/**
 * The header: the account's wallet card from Özet in miniature, in its owned colour
 * (name, drawn chip, available figure, track, meta). Not interactive here.
 */
function DetailCard({ account, slot }: { account: Account; slot: number }) {
  const hasLimit = account.kind === 'card' || account.kind === 'kmh'
  const share = hasLimit && account.limit > 0 ? Math.min(1, Math.max(0, account.available / account.limit)) : 0
  return (
    <div class={`account-detail-card is-${account.kind}`} data-slot={slot}>
      <svg class="account-detail-card-art" viewBox="0 0 320 160" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <circle cx="290" cy="10" r="110" />
        <circle cx="250" cy="180" r="64" />
      </svg>
      <span class="account-detail-card-name">{account.name}</span>
      {hasLimit && <span class="account-detail-card-chip" aria-hidden="true" />}
      <span class="account-detail-card-bottom">
        <Amount value={accountFree(account)} size="xl" />
        {hasLimit && (
          <span class="account-detail-card-track" aria-hidden="true">
            <span class="account-detail-card-fill" style={{ width: `${share * 100}%` }} />
          </span>
        )}
        <span class="account-detail-card-meta">{CAPTION[account.kind]}</span>
      </span>
    </div>
  )
}

/** "Limit" and "Kullanılan": the two figures the card above does not show. */
function LimitStats({ limit, used }: { limit: Kurus; used: Kurus }) {
  return (
    <div class="account-detail-stats">
      <div class="account-detail-stat">
        <span class="account-detail-stat-label">Limit</span>
        <Amount value={limit} size="md" />
      </div>
      <div class="account-detail-stat">
        <span class="account-detail-stat-label">Kullanılan</span>
        <Amount value={used} size="md" />
      </div>
    </div>
  )
}

/** Rose wash panel: the title and sentences in ink, only the figure in rose. */
function InterestPanel({ figure, sub, children }: { figure: Kurus; sub: string; children: ComponentChildren }) {
  return (
    <section class="account-detail-interest" aria-label="İşleyen faiz">
      <h3 class="account-detail-interest-title">İşleyen faiz</h3>
      <Amount value={figure} exact size="xl" tone={figure > 0 ? 'crit' : 'default'} />
      <p class="account-detail-interest-sub">{sub}</p>
      {children}
    </section>
  )
}

function CardContent({ account }: { account: CardAccount }): JSX.Element {
  const t = today.value
  const data = cardInterestPanelData(account, t)
  const used = account.limit - account.available
  const hist = interestHistory(account)
  // The daily figure runs on the unpaid statement, not on "Kullanılan"; flag it when they disagree.
  const stale = staleStatementLine(account, t)

  // Rate shown in the caption: the tier of the first statement debt, else of what is used.
  const firstDebt = account.lines.find((l) => (l.statementDebt ?? 0) > 0)?.statementDebt ?? used
  const caption = rateCaption({
    override: account.rateOverride?.contractual ?? null,
    contractual: rateFor(account, firstDebt).contractual,
    effective: RATES_SINCE,
  })

  return (
    <>
      <LimitStats limit={account.limit} used={used} />

      {data && (
        <InterestPanel figure={data.totalInterest + (data.currentProjected ?? 0)} sub="Bu kartta toplam işleyen faiz">
          <p class="account-detail-interest-source">
            {interestSourceLine(data.historyCycles, data.currentProjected !== null)}
          </p>

          {(data.dailyCosts.length > 0 || data.lineProjections.length > 0) && (
            <ul class="account-detail-interest-lines">
              {data.dailyCosts.length > 0 && (
                <li>
                  Ödenmemiş ekstre borcuna göre her gün{' '}
                  <strong class="num">~{figure(formatTLExact(data.dailyCosts.reduce((s, d) => s + d.cost, 0)))}</strong> faiz
                  işliyor.
                  {stale !== null && (
                    <span class="account-detail-interest-stale">
                      Ekstre ödeme durumunu güncellersen bu rakam düzelir.
                      <button
                        type="button"
                        class="account-detail-interest-link"
                        onClick={() => openSheet({ type: 'statement', accountId: account.id, lineIndex: stale })}
                      >
                        Ekstreyi güncelle
                      </button>
                    </span>
                  )}
                </li>
              )}
              {data.lineProjections.map((proj) => (
                <li key={proj.lineIndex}>
                  <strong>{proj.label}:</strong> bu ekstrede <span class="num">~{figure(formatTLExact(proj.projectedAsEntered))}</span>
                  {(proj.payment === 'unpaid' || proj.payment === 'partial') && proj.projectedMinimum !== null && (
                    <>
                      ; yalnız asgariyi ödersen <span class="num">~{figure(formatTLExact(proj.projectedMinimum))}</span>
                    </>
                  )}
                  .
                </li>
              ))}
            </ul>
          )}

          <p class="account-detail-interest-nudge">
            {used > 0
              ? 'Tamamını ödersen bu faiz işlemez. Yeni harcama, ödemediğin borcun üstüne eklenir.'
              : 'Ekstreni tamamen ödüyorsun; faiz işlemiyor.'}
          </p>
          <p class="account-detail-interest-caption">{caption}</p>
        </InterestPanel>
      )}

      {account.lines.length > 0 && (
        <section class="account-detail-section">
          <h3 class="account-detail-section-title">Ekstreler</h3>
          <div class="account-detail-statements">
            {statementRows(account, t).map((row) => {
              const pillTone =
                row.status === 'paid' ? 'ok' : row.status === 'overdue' ? 'crit' : row.status === 'upcoming' ? 'neutral' : 'warn'
              return (
                <button
                  key={account.lines[row.lineIndex].id}
                  type="button"
                  class="account-detail-statement"
                  onClick={() => openSheet({ type: 'statement', accountId: account.id, lineIndex: row.lineIndex })}
                >
                  <span class="account-detail-statement-main">
                    <span class="account-detail-statement-label">{row.label}</span>
                    <span class="account-detail-statement-dates">
                      Kesim {row.cutShort} · son ödeme {row.dueIsExact ? '' : '~'}
                      {row.dueShort}
                    </span>
                  </span>
                  <span class="account-detail-statement-end">
                    {row.debt !== null && row.debt > 0 && (
                      <span class="account-detail-statement-debt num">{figure(formatTL(row.debt))}</span>
                    )}
                    <Pill tone={pillTone}>{row.statusLabel}</Pill>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {hist.records.length > 0 && (
        <section class="account-detail-section">
          <h3 class="account-detail-section-title">Faiz geçmişi</h3>
          <div class="account-detail-history">
            {hist.records.map((rec) => (
              <div key={rec.cycle} class="account-detail-history-row">
                <span>{formatMonth(rec.cycle)}</span>
                <span class="account-detail-history-end">
                  {rec.source === 'estimate' && <Pill tone="neutral">tahmini</Pill>}
                  <span class="account-detail-history-amount num">{figure(formatTLExact(rec.amount))}</span>
                </span>
              </div>
            ))}
          </div>
          {hist.older > 0 && <p class="account-detail-history-older">{hist.older} eski ekstre daha</p>}
        </section>
      )}
    </>
  )
}

function KmhContent({ account }: { account: KmhAccount }): JSX.Element {
  const used = account.limit - account.available
  const dailyCost = kmhDailyCost(account)

  return (
    <>
      <LimitStats limit={account.limit} used={used} />

      {dailyCost !== null && (
        <InterestPanel figure={dailyCost} sub="KMH borcun her gün bu kadar faiz işletiyor">
          <ul class="account-detail-interest-lines">
            <li>
              Aylık tahmini <strong class="num">~{figure(formatTLExact(dailyCost * 30))}</strong>.
            </li>
          </ul>
          <p class="account-detail-interest-caption">
            {rateCaption({
              override: account.rateOverride?.contractual ?? null,
              contractual: CURRENT_RATES.cash.contractual,
              effective: RATES_SINCE,
              cash: true,
            })}
          </p>
        </InterestPanel>
      )}
    </>
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
      title={KIND_TITLE[account.kind]}
      onClose={handleClose}
      footer={
        <>
          <Button variant="primary" block onClick={() => openSheet({ type: 'expense', accountId: account.id })}>
            {addExpenseLabel(account.kind)}
          </Button>
          <Button variant="secondary" block onClick={handleEdit}>
            Düzenle
          </Button>
        </>
      }
    >
      <DetailCard account={account} slot={accountColors(accounts.value).get(account.id) ?? 1} />
      {isCard(account) && <CardContent account={account} />}
      {isKmh(account) && <KmhContent account={account} />}
      {isBalanceAccount(account) && account.note && <p class="account-detail-note">{account.note}</p>}
    </Sheet>
  )
}

export function AccountDetailSheet(props: AccountDetailSheetProps): JSX.Element | null {
  return <AccountDetailSheetImpl {...props} />
}
