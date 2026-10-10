import { signal } from '@preact/signals'
import { Button } from '../../ui/components/controls'
import { toast } from '../../ui/components/toast'
import { isNativeApp } from '../../platform/files'
import './install-guide.css'

/** Chrome on Android fires this once per page load, possibly before Settings mounts, so listen at module load. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

const installPrompt = signal<InstallPromptEvent | null>(null)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    installPrompt.value = e as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installPrompt.value = null
  })
}

function isStandalone(): boolean {
  return (
    isNativeApp ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function install(event: InstallPromptEvent) {
  try {
    await event.prompt()
  } catch {
    toast('Yükleme başlatılamadı. Menüden tekrar dene.')
  }
  installPrompt.value = null
}

/** How to add the app to the home screen. Hidden when already running as an installed app. */
export function InstallGuide() {
  if (isStandalone()) return null

  const prompt = installPrompt.value

  return (
    <section class="install-guide" aria-labelledby="install-guide-title">
      <h2 class="install-guide-title" id="install-guide-title">
        Uygulama gibi kullan
      </h2>

      <div class="install-guide-group">
        <h3 class="install-guide-platform">iPhone</h3>
        <ol class="install-guide-steps">
          <li>Safari'de Paylaş düğmesine dokun</li>
          <li>Ana Ekrana Ekle</li>
          <li>Ekle</li>
        </ol>
      </div>

      <div class="install-guide-group">
        <h3 class="install-guide-platform">Android</h3>
        <ol class="install-guide-steps">
          <li>Chrome menüsü (⋮) → Uygulamayı yükle</li>
        </ol>
        {prompt && (
          <Button variant="primary" block onClick={() => install(prompt)}>
            Yükle
          </Button>
        )}
      </div>
    </section>
  )
}
