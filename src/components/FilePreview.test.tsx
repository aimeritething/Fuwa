import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FilePreview } from './FilePreview'
import type { VaultEntry } from '../types'

const { convertFileSrcMock, trackEventMock } = vi.hoisted(() => ({
  convertFileSrcMock: vi.fn((path: string) => `asset://${path}`),
  trackEventMock: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: convertFileSrcMock,
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: trackEventMock,
}))

const imageEntry: VaultEntry = {
  path: '/vault/Attachments/photo.png',
  filename: 'photo.png',
  title: 'photo.png',
  isA: null,
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  fileKind: 'binary',
}

describe('FilePreview', () => {
  beforeEach(() => {
    convertFileSrcMock.mockReset()
    convertFileSrcMock.mockImplementation((path: string) => {
      if (typeof path !== 'string' || path.trim().length === 0) {
        throw new Error('null pointer passed to rust')
      }

      return `asset://${path}`
    })
    trackEventMock.mockClear()
  })

  it('routes header file actions to the active file path', () => {
    const onRevealFile = vi.fn()
    const onCopyFilePath = vi.fn()
    const onCopyDeepLink = vi.fn()
    const onOpenExternalFile = vi.fn()

    render(
      <FilePreview
        entry={imageEntry}
        onRevealFile={onRevealFile}
        onCopyFilePath={onCopyFilePath}
        onCopyDeepLink={onCopyDeepLink}
        onOpenExternalFile={onOpenExternalFile}
      />,
    )

    expect(trackEventMock).toHaveBeenCalledWith('file_preview_opened', { preview_kind: 'image' })

    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(onRevealFile).toHaveBeenCalledWith('/vault/Attachments/photo.png')
    expect(onCopyFilePath).toHaveBeenCalledWith('/vault/Attachments/photo.png')
    expect(onCopyDeepLink).toHaveBeenCalledWith(imageEntry)
    expect(onOpenExternalFile).toHaveBeenCalledWith('/vault/Attachments/photo.png')
    expect(trackEventMock).toHaveBeenCalledWith('file_preview_action', {
      action: 'reveal',
      preview_kind: 'image',
    })
    expect(trackEventMock).toHaveBeenCalledWith('file_preview_action', {
      action: 'copy_path',
      preview_kind: 'image',
    })
    expect(trackEventMock).toHaveBeenCalledWith('file_preview_action', {
      action: 'copy_deep_link',
      preview_kind: 'image',
    })
    expect(trackEventMock).toHaveBeenCalledWith('file_preview_action', {
      action: 'open_external',
      preview_kind: 'image',
    })
  })

  it('renders supported image files through the asset preview path', () => {
    render(<FilePreview entry={imageEntry} />)

    expect(screen.getByTestId('image-file-preview')).toHaveAttribute('src', 'asset:///vault/Attachments/photo.png')
    expect(screen.getByText('PNG file')).toBeInTheDocument()
  })

  it('does not call the Tauri asset bridge for malformed file paths', () => {
    const malformedEntry = {
      ...imageEntry,
      path: null,
      filename: 'photo.png',
      title: 'photo.png',
    } as unknown as VaultEntry

    expect(() => render(<FilePreview entry={malformedEntry} />)).not.toThrow()

    expect(convertFileSrcMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-preview-fallback')).toHaveTextContent('Preview unavailable')
  })

  it('falls back when the native asset bridge rejects a preview path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    convertFileSrcMock.mockImplementationOnce(() => {
      throw new Error('null pointer passed to rust')
    })

    try {
      expect(() => render(<FilePreview entry={imageEntry} />)).not.toThrow()

      expect(screen.queryByTestId('image-file-preview')).not.toBeInTheDocument()
      expect(screen.getByTestId('file-preview-fallback')).toHaveTextContent('Image preview failed')
      expect(warnSpy).toHaveBeenCalledWith(
        '[file-preview] Failed to prepare asset preview source:',
        expect.any(Error),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('tracks image preview failures without leaking the file path', () => {
    render(<FilePreview entry={imageEntry} />)

    fireEvent.error(screen.getByTestId('image-file-preview'))

    expect(trackEventMock).toHaveBeenCalledWith('file_preview_failed', { preview_kind: 'image' })
    expect(trackEventMock).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ path: expect.any(String) }),
    )
  })
})
