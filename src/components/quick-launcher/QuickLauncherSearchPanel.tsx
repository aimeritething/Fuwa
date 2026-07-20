import { useEffect, useRef, useState } from 'react'
import { FileText as FileTextIcon, MagnifyingGlass as SearchIcon } from '@phosphor-icons/react'
import type { VaultOption } from '../StatusBar'
import type { TranslationKey } from '../../lib/i18n'
import type { QuickLauncherSearchResult } from '../../lib/quickLauncher'
import { searchQuickLauncherVaults } from '../../lib/quickLauncherBackend'
import { trackQuickLauncherResultOpened, trackQuickLauncherSearchCompleted } from '../../lib/productAnalytics'
import { openQuickLauncherNote } from '../../utils/openQuickLauncherNote'
import { hideQuickLauncherWindow } from '../../utils/openQuickLauncherWindow'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface QuickLauncherSearchPanelProps {
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  vaults: readonly VaultOption[]
}

export function QuickLauncherSearchPanel({ t, vaults }: QuickLauncherSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [scopePath, setScopePath] = useState('__all__')
  const [results, setResults] = useState<QuickLauncherSearchResult[]>([])
  const [failedVaultLabels, setFailedVaultLabels] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchableVaults = vaults.filter((vault) => vault.available !== false && vault.mounted !== false && vault.searchEnabled !== false)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return
    let current = true
    const timeoutId = window.setTimeout(() => {
      void searchQuickLauncherVaults({
        query: trimmedQuery,
        scopePath: scopePath === '__all__' ? null : scopePath,
        vaults,
      }).then((response) => {
        if (!current) return
        setResults(response.results)
        setFailedVaultLabels(response.failedVaultLabels)
        setSelectedIndex(0)
        trackQuickLauncherSearchCompleted({
          failedVaultCount: response.failedVaultLabels.length,
          queryLength: trimmedQuery.length,
          resultCount: response.results.length,
          scope: scopePath === '__all__' ? 'all' : 'single',
        })
      }).finally(() => {
        if (current) setSearching(false)
      })
    }, 120)
    return () => {
      current = false
      window.clearTimeout(timeoutId)
    }
  }, [query, scopePath, vaults])

  const openResult = async (result: QuickLauncherSearchResult) => {
    trackQuickLauncherResultOpened(result.matchCategory)
    await openQuickLauncherNote({
      absolutePath: result.absolutePath,
      vaultPath: result.vaultPath,
      vaults,
    })
    await hideQuickLauncherWindow()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault()
      void openResult(results[selectedIndex])
    }
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    if (value.trim()) {
      setSearching(true)
      return
    }
    setResults([])
    setFailedVaultLabels([])
    setSearching(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
          <Input ref={inputRef} value={query} onChange={(event) => updateQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder={t('quickLauncher.searchPlaceholder')} aria-label={t('quickLauncher.searchPlaceholder')} className="pl-9" autoFocus />
        </div>
        <Select value={scopePath} onValueChange={(value) => { setScopePath(value); if (query.trim()) setSearching(true) }}>
          <SelectTrigger className="w-40" aria-label={t('quickLauncher.scopeLabel')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('quickLauncher.allVaults')}</SelectItem>
            {searchableVaults.map((vault) => <SelectItem key={vault.path} value={vault.path}>{vault.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="text-muted-foreground min-h-5 text-xs" role="status" aria-live="polite">
        {searching ? t('quickLauncher.searching') : failedVaultLabels.length > 0 ? t('quickLauncher.degradedSearch', { vaults: failedVaultLabels.join(', ') }) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label={t('quickLauncher.searchTab')}>
        {!query.trim() && <div className="text-muted-foreground grid h-full place-items-center text-sm">{t('quickLauncher.searchHint')}</div>}
        {query.trim() && !searching && results.length === 0 && <div className="text-muted-foreground grid h-full place-items-center text-sm">{t('quickLauncher.noResults')}</div>}
        <div className="space-y-1">
          {results.map((result, index) => (
            <Button key={`${result.vaultId}:${result.relativePath}`} variant="ghost" role="option" aria-selected={index === selectedIndex} onMouseMove={() => setSelectedIndex(index)} onClick={() => void openResult(result)} className={`h-auto w-full justify-start gap-3 px-3 py-2 text-left ${index === selectedIndex ? 'bg-accent' : ''}`}>
              <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate font-medium">{result.title}</span><span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">{result.vaultLabel}</span></span>
                <span className="text-muted-foreground block truncate text-xs">{result.relativePath}{result.snippet ? ` · ${result.snippet}` : ''}</span>
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
