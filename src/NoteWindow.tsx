import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Editor } from './components/Editor'
import { Toast } from './components/Toast'
import { isTauri, mockInvoke } from './mock-tauri'
import { getNoteWindowParams } from './utils/windowMode'
import { useThemeManager } from './hooks/useThemeManager'
import { useEditorSaveWithLinks } from './hooks/useEditorSaveWithLinks'
import { useLayoutPanels } from './hooks/useLayoutPanels'
import type { VaultEntry } from './types'
import './App.css'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

interface Tab {
  entry: VaultEntry
  content: string
}

/**
 * Minimal app shell for secondary "note windows" opened via "Open in New Window".
 * Shows only the editor — no sidebar, no note list.
 */
export default function NoteWindow() {
  const params = getNoteWindowParams()
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const activeTabPath = tabs[0]?.entry.path ?? null

  const layout = useLayoutPanels()

  // Load vault entries + note content on mount
  useEffect(() => {
    if (!params) return
    const { vaultPath, notePath } = params
    let cancelled = false

    async function load() {
      const vaultEntries = await tauriCall<VaultEntry[]>('list_vault', { path: vaultPath })
      if (cancelled) return
      setEntries(vaultEntries)
      const entry = vaultEntries.find(e => e.path === notePath)
      if (!entry) return
      const content = await tauriCall<string>('get_note_content', { path: notePath })
      if (cancelled) return
      setTabs([{ entry, content }])
    }

    load().catch(err => console.error('NoteWindow load failed:', err))
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount with captured params

  // Apply theme
  const vaultPath = params?.vaultPath ?? ''
  useThemeManager(vaultPath, entries)

  // Update window title when note title changes
  useEffect(() => {
    const title = tabs[0]?.entry.title
    if (!title) return
    if (!isTauri()) { document.title = title; return }
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title)
    }).catch(() => {})
  }, [tabs])

  // Auto-save
  const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) => {
    setEntries(prev => prev.map(e => e.path === path ? { ...e, ...patch } : e))
    setTabs(prev => prev.map(t => t.entry.path === path ? { ...t, entry: { ...t.entry, ...patch } } : t))
  }, [])

  const onAfterSave = useCallback(() => {}, [])
  const onNotePersisted = useCallback(() => {}, [])

  const { handleSave, handleContentChange } = useEditorSaveWithLinks({
    updateEntry,
    setTabs,
    setToastMessage,
    onAfterSave,
    onNotePersisted,
  })

  // Wikilink navigation — in a note window, open wikilinks in the same window
  const handleNavigateWikilink = useCallback((target: string) => {
    const targetLower = target.toLowerCase()
    const entry = entries.find(e =>
      e.title.toLowerCase() === targetLower ||
      e.aliases.some(a => a.toLowerCase() === targetLower)
    )
    if (!entry) return
    tauriCall<string>('get_note_content', { path: entry.path }).then(content => {
      setTabs([{ entry, content }])
    }).catch(() => {})
  }, [entries])

  // Stub for close tab — in a note window, close the window
  const handleCloseTab = useCallback(() => {
    if (!isTauri()) return
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().close()
    }).catch(() => {})
  }, [])

  // Keyboard: Cmd+S to save, Cmd+W to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        handleCloseTab()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleCloseTab])

  const activeTab = tabs[0] ?? null
  const gitHistory = useMemo(() => [], [])

  if (!params) {
    return <div className="app-shell"><p>Invalid note window parameters</p></div>
  }

  if (!activeTab) {
    return (
      <div className="app-shell">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar)' }}>
          <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app">
        <div className="app__editor">
          <Editor
            tabs={tabs}
            activeTabPath={activeTabPath}
            entries={entries}
            onSwitchTab={() => {}}
            onCloseTab={handleCloseTab}
            onNavigateWikilink={handleNavigateWikilink}
            inspectorCollapsed={layout.inspectorCollapsed}
            onToggleInspector={() => layout.setInspectorCollapsed(c => !c)}
            inspectorWidth={layout.inspectorWidth}
            onInspectorResize={layout.handleInspectorResize}
            inspectorEntry={activeTab.entry}
            inspectorContent={activeTab.content}
            gitHistory={gitHistory}
            onContentChange={handleContentChange}
            onSave={handleSave}
            leftPanelsCollapsed={true}
            vaultPath={vaultPath}
          />
        </div>
      </div>
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  )
}
