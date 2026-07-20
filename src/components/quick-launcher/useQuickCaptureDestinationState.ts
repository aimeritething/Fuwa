import { useEffect, useState } from 'react'
import type { VaultOption } from '../StatusBar'
import type { QuickCaptureDestination } from '../../lib/quickLauncher'
import {
  loadQuickCaptureFolders,
  previewQuickCapture,
  type QuickCapturePreview,
} from '../../lib/quickLauncherBackend'
import { flattenQuickLauncherFolders } from './quickLauncherFolders'

function useCaptureFolders(vaultPath: string) {
  const [folders, setFolders] = useState<Array<{ label: string; path: string }>>([])
  useEffect(() => {
    if (!vaultPath) return
    let current = true
    void loadQuickCaptureFolders({ vaultPath }).then((nodes) => {
      if (current) setFolders(flattenQuickLauncherFolders(nodes))
    }).catch(() => {
      if (current) setFolders([])
    })
    return () => { current = false }
  }, [vaultPath])
  return { folders, setFolders }
}

function useCapturePreview({ folder, title, vaultPath }: {
  folder: string
  title: string
  vaultPath: string
}) {
  const [preview, setPreview] = useState<QuickCapturePreview | null>(null)
  useEffect(() => {
    if (!vaultPath) return
    let current = true
    const timeoutId = window.setTimeout(() => {
      void previewQuickCapture({ folder, title: title || 'Untitled', vaultPath }).then((value) => {
        if (current) setPreview(value)
      }).catch(() => {
        if (current) setPreview(null)
      })
    }, 100)
    return () => {
      current = false
      window.clearTimeout(timeoutId)
    }
  }, [folder, title, vaultPath])
  return { preview, setPreview }
}

export function writableQuickCaptureVault(vault: VaultOption): boolean {
  return vault.available !== false && vault.mounted !== false
}

export function useQuickCaptureDestinationState(
  initialDestination: QuickCaptureDestination | null,
  title: string,
) {
  const [vaultPath, setVaultPath] = useState(initialDestination?.vaultPath ?? '')
  const [folder, setFolder] = useState(initialDestination?.folder ?? '')
  const folderState = useCaptureFolders(vaultPath)
  const previewState = useCapturePreview({ folder, title, vaultPath })
  const selectVault = (path: string) => {
    setVaultPath(path)
    setFolder('')
    folderState.setFolders([])
    previewState.setPreview(null)
  }
  return {
    folder,
    folders: folderState.folders,
    preview: previewState.preview,
    selectVault,
    setFolder,
    vaultPath,
  }
}
