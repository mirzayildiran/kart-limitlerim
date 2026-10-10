import '@fontsource-variable/onest'
import '@fontsource-variable/schibsted-grotesk'
import './ui/tokens.css'
import './ui/fonts.css'
import './ui/base.css'
import './app.css'
import { render } from 'preact'
import { init } from './data/store'
import { applySavedTheme } from './ui/theme'
import { App } from './app.tsx'
import { startReminders } from './platform/reminders'

// Initialize data store (don't await before first render)
init().catch(() => {})

applySavedTheme()
startReminders()

render(<App />, document.getElementById('app')!)
