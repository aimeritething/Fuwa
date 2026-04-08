import { memo } from 'react'
import { NoteListLayout } from './note-list/NoteListLayout'
import { useNoteListModel, type NoteListProps } from './note-list/useNoteListModel'

function NoteListInner(props: NoteListProps) {
  const model = useNoteListModel(props)
  return <NoteListLayout {...model} />
}

export const NoteList = memo(NoteListInner)
