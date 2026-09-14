import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImageView } from './image-view'

const runtime = vi.hoisted(() => ({ assetUrl: vi.fn<(path: string) => string | null>(() => 'data:image/svg+xml,mock') }))

vi.mock('@/platform/tauri', () => ({
  isTauri: () => false,
  mockAssetUrl: (path: string) => runtime.assetUrl(path),
}))

function renderView(props: Partial<React.ComponentProps<typeof ImageView>> = {}) {
  const onNaturalSize = vi.fn()
  const onOpenExternal = vi.fn()
  const view = render(
    <ImageView path="/n/lake.png" filename="lake.png" version="1" onNaturalSize={onNaturalSize} onOpenExternal={onOpenExternal} {...props} />,
  )
  return { ...view, onNaturalSize, onOpenExternal }
}

describe('image-view', () => {
  it('shows the picture through the asset protocol, named by its file', () => {
    renderView()

    expect(screen.getByTestId('image-file-preview')).toHaveAttribute('src', 'data:image/svg+xml,mock#v=1')
    expect(screen.getByAltText('lake.png')).toBeInTheDocument()
  })

  it('reports the natural size once the browser has it', () => {
    const { onNaturalSize } = renderView()
    const image = screen.getByTestId('image-file-preview')
    Object.defineProperty(image, 'naturalWidth', { value: 1920 })
    Object.defineProperty(image, 'naturalHeight', { value: 1080 })

    fireEvent.load(image)

    expect(onNaturalSize).toHaveBeenCalledWith({ width: 1920, height: 1080 })
  })

  it('falls back with a hand-off to the default app when the picture will not render', () => {
    const { onNaturalSize, onOpenExternal } = renderView()

    fireEvent.error(screen.getByTestId('image-file-preview'))

    expect(onNaturalSize).toHaveBeenCalledWith(null)
    expect(screen.getByText("Couldn't show lake.png")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /default app/ }))
    expect(onOpenExternal).toHaveBeenCalled()
  })

  it('tries the picture again when the file on disk has changed', () => {
    runtime.assetUrl.mockImplementation((path) => `${path}?stale`)
    const { rerender, onNaturalSize, onOpenExternal } = renderView()
    fireEvent.error(screen.getByTestId('image-file-preview'))
    expect(screen.getByTestId('file-preview-fallback')).toBeInTheDocument()

    runtime.assetUrl.mockImplementation((path) => `${path}?fresh`)
    rerender(
      <ImageView path="/n/lake.png" filename="lake.png" version="2" onNaturalSize={onNaturalSize} onOpenExternal={onOpenExternal} />,
    )

    expect(screen.getByTestId('image-file-preview')).toHaveAttribute('src', '/n/lake.png?fresh#v=2')
  })

  it('falls back when there is no asset URL to show at all', () => {
    runtime.assetUrl.mockReturnValue(null)

    renderView()

    expect(screen.getByTestId('file-preview-fallback')).toBeInTheDocument()
  })
})
