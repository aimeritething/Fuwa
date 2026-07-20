import type { VaultEntry, WorkspaceIdentity } from '../types'
import {
  entryTypeWorkspaceKey,
  findTypeDefinitionForWorkspace as findTypeDefinitionForWorkspaceByQuery,
  isActiveTypeDefinition,
  isMarkdownEntry,
  isTypeDefinitionForName,
  normalizeTypeName,
  typeWorkspaceKey,
} from './typeDefinitions'

export type TypeVisibilityLookup = Record<string, Record<string, boolean>>

export function buildTypeVisibilityLookup(entries: VaultEntry[]): TypeVisibilityLookup {
  const lookup: TypeVisibilityLookup = {}
  for (const entry of entries) {
    if (!isActiveTypeDefinition(entry)) continue
    const key = normalizeTypeName({ type: entry.title })
    if (!key) continue
    const workspaceVisibility = (Reflect.get(lookup, key) as Record<string, boolean> | undefined) ?? {}
    Reflect.set(workspaceVisibility, entryTypeWorkspaceKey(entry), entry.visible !== false)
    Reflect.set(lookup, key, workspaceVisibility)
  }
  return lookup
}

export function isTypeVisibleInWorkspace(
  lookup: TypeVisibilityLookup,
  type: string,
  workspacePath?: string | null,
): boolean {
  const typeLookup = Reflect.get(lookup, normalizeTypeName({ type })) as Record<string, boolean> | undefined
  if (!typeLookup) return true
  const visible = Reflect.get(typeLookup, typeWorkspaceKey({ path: workspacePath })) as boolean | undefined
  return visible !== false
}

export function isSectionEntryVisibleForType(
  entry: VaultEntry,
  type: string,
  lookup: TypeVisibilityLookup,
): boolean {
  if (!isMarkdownEntry(entry) || entry.isA !== type) return false
  return isTypeVisibleInWorkspace(lookup, type, entry.workspace?.path)
}

export function isTypeSectionVisible(
  entries: VaultEntry[],
  type: string,
  lookup: TypeVisibilityLookup = buildTypeVisibilityLookup(entries),
): boolean {
  let hasMatchingTypeDefinition = false

  for (const entry of entries) {
    if (isSectionEntryVisibleForType(entry, type, lookup)) return true
    if (!isTypeDefinitionForName(entry, { type })) continue
    hasMatchingTypeDefinition = true
    if (isTypeVisibleInWorkspace(lookup, type, entry.workspace?.path)) return true
  }

  return !hasMatchingTypeDefinition
}

function workspaceOrderIndex(workspace: WorkspaceIdentity, orderedWorkspacePaths: readonly string[]): number {
  const index = orderedWorkspacePaths.indexOf(workspace.path)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function collectTypeVisibilityWorkspaces(
  entries: VaultEntry[],
  orderedWorkspacePaths: readonly string[] = [],
): WorkspaceIdentity[] {
  const workspacesByPath = new Map<string, WorkspaceIdentity>()
  for (const entry of entries) {
    const workspace = entry.workspace
    if (!workspace || workspacesByPath.has(workspace.path)) continue
    workspacesByPath.set(workspace.path, workspace)
  }
  return [...workspacesByPath.values()].sort((a, b) => (
    workspaceOrderIndex(a, orderedWorkspacePaths) - workspaceOrderIndex(b, orderedWorkspacePaths)
  ))
}

export function findTypeDefinitionForWorkspace(
  entries: VaultEntry[],
  type: string,
  workspacePath: string,
): VaultEntry | null {
  return findTypeDefinitionForWorkspaceByQuery({ entries, type, workspacePath })
}
