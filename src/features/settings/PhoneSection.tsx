import { useState } from 'preact/hooks'
import { Switch } from '../../ui/components/controls'
import { Icon, type IconName } from '../../ui/components/Icon'
import { isNativeApp } from '../../platform/files'
import { lockOn, setLock } from '../../platform/lock'
import { remindersOn, setReminders } from '../../platform/reminders'

type LockNote = 'unavailable' | 'cancelled' | null

/** One switch row with its icon tile; a note under it explains why the switch did not turn on. */
function PhoneRow({ icon, note, children }: { icon: IconName; note?: string | null; children: preact.ComponentChildren }) {
  return (
    <div class="phone-row">
      <div class="phone-row-main">
        <span class="phone-row-icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <div class="phone-row-switch">{children}</div>
      </div>
      {note && (
        <p class="phone-note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}

/** iPhone-only settings: Face ID lock and due-date notifications. Hidden in the browser. */
export function PhoneSection() {
  const [lockNote, setLockNote] = useState<LockNote>(null)
  const [remindersDenied, setRemindersDenied] = useState(false)

  if (!isNativeApp) return null

  async function onReminders(on: boolean) {
    const ok = await setReminders(on)
    setRemindersDenied(on && !ok)
  }

  async function onLock(on: boolean) {
    const result = await setLock(on)
    setLockNote(result === 'ok' ? null : result)
  }

  const lockText =
    lockNote === 'unavailable'
      ? 'Bu iPhone’da Face ID ya da şifre kurulu değil. iPhone Ayarlar → Face ID ve Parola’dan kurduktan sonra yeniden aç.'
      : lockNote === 'cancelled'
        ? 'Doğrulama tamamlanmadı, kilit kapalı kaldı. Açmak için anahtara yeniden dokun.'
        : null

  return (
    <section class="settings-section" aria-labelledby="settings-phone">
      <h2 class="settings-section-title" id="settings-phone">
        Bu iPhone
      </h2>
      <div class="settings-card phone-card">
        <PhoneRow icon="faceid" note={lockText}>
          <Switch
            label="Face ID ile kilitle"
            hint="Uygulamaya her dönüşünde sorar. Uygulama değiştiricide bakiyeler gizlenir."
            checked={lockOn.value}
            onChange={onLock}
          />
        </PhoneRow>
        <PhoneRow
          icon="bell"
          note={
            remindersDenied
              ? 'Bildirim izni kapalı. iPhone Ayarlar → Limitlerim → Bildirimler’den izin ver, sonra anahtarı yeniden aç.'
              : null
          }
        >
          <Switch
            label="Son ödeme hatırlatması"
            hint="İki gün önce ve son gün sabah 10:00’da. Bildirimde tutar yazmaz."
            checked={remindersOn.value}
            onChange={onReminders}
          />
        </PhoneRow>
      </div>
    </section>
  )
}
