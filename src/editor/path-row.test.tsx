import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PathRow, type PathRowMode } from './path-row'
import { TooltipProvider } from '@/ui/tooltip'

const imageSlot = { metadata: '1920 × 1080 · 240 KB', onOpenExternal: vi.fn(), onCopyPath: vi.fn() }

function richMode(overrides: Partial<PathRowMode> = {}): PathRowMode {
  return { value: 'rich', onChange: vi.fn(), richDisabledReason: null, frontmatterLabel: null, ...overrides }
}

function renderWithTooltips(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('PathRow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the file name and no save state before the first write', () => {
    render(<PathRow filename="Welcome.md" savedAt={null} />)

    expect(screen.getByText('Welcome.md')).toBeInTheDocument()
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument()
  })

  it('shows when the last write landed and keeps counting', () => {
    render(<PathRow filename="Welcome.md" savedAt={Date.now()} />)

    expect(screen.getByText('saved just now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2_100)
    })

    expect(screen.getByText('saved 2s ago')).toBeInTheDocument()
  })

  it('restarts from "just now" when a later write lands', () => {
    const { rerender } = render(<PathRow filename="Welcome.md" savedAt={Date.now()} />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText('saved 5s ago')).toBeInTheDocument()

    rerender(<PathRow filename="Welcome.md" savedAt={Date.now()} />)

    expect(screen.getByText('saved just now')).toBeInTheDocument()
  })

  it('replaces the save state on an Image Tab with its dimensions, size and two hand-offs', () => {
    render(<PathRow filename="lake.png" savedAt={Date.now()} image={imageSlot} />)

    expect(screen.getByTestId('path-row-image-meta')).toHaveTextContent('1920 × 1080 · 240 KB')
    expect(screen.queryByTestId('path-row-saved')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('keeps the metadata slot empty until the picture has loaded, buttons and all in place', () => {
    render(<PathRow filename="lake.png" savedAt={null} image={{ ...imageSlot, metadata: null }} />)

    expect(screen.queryByTestId('path-row-image-meta')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
  })

  it('hands the file over from either button', () => {
    const onOpenExternal = vi.fn()
    const onCopyPath = vi.fn()
    render(<PathRow filename="lake.png" savedAt={null} image={{ metadata: null, onOpenExternal, onCopyPath }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open ↗' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }))

    expect(onOpenExternal).toHaveBeenCalledTimes(1)
    expect(onCopyPath).toHaveBeenCalledTimes(1)
  })

  describe('the Rich | Raw control', () => {
    it('shows both segments with the current one checked and asks for the other on click', () => {
      const onChange = vi.fn()
      renderWithTooltips(<PathRow filename="Welcome.md" savedAt={null} mode={richMode({ onChange })} />)

      const rich = screen.getByRole('radio', { name: 'Rich' })
      const raw = screen.getByRole('radio', { name: 'Raw' })
      expect(rich).toBeChecked()
      expect(raw).not.toBeChecked()

      fireEvent.click(raw)
      expect(onChange).toHaveBeenCalledWith('raw')
      fireEvent.click(rich)
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('names the shortcut as a chip in the tooltip', async () => {
      vi.useRealTimers()
      renderWithTooltips(<PathRow filename="Welcome.md" savedAt={null} mode={richMode()} />)

      fireEvent.focus(screen.getByRole('radio', { name: 'Raw' }))

      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent('Raw ⌘\\')
      expect(tip.querySelector('kbd')).toHaveTextContent('⌘\\')
    })

    it('disables the Rich segment with the reason as its tooltip while the Frontmatter is invalid', async () => {
      vi.useRealTimers()
      const onChange = vi.fn()
      renderWithTooltips(
        <PathRow
          filename="Welcome.md"
          savedAt={null}
          mode={richMode({ value: 'raw', onChange, richDisabledReason: 'Fix the frontmatter to use Rich mode', frontmatterLabel: 'frontmatter · invalid' })}
        />,
      )

      const rich = screen.getByRole('radio', { name: 'Rich' })
      expect(rich).toHaveAttribute('aria-disabled', 'true')
      fireEvent.click(rich)
      expect(onChange).not.toHaveBeenCalled()

      fireEvent.focus(rich)
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Fix the frontmatter to use Rich mode')
    })

    it('shows the Frontmatter badge between the save state and the control, and switches to Raw on click', () => {
      const onChange = vi.fn()
      renderWithTooltips(
        <PathRow filename="Fuwa.md" savedAt={Date.now()} mode={richMode({ onChange, frontmatterLabel: 'frontmatter · 2 keys' })} />,
      )

      const badge = screen.getByTestId('path-row-frontmatter')
      expect(badge).toHaveTextContent('frontmatter · 2 keys')
      const meta = badge.parentElement as HTMLElement
      const order = Array.from(meta.children).map((child) => child.getAttribute('data-testid'))
      expect(order).toEqual(['path-row-saved', 'path-row-frontmatter', 'path-row-mode'])

      fireEvent.click(badge)
      expect(onChange).toHaveBeenCalledWith('raw')
    })

    it('shows no badge and no control on a Document without Frontmatter and an Image Tab', () => {
      const { rerender } = renderWithTooltips(<PathRow filename="Welcome.md" savedAt={null} mode={richMode()} />)
      expect(screen.queryByTestId('path-row-frontmatter')).toBeNull()

      rerender(<TooltipProvider><PathRow filename="lake.png" savedAt={null} image={imageSlot} /></TooltipProvider>)
      expect(screen.queryByTestId('path-row-mode')).toBeNull()
    })
  })
})
