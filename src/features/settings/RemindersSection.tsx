import { Switch } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { isNativeApp } from '../../platform/files'
import { remindersOn, setReminders } from '../../platform/reminders'

/** Due-date notifications; only in the iOS app, browsers have no reliable scheduled notifications. */
export function RemindersSection() {
  if (!isNativeApp) return null

  async function onChange(on: boolean) {
    const ok = await setReminders(on)
    if (!ok) toast('Bildirim izni kapalı. iPhone Ayarlar → Limitlerim → Bildirimler’den açabilirsin.')
  }

  return (
    <section class="settings-section" aria-labelledby="settings-reminders">
      <h2 class="settings-section-title" id="settings-reminders">
        Hatırlatmalar
      </h2>
      <div class="settings-card settings-pad">
        <Switch
          label="Son ödeme hatırlatması"
          hint="İki gün önce ve son gün sabah 10:00’da. Bildirimde tutar yazmaz."
          checked={remindersOn.value}
          onChange={onChange}
        />
      </div>
    </section>
  )
}
