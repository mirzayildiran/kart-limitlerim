import '@fontsource-variable/onest'
import '@fontsource-variable/schibsted-grotesk'
import './ui/tokens.css'
import './ui/base.css'
import './app.css'
import { render } from 'preact'
import { init } from './data/store'
import { App } from './app.tsx'

// Initialize data store (don't await before first render)
init().catch(() => {})

render(<App />, document.getElementById('app')!)
