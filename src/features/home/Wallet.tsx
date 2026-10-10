import { useRef, useState } from 'preact/hooks'
import { daysBetween, startOfDay } from '../../domain/dates'
import { formatTL } from '../../domain/money'
import type { StatementItem } from '../../domain/power'
import type { Account } from '../../domain/types'
import { Amount } from '../../ui/components/Amount'
import { Icon } from '../../ui/components/Icon'
import { openSheet } from '../../ui/nav'
export { accountColors } from '../../ui/accountColor'
import './wallet.css'

const KIND_LABEL = { card: 'Kredi kartı', kmh: 'KMH', bank: 'Banka hesabı', cash: 'Nakit' } as const
const CAPTION = { card: 'Kullanılabilir', kmh: 'KMH · Kullanılabilir', bank: 'Banka · Bakiye', cash: 'Nakit' } as const
const cutFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })

function nextDate(items: StatementItem[]): { text: string; urgent: boolean } | null {
  const open = items.filter((i) => i.view.status !== 'paid')
  const first = open[0]
  if (first) {
    const d = first.view.daysLeft
    if (d < 0) return { text: `Son ödeme ${-d} gün geçti`, urgent: true }
    if (d === 0) return { text: 'Son ödeme bugün', urgent: true }
    if (d <= 7) return { text: `Son ödeme ${d} gün`, urgent: d <= 3 }
  }
  const cut = items.map((i) => i.view.nextCut).sort((a, b) => +a - +b)[0]
  if (!cut) return null
  const days = daysBetween(cut, startOfDay(new Date()))
  if (days <= 0) return { text: 'Kesim bugün', urgent: false }
  if (days === 1) return { text: 'Kesim yarın', urgent: false }
  return { text: `Kesim ${cutFmt.format(cut)}`, urgent: false }
}

function WalletCard({ account, slot, items }: { account: Account; slot: number; items: StatementItem[] }) {
  const hasLimit = account.kind === 'card' || account.kind === 'kmh'
  const free = hasLimit ? account.available : account.balance
  const share = hasLimit && account.limit > 0 ? Math.min(1, Math.max(0, account.available / account.limit)) : 0
  const date = account.kind === 'card' ? nextDate(items) : null
  const label = `${account.name}, ${KIND_LABEL[account.kind]}, ${formatTL(free)} ${hasLimit ? 'kullanılabilir' : 'bakiye'}`

  return (
    <button
      type="button"
      class={`wallet-card is-${account.kind}`}
      data-slot={slot}
      aria-label={label}
      onClick={() => openSheet({ type: 'accountDetail', id: account.id })}
    >
      <svg class="wallet-card-art" viewBox="0 0 320 200" aria-hidden="true">
        <circle cx="290" cy="20" r="120" />
        <circle cx="250" cy="210" r="70" />
      </svg>

      <span class="wallet-card-top">
        <span class="wallet-card-name">{account.name}</span>
        {date && <span class={`wallet-card-date${date.urgent ? ' is-urgent' : ''}`}>{date.text}</span>}
      </span>

      {hasLimit && <span class="wallet-card-chip" aria-hidden="true" />}

      <span class="wallet-card-bottom">
        <span class="wallet-card-caption">{CAPTION[account.kind]}</span>
        <Amount value={free} size="xl" />
        {hasLimit && (
          <>
            <span class="wallet-card-track" aria-hidden="true">
              <span class="wallet-card-fill" style={{ width: `${share * 100}%` }} />
            </span>
            <span class="wallet-card-meta">
              {account.limit > 0 ? `Limit ${formatTL(account.limit)} · %${Math.round(share * 100)} boş` : 'Limit girilmedi'}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

interface Props {
  accounts: Account[]
  colors: Map<string, number>
  statements: StatementItem[]
}

/** Swipeable wallet: every card, KMH and account as a real card in its own colour. */
export function Wallet({ accounts, colors, statements }: Props) {
  const rail = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const count = accounts.length + 1

  const onScroll = () => {
    const el = rail.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const step = first.offsetWidth + 12
    const next = Math.min(count - 1, Math.round(el.scrollLeft / step))
    // A light tick as the active card changes (Android; ignored elsewhere).
    if (next !== active) navigator.vibrate?.(8)
    setActive(next)
  }

  return (
    <section class="wallet" aria-label="Kartların ve hesapların">
      <div class="wallet-rail" ref={rail} onScroll={onScroll}>
        {accounts.map((a, i) => (
          <div key={a.id} class={`wallet-slide${i === active ? ' is-active' : ''}`} style={{ '--i': i }}>
            <WalletCard account={a} slot={colors.get(a.id) ?? 1} items={statements.filter((s) => s.account.id === a.id)} />
          </div>
        ))}
        <div class={`wallet-slide${active === count - 1 ? ' is-active' : ''}`} style={{ '--i': accounts.length }}>
          <button type="button" class="wallet-add" onClick={() => openSheet({ type: 'account' })}>
            <span class="wallet-add-icon">
              <Icon name="plus" size={24} />
            </span>
            Kart veya hesap ekle
          </button>
        </div>
      </div>
      <div class="wallet-dots" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} class={`wallet-dot${i === active ? ' is-active' : ''}`} />
        ))}
      </div>
    </section>
  )
}
