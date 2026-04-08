import { useCallback, useRef } from 'react'
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
}) {
  const { updateEntry } = config
  const saveContent = useCallback((path: string, content: string) => {
    updateEntry(path, {
      outgoingLinks: extractOutgoingLinks(content),
      snippet: extractSnippet(content),
      wordCount: countWords(content),
    })
  }, [updateEntry])
  const editor = useEditorSave({ updateVaultContent: saveContent, setTabs: config.setTabs, setToastMessage: config.setToastMessage, onAfterSave: config.onAfterSave, onNotePersisted: config.onNotePersisted })
  const { handleContentChange: rawOnChange } = editor
  const prevLinksKeyRef = useRef('')
  const prevFmKeyRef = useRef('')
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
    const fmPatch = {
      ...frontmatterPatch,
      ...deriveDisplayTitleState(
        content,
        filename,
        typeof frontmatterPatch.title === 'string' ? frontmatterPatch.title : null,
      ),
    }
    const fmKey = JSON.stringify(fmPatch)
    if (fmKey !== prevFmKeyRef.current) {
      prevFmKeyRef.current = fmKey
      if (Object.keys(fmPatch).length > 0) updateEntry(path, fmPatch)
    }
  }, [rawOnChange, updateEntry])
  return { ...editor, handleContentChange }
}
