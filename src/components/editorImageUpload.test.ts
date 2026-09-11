import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadEditorImage } from './editorImageUpload'

const runtime = vi.hoisted(() => ({
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
  convertFileSrc: (path: string) => `asset://localhost${path}`,
}))

describe('uploadEditorImage', () => {
  beforeEach(() => {
    runtime.invoke.mockReset()
  })

  it('writes a pasted image beside the Document and points the block at it', async () => {
    runtime.invoke.mockResolvedValue('/Users/fuwa/Notes/attachments/1700-image.png')
    const file = new File([new Uint8Array([0x89, 0x50])], 'image.png', { type: 'image/png' })

    const result = await uploadEditorImage(file, '/Users/fuwa/Notes')

    expect(runtime.invoke).toHaveBeenCalledWith('save_image', {
      vaultPath: '/Users/fuwa/Notes',
      filename: 'image.png',
      data: expect.any(String),
    })
    expect(result).toBe('asset://localhost/Users/fuwa/Notes/attachments/1700-image.png')
  })

  it('leaves an unsupported format empty rather than failing the paste', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const file = new File(['heic-data'], 'iphone.HEIC', { type: 'image/heic' })

    try {
      await expect(uploadEditorImage(file, '/Users/fuwa/Notes')).resolves.toEqual({
        props: { name: 'iphone.HEIC', url: '' },
      })
      expect(runtime.invoke).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('lets a failure that is not an unsupported format surface', async () => {
    runtime.invoke.mockRejectedValue('Path must stay inside the active vault')
    const file = new File(['data'], 'shot.png', { type: 'image/png' })

    await expect(uploadEditorImage(file, '/Users/fuwa/Notes')).rejects.toBe(
      'Path must stay inside the active vault',
    )
  })
})
