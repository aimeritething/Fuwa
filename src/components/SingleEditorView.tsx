import { useEffect, useCallback, useMemo, useRef, useContext } from 'react'
import { trackEvent } from '../lib/telemetry'
import {
  useCreateBlockNote,
  SuggestionMenuController,
  BlockNoteViewRaw,
  ComponentsContext,
  SideMenuController,
} from '@blocknote/react'
import { components } from '@blocknote/mantine'
import { MantineContext, MantineProvider } from '@mantine/core'
import { useEditorTheme } from '../hooks/useTheme'
import { useImageDrop } from '../hooks/useImageDrop'
import { buildTypeEntryMap } from '../utils/typeColors'
import { preFilterWikilinks, deduplicateByPath, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { filterPersonMentions, PERSON_MENTION_MIN_QUERY } from '../utils/personMentionSuggestions'
import { attachClickHandlers, enrichSuggestionItems } from '../utils/suggestionEnrichment'
import { WikilinkSuggestionMenu, type WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
import type { VaultEntry } from '../types'
import { _wikilinkEntriesRef } from './editorSchema'
import { useBlockNoteSideMenuHoverGuard } from './blockNoteSideMenuHoverGuard'
import { getTolariaSlashMenuItems } from './tolariaEditorFormattingConfig'
import {
  TolariaFormattingToolbar,
  TolariaFormattingToolbarController,
} from './tolariaEditorFormatting'
import { TolariaSideMenu } from './tolariaBlockNoteSideMenu'
import { useEditorLinkActivation } from './useEditorLinkActivation'

const TEST_TABLE_MARKDOWN = `| Head 1 | Head 2 | Head 3 |
| --- | --- | --- |
| A | B | C |
| D | E | F |
`

type TestTableBlock = {
  type?: string
  content?: { type?: string; columnWidths?: Array<number | null> }
}

function SharedContextBlockNoteView(props: React.ComponentProps<typeof BlockNoteViewRaw>) {
  const { children, className, theme, ...rest } = props
  const mantineContext = useContext(MantineContext)
  const colorScheme = theme === 'dark' ? 'dark' : 'light'
  const view = (
    <ComponentsContext.Provider value={components}>
      <BlockNoteViewRaw
        {...rest}
        className={['bn-mantine', className].filter(Boolean).join(' ')}
        data-mantine-color-scheme={colorScheme}
        theme={theme}
      >
        {children}
      </BlockNoteViewRaw>
    </ComponentsContext.Provider>
  )

  if (mantineContext) return view

  return (
    <MantineProvider
      // BlockNote scopes Mantine defaults under `.bn-mantine` instead of `:root`.
      withCssVariables={false}
      getRootElement={() => undefined}
    >
      {view}
    </MantineProvider>
  )
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
  const parsedBlocks = await Promise.resolve(
    editor.tryParseMarkdownToBlocks(TEST_TABLE_MARKDOWN),
  ) as Array<TestTableBlock>

  applySeededColumnWidths(parsedBlocks, columnWidths)

  const tableHtml = editor.blocksToHTMLLossy([
    ...parsedBlocks,
    { type: 'paragraph', content: [], children: [] },
  ] as typeof editor.document)
  editor._tiptapEditor.commands.setContent(tableHtml)
  editor.focus()
}

function useSeedBlockNoteTableBridge(editor: ReturnType<typeof useCreateBlockNote>) {
  useEffect(() => {
    const seedBlockNoteTable = (columnWidths?: Array<number | null>) => (
      seedEditorWithTestTable(editor, columnWidths)
    )

    window.__laputaTest = {
      ...window.__laputaTest,
      seedBlockNoteTable,
    }

    return () => {
      if (window.__laputaTest?.seedBlockNoteTable === seedBlockNoteTable) {
        delete window.__laputaTest.seedBlockNoteTable
      }
    }
  }, [editor])
}

function shouldIgnoreContainerClick(target: HTMLElement) {
  return Boolean(
    target.closest(
      '[contenteditable="true"], .bn-formatting-toolbar, [role="menu"], [role="dialog"]',
    ),
  )
}

/** Insert an image block after the current cursor position. */
function useInsertImageCallback(editor: ReturnType<typeof useCreateBlockNote>) {
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])
  return useCallback((url: string) => {
    const e = editorRef.current
    const cursorBlock = e.getTextCursorPosition().block
    e.insertBlocks([{ type: 'image' as const, props: { url } }], cursorBlock, 'after')
  }, [])
}

