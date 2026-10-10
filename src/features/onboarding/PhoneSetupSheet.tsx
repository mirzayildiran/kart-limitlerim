import { useState } from 'preact/hooks'
import { Button } from '../../ui/components/controls'
import { Icon, type IconName } from '../../ui/components/Icon'
import { Sheet } from '../../ui/components/Sheet'
import { closeSheet } from '../../ui/nav'
import { lockOn, setLock } from '../../platform/lock'
import { remindersOn, setReminders } from '../../platform/reminders'
import './phone-setup.css'

interface RowProps {
  icon: IconName
  title: string
  why: string
  on: boolean
  busy: boolean
  note: string | null
  onTurnOn: () => void
}

/** One optional feature: what it does in a sentence, and an "Aç" that is the only way to the system prompt. */
function SetupRow({ icon, title, why, on, busy, note, onTurnOn }: RowProps) {
  return (
    <div class="phone-setup-row">
      <div class="phone-setup-main">
        <span class="phone-setup-icon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <div class="phone-setup-text">
          <p class="phone-setup-title">{title}</p>
          <p class="phone-setup-why">{why}</p>
        </div>
        {on ? (
          <span class="phone-setup-on">
            <Icon name="check" size={18} />
            Açık
          </span>
        ) : (
          <Button variant="secondary" onClick={onTurnOn} disabled={busy}>
            Aç
          </Button>
        )}
      </div>
      {note && (
        <p class="phone-setup-note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}

/**
 * Shown once on the phone after the first card is added. Nothing asks iOS for permission until
 * the user taps "Aç" on a row; "Şimdi değil" closes it with nothing changed.
 */
export function PhoneSetupSheet() {
  const [busy, setBusy] = useState<'reminders' | 'lock' | null>(null)
  const [remindersNote, setRemindersNote] = useState<string | null>(null)
  const [lockNote, setLockNote] = useState<string | null>(null)
  const anyOn = remindersOn.value || lockOn.value

  async function turnOnReminders() {
    setBusy('reminders')
    const ok = await setReminders(true)
    setBusy(null)
    setRemindersNote(ok ? null : 'Bildirim izni verilmedi. İstersen iPhone Ayarlar → Limitlerim → Bildirimler’den açabilirsin.')
  }

  async function turnOnLock() {
    setBusy('lock')
    const result = await setLock(true)
    setBusy(null)
    setLockNote(
      result === 'unavailable'
        ? 'Bu iPhone’da Face ID ya da şifre kurulu değil.'
        : result === 'cancelled'
          ? 'Doğrulama tamamlanmadı, kilit kapalı kaldı.'
          : null,
    )
  }

  return (
    <Sheet
      open
      title="Telefonun da yardım etsin"
      onClose={closeSheet}
      footer={
        <Button variant={anyOn ? 'primary' : 'secondary'} block onClick={closeSheet}>
          {anyOn ? 'Bitti' : 'Şimdi değil'}
        </Button>
      }
    >
      <p class="phone-setup-intro">İkisi de isteğe bağlı. Sonra Ayarlar → Bu iPhone’dan değiştirebilirsin.</p>
      <div class="phone-setup-list">
        <SetupRow
          icon="bell"
          title="Son ödeme hatırlatması"
          why="İki gün önce ve son gün sabah 10:00’da haber verir. Bildirimde tutar yazmaz."
          on={remindersOn.value}
          busy={busy !== null}
          note={remindersNote}
          onTurnOn={turnOnReminders}
        />
        <SetupRow
          icon="faceid"
          title="Face ID ile kilitle"
          why="Uygulamaya her dönüşünde sorar; uygulama değiştiricide bakiyeler gizlenir."
          on={lockOn.value}
          busy={busy !== null}
          note={lockNote}
          onTurnOn={turnOnLock}
        />
      </div>
    </Sheet>
  )
}
