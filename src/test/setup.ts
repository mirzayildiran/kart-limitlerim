import { cleanup } from '@testing-library/preact'
import { afterEach, beforeEach } from 'vitest'

// Each test starts from an empty page holding the app root the components expect (#app).
beforeEach(() => {
  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})
