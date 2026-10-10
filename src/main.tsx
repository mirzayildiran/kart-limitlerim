import '@fontsource-variable/onest'
import '@fontsource-variable/schibsted-grotesk'
import './ui/tokens.css'
import './ui/fonts.css'
import './ui/base.css'
import './app.css'
import { render } from 'preact'
import { init } from './data/store'
import { applySavedTheme, dismissBoot } from './ui/theme'
import { App } from './app.tsx'
import { startReminders } from './platform/reminders'
import { startLock } from './platform/lock'
import { startDeepLinks } from './platform/deeplinks'
import { startTextSize } from './platform/textSize'
import { LockScreen } from './features/lock/LockScreen'

// Initialize data store (don't await before first render)
init().catch(() => {})

applySavedTheme()
startReminders()
startLock()
startDeepLinks()
startTextSize()

// Same task as the render, so no frame is painted without the boot screen or the app.
dismissBoot()
render(<App />, document.getElementById('app')!)

// Separate root so the lock covers the app without the app knowing about it.
const lockRoot = document.body.appendChild(document.createElement('div'))
render(<LockScreen />, lockRoot)
