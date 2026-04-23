import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'

const MAIN_ENTRYPOINT_TEST_TIMEOUT_MS = 30_000

type ReactRootErrorInfo = { componentStack?: string }
type ReactRootOptions = {
  onCaughtError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
  onUncaughtError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
  onRecoverableError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
}

const mocks = vi.hoisted(() => {
  const render = vi.fn()
  const createRoot = vi.fn(() => ({ render }))
  const sentryHandler = vi.fn()
  const reactErrorHandler = vi.fn(() => sentryHandler)
  const getShortcutEventInit = vi.fn(() => ({ key: 'x' }))

  return {
    createRoot,
    getShortcutEventInit,
    reactErrorHandler,
    render,
    sentryHandler,
  }
})

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }))
vi.mock('@sentry/react', () => ({ reactErrorHandler: mocks.reactErrorHandler }))
vi.mock('./App.tsx', () => ({
  default: () => createElement('div', { 'data-testid': 'mock-app' }),
}))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))
vi.mock('./hooks/appCommandDispatcher', () => ({
  APP_COMMAND_EVENT_NAME: 'laputa:command',
  isAppCommandId: (id: string) => id === 'known-command',
  isNativeMenuCommandId: (id: string) => id === 'native-command',
}))
vi.mock('./hooks/appCommandCatalog', () => ({
  getShortcutEventInit: mocks.getShortcutEventInit,
}))

async function importEntrypoint() {
  await import('./main')
}

function rootOptions(): ReactRootOptions {
  const options = mocks.createRoot.mock.calls[0]?.[1]
  if (!options) throw new Error('createRoot was not called with root options')
  return options
}

describe('main entrypoint', () => {
  beforeAll(async () => {
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
    await importEntrypoint()
  }, MAIN_ENTRYPOINT_TEST_TIMEOUT_MS)

  beforeEach(() => {
    mocks.sentryHandler.mockClear()
  })

  it('captures React root errors through Sentry with component stack context', () => {
    expect(mocks.reactErrorHandler).toHaveBeenCalledOnce()
    expect(mocks.createRoot).toHaveBeenCalledWith(
      document.getElementById('root'),
      expect.objectContaining({
        onCaughtError: expect.any(Function),
        onUncaughtError: expect.any(Function),
        onRecoverableError: expect.any(Function),
      }),
    )

    const error = new Error('Maximum update depth exceeded')
    rootOptions().onCaughtError?.(error, { componentStack: '\n    in App' })

    expect(mocks.sentryHandler).toHaveBeenCalledWith(error, { componentStack: '\n    in App' })
  })

  it('normalizes missing React component stacks before handing errors to Sentry', () => {
    const error = new Error('recoverable render error')
    rootOptions().onRecoverableError?.(error, {})

    expect(mocks.sentryHandler).toHaveBeenCalledWith(error, { componentStack: '' })
  })
})
