import { memo, useCallback } from 'react'
import { NoteListLayout } from './note-list/NoteListLayout'
import { useNoteListModel, type NoteListProps } from './note-list/useNoteListModel'

type NoteListInnerProps = NoteListProps & {
  onBulkOrganize?: (paths: string[]) => void
}

function NoteListInner({ onBulkOrganize, ...props }: NoteListInnerProps) {
  const model = useNoteListModel(props)
  const handleBulkOrganize = useCallback(() => {
    const paths = [...model.multiSelect.selectedPaths]
    model.multiSelect.clear()
    onBulkOrganize?.(paths)
  }, [model.multiSelect, onBulkOrganize])

  return <NoteListLayout {...model} handleBulkOrganize={onBulkOrganize ? handleBulkOrganize : undefined} />
}

export const NoteList = memo(NoteListInner)
