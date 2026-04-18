import { startTransition, useCallback, useRef } from 'react'
import { useEditorSave } from './useEditorSave'
import { extractOutgoingLinks, extractSnippet, countWords } from '../utils/wikilinks'
import { contentToEntryPatch } from './frontmatterOps'
import { deriveDisplayTitleState } from '../utils/noteTitle'
import type { VaultEntry } from '../types'

export function useEditorSaveWithLinks(config: {
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSave>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  onAfterSave: () => void
  onNotePersisted?: (path: string, content: string) => void
  resolvePath?: (path: string) => string
  resolvePathBeforeSave?: (path: string) => Promise<string>
}) {
  const { updateEntry } = config
  const saveContent = useCallback((path: string, content: string) => {
    updateEntry(path, {
      outgoingLinks: extractOutgoingLinks(content),
      snippet: extractSnippet(content),
      wordCount: countWords(content),
      modifiedAt: Math.floor(Date.now() / 1000),
    })
  }, [updateEntry])
  const editor = useEditorSave({
    updateVaultContent: saveContent,
    setTabs: config.setTabs,
    setToastMessage: config.setToastMessage,
    onAfterSave: config.onAfterSave,
    onNotePersisted: config.onNotePersisted,
    resolvePath: config.resolvePath,
    resolvePathBeforeSave: config.resolvePathBeforeSave,
  })
  const { handleContentChange: rawOnChange } = editor
  const prevLinksKeyRef = useRef('')
  const prevFmKeyRef = useRef('')
  const prevTitleKeyRef = useRef('')
  const handleContentChange = useCallback((path: string, content: string) => {
    rawOnChange(path, content)
    const links = extractOutgoingLinks(content)
    const key = links.join('\0')
    if (key !== prevLinksKeyRef.current) {
      prevLinksKeyRef.current = key
      updateEntry(path, { outgoingLinks: links })
    }
    const frontmatterPatch = contentToEntryPatch(content)
    const filename = path.split('/').pop() ?? path
    const titlePatch = deriveDisplayTitleState({
      content,
      filename,
      frontmatterTitle: typeof frontmatterPatch.title === 'string' ? frontmatterPatch.title : null,
    })
    const fmPatch = { ...frontmatterPatch }
    delete fmPatch.title
    const fmKey = JSON.stringify(fmPatch)
    if (fmKey !== prevFmKeyRef.current) {
      prevFmKeyRef.current = fmKey
      if (Object.keys(fmPatch).length > 0) updateEntry(path, fmPatch)
    }
    const titleKey = JSON.stringify(titlePatch)
    if (titleKey !== prevTitleKeyRef.current) {
      prevTitleKeyRef.current = titleKey
      startTransition(() => {
        updateEntry(path, titlePatch)
      })
    }
  }, [rawOnChange, updateEntry])
  return { ...editor, handleContentChange }
}
