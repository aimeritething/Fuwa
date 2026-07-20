import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass as SearchIcon, Plus } from '@phosphor-icons/react'
import type { VaultOption } from '../StatusBar'
import type { Settings, VaultEntry } from '../../types'
import type { TranslationKey } from '../../lib/i18n'
import type { QuickCaptureDestination, QuickLauncherSearchResult } from '../../lib/quickLauncher'
import {
  createQuickCapture,
  loadQuickLauncherEntries,
  searchQuickLauncherVaults,
} from '../../lib/quickLauncherBackend'
import { trackQuickCaptureSaved, trackQuickLauncherResultOpened, trackQuickLauncherSearchCompleted } from '../../lib/productAnalytics'
import { openQuickLauncherNote } from '../../utils/openQuickLauncherNote'
import { hideQuickLauncherWindow } from '../../utils/openQuickLauncherWindow'
import { useNoteSearch } from '../../hooks/useNoteSearch'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { NoteSearchList, type NoteSearchResultItem } from '../NoteSearchList'
import { rememberQuickCaptureDestination } from './useQuickLauncherContext'

interface QuickLauncherSearchPanelProps {
  initialDestination: QuickCaptureDestination | null
  settings: Settings
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  vaults: readonly VaultOption[]
}

interface PresentedLauncherResult extends QuickLauncherSearchResult, NoteSearchResultItem {}

type Translate = QuickLauncherSearchPanelProps['t']

function writableVault(vault: VaultOption): boolean {
  return vault.available !== false && vault.mounted !== false
}

function launcherEmptyMessage({
  query,
  searching,
  t,
}: {
  query: string
  searching: boolean
  t: Translate
}): string {
  if (searching) return t('quickLauncher.searching')
  return query ? t('quickLauncher.noResults') : t('quickLauncher.searchHint')
}

function useLauncherEntries(vaults: readonly VaultOption[]): VaultEntry[] {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  useEffect(() => {
    let current = true
    void loadQuickLauncherEntries(vaults).then((loaded) => {
      if (current) setEntries(loaded)
    }).catch(() => {
      if (current) setEntries([])
    })
    return () => { current = false }
  }, [vaults])
  return entries
}

function usePresentedResults(
  entries: VaultEntry[],
  results: QuickLauncherSearchResult[],
): PresentedLauncherResult[] {
  const { results: presentations } = useNoteSearch(entries, '', Math.max(entries.length, 1))
  return useMemo(() => {
    const byPath = new Map(presentations.map((item) => [item.entry.path, item]))
    return results.map((result) => {
      const presentation = byPath.get(result.absolutePath)
      return {
        ...result,
        noteIcon: presentation?.noteIcon,
        noteType: presentation?.noteType,
        title: presentation?.title ?? result.title,
        typeColor: presentation?.typeColor,
        typeLightColor: presentation?.typeLightColor,
        TypeIcon: presentation?.TypeIcon,
        workspace: presentation?.workspace,
      }
    })
  }, [presentations, results])
}

