import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { isTauri } from '../mock-tauri'
import {
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  type AppUpdateDownloadEvent,
  type AppUpdateMetadata,
} from '../lib/appUpdater'
import { openExternalUrl } from '../utils/url'

const RELEASE_NOTES_URL = 'https://refactoringhq.github.io/tolaria/'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'available'; version: string; notes: string | undefined }
  | { state: 'downloading'; version: string; progress: number }
  | { state: 'ready'; version: string }
  | { state: 'error' }

export type UpdateCheckResult = 'up-to-date' | 'available' | 'error'

export interface UpdateActions {
  checkForUpdates: () => Promise<UpdateCheckResult>
  startDownload: () => void
  openReleaseNotes: () => void
  dismiss: () => void
}

function toAvailableStatus(update: AppUpdateMetadata): UpdateStatus {
  return {
    state: 'available',
    version: update.version,
    notes: update.body ?? undefined,
  }
}

function createDownloadProgressHandler(
  version: string,
  setStatus: Dispatch<SetStateAction<UpdateStatus>>,
): (event: AppUpdateDownloadEvent) => void {
  let totalBytes = 0
  let downloadedBytes = 0

  return (event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength ?? 0
      return
    }

    if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength
      const progress = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0
      setStatus({ state: 'downloading', version, progress })
      return
    }

    setStatus({ state: 'ready', version })
  }
}

export function useUpdater(
  releaseChannel: string | null | undefined,
): { status: UpdateStatus; actions: UpdateActions } {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const updateRef = useRef<AppUpdateMetadata | null>(null)

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!isTauri()) return 'up-to-date'

    try {
      const update = await checkForAppUpdate(releaseChannel)
      if (!update) {
        updateRef.current = null
        setStatus({ state: 'idle' })
        return 'up-to-date'
      }

      updateRef.current = update
      setStatus(toAvailableStatus(update))
      return 'available'
    } catch {
      console.warn('[updater] Failed to check for updates')
      return 'error'
    }
  }, [releaseChannel])

  useEffect(() => {
    if (!isTauri()) return
    const timer = setTimeout(() => { checkForUpdates() }, 3000)
    return () => clearTimeout(timer)
  }, [checkForUpdates])

  const startDownload = useCallback(async () => {
    const update = updateRef.current
    if (!update) return

    setStatus({ state: 'downloading', version: update.version, progress: 0 })

    try {
      await downloadAndInstallAppUpdate(
        releaseChannel,
        update.version,
        createDownloadProgressHandler(update.version, setStatus),
      )

      // If Finished wasn't emitted via callback, set ready after await resolves
      setStatus((prev) => (prev.state === 'downloading' ? { state: 'ready', version: update.version } : prev))
    } catch {
      console.warn('[updater] Download failed')
      setStatus({ state: 'error' })
    }
  }, [releaseChannel])

  const openReleaseNotes = useCallback(() => {
    openExternalUrl(RELEASE_NOTES_URL)
  }, [])

  const dismiss = useCallback(() => {
    updateRef.current = null
    setStatus({ state: 'idle' })
  }, [])

  return { status, actions: { checkForUpdates, startDownload, openReleaseNotes, dismiss } }
}

/**
 * Trigger app restart after an update has been downloaded.
 * Separated so the component can call it on button click.
 */
export async function restartApp(): Promise<void> {
  try {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch {
    console.warn('[updater] Failed to relaunch')
  }
}
