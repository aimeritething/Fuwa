import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  tauri: false,
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  mockAssetUrl: vi.fn<(path: string) => string | null>(() => 'data:image/svg+xml,mock'),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: runtime.convertFileSrc }))
vi.mock('./tauri', () => ({
  isTauri: () => runtime.tauri,
  mockAssetUrl: (path: string) => runtime.mockAssetUrl(path),
}))

const { imageAssetUrl } = await import('./image-asset')

describe('imageAssetUrl', () => {
  beforeEach(() => {
    runtime.tauri = true
    runtime.convertFileSrc.mockClear()
  })

  it('serves the Image file through the asset protocol', () => {
    expect(imageAssetUrl('/n/lake.png', '17-2048')).toBe('asset://localhost/%2Fn%2Flake.png?v=17-2048')
  })

  it('changes with the version, so an overwrite is fetched rather than served from the cache', () => {
    const before = imageAssetUrl('/n/lake.png', '17-2048')

    expect(imageAssetUrl('/n/lake.png', '18-4096')).not.toBe(before)
  })

  it('keeps a query the asset URL already carries', () => {
    runtime.convertFileSrc.mockReturnValueOnce('http://asset.localhost/lake.png?token=abc')

    expect(imageAssetUrl('/n/lake.png', '17')).toBe('http://asset.localhost/lake.png?token=abc&v=17')
  })

  it('is nothing when the protocol refuses the path', () => {
    runtime.convertFileSrc.mockImplementationOnce(() => { throw new Error('no internals') })

    expect(imageAssetUrl('/n/lake.png', '17')).toBeNull()
  })

  it('falls back to the Folder fixture outside Tauri, versioning in the fragment a data URL allows', () => {
    runtime.tauri = false

    expect(imageAssetUrl('/n/lake.png', '17')).toBe('data:image/svg+xml,mock#v=17')
    expect(runtime.convertFileSrc).not.toHaveBeenCalled()
  })

  it('is nothing when the fixture has no such picture', () => {
    runtime.tauri = false
    runtime.mockAssetUrl.mockReturnValueOnce(null)

    expect(imageAssetUrl('/n/gone.png', '17')).toBeNull()
  })
})
