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
  entryTitle: string
  path: string
}

/** Build the wikilink target: relative path stem with pipe display for the title.
 *  e.g. "docs/adr/0001-tauri-stack|Tauri Stack" for subfolders,
 *  "roadmap|Roadmap" for root files. */
function buildTarget(item: BaseSuggestionItem, vaultPath: string): string {
  const stem = relativePathStem(item.path, vaultPath)
  return stem === item.entryTitle ? stem : `${stem}|${item.entryTitle}`
}

/** Add onItemClick to raw suggestion candidates.
 *  Always inserts the vault-relative path as the wikilink target
 *  so links are unambiguous and work across subfolders. */
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
  return final.map(({ group, ...rest }) => {
    const noteType = group !== 'Note' ? group : undefined
    const te = typeEntryMap[group]
    return {
      ...rest,
      noteType,
      typeColor: noteType ? getTypeColor(group, te?.color) : undefined,
      typeLightColor: noteType ? getTypeLightColor(group, te?.color) : undefined,
      TypeIcon: noteType ? getTypeIcon(group, te?.icon) : undefined,
    }
  })
}
