import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'

// Mock restartApp to prevent dynamic import issues in tests
vi.mock('../hooks/useUpdater', async () => {
  const actual = await vi.importActual('../hooks/useUpdater')
  return {
    ...actual,
    restartApp: vi.fn(),
  }
})

function makeActions(overrides?: Partial<UpdateActions>): UpdateActions {
  return {
    startDownload: vi.fn(),
    openReleaseNotes: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  }
}

describe('UpdateBanner', () => {
  it('renders nothing when idle', () => {
    const status: UpdateStatus = { state: 'idle' }
    const { container } = render(<UpdateBanner status={status} actions={makeActions()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing on error state', () => {
    const status: UpdateStatus = { state: 'error' }
    const { container } = render(<UpdateBanner status={status} actions={makeActions()} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows version and action buttons when update is available', () => {
    const status: UpdateStatus = { state: 'available', version: '1.5.0', notes: 'Bug fixes' }
    const actions = makeActions()
    render(<UpdateBanner status={status} actions={actions} />)

    expect(screen.getByTestId('update-banner')).toBeTruthy()
    expect(screen.getByText(/Tolaria 1\.5\.0/)).toBeTruthy()
    expect(screen.getByText('is available')).toBeTruthy()
    expect(screen.getByTestId('update-now-btn')).toBeTruthy()
    expect(screen.getByTestId('update-release-notes')).toBeTruthy()
    expect(screen.getByTestId('update-dismiss')).toBeTruthy()
  })

  it('"Update Now" calls startDownload', () => {
    const status: UpdateStatus = { state: 'available', version: '1.5.0', notes: undefined }
    const actions = makeActions()
    render(<UpdateBanner status={status} actions={actions} />)

    fireEvent.click(screen.getByTestId('update-now-btn'))
    expect(actions.startDownload).toHaveBeenCalledOnce()
  })

  it('"Release Notes" link calls openReleaseNotes', () => {
    const status: UpdateStatus = { state: 'available', version: '1.5.0', notes: undefined }
    const actions = makeActions()
    render(<UpdateBanner status={status} actions={actions} />)

    fireEvent.click(screen.getByTestId('update-release-notes'))
    expect(actions.openReleaseNotes).toHaveBeenCalledOnce()
  })

  it('dismiss button calls dismiss action', () => {
    const status: UpdateStatus = { state: 'available', version: '1.5.0', notes: undefined }
    const actions = makeActions()
    render(<UpdateBanner status={status} actions={actions} />)

    fireEvent.click(screen.getByTestId('update-dismiss'))
    expect(actions.dismiss).toHaveBeenCalledOnce()
  })

  it('shows progress bar during download', () => {
    const status: UpdateStatus = { state: 'downloading', version: '1.5.0', progress: 0.65 }
    render(<UpdateBanner status={status} actions={makeActions()} />)

    expect(screen.getByText(/Downloading Tolaria 1\.5\.0/)).toBeTruthy()
    expect(screen.getByText('65%')).toBeTruthy()

    const progressBar = screen.getByTestId('update-progress')
    expect(progressBar.style.width).toBe('65%')
  })

  it('shows 0% at start of download', () => {
    const status: UpdateStatus = { state: 'downloading', version: '2.0.0', progress: 0 }
    render(<UpdateBanner status={status} actions={makeActions()} />)

    expect(screen.getByText('0%')).toBeTruthy()
    const progressBar = screen.getByTestId('update-progress')
    expect(progressBar.style.width).toBe('0%')
  })

  it('shows restart button when update is ready', () => {
    const status: UpdateStatus = { state: 'ready', version: '1.5.0' }
    render(<UpdateBanner status={status} actions={makeActions()} />)

    expect(screen.getByText(/Tolaria 1\.5\.0/)).toBeTruthy()
    expect(screen.getByText(/restart to apply/)).toBeTruthy()
    expect(screen.getByTestId('update-restart-btn')).toBeTruthy()
  })

  it('restart button calls restartApp', async () => {
    const { restartApp } = await import('../hooks/useUpdater')
    const status: UpdateStatus = { state: 'ready', version: '1.5.0' }
    render(<UpdateBanner status={status} actions={makeActions()} />)

    fireEvent.click(screen.getByTestId('update-restart-btn'))
    expect(restartApp).toHaveBeenCalled()
  })
})
