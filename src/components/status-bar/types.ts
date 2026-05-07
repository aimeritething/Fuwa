export interface VaultOption {
  label: string
  path: string
  alias?: string
  color?: string | null
  icon?: string | null
  mounted?: boolean
  managedDefault?: boolean
  available?: boolean
}
