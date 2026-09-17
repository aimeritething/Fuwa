import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PathRow, type PathRowMode } from './path-row'
import { TooltipProvider } from '@/ui/tooltip'

const imageSlot = { metadata: '1920 × 1080 · 240 KB', onOpenExternal: vi.fn() }

function richMode(overrides: Partial<PathRowMode> = {}): PathRowMode {
  return { value: 'rich', onChange: vi.fn(), richDisabledReason: null, frontmatterLabel: null, ...overrides }
}

function renderWithTooltips(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('PathRow', () => {
  it('shows the file name and no save state', () => {
    renderWithTooltips(<PathRow filename="Welcome.md" mode={richMode()} />)

    expect(screen.getByText('Welcome.md')).toBeInTheDocument()
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument()
  })

  it('fills the right-hand slot on an Image Tab with its dimensions, size, Open ↗ and Copy path', () => {
    renderWithTooltips(<PathRow filename="lake.png" image={imageSlot} onCopyPath={vi.fn()} />)

    expect(screen.getByTestId('path-row-image-meta')).toHaveTextContent('1920 × 1080 · 240 KB')
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('keeps the metadata slot empty until the picture has loaded, buttons and all in place', () => {
    renderWithTooltips(<PathRow filename="lake.png" image={{ ...imageSlot, metadata: null }} onCopyPath={vi.fn()} />)

    expect(screen.queryByTestId('path-row-image-meta')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open ↗' })).toBeInTheDocument()
  })

  it('hands the file over from either button', () => {
    const onOpenExternal = vi.fn()
    const onCopyPath = vi.fn()
    renderWithTooltips(<PathRow filename="lake.png" image={{ metadata: null, onOpenExternal }} onCopyPath={onCopyPath} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open ↗' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }))

    expect(onOpenExternal).toHaveBeenCalledTimes(1)
    expect(onCopyPath).toHaveBeenCalledTimes(1)
  })

  it('puts Copy path on a Document Tab too, its tooltip naming the shortcut', async () => {
    const onCopyPath = vi.fn()
    renderWithTooltips(<PathRow filename="Welcome.md" mode={richMode()} onCopyPath={onCopyPath} />)

    const button = screen.getByRole('button', { name: 'Copy path' })
    fireEvent.click(button)
    expect(onCopyPath).toHaveBeenCalledTimes(1)

    fireEvent.focus(button)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Copy path ⌘⇧,')
  })

  describe('the Rich | Raw control', () => {
    it('shows both segments with the current one checked and asks for the other on click', () => {
      const onChange = vi.fn()
      renderWithTooltips(<PathRow filename="Welcome.md" mode={richMode({ onChange })} />)

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
      renderWithTooltips(<PathRow filename="Welcome.md" mode={richMode()} />)

      fireEvent.focus(screen.getByRole('radio', { name: 'Raw' }))

      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent('Raw ⌘\\')
      expect(tip.querySelector('kbd')).toHaveTextContent('⌘\\')
    })

    it('disables the Rich segment with the reason as its tooltip while the Frontmatter is invalid', async () => {
      const onChange = vi.fn()
      renderWithTooltips(
        <PathRow
          filename="Welcome.md"
         
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

    it('shows the Frontmatter badge, then Copy path, then the control, and the badge switches to Raw on click', () => {
      const onChange = vi.fn()
      renderWithTooltips(
        <PathRow filename="Fuwa.md" mode={richMode({ onChange, frontmatterLabel: 'frontmatter · 2 keys' })} onCopyPath={vi.fn()} />,
      )

      const badge = screen.getByTestId('path-row-frontmatter')
      expect(badge).toHaveTextContent('frontmatter · 2 keys')
      const slot = badge.parentElement as HTMLElement
      const order = Array.from(slot.querySelectorAll('[data-testid]')).map((child) => child.getAttribute('data-testid'))
      expect(order).toEqual(['path-row-frontmatter', 'path-row-actions', 'path-row-copy-path', 'path-row-mode', 'path-row-mode-rich', 'path-row-mode-raw'])

      fireEvent.click(badge)
      expect(onChange).toHaveBeenCalledWith('raw')
    })

    it('shows no badge and no control on a Document without Frontmatter and an Image Tab', () => {
      const { rerender } = renderWithTooltips(<PathRow filename="Welcome.md" mode={richMode()} />)
      expect(screen.queryByTestId('path-row-frontmatter')).toBeNull()

      rerender(<TooltipProvider><PathRow filename="lake.png" image={imageSlot} /></TooltipProvider>)
      expect(screen.queryByTestId('path-row-mode')).toBeNull()
    })
  })
})
