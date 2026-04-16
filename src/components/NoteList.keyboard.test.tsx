import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteList } from './NoteList'
import {
  allSelection,
  mockEntries,
} from '../test-utils/noteListTestUtils'
import type { VaultEntry } from '../types'

function NoteListKeyboardHarness({
  onOpen,
}: {
  onOpen: (entry: VaultEntry) => void
}) {
  const [selectedNote, setSelectedNote] = useState<VaultEntry | null>(null)

  const handleOpen = (entry: VaultEntry) => {
    setSelectedNote(entry)
    onOpen(entry)
  }

  return (
    <NoteList
      entries={mockEntries}
      selection={allSelection}
      selectedNote={selectedNote}
      noteListFilter="open"
      onNoteListFilterChange={() => {}}
      onSelectNote={handleOpen}
      onReplaceActiveTab={handleOpen}
      onCreateNote={() => {}}
    />
  )
}

describe('NoteList keyboard activation', () => {
  it('focuses the list on click and continues arrow navigation from the clicked note', async () => {
    const onOpen = vi.fn()
    render(<NoteListKeyboardHarness onOpen={onOpen} />)

    fireEvent.click(screen.getByText('Facebook Ads Strategy'))

    const container = screen.getByTestId('note-list-container')
    await waitFor(() => {
      expect(document.activeElement).toBe(container)
      expect(
        container.querySelector('[data-highlighted="true"]')?.getAttribute('data-note-path'),
      ).toBe(mockEntries[1].path)
    })

    fireEvent.keyDown(container, { key: 'ArrowDown' })

    expect(onOpen).toHaveBeenNthCalledWith(1, mockEntries[1])
    expect(onOpen).toHaveBeenNthCalledWith(2, mockEntries[2])
  })
})
