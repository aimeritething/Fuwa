interface FlatVaultMigrationBannerProps {
  strayFileCount: number
  isMigrating: boolean
  onMigrate: () => void
  onDismiss: () => void
}

/**
 * Banner shown when the vault has files in non-protected subfolders.
 * Offers to flatten them to the vault root.
 */
export function FlatVaultMigrationBanner({ strayFileCount, isMigrating, onMigrate, onDismiss }: FlatVaultMigrationBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-sm" data-testid="migration-banner">
      <span className="flex-1 text-amber-800 dark:text-amber-200">
        {strayFileCount} note{strayFileCount !== 1 ? 's' : ''} found in subfolders.
        Flatten to vault root for consistent scanning.
      </span>
      <button
        className="px-3 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        onClick={onMigrate}
        disabled={isMigrating}
        data-testid="migration-flatten-btn"
      >
        {isMigrating ? 'Migrating...' : 'Flatten Now'}
      </button>
      <button
        className="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
        onClick={onDismiss}
        disabled={isMigrating}
        data-testid="migration-dismiss-btn"
      >
        Dismiss
      </button>
    </div>
  )
}
