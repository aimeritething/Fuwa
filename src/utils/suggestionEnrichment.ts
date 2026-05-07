import type { VaultEntry } from '../types'
import { getTypeColor, getTypeLightColor } from './typeColors'
import { getTypeIcon } from '../components/NoteItem'
import { deduplicateByPath, disambiguateTitles } from './wikilinkSuggestions'
import { bestSearchRank } from './fuzzyMatch'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import type { WikilinkSuggestionItem } from '../components/WikilinkSuggestionMenu'
import { relativePathStem } from './wikilink'

const MAX_RESULTS = 20

interface BaseSuggestionItem {
  title: string
  aliases: string[]
  group: string
  entryType?: string | null
  entryTitle: string
  path: string
}

/** Build the canonical wikilink target: vault-relative path stem without a default alias. */
function buildTarget(item: BaseSuggestionItem, vaultPath: string): string {
  return relativePathStem(item.path, vaultPath)
}

/** Add onItemClick to raw suggestion candidates.
 *  Always inserts the canonical vault-relative path target so links are
 *  unambiguous and remain stable across renames. */
export function attachClickHandlers(
  candidates: BaseSuggestionItem[],
  insertWikilink: (target: string) => void,
  vaultPath: string,
) {
  return candidates.map(item => ({
    ...item,
    onItemClick: () => insertWikilink(buildTarget(item, vaultPath)),
  }))
}

/** Filter, deduplicate, disambiguate, and enrich suggestion items with type metadata */
export function enrichSuggestionItems(
  items: (BaseSuggestionItem & { onItemClick: () => void })[],
  query: string,
  typeEntryMap: Record<string, VaultEntry>,
): WikilinkSuggestionItem[] {
  const filtered = filterSuggestionItems(items, query)
  filtered.sort((a, b) =>
    bestSearchRank(query, a.entryTitle, a.aliases) - bestSearchRank(query, b.entryTitle, b.aliases),
  )
  const sliced = filtered.slice(0, MAX_RESULTS)
  const final = disambiguateTitles(deduplicateByPath(sliced))
  return final.map(({ entryType, ...rest }) => {
    const noteType = entryType ?? undefined
    const te = noteType ? Reflect.get(typeEntryMap, noteType) as VaultEntry | undefined : undefined
    return {
      ...rest,
      noteType,
      typeColor: noteType ? getTypeColor(noteType, te?.color) : undefined,
      typeLightColor: noteType ? getTypeLightColor(noteType, te?.color) : undefined,
      TypeIcon: noteType ? getTypeIcon(noteType, te?.icon) : undefined,
    }
  })
}
