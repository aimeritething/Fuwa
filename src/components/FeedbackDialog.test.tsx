import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'
import {
  TOLARIA_CANNY_URL,
  TOLARIA_GITHUB_CONTRIBUTING_URL,
  TOLARIA_GITHUB_DISCUSSIONS_URL,
  TOLARIA_GITHUB_ISSUES_URL,
} from '../constants/feedback'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { rememberFeedbackDialogOpener } from '../lib/feedbackDialogOpener'

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & {
  openExternalUrl: ReturnType<typeof vi.fn>
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders the contribution paths when open', () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel="alpha" />)
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
    expect(screen.getByText('Contribute to Tolaria')).toBeInTheDocument()
    expect(screen.getByText('Feature request / improvement idea')).toBeInTheDocument()
    expect(screen.getByText('Community / discussion')).toBeInTheDocument()
    expect(screen.getByText('Contribute code')).toBeInTheDocument()
    expect(screen.getByText('Report a bug')).toBeInTheDocument()
  })

  it('focuses the primary CTA when opened', async () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel={null} />)
    const cta = screen.getByRole('button', { name: 'Open Canny' })
    await waitFor(() => expect(cta).toHaveFocus())
  })

  it('opens the expected contribution links without closing the modal', async () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Canny' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Discussions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Contributing Guide' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open GitHub Issues' }))

    await waitFor(() => expect(openExternalUrl).toHaveBeenNthCalledWith(1, TOLARIA_CANNY_URL))
    expect(openExternalUrl).toHaveBeenNthCalledWith(2, TOLARIA_GITHUB_DISCUSSIONS_URL)
    expect(openExternalUrl).toHaveBeenNthCalledWith(3, TOLARIA_GITHUB_CONTRIBUTING_URL)
    expect(openExternalUrl).toHaveBeenNthCalledWith(4, TOLARIA_GITHUB_ISSUES_URL)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
  })

  it('copies a sanitized diagnostic bundle', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel="alpha" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]?.[0]).toContain('Tolaria sanitized diagnostics')
    expect(writeText.mock.calls[0]?.[0]).toContain('Build: b281')
    expect(writeText.mock.calls[0]?.[0]).toContain('Release channel: alpha')
    expect(screen.getByText('Diagnostics copied.')).toBeInTheDocument()
  })

  it('shows a fallback message when a contribution link cannot be opened', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('blocked'))

    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Canny' }))

    expect(await screen.findByText(/couldn’t open Canny automatically/i)).toBeInTheDocument()
    expect(screen.getByText(TOLARIA_CANNY_URL)).toBeInTheDocument()
  })

  it('closes when pressing Escape', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when clicking Close', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('reopens the command palette after closing when launched from it', () => {
    vi.useFakeTimers()

    const opener = document.createElement('input')
    opener.setAttribute('placeholder', 'Type a command...')
    document.body.appendChild(opener)
    rememberFeedbackDialogOpener(opener)

    const onClose = vi.fn()
    const handleReopen = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, handleReopen)

    const { rerender } = render(
      <FeedbackDialog open={false} onClose={onClose} buildNumber="b281" releaseChannel={null} />,
    )

    rerender(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    vi.advanceTimersByTime(100)

    expect(onClose).toHaveBeenCalledOnce()
    expect(handleReopen).toHaveBeenCalledTimes(1)
    expect(handleReopen.mock.calls[0]?.[0]).toMatchObject({
      detail: APP_COMMAND_IDS.viewCommandPalette,
    })

    window.removeEventListener(APP_COMMAND_EVENT_NAME, handleReopen)
    opener.remove()
    vi.useRealTimers()
  })
})
