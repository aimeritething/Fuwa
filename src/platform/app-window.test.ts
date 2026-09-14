import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeAppWindow, exitApp } from './app-window'

const runtime = vi.hoisted(() => ({
  inTauri: false,
  close: vi.fn(async () => {}),
  invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(async () => null),
  mockInvoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(async () => null),
}))

vi.mock('./tauri', () => ({
  isTauri: () => runtime.inTauri,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => runtime.mockInvoke(cmd, args),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => runtime.invoke(cmd, args),
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

describe('exitApp', () => {
  beforeEach(() => {
    runtime.invoke.mockClear()
    runtime.mockInvoke.mockClear()
  })

  it('asks the Rust side to exit, which flushes the Session file on its way out', async () => {
    runtime.inTauri = true

    await exitApp()

    expect(runtime.invoke).toHaveBeenCalledWith('quit_app', undefined)
    expect(runtime.mockInvoke).not.toHaveBeenCalled()
  })

  it('outside Tauri the Folder fixture records the quit, so a smoke spec can assert it', async () => {
    runtime.inTauri = false

    await exitApp()

    expect(runtime.mockInvoke).toHaveBeenCalledWith('quit_app', undefined)
    expect(runtime.invoke).not.toHaveBeenCalled()
  })
})
