import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { uploadImageFile, useImageDrop } from './useImageDrop'
import { createRef } from 'react'

let tauriMode = false

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => tauriMode,
}))

// JSDOM lacks DragEvent and File.arrayBuffer — polyfill for tests
beforeAll(() => {
  if (typeof globalThis.DragEvent === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DragEvent = class DragEvent extends MouseEvent {
      dataTransfer: DataTransfer | null
      constructor(type: string, init?: DragEventInit) {
        super(type, init)
        this.dataTransfer = init?.dataTransfer ?? null
      }
    }
  }

  // File.prototype.arrayBuffer may be missing in older JSDOM
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.readAsArrayBuffer(this)
      })
    }
  }
})

// Mock DataTransfer (JSDOM doesn't implement it)
function createMockDataTransfer(files: File[]) {
  const items = files.map(f => ({ kind: 'file' as const, type: f.type, getAsFile: () => f }))
  return {
    items: { ...items, length: items.length },
    files: Object.assign([...files], { item: (i: number) => files[i], length: files.length }),
    dropEffect: 'none',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as DataTransfer
}

function createDragEvent(type: string, files: File[], opts?: { relatedTarget?: EventTarget | null }) {
  const dt = createMockDataTransfer(files)
  return new DragEvent(type, {
    dataTransfer: dt,
    bubbles: true,
    cancelable: true,
    relatedTarget: opts?.relatedTarget ?? null,
  })
}

describe('uploadImageFile', () => {
  it('returns a data URL in browser mode', async () => {
    const blob = new Blob(['fake-image-data'], { type: 'image/png' })
    const file = new File([blob], 'test.png', { type: 'image/png' })

    const url = await uploadImageFile(file)
    expect(url).toMatch(/^data:image\/png;base64,/)
  })

  it('passes file to Tauri save_image in Tauri mode', async () => {
    tauriMode = true

    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue('/vault/attachments/123-test.png')
    vi.mocked(convertFileSrc).mockReturnValue('asset://localhost/vault/attachments/123-test.png')

    const blob = new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' })
    const file = new File([blob], 'test.png', { type: 'image/png' })

    const url = await uploadImageFile(file, '/vault')
    expect(invoke).toHaveBeenCalledWith('save_image', {
      vaultPath: '/vault',
      filename: 'test.png',
      data: expect.any(String),
    })
    expect(url).toBe('asset://localhost/vault/attachments/123-test.png')

    tauriMode = false
  })
})

describe('useImageDrop', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function renderImageDrop(opts?: { onImageUrl?: (url: string) => void; vaultPath?: string }) {
    const ref = createRef<HTMLDivElement>()
    Object.defineProperty(ref, 'current', { value: container, writable: true })
    return renderHook(() => useImageDrop({ containerRef: ref, ...opts }))
  }

  it('sets isDragOver to true on dragover with image files', () => {
    const { result } = renderImageDrop()
    const file = new File(['data'], 'photo.png', { type: 'image/png' })

    act(() => { container.dispatchEvent(createDragEvent('dragover', [file])) })
    expect(result.current.isDragOver).toBe(true)
  })

  it('ignores dragover with non-image files', () => {
    const { result } = renderImageDrop()
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })

    act(() => { container.dispatchEvent(createDragEvent('dragover', [file])) })
    expect(result.current.isDragOver).toBe(false)
  })

  it('resets isDragOver on dragleave when leaving container', () => {
    const { result } = renderImageDrop()
    const file = new File(['data'], 'photo.png', { type: 'image/png' })

    act(() => { container.dispatchEvent(createDragEvent('dragover', [file])) })
    expect(result.current.isDragOver).toBe(true)

    act(() => { container.dispatchEvent(createDragEvent('dragleave', [], { relatedTarget: document.body })) })
    expect(result.current.isDragOver).toBe(false)
  })

  it('resets isDragOver on drop', () => {
    const { result } = renderImageDrop()
    const file = new File(['data'], 'photo.png', { type: 'image/png' })

    act(() => { container.dispatchEvent(createDragEvent('dragover', [file])) })
    expect(result.current.isDragOver).toBe(true)

    act(() => { container.dispatchEvent(createDragEvent('drop', [file])) })
    expect(result.current.isDragOver).toBe(false)
  })

  it('accepts jpeg, gif, and webp types', () => {
    const { result } = renderImageDrop()

    for (const type of ['image/jpeg', 'image/gif', 'image/webp']) {
      const file = new File(['data'], `img.${type.split('/')[1]}`, { type })
      act(() => { container.dispatchEvent(createDragEvent('dragover', [file])) })
      expect(result.current.isDragOver).toBe(true)

      act(() => { container.dispatchEvent(createDragEvent('dragleave', [], { relatedTarget: document.body })) })
    }
  })

  it('calls onImageUrl for each image file on drop', async () => {
    const onImageUrl = vi.fn()
    renderImageDrop({ onImageUrl, vaultPath: '/vault' })

    const file = new File(['fake-img'], 'photo.png', { type: 'image/png' })
    act(() => { container.dispatchEvent(createDragEvent('drop', [file])) })

    // uploadImageFile is async — wait for callback
    await waitFor(() => expect(onImageUrl).toHaveBeenCalledTimes(1))
    expect(onImageUrl).toHaveBeenCalledWith(expect.stringContaining('data:image/png'))
  })

  it('skips non-image files during drop', async () => {
    const onImageUrl = vi.fn()
    renderImageDrop({ onImageUrl })

    const pdf = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    act(() => { container.dispatchEvent(createDragEvent('drop', [pdf])) })

    // Give it a tick to ensure no callback fires
    await new Promise(r => setTimeout(r, 50))
    expect(onImageUrl).not.toHaveBeenCalled()
  })

  it('does not call onImageUrl when no callback provided', () => {
    renderImageDrop()
    const file = new File(['data'], 'photo.png', { type: 'image/png' })
    // Should not throw
    act(() => { container.dispatchEvent(createDragEvent('drop', [file])) })
  })

  it('handles multiple image files in a single drop', async () => {
    const onImageUrl = vi.fn()
    renderImageDrop({ onImageUrl })

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ]
    const dt = createMockDataTransfer(files)
    const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
    act(() => { container.dispatchEvent(event) })

    await waitFor(() => expect(onImageUrl).toHaveBeenCalledTimes(2))
  })

  it('internal drag (no image files) does not trigger overlay', () => {
    const { result } = renderImageDrop()

    // Internal drags have no image files in dataTransfer
    act(() => { container.dispatchEvent(createDragEvent('dragover', [])) })
    expect(result.current.isDragOver).toBe(false)
  })
})