/** Single BlockNote editor view — content is swapped via replaceBlocks */
export function SingleEditorView({ editor, entries, onNavigateWikilink, onChange, vaultPath, editable = true }: {
  editor: ReturnType<typeof useCreateBlockNote>
  entries: VaultEntry[]
  onNavigateWikilink: (target: string) => void
  onChange?: () => void
  vaultPath?: string
  editable?: boolean
}) {
  const { cssVars } = useEditorTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const onImageUrl = useInsertImageCallback(editor)
  const { isDragOver } = useImageDrop({ containerRef, onImageUrl, vaultPath })
  useBlockNoteSideMenuHoverGuard(containerRef)
  useEditorLinkActivation(containerRef, onNavigateWikilink)

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return
    const target = e.target as HTMLElement
    if (shouldIgnoreContainerClick(target)) return
    const blocks = editor.document
    if (blocks.length > 0) {
      editor.setTextCursorPosition(blocks[blocks.length - 1].id, 'end')
    }
    editor.focus()
  }, [editor, editable])

  useEffect(() => {
    _wikilinkEntriesRef.current = entries
  }, [entries])

  useSeedBlockNoteTableBridge(editor)

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(
    () => deduplicateByPath(entries.map(entry => ({
      title: entry.title,
      aliases: [...new Set([entry.filename.replace(/\.md$/, ''), ...entry.aliases])],
      group: entry.isA || 'Note',
      entryType: entry.isA,
      entryTitle: entry.title,
      path: entry.path,
    }))),
    [entries]
  )

  const insertWikilink = useCallback((target: string) => {
    editor.insertInlineContent([
      { type: 'wikilink' as const, props: { target } },
      " ",
    ])
    trackEvent('wikilink_inserted')
  }, [editor])

  const getWikilinkItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < MIN_QUERY_LENGTH) return []
    const candidates = preFilterWikilinks(baseItems, query)
    const items = attachClickHandlers(candidates, insertWikilink, vaultPath ?? '')
    return enrichSuggestionItems(items, query, typeEntryMap)
  }, [baseItems, insertWikilink, typeEntryMap, vaultPath])

  const getPersonMentionItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < PERSON_MENTION_MIN_QUERY) return []
    const candidates = filterPersonMentions(baseItems, query)
    const items = attachClickHandlers(candidates, insertWikilink, vaultPath ?? '')
    return enrichSuggestionItems(items, query, typeEntryMap)
  }, [baseItems, insertWikilink, typeEntryMap, vaultPath])

  const getSlashMenuItems = useCallback(async (query: string) => (
    getTolariaSlashMenuItems(editor, query)
  ), [editor])

  return (
    <div ref={containerRef} className={`editor__blocknote-container${isDragOver ? ' editor__blocknote-container--drag-over' : ''}`} style={cssVars as React.CSSProperties} onClick={handleContainerClick}>
      {isDragOver && (
        <div className="editor__drop-overlay">
          <div className="editor__drop-overlay-label">Drop image here</div>
        </div>
      )}
      <SharedContextBlockNoteView
        editor={editor}
        theme="light"
        onChange={onChange}
        editable={editable}
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
      >
        <SideMenuController sideMenu={TolariaSideMenu} />
        <TolariaFormattingToolbarController
          formattingToolbar={TolariaFormattingToolbar}
          floatingUIOptions={{
            elementProps: {
              onMouseDownCapture: (event) => {
                const target = event.target as HTMLElement
                if (
                  target.closest(
                    '[role="menu"], [role="dialog"], button[aria-haspopup]',
                  )
                ) {
                  return
                }
                event.preventDefault()
              },
            },
          }}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={getWikilinkItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={getPersonMentionItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
      </SharedContextBlockNoteView>
    </div>
  )
}
