import { fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Aç
      </button>
      <Sheet
        open={open}
        title="Harcama ekle"
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        footer={<button type="button">Kaydet</button>}
      >
        <label>
          Tutar <input name="amount" />
        </label>
      </Sheet>
    </>
  )
}

/** Renders inside #app (as the app does) and opens the sheet from its button. */
function openSheet(onClose?: () => void) {
  const app = document.getElementById('app')!
  render(<Harness onClose={onClose} />, { container: app })
  const opener = screen.getByRole('button', { name: 'Aç' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: screen.getByRole('dialog', { name: 'Harcama ekle' }) }
}

describe('Sheet', () => {
  it('is a labelled modal dialog and focuses the first field', () => {
    const { dialog } = openSheet()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Tutar' }))
  })

  it('makes the rest of the page inert while open and restores it on close', () => {
    const { opener } = openSheet()
    // The page around the sheet is inert; the sheet's own branch is not.
    const inert = [...document.querySelectorAll('[inert]')]
    expect(inert.some((el) => el.contains(opener))).toBe(true)
    expect(inert.some((el) => el.contains(screen.getByRole('dialog')))).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
  })

  it('keeps Tab and Shift+Tab inside the sheet', () => {
    openSheet()
    const field = screen.getByRole('textbox', { name: 'Tutar' })
    const close = screen.getByRole('button', { name: 'Kapat' })
    const save = screen.getByRole('button', { name: 'Kaydet' })
    save.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
    field.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape and gives focus back to the opener', () => {
    const onClose = vi.fn()
    const { opener } = openSheet(onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('closes from the Kapat button', () => {
    const onClose = vi.fn()
    openSheet(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
