import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getMockVault, isTauri, mockInvoke } from '../mock-tauri'
import type { ListedFile } from '../utils/explorer'
import { allowVaultAssets } from '../utils/vaultAssetScope'

async function listFiles(vaultPath: string): Promise<ListedFile[]> {
  const command = isTauri() ? invoke : mockInvoke
  return command<ListedFile[]>('list_files', { vaultPath })
}

export async function pickFolderToOpen(): Promise<string | null> {
  if (!isTauri()) return getMockVault().takeDialogSelection()
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selection = await open({ title: 'Open Folder', directory: true, multiple: false })
  return typeof selection === 'string' ? selection : null
}

export function useFolder() {
  const [folder, setFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<ListedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const folderRef = useRef<string | null>(null)
  const generation = useRef(0)
  const changing = useRef(false)

  const changeFolder = useCallback(async (path: string | null, beforeChange: () => Promise<void>) => {
    if (changing.current) return
    changing.current = true
    try {
      const next = path?.replace(/\/+$/u, '') || (path === '/' ? '/' : null)
      // A Folder that will not list is the reader's problem, so the Explorer
      // says so (spec section 2); a Write failure in `beforeChange` is not,
      // and keeps the Folder it already has without a message.
      let listed: ListedFile[] = []
      if (next) {
        try {
          listed = await listFiles(next)
        } catch (error) {
          setError(`Folder not found: ${next}`)
          throw error
        }
      }
      if (next) await allowVaultAssets(next)
      await beforeChange()
      generation.current += 1
      folderRef.current = next
      setFolder(next)
      setFiles(listed)
      setError(null)
    } finally {
      changing.current = false
    }
  }, [])

  const restoreFolder = useCallback(async (path: string | null) => {
    await changeFolder(path, async () => {}).catch(() => {})
    return folderRef.current
  }, [changeFolder])

  const refresh = useCallback(async () => {
    const path = folderRef.current
    if (!path) return
    const request = ++generation.current
    const listed = await listFiles(path)
    if (request === generation.current && path === folderRef.current) setFiles(listed)
  }, [])

  return { folder, files, error, changeFolder, restoreFolder, refresh }
}
