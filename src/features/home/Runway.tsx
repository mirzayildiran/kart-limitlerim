import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { daysBetween } from '../../domain/dates'
import { formatTL } from '../../domain/money'
import { figure } from '../../ui/components/Amount'
import type { RunwayDay } from '../../domain/runway'
import './runway.css'
import { tick } from '../../platform/haptics'

interface Props {
  days: RunwayDay[]
}

const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const weekdayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' })

/** Chart box in viewBox units; the SVG stretches to its container. */
const W = 1000
const H = 100
const PAD_TOP = 8

function dayTitle(day: RunwayDay, index: number, last: number): string {
  if (index === 0) return 'Bugün'
  if (index === 1) return 'Yarın'
  const base = `${dayFmt.format(day.date)} ${weekdayFmt.format(day.date)}`
  return index === last && day.events.some((e) => e.kind === 'cut') ? `${dayFmt.format(day.date)}, kesim` : base
}

function eventText(e: RunwayDay['events'][number]): string {
  if (e.kind === 'recurring') return `${e.label} −${formatTL(e.amount ?? 0)}`
  if (e.kind === 'due') return e.amount == null ? `${e.label} · tutar girilmedi` : `${e.label} · asgari ${formatTL(e.amount)}`
  return e.label
}

/**
 * "Kesime kadar" runway: spending power for each day until the next statement
 * cut. Drag or use the arrow keys to read any day; recurring charges step the
 * line down, due dates and the cut are markers.
 */
export function Runway({ days }: Props) {
  const last = days.length - 1
  const [selected, setSelected] = useState(last)
  const index = Math.min(selected, last)
  const day = days[index]

  const powers = days.map((d) => d.power)
  // Zoom to the change so a drop reads clearly; the line has no fill, so no area is implied.
  const max = Math.max(...powers, 1)
  const min = Math.min(...powers)
  const range = Math.max(max - min, max * 0.1)
  const hi = max + range * 0.3
  const lo = min - range * 0.6
  const x = (i: number) => (last === 0 ? W : (i / last) * W)
  const y = (p: number) => PAD_TOP + (1 - (p - lo) / (hi - lo)) * (H - PAD_TOP)

  // Step line: power holds through a day and drops at the next day's start.
  let line = `M0 ${y(days[0].power)}`
  for (let i = 1; i <= last; i++) line += ` H${x(i)} V${y(days[i].power)}`

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const next = Math.round(t * last)
    // A light tick under the finger as the day changes.
    if (next !== index && days[next].events.length > 0) tick()
    setSelected(next)
  }

  const onPointer = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    else if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    pick(e.clientX, e.currentTarget)
  }

  const onKey = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
    if (step) setSelected(Math.min(last, Math.max(0, index + step)))
    else if (e.key === 'Home') setSelected(0)
    else if (e.key === 'End') setSelected(last)
    else return
    e.preventDefault()
  }

  const title = dayTitle(day, index, last)
  const daysLeft = daysBetween(days[last].date, days[0].date)
  const pct = (i: number) => `${(x(i) / W) * 100}%`
  const top = (p: number) => `${(y(p) / H) * 100}%`

  return (
    <div class="runway">
      <div class="runway-readout" aria-live="polite">
        <div class="runway-readout-head">
          <span class="runway-day">{title}</span>
          <span class="runway-amount num">
            {figure(formatTL(day.power))} <span class="runway-amount-tail">kalır</span>
          </span>
        </div>
        <ul class="runway-events">
          {day.events.length === 0 ? (
            <li class="runway-event is-quiet">Planlı ödeme yok</li>
          ) : (
            day.events.map((e, i) => (
              <li key={i} class={`runway-event is-${e.kind}`}>
                {eventText(e)}
              </li>
            ))
          )}
        </ul>
      </div>

      <div
        class="runway-plot"
        role="slider"
        tabIndex={0}
        aria-label="Kesime kadar harcama gücü"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={index}
        aria-valuetext={`${title}: ${formatTL(day.power)} kalır`}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onKeyDown={onKey}
      >
        <svg class="runway-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line class="runway-base" x1="0" x2={W} y1={y(days[0].power)} y2={y(days[0].power)} vector-effect="non-scaling-stroke" />
          <path class="runway-line" d={line} vector-effect="non-scaling-stroke" />
        </svg>
        {days.map((d, i) =>
          d.events.length > 0 && i !== index ? (
            <span
              key={i}
              class={`runway-mark is-${d.events.some((e) => e.kind === 'cut') ? 'cut' : d.events.some((e) => e.kind === 'due') ? 'due' : 'recurring'}`}
              style={{ left: pct(i), top: top(d.power) }}
            />
          ) : null,
        )}
        <span class="runway-cursor" style={{ left: pct(index) }} />
        <span class="runway-dot" style={{ left: pct(index), top: top(day.power) }} />
      </div>

      <div class="runway-axis" aria-hidden="true">
        <span>Bugün</span>
        <span>
          {dayFmt.format(days[last].date)} · {daysLeft} gün
        </span>
      </div>
    </div>
  )
}
