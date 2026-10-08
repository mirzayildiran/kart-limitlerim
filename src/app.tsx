import { useEffect } from 'preact/hooks'
import { route } from './ui/nav'
import { ready, loadError } from './data/store'
import { HomePage } from './features/home/HomePage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TabBar } from './ui/components/TabBar'
import { SheetHost } from './features/SheetHost'
import { ToastHost } from './ui/components/controls'
import { toast } from './ui/components/toast'

export function App() {
  useEffect(() => {
    // Register service worker with PWA updates
    try {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          const updateSW = registerSW({
            onNeedRefresh() {
              toast('Yeni sürüm hazır.', {
                label: 'Yenile',
                run: () => updateSW(true),
              })
            },
            onOfflineReady() {
              toast('Uygulama çevrim dışı da çalışır.')
            },
          })
        })
        .catch(() => {})
    } catch {
      // PWA registration not available or failed
    }
  }, [])

  const isReady = ready.value
  const hasError = loadError.value

  if (!isReady) {
    return (
      <main class="app-main">
        <div class="loading-state">
          <p class="loading-title">Kart Limitlerim</p>
          <p class="loading-subtitle">Yükleniyor...</p>
        </div>
      </main>
    )
  }

  if (hasError) {
    return (
      <main class="app-main">
        <div class="error-state">
          <p class="error-title">Veriler açılamadı</p>
          <p class="error-message">{hasError}</p>
        </div>
      </main>
    )
  }

  const currentRoute = route.value

  const renderPage = () => {
    switch (currentRoute) {
      case 'home':
        return <HomePage />
      case 'expenses':
        return <ExpensesPage />
      case 'calendar':
        return <CalendarPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <HomePage />
    }
  }

  return (
    <main class="app-main">
      <div class="app-content">{renderPage()}</div>
      <TabBar />
      <SheetHost />
      <ToastHost />
    </main>
  )
}
