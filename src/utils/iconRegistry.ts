import { createElement, lazy, Suspense, type ComponentType } from 'react'
import { FileText, type IconProps } from '@phosphor-icons/react'

export type { IconProps }
export type IconEntry = { name: string; Icon: ComponentType<IconProps> }

type IconModule = Record<string, ComponentType<IconProps>>
type IconLoader = () => Promise<IconModule>
type IconAlias = { exportName: string; moduleName: string }

const ICON_MODULES = import.meta.glob<IconModule>(
  '/node_modules/@phosphor-icons/react/dist/csr/*.es.js',
)

// The package keeps these compatibility exports in its root index. Their
// implementations live in the canonical per-icon modules listed here.
const ICON_ALIASES: Record<string, IconAlias> = {
  ActivityIcon: { moduleName: 'Pulse', exportName: 'PulseIcon' },
  ArchiveBoxIcon: { moduleName: 'BoxArrowDown', exportName: 'BoxArrowDownIcon' },
  ArchiveTrayIcon: { moduleName: 'TrayArrowDown', exportName: 'TrayArrowDownIcon' },
  CaduceusIcon: { moduleName: 'Asclepius', exportName: 'AsclepiusIcon' },
  CircleWavyCheckIcon: { moduleName: 'SealCheck', exportName: 'SealCheckIcon' },
  CircleWavyIcon: { moduleName: 'Seal', exportName: 'SealIcon' },
  CircleWavyQuestionIcon: { moduleName: 'SealQuestion', exportName: 'SealQuestionIcon' },
  CircleWavyWarningIcon: { moduleName: 'SealWarning', exportName: 'SealWarningIcon' },
  FileDottedIcon: { moduleName: 'FileDashed', exportName: 'FileDashedIcon' },
  FileSearchIcon: { moduleName: 'FileMagnifyingGlass', exportName: 'FileMagnifyingGlassIcon' },
  FolderDottedIcon: { moduleName: 'FolderDashed', exportName: 'FolderDashedIcon' },
  FolderNotchIcon: { moduleName: 'Folder', exportName: 'FolderIcon' },
  FolderNotchMinusIcon: { moduleName: 'FolderMinus', exportName: 'FolderMinusIcon' },
  FolderNotchOpenIcon: { moduleName: 'FolderOpen', exportName: 'FolderOpenIcon' },
  FolderNotchPlusIcon: { moduleName: 'FolderPlus', exportName: 'FolderPlusIcon' },
  FolderSimpleDottedIcon: { moduleName: 'FolderSimpleDashed', exportName: 'FolderSimpleDashedIcon' },
  LemniscateIcon: { moduleName: 'Infinity', exportName: 'InfinityIcon' },
  TextBolderIcon: { moduleName: 'TextB', exportName: 'TextBIcon' },
}

function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase()
}

function moduleNameFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1, -'.es.js'.length)
}

function modulePath(moduleName: string): string {
  return `/node_modules/@phosphor-icons/react/dist/csr/${moduleName}.es.js`
}

function createDeferredIcon(loader: IconLoader, exportName: string): ComponentType<IconProps> {
  const LazyIcon = lazy(async () => {
    const iconModule = await loader()
    const icon = Object.entries(iconModule).find(([name]) => name === exportName)?.[1]
    return { default: icon ?? FileText }
  })
  const DeferredIcon = (props: IconProps) => createElement(
    Suspense,
    { fallback: createElement(FileText, props) },
    createElement(LazyIcon, props),
  )
  DeferredIcon.displayName = `Deferred${exportName}`
  return DeferredIcon
}

function canonicalEntries(): IconEntry[] {
  return Object.entries(ICON_MODULES).map(([path, loader]) => {
    const exportName = moduleNameFromPath(path)
    return { name: pascalToKebab(exportName), Icon: createDeferredIcon(loader, exportName) }
  })
}

function aliasEntries(): IconEntry[] {
  return Object.entries(ICON_ALIASES).map(([aliasName, alias]) => {
    const loader = ICON_MODULES[modulePath(alias.moduleName)]
    if (!loader) throw new Error(`Missing Phosphor icon module: ${alias.moduleName}`)
    return { name: pascalToKebab(aliasName), Icon: createDeferredIcon(loader, alias.exportName) }
  })
}

/**
 * The full Phosphor icon set, loaded from per-icon modules on demand. Names are
 * kebab-case for the `_icon` field and sorted for stable picker presentation.
 */
export const ICON_OPTIONS: IconEntry[] = [...canonicalEntries(), ...aliasEntries()]
  .sort((left, right) => left.name.localeCompare(right.name))

const ICON_MAP: Record<string, ComponentType<IconProps>> = Object.fromEntries(
  ICON_OPTIONS.map((option) => [option.name, option.Icon]),
)

function normalizeIconName(name: string): string {
  return name.trim().toLowerCase().replace(/[_\s]+/g, '-')
}

/** Resolves a Phosphor icon name to its component, without a fallback. */
export function findIcon(name: string | null | undefined): ComponentType<IconProps> | null {
  if (!name) return null
  return ICON_MAP[normalizeIconName(name)] ?? null
}

/** Resolves a Phosphor icon name to its component, with fallback to FileText. */
export function resolveIcon(name: string | null): ComponentType<IconProps> {
  return findIcon(name) ?? FileText
}
