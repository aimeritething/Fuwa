import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommitFlow } from './useCommitFlow'

describe('useCommitFlow', () => {
  let savePending: vi.Mock
  let loadModifiedFiles: vi.Mock
  let commitAndPush: vi.Mock
  let setToastMessage: vi.Mock
  let onPushRejected: vi.Mock

  beforeEach(() => {
    savePending = vi.fn().mockResolvedValue(undefined)
    loadModifiedFiles = vi.fn().mockResolvedValue(undefined)
    commitAndPush = vi.fn().mockResolvedValue({ status: 'ok', message: 'Pushed to remote' })
    setToastMessage = vi.fn()
    onPushRejected = vi.fn()
  })

  function renderCommitFlow() {
    return renderHook(() => useCommitFlow({ savePending, loadModifiedFiles, commitAndPush, setToastMessage, onPushRejected }))
  }

  it('openCommitDialog saves pending, refreshes files, then opens dialog', async () => {
    const { result } = renderCommitFlow()
    expect(result.current.showCommitDialog).toBe(false)

    await act(async () => {
      await result.current.openCommitDialog()
    })

    expect(savePending).toHaveBeenCalledTimes(1)
    expect(loadModifiedFiles).toHaveBeenCalledTimes(1)
    expect(result.current.showCommitDialog).toBe(true)
  })

  it('handleCommitPush saves pending, commits, shows toast, and refreshes files', async () => {
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test message')
    })

    expect(savePending).toHaveBeenCalled()
    expect(commitAndPush).toHaveBeenCalledWith('test message')
    expect(setToastMessage).toHaveBeenCalledWith('Committed and pushed')
    expect(loadModifiedFiles).toHaveBeenCalled()
    expect(result.current.showCommitDialog).toBe(false)
  })

  it('handleCommitPush calls onPushRejected when push is rejected', async () => {
    commitAndPush.mockResolvedValueOnce({ status: 'rejected', message: 'Push rejected' })
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test message')
    })

    expect(onPushRejected).toHaveBeenCalledTimes(1)
    expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('push rejected'))
  })

  it('handleCommitPush shows error toast on failure', async () => {
    commitAndPush.mockRejectedValueOnce(new Error('push failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test')
    })

    expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('Commit failed'))
    consoleSpy.mockRestore()
  })

  it('closeCommitDialog closes the dialog', async () => {
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.openCommitDialog()
    })
    expect(result.current.showCommitDialog).toBe(true)

    act(() => {
      result.current.closeCommitDialog()
    })
    expect(result.current.showCommitDialog).toBe(false)
  })
})