export function QuickLauncherSearchPanel({
  initialDestination,
  settings,
  t,
  vaults,
}: QuickLauncherSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<QuickLauncherSearchResult[]>([])
  const [failedVaultLabels, setFailedVaultLabels] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [vaultPath, setVaultPath] = useState(initialDestination?.vaultPath ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const entries = useLauncherEntries(vaults)
  const presentedResults = usePresentedResults(entries, results)
  const writableVaults = vaults.filter(writableVault)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (!trimmedQuery) return
    let current = true
    const timeoutId = window.setTimeout(() => {
      void searchQuickLauncherVaults({ query: trimmedQuery, scopePath: null, vaults })
        .then((response) => {
          if (!current) return
          setResults(response.results)
          setFailedVaultLabels(response.failedVaultLabels)
          trackQuickLauncherSearchCompleted({
            failedVaultCount: response.failedVaultLabels.length,
            queryLength: trimmedQuery.length,
            resultCount: response.results.length,
            scope: 'all',
          })
        })
        .finally(() => { if (current) setSearching(false) })
    }, 120)
    return () => {
      current = false
      window.clearTimeout(timeoutId)
    }
  }, [trimmedQuery, vaults])

  const updateQuery = (value: string) => {
    setQuery(value)
    setResults([])
    setFailedVaultLabels([])
    setSelectedIndex(0)
    setActionError(false)
    setSearching(Boolean(value.trim()))
  }

  const openResult = async (result: QuickLauncherSearchResult) => {
    try {
      trackQuickLauncherResultOpened(result.matchCategory)
      await openQuickLauncherNote({ absolutePath: result.absolutePath, vaultPath: result.vaultPath, vaults })
      await hideQuickLauncherWindow()
    } catch {
      setActionError(true)
    }
  }

  const createNote = async () => {
    if (!trimmedQuery || !vaultPath || saving) return
    setSaving(true)
    setActionError(false)
    let created
    try {
      created = await createQuickCapture({ body: '', folder: '', title: trimmedQuery, vaultPath })
    } catch {
      setActionError(true)
      setSaving(false)
      return
    }

    rememberQuickCaptureDestination({ folder: '', vaultPath })
    trackQuickCaptureSaved({ collided: created.collided, openedAfterSave: settings.quick_capture_open_after_save === true })
    const followUpActions = [hideQuickLauncherWindow()]
    if (settings.quick_capture_open_after_save) {
      followUpActions.push(openQuickLauncherNote({ absolutePath: created.absolutePath, vaultPath, vaults }))
    }
    // The write already succeeded, so lifecycle failures must not invite a duplicate retry.
    await Promise.allSettled(followUpActions)
    setSaving(false)
  }

  const activateSelection = () => {
    const selected = presentedResults.at(selectedIndex)
    if (selected) {
      void openResult(selected)
      return
    }
    void createNote()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, Math.max(0, presentedResults.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      activateSelection()
    }
  }

  const canOfferCreate = Boolean(trimmedQuery)
  const emptyMessage = launcherEmptyMessage({ query: trimmedQuery, searching, t })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 border-b border-border">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 size-4" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('quickLauncher.searchPlaceholder')}
          aria-label={t('quickLauncher.searchPlaceholder')}
          className="h-auto rounded-none border-0 py-3 pr-4 pl-11 text-[15px] shadow-none focus-visible:ring-0"
          autoFocus
        />
      </div>
      <NoteSearchList
        items={presentedResults}
        selectedIndex={selectedIndex}
        getItemKey={(item) => `${item.vaultId}:${item.relativePath}`}
        onItemClick={(item) => { void openResult(item) }}
        onItemHover={setSelectedIndex}
        activateOnMouseDown
        emptyMessage={emptyMessage}
        className="min-h-0 flex-1 overflow-y-auto"
      />
      {canOfferCreate && (
        <div className="shrink-0 border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-2 text-sm"
            disabled={!vaultPath || saving}
            onClick={() => { void createNote() }}
          >
            <Plus size={14} className="shrink-0" />
            <span className="truncate">{t('quickLauncher.createNote', { title: trimmedQuery })}</span>
          </Button>
          <div className="mt-2 flex items-center justify-between gap-3 px-2">
            <span className="text-xs text-muted-foreground">{t('quickLauncher.saveToVault')}</span>
            <Select value={vaultPath} onValueChange={setVaultPath}>
              <SelectTrigger className="h-8 w-48" aria-label={t('quickLauncher.saveToVault')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {writableVaults.map((vault) => <SelectItem key={vault.path} value={vault.path}>{vault.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {(actionError || failedVaultLabels.length > 0) && (
        <div className="shrink-0 px-4 pb-2 text-xs text-destructive" role="status">
          {actionError
            ? t('quickLauncher.actionError')
            : t('quickLauncher.degradedSearch', { vaults: failedVaultLabels.join(', ') })}
        </div>
      )}
    </div>
  )
}
