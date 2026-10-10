import { Switch } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { isNativeApp } from '../../platform/files'
import { lockOn, setLock } from '../../platform/lock'
import { remindersOn, setReminders } from '../../platform/reminders'

/** iPhone-only settings: Face ID lock and due-date notifications. Hidden in the browser. */
export function PhoneSection() {
  if (!isNativeApp) return null

  async function onReminders(on: boolean) {
    const ok = await setReminders(on)
    if (!ok) toast('Bildirim izni kapalı. iPhone Ayarlar → Limitlerim → Bildirimler’den açabilirsin.')
  }

  async function onLock(on: boolean) {
    const result = await setLock(on)
    if (result === 'unavailable') toast('Bu iPhone’da Face ID ya da şifre kurulu değil.')
  }

  return (
    <section class="settings-section" aria-labelledby="settings-phone">
      <h2 class="settings-section-title" id="settings-phone">
        Bu iPhone
      </h2>
      <div class="settings-card settings-pad">
        <Switch
          label="Face ID ile kilitle"
          hint="Uygulamaya her dönüşünde sorar. Uygulama değiştiricide bakiyeler gizlenir."
          checked={lockOn.value}
          onChange={onLock}
        />
        <Switch
          label="Son ödeme hatırlatması"
          hint="İki gün önce ve son gün sabah 10:00’da. Bildirimde tutar yazmaz."
          checked={remindersOn.value}
          onChange={onReminders}
        />
      </div>
    </section>
  )
}
