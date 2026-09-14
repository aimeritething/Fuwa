import { describe, expect, it, vi } from 'vitest'
import { copyImagePath, openImageExternally } from './image-tab-actions'

const runtime = vi.hoisted(() => ({
  openLocalFile: vi.fn<(path: string, root?: string) => Promise<void>>(() => Promise.resolve()),
  copyLocalPath: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
}))

vi.mock('@/platform/url', () => ({
  openLocalFile: (path: string, root?: string) => runtime.openLocalFile(path, root),
  copyLocalPath: (path: string) => runtime.copyLocalPath(path),
}))

describe('the Image Tab hand-offs', () => {
  it('opens the file with the default app, inside the boundary root it names', () => {
    openImageExternally('/n/Attachments/lake.png', '/n')

    expect(runtime.openLocalFile).toHaveBeenCalledWith('/n/Attachments/lake.png', '/n')
  })

  it('puts the absolute path on the clipboard', () => {
    copyImagePath('/n/Attachments/lake.png')

    expect(runtime.copyLocalPath).toHaveBeenCalledWith('/n/Attachments/lake.png')
  })

  it('reports a refusal rather than throwing at the click', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runtime.openLocalFile.mockRejectedValueOnce(new Error('No app for image/png'))

    openImageExternally('/n/lake.png', '/n')
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    warn.mockRestore()
  })
})
