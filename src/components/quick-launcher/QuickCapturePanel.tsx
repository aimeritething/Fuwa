import { useRef, useState } from 'react'
import type { VaultOption } from '../StatusBar'
import type { Settings } from '../../types'
import type { TranslationKey } from '../../lib/i18n'
import type { QuickCaptureDestination } from '../../lib/quickLauncher'
import { createQuickCapture, type QuickCapturePreview } from '../../lib/quickLauncherBackend'
import { openQuickLauncherNote } from '../../utils/openQuickLauncherNote'
import { hideQuickLauncherWindow } from '../../utils/openQuickLauncherWindow'
import { rememberQuickCaptureDestination } from './useQuickLauncherContext'
import { trackQuickCaptureSaved } from '../../lib/productAnalytics'
import {
  useQuickCaptureDestinationState,
  writableQuickCaptureVault,
} from './useQuickCaptureDestinationState'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface QuickCapturePanelProps {
  initialDestination: QuickCaptureDestination | null
  settings: Settings
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  vaults: readonly VaultOption[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Translate = QuickCapturePanelProps['t']

function isCaptureSaveShortcut(event: React.KeyboardEvent): boolean {
  if (event.key !== 'Enter') return false
  return event.metaKey || event.ctrlKey
}

function quickCaptureDestinationLabel({
  folder,
  preview,
  t,
  vaultPath,
}: {
  folder: string
  preview: QuickCapturePreview | null
  t: Translate
  vaultPath: string
}): string {
  if (preview) return preview.absolutePath
  if (!vaultPath) return t('quickLauncher.destinationRequired')
  const folderPrefix = folder ? `${folder}/` : ''
  return `${vaultPath}/${folderPrefix}untitled.md`
}

export function QuickCapturePanel({ initialDestination, settings, t, vaults }: QuickCapturePanelProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const destination = useQuickCaptureDestinationState(initialDestination, title)
  const { folder, folders, preview, selectVault, setFolder, vaultPath } = destination
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [validationMessage, setValidationMessage] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const writableVaults = vaults.filter(writableQuickCaptureVault)

  const saveCapture = async () => {
    if (!title.trim()) {
      setValidationMessage(t('quickLauncher.titleRequired'))
      titleRef.current?.focus()
      return
    }
    if (!vaultPath) {
      setValidationMessage(t('quickLauncher.destinationRequired'))
      return
    }
    setValidationMessage('')
    setSaveState('saving')
    try {
      const created = await createQuickCapture({ body, folder, title, vaultPath })
      rememberQuickCaptureDestination({ folder, vaultPath })
      trackQuickCaptureSaved({
        collided: created.collided,
        openedAfterSave: settings.quick_capture_open_after_save === true,
      })
      setSaveState('saved')
      if (settings.quick_capture_open_after_save) {
        await openQuickLauncherNote({ absolutePath: created.absolutePath, vaultPath, vaults })
      }
      window.setTimeout(() => { void hideQuickLauncherWindow() }, 450)
    } catch {
      setSaveState('error')
    }
  }

  const openExisting = async () => {
    if (!preview?.collidingAbsolutePath || !vaultPath) return
    await openQuickLauncherNote({ absolutePath: preview.collidingAbsolutePath, vaultPath, vaults })
    await hideQuickLauncherWindow()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isCaptureSaveShortcut(event)) {
      event.preventDefault()
      void saveCapture()
    }
  }

  const destinationLabel = quickCaptureDestinationLabel({ folder, preview, t, vaultPath })

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-3" onKeyDown={handleKeyDown} onSubmit={(event) => event.preventDefault()}>
      <div className="grid grid-cols-2 gap-2">
        <Select value={vaultPath} onValueChange={selectVault}>
          <SelectTrigger className="w-full" aria-label={t('quickLauncher.vaultLabel')}><SelectValue placeholder={t('quickLauncher.vaultLabel')} /></SelectTrigger>
          <SelectContent>{writableVaults.map((vault) => <SelectItem key={vault.path} value={vault.path}>{vault.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={folder || '__root__'} onValueChange={(value) => setFolder(value === '__root__' ? '' : value)} disabled={!vaultPath}>
          <SelectTrigger className="w-full" aria-label={t('quickLauncher.folderLabel')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__root__">{t('quickLauncher.vaultRoot')}</SelectItem>
            {folders.map((option) => <SelectItem key={option.path} value={option.path}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Input ref={titleRef} value={title} onChange={(event) => { setTitle(event.target.value); setSaveState('idle') }} aria-label={t('quickLauncher.captureTitle')} placeholder={t('quickLauncher.captureTitlePlaceholder')} autoFocus />
      <Textarea value={body} onChange={(event) => { setBody(event.target.value); setSaveState('idle') }} aria-label={t('quickLauncher.captureBody')} placeholder={t('quickLauncher.captureBodyPlaceholder')} className="min-h-32 flex-1 resize-none" />
      <div className="bg-muted/50 rounded-md border px-3 py-2">
        <div className="text-muted-foreground truncate text-xs" title={destinationLabel}>{t('quickLauncher.destination', { path: destinationLabel })}</div>
        {preview?.collided && <div className="mt-2 space-y-2">
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('quickLauncher.collision', { path: preview.relativePath })}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void openExisting()}>{t('quickLauncher.openExisting')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => titleRef.current?.focus()}>{t('quickLauncher.chooseAnotherTitle')}</Button>
          </div>
        </div>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground text-xs" role="status" aria-live="polite">
          {validationMessage || (saveState === 'saved' ? t('quickLauncher.saved') : saveState === 'error' ? t('quickLauncher.saveError') : t('quickLauncher.shortcutHint'))}
        </div>
        <Button type="button" onClick={() => void saveCapture()} disabled={saveState === 'saving' || !vaultPath}>{saveState === 'saving' ? t('quickLauncher.saving') : t('quickLauncher.save')}</Button>
      </div>
    </form>
  )
}
