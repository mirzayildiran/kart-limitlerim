import { fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'
import type { Kurus } from '../../domain/types'
import { MoneyField } from './controls'

function Harness({ initial = null, onChange }: { initial?: Kurus | null; onChange: (v: Kurus | null) => void }) {
  const [value, setValue] = useState<Kurus | null>(initial)
  return (
    <>
      <MoneyField
        label="Tutar"
        value={value}
        onChange={(v) => {
          onChange(v)
          setValue(v)
        }}
        error={value !== null && value <= 0 ? 'Tutar sıfırdan büyük olmalı.' : null}
      />
      <button type="button" onClick={() => setValue(123_456)}>
        Dışarıdan değiştir
      </button>
    </>
  )
}

const field = () => screen.getByRole('textbox', { name: 'Tutar' }) as HTMLInputElement
const type = (text: string) => fireEvent.input(field(), { target: { value: text } })

describe('MoneyField', () => {
  it('shows a stored amount in Turkish format with a decimal keyboard', () => {
    render(<Harness initial={123_456} onChange={() => {}} />)
    expect(field().value).toBe('1.234,56')
    expect(field().getAttribute('inputmode')).toBe('decimal')
  })

  it.each([
    ['250', 25_000],
    ['1.234,56', 123_456],
    ['1234,5', 123_450],
    ['1234.56', 123_456],
    ['12.345.678', 1_234_567_800],
    ['₺ 99,90 TL', 9_990],
    ['', null],
    ['   ', null],
    ['abc', null],
  ])('reports "%s" as %s kuruş', (text, kurus) => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    type(text)
    expect(onChange).toHaveBeenLastCalledWith(kurus)
  })

  it('keeps what the user typed while they type', () => {
    render(<Harness onChange={() => {}} />)
    type('1234,')
    expect(field().value).toBe('1234,')
    type('1234,5')
    expect(field().value).toBe('1234,5')
  })

  it('follows a value changed from outside', () => {
    render(<Harness onChange={() => {}} />)
    type('5')
    fireEvent.click(screen.getByRole('button', { name: 'Dışarıdan değiştir' }))
    expect(field().value).toBe('1.234,56')
  })

  it('links the error to the field for screen readers', () => {
    render(<Harness onChange={() => {}} />)
    type('0')
    expect(field().getAttribute('aria-invalid')).toBe('true')
    const described = field().getAttribute('aria-describedby')!
    expect(document.getElementById(described)?.textContent).toContain('Tutar sıfırdan büyük olmalı.')
  })
})
