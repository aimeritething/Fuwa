/**
 * Pure functions for building sidebar section groups from vault entries.
 * Extracted from Sidebar.tsx for testability.
 */

import type { VaultEntry } from '../types'
import type { SectionGroup } from '../components/SidebarParts'
import { resolveIcon } from './iconRegistry'
import { pluralizeType } from '../hooks/useCommandRegistry'
import { isLegacyJournalingType } from './legacyTypes'
import {
  Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, StackSimple,
} from '@phosphor-icons/react'

const BUILT_IN_SECTION_GROUPS: SectionGroup[] = [
  { label: 'Projects', type: 'Project', Icon: Wrench },
  { label: 'Experiments', type: 'Experiment', Icon: Flask },
  { label: 'Responsibilities', type: 'Responsibility', Icon: Target },
  { label: 'Procedures', type: 'Procedure', Icon: ArrowsClockwise },
  { label: 'People', type: 'Person', Icon: Users },
  { label: 'Events', type: 'Event', Icon: CalendarBlank },
  { label: 'Topics', type: 'Topic', Icon: Tag },
  { label: 'Types', type: 'Type', Icon: StackSimple },
]

/** Metadata lookup for well-known types (icon/label only — NOT used to determine which sections to show) */
const BUILT_IN_TYPE_MAP = new Map(BUILT_IN_SECTION_GROUPS.map((sg) => [sg.type, sg]))

const isMarkdown = (e: VaultEntry) => e.fileKind === 'markdown' || !e.fileKind
const isActive = (e: VaultEntry) => !e.archived
const isSupportedSectionType = (type: string) => !isLegacyJournalingType(type)

function shouldCollectActiveType(entry: VaultEntry): boolean {
  if (!isActive(entry) || !isMarkdown(entry)) return false
  if (!entry.isA) return false
  return isSupportedSectionType(entry.isA)
}

function shouldIncludeTypeDefinition(name: string, entry: VaultEntry): boolean {
  if (name !== entry.title || !isActive(entry)) return false
  return isSupportedSectionType(name)
}

/** Collect unique explicit isA values from active (non-archived) markdown entries. */
export function collectActiveTypes(entries: VaultEntry[]): Set<string> {
  const types = new Set<string>()
  for (const e of entries) {
    if (!shouldCollectActiveType(e)) continue
    types.add(e.isA!)
  }
  return types
}

function resolveLabel(type: string, typeEntry: VaultEntry | undefined, builtIn: SectionGroup | undefined): string {
  return typeEntry?.sidebarLabel || builtIn?.label || pluralizeType(type)
}

/** Build a single SectionGroup for a type, using built-in metadata or Type entry for icon/label */
export function buildSectionGroup(type: string, typeEntryMap: Record<string, VaultEntry>): SectionGroup {
  const builtIn = BUILT_IN_TYPE_MAP.get(type)
  const typeEntry = typeEntryMap[type]
  const customColor = typeEntry?.color ?? null
  const label = resolveLabel(type, typeEntry, builtIn)
  const icon = resolveIcon(typeEntry?.icon ?? null)
  if (builtIn) {
    return { ...builtIn, label, Icon: typeEntry?.icon ? icon : builtIn.Icon, customColor }
  }
  return { label, type, Icon: icon, customColor }
}

/** Build sections dynamically from vault entries and defined types — types with 0 notes still appear */
export function buildDynamicSections(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  const activeTypes = collectActiveTypes(entries)
  for (const [name, entry] of Object.entries(typeEntryMap)) {
    if (!shouldIncludeTypeDefinition(name, entry)) continue
    activeTypes.add(name)
  }
  return Array.from(activeTypes, (type) => buildSectionGroup(type, typeEntryMap))
}

export function sortSections(groups: SectionGroup[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  return [...groups].sort((a, b) => {
    const orderA = typeEntryMap[a.type]?.order ?? Infinity
    const orderB = typeEntryMap[b.type]?.order ?? Infinity
    return orderA !== orderB ? orderA - orderB : a.label.localeCompare(b.label)
  })
}

export { BUILT_IN_SECTION_GROUPS }
