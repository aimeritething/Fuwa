import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { bindVaultConfigStore, resetVaultConfigStore } from '../utils/vaultConfigStore'
import {
  EditorTestHarness as Editor,
  defaultProps,
  flushEditorSwapWork,
  mockEditor,
  mockEntry,
  render,
  resetEditorTestState,
} from './Editor.helpers.test'

const NOTE_ENTRY: VaultEntry = {
  ...mockEntry,
  path: '/vault/previous-note.md',
  filename: 'previous-note.md',
  title: 'Previous note',
}

const NOTE = {
  entry: NOTE_ENTRY,
  content: '---\ntype: Note\nprobe_value: hello\n---\n\n# Previous note\n\nAlpha body.\n',
}

const SHEET_ENTRY: VaultEntry = {
  ...mockEntry,
  path: '/vault/probe-sheet.md',
  filename: 'probe-sheet.md',
  title: 'Probe sheet',
  display: 'sheet',
}

const SHEET_CONTENT = '---\ntype: Note\n_display: sheet\n---\nName,Value\nx,42\n'
const SHEET_TAB = { entry: SHEET_ENTRY, content: SHEET_CONTENT }

const STALE_NOTE_DOCUMENT = [
  {
    id: 'h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Previous note' }],
    children: [],
  },
  {
    id: 'html-1',
    type: 'htmlBlock',
    props: { height: '80', html: '<p>A: {{probe_value}}</p>', scripts: 'blocked' },
    content: [],
    children: [],
  },
]

function bindEmptyVaultConfig() {
  resetVaultConfigStore()
  bindVaultConfigStore(
    {
      zoom: null,
      view_mode: null,
      editor_mode: null,
      tag_colors: null,
      status_colors: null,
      property_display_modes: null,
      inbox: null,
    },
    vi.fn(),
  )
}

describe('sheet notes and the shared rich editor', () => {
  beforeEach(() => {
    resetEditorTestState()
    bindEmptyVaultConfig()
    mockEditor.document = STALE_NOTE_DOCUMENT
  })

  it('does not write the previously viewed note body into a sheet note', async () => {
    const rawToggleRef = { current: (() => {}) as () => void | Promise<void> }
    const flushPendingRawContentRef = { current: null as ((path: string) => void) | null }
    const onContentChange = vi.fn()

    const props = {
      ...defaultProps,
      tabs: [NOTE, SHEET_TAB],
      entries: [NOTE_ENTRY, SHEET_ENTRY],
      onContentChange,
      rawToggleRef,
      flushPendingRawContentRef,
    }

    const { rerender } = render(<Editor {...props} activeTabPath={NOTE_ENTRY.path} />)
    await flushEditorSwapWork()

    rerender(<Editor {...props} activeTabPath={SHEET_ENTRY.path} />)
    await flushEditorSwapWork()
    expect(screen.getByTestId('sheet-editor')).toHaveAttribute('data-path', SHEET_ENTRY.path)

    await act(async () => {
      await rawToggleRef.current()
    })
    await flushEditorSwapWork()

    const rawText = screen.getByTestId('raw-editor-codemirror').textContent ?? ''
    expect(rawText).toContain('Name,Value')
    expect(rawText).not.toContain('Previous note')

    await act(async () => {
      flushPendingRawContentRef.current?.(SHEET_ENTRY.path)
    })

    await act(async () => {
      await rawToggleRef.current()
    })
    await flushEditorSwapWork()

    expect(onContentChange).not.toHaveBeenCalledWith(
      SHEET_ENTRY.path,
      expect.stringContaining('Previous note'),
    )
  })
})
