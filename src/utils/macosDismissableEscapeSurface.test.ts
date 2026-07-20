import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const invoke = vi.fn(async () => undefined)

vi.mock('@tauri-apps/api/core', () => ({ invoke }))

const withMacTauri = async (callback: () => Promise<void>) => {
  const originalUserAgent = navigator.userAgent
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Safari/605.1.15',
    configurable: true,
  })
  ;(window as typeof window & { __TAURI__?: object }).__TAURI__ = {}
  try {
    await callback()
  } finally {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
    delete (window as typeof window & { __TAURI__?: object }).__TAURI__
  }
}

describe('macOS dismissable Escape surface state', () => {
  it('reports the first visible surface and final hidden surface to the native monitor', async () => {
    await withMacTauri(async () => {
      const { useMacosDismissableEscapeSurfaceRef } = await import('./macosDismissableEscapeSurface')

      function Surface({ open }: { open: boolean }) {
        const ref = useMacosDismissableEscapeSurfaceRef<HTMLDivElement>()
        return open ? React.createElement('div', { ref }) : null
      }

      const first = render(React.createElement(Surface, { open: true }))
      const second = render(React.createElement(Surface, { open: true }))

      await vi.waitFor(() => {
        expect(invoke).toHaveBeenCalledWith(
          'set_macos_dismissable_escape_surface_open',
          { open: true },
        )
      })

      first.rerender(React.createElement(Surface, { open: false }))
      expect(invoke).not.toHaveBeenCalledWith(
        'set_macos_dismissable_escape_surface_open',
        { open: false },
      )

      second.rerender(React.createElement(Surface, { open: false }))
      await vi.waitFor(() => {
        expect(invoke).toHaveBeenCalledWith(
          'set_macos_dismissable_escape_surface_open',
          { open: false },
        )
      })
    })
  })
})
