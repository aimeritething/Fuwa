import { useEffect } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'

const TEST_TABLE_MARKDOWN = `| Head 1 | Head 2 | Head 3 |
| --- | --- | --- |
| A | B | C |
| D | E | F |
`

declare global {
  interface TestBridge {
    seedBlockNoteTable?: (columnWidths?: Array<number | null>) => Promise<void> | void
  }
}

type TestTableBlock = {
  type?: string
  content?: { type?: string; columnWidths?: Array<number | null> }
}

function applySeededColumnWidths(
  parsedBlocks: Array<TestTableBlock>,
  columnWidths?: Array<number | null>,
) {
  if (!columnWidths) return

  const tableBlock = parsedBlocks[0]
  if (tableBlock?.type !== 'table') return

  const tableContent = tableBlock.content
  if (tableContent?.type !== 'tableContent') return

  tableContent.columnWidths = [...columnWidths]
}

async function seedEditorWithTestTable(
  editor: ReturnType<typeof useCreateBlockNote>,
  columnWidths?: Array<number | null>,
) {
  const parsedBlocks = (await Promise.resolve(
    editor.tryParseMarkdownToBlocks(TEST_TABLE_MARKDOWN),
  )) as Array<TestTableBlock>

  applySeededColumnWidths(parsedBlocks, columnWidths)

  const tableMarkup = editor.blocksToHTMLLossy([
    ...parsedBlocks,
    { type: 'paragraph', content: [], children: [] },
  ] as typeof editor.document)
  editor._tiptapEditor.commands.setContent(tableMarkup)
  editor.focus()
}

function unregisterSeedBlockNoteTableBridge(
  seedBlockNoteTable: NonNullable<Window['__fuwaTest']>['seedBlockNoteTable'],
) {
  const testBridge = window.__fuwaTest
  if (!testBridge || testBridge.seedBlockNoteTable !== seedBlockNoteTable) return
  delete testBridge.seedBlockNoteTable
}

function registerSeedBlockNoteTableBridge(editor: ReturnType<typeof useCreateBlockNote>) {
  const seedBlockNoteTable = seedEditorWithTestTable.bind(null, editor)
  window.__fuwaTest = { ...window.__fuwaTest, seedBlockNoteTable }
  return unregisterSeedBlockNoteTableBridge.bind(null, seedBlockNoteTable)
}

export function useSeedBlockNoteTableBridge(editor: ReturnType<typeof useCreateBlockNote>) {
  useEffect(() => registerSeedBlockNoteTableBridge(editor), [editor])
}
