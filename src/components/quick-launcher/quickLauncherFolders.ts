import type { FolderNode } from '../../types'

export interface QuickLauncherFolderOption {
  label: string
  path: string
}

export function flattenQuickLauncherFolders(nodes: readonly FolderNode[]): QuickLauncherFolderOption[] {
  return nodes.flatMap((node) => [
    { label: node.path, path: node.path },
    ...flattenQuickLauncherFolders(node.children),
  ])
}
