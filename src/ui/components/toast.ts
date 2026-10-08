import { signal } from '@preact/signals'

export interface ToastMsg {
  id: number
  text: string
  /** Optional undo-style action. */
  action?: { label: string; run: () => void }
}

export const toastMsg = signal<ToastMsg | null>(null)

let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(text: string, action?: ToastMsg['action'], ms = 3200) {
  clearTimeout(timer)
  toastMsg.value = { id: ++seq, text, action }
  timer = setTimeout(() => (toastMsg.value = null), action ? ms + 2000 : ms)
}

export function dismissToast() {
  clearTimeout(timer)
  toastMsg.value = null
}
