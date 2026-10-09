import { formatTL } from '../../domain/money'
import type { Kurus } from '../../domain/types'
import { Amount } from './Amount'
import { Pill } from './controls'
import './limit-strip.css'

interface Props {
  name: string
  sub?: string
  available: Kurus
  limit: Kurus
  tone?: 'card' | 'kmh'
  onClick?: () => void
}

export function LimitStrip({ name, sub, available, limit, tone = 'card', onClick }: Props) {
  const isFull = available <= 0
  const freeShare = limit <= 0 ? 0 : Math.min(1, Math.max(0, available / limit))
  const showWarnBar = freeShare < 0.1

  const accessibleName = `${name}${sub ? `, ${sub}` : ''}, ${formatTL(available)} kullanılabilir, limit ${formatTL(limit)}`

  return (
    <button
      type="button"
      class="limit-strip"
      data-tone={tone}
      aria-label={accessibleName}
      onClick={onClick}
    >
      <span class={`limit-strip-fill${showWarnBar ? ' is-low' : ''}`} style={{ width: `${isFull ? 0 : freeShare * 100}%` }} />

      <span class="limit-strip-content">
        <span class="limit-strip-left">
          <span class="limit-strip-name">{name}</span>
          {sub && <span class="limit-strip-sub">{sub}</span>}
        </span>

        <span class="limit-strip-right">
          {isFull ? (
            <Pill tone="crit">Limit dolu</Pill>
          ) : (
            <>
              <Amount value={available} size="lg" />
              <span class="limit-strip-caption">kullanılabilir</span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}
