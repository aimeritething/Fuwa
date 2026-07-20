import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StartupShellFallback } from './StartupShellFallback'

const STARTUP_SHELL_FALLBACK_NODE_KEY = '__tolariaStartupShellFallbackNode'

describe('StartupShellFallback', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, STARTUP_SHELL_FALLBACK_NODE_KEY)
    document.body.innerHTML = ''
  })

  it('renders the startup shell content captured from index.html', () => {
    const capturedShell = document.createElement('div')
    const sidebar = document.createElement('div')
    sidebar.className = 'startup-shell-fallback__sidebar'
    const list = document.createElement('div')
    list.className = 'startup-shell-fallback__list'
    const editor = document.createElement('div')
    editor.className = 'startup-shell-fallback__editor'
    const editorTitle = document.createElement('div')
    editorTitle.className = 'startup-shell-fallback__editor-title'
    editor.append(editorTitle)
    capturedShell.append(sidebar, list, editor)
    Reflect.set(window, STARTUP_SHELL_FALLBACK_NODE_KEY, capturedShell)

    render(<StartupShellFallback />)

    const shell = screen.getByTestId('startup-shell-fallback')
    expect(shell.getAttribute('aria-hidden')).toBe('true')
    expect(shell.querySelector('.startup-shell-fallback__sidebar')).not.toBeNull()
    expect(shell.querySelector('.startup-shell-fallback__editor-title')).not.toBeNull()
  })

  it('falls back to the static boot shell when the capture script has not run', () => {
    document.body.innerHTML = [
      '<div id="tolaria-boot-shell">',
      '<div class="startup-shell-fallback__list"></div>',
      '</div>',
    ].join('')

    render(<StartupShellFallback />)

    const shell = screen.getByTestId('startup-shell-fallback')
    expect(shell.querySelector('.startup-shell-fallback__list')).not.toBeNull()
  })
})
