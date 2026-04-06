import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkActions } from './useBulkActions'

describe('useBulkActions', () => {
  let handleArchiveNote: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handleArchiveNote = vi.fn().mockResolvedValue(undefined)
    setToastMessage = vi.fn()
  })

  function renderBulkActions() {
    return renderHook(() =>
      useBulkActions(
        { handleArchiveNote },
        setToastMessage,
      ),
    )
  }

  // --- handleBulkArchive ---

  describe('handleBulkArchive', () => {
    it('archives each path and shows plural toast for multiple notes', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md'])
      })
      expect(handleArchiveNote).toHaveBeenCalledTimes(2)
      expect(handleArchiveNote).toHaveBeenCalledWith('/vault/a.md')
      expect(handleArchiveNote).toHaveBeenCalledWith('/vault/b.md')
      expect(setToastMessage).toHaveBeenCalledWith('2 notes archived')
    })

    it('shows singular toast when one note archived', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md'])
      })
      expect(setToastMessage).toHaveBeenCalledWith('1 note archived')
    })

    it('does not show toast when empty array given', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive([])
      })
      expect(handleArchiveNote).not.toHaveBeenCalled()
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('skips failed paths and only counts successes in toast', async () => {
      handleArchiveNote
        .mockResolvedValueOnce(undefined) // /vault/a.md succeeds
        .mockRejectedValueOnce(new Error('fail')) // /vault/b.md fails
        .mockResolvedValueOnce(undefined) // /vault/c.md succeeds
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md', '/vault/c.md'])
      })
      expect(handleArchiveNote).toHaveBeenCalledTimes(3)
      expect(setToastMessage).toHaveBeenCalledWith('2 notes archived')
    })

    it('shows no toast when all paths fail', async () => {
      handleArchiveNote.mockRejectedValue(new Error('fail'))
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md'])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })
  })
})
