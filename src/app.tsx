import { useEffect } from 'preact/hooks'
import { route } from './ui/nav'
import { ready, loadError } from './data/store'
import { HomePage } from './features/home/HomePage'
import { lazy, preloadLazy } from './lazy'
import { TabBar } from './ui/components/TabBar'
import { SheetHost } from './features/SheetHost'
import { ToastHost } from './ui/components/controls'
import { toast } from './ui/components/toast'

// Only the home screen is in the first chunk; the rest load on demand (and are preloaded when idle).
const ExpensesPage = lazy(() => import('./features/expenses/ExpensesPage').then((m) => m.ExpensesPage))
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then((m) => m.CalendarPage))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => m.SettingsPage))
const AssistantPage = lazy(() => import('./features/assistant/AssistantPage').then((m) => m.AssistantPage))

export function App() {
  const isReady = ready.value
  // After the data is in, so the chunk downloads do not compete with opening IndexedDB.
  useEffect(() => {
    if (isReady) preloadLazy()
  }, [isReady])

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
      case 'assistant':
        return <AssistantPage />
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
