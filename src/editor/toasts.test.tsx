import { describe, expect, it, vi } from 'vitest'
import { copyPathWithToast, showRefusalToast } from './toasts'

const runtime = vi.hoisted(() => ({
  copyLocalPath: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  toast: vi.fn(),
}))

vi.mock('@/platform/url', () => ({ copyLocalPath: (path: string) => runtime.copyLocalPath(path) }))
vi.mock('sonner', () => ({ toast: runtime.toast }))

describe('toasts', () => {
  it('puts the path on the clipboard, then says so', async () => {
    copyPathWithToast('/n/Welcome.md')

    expect(runtime.copyLocalPath).toHaveBeenCalledWith('/n/Welcome.md')
    await vi.waitFor(() => expect(runtime.toast).toHaveBeenCalledWith('Copied path to clipboard', expect.objectContaining({ id: 'copy-path' })))
  })

  it('says a refused copy in the same toast, so a retry replaces it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runtime.copyLocalPath.mockRejectedValueOnce(new Error('clipboard denied'))

    copyPathWithToast('/n/Welcome.md')

    await vi.waitFor(() => expect(runtime.toast).toHaveBeenCalledWith("Couldn't copy path", expect.objectContaining({ id: 'copy-path' })))
    warn.mockRestore()
  })

  it('keys a refusal by its words, so the same refusal twice restarts one toast', () => {
    showRefusalToast('Projects already has Welcome.md')

    expect(runtime.toast).toHaveBeenCalledWith('Projects already has Welcome.md', expect.objectContaining({ id: 'Projects already has Welcome.md' }))
  })
})
