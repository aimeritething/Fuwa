import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeAppWindow } from './appWindow'

const runtime = vi.hoisted(() => ({
  inTauri: false,
  close: vi.fn(async () => {}),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => runtime.inTauri,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: runtime.close }),
}))

describe('closeAppWindow', () => {
  beforeEach(() => {
    runtime.close.mockClear()
  })

  it('closes the Tauri window', async () => {
    runtime.inTauri = true

    await closeAppWindow()

    expect(runtime.close).toHaveBeenCalledTimes(1)
  })

  it('is a logged no-op outside Tauri', async () => {
    runtime.inTauri = false
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    await closeAppWindow()

    expect(runtime.close).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalled()
    info.mockRestore()
  })
})
