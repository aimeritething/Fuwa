import { useState } from 'react'
import { FolderOpen, Plus, AlertTriangle, Loader2, Rocket } from 'lucide-react'

interface WelcomeScreenProps {
  mode: 'welcome' | 'vault-missing'
  missingPath?: string
  defaultVaultPath: string
  onCreateVault: () => void
  onCreateNewVault: () => void
  onOpenFolder: () => void
  creating: boolean
  error: string | null
}

const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--sidebar)',
}

const CARD_STYLE: React.CSSProperties = {
  width: 520,
  background: 'var(--background)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
}

const ICON_WRAP_STYLE: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: -0.5,
  color: 'var(--foreground)',
  textAlign: 'center',
  margin: 0,
}

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--muted-foreground)',
  textAlign: 'center',
  margin: 0,
}

const DIVIDER_STYLE: React.CSSProperties = {
  width: '100%',
  height: 1,
  background: 'var(--border)',
}

const OPTION_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  textAlign: 'left',
  transition: 'background 0.15s',
}

const OPTION_ICON_STYLE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const OPTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--foreground)',
  margin: 0,
}

const OPTION_DESC_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted-foreground)',
  margin: 0,
  marginTop: 2,
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--destructive, #e03e3e)',
  textAlign: 'center',
  margin: 0,
}

interface OptionButtonProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  onClick: () => void
  disabled: boolean
  loading?: boolean
  testId: string
}

function OptionButton({ icon, iconBg, label, description, onClick, disabled, loading, testId }: OptionButtonProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      style={{
        ...OPTION_BTN_STYLE,
        background: hover ? 'var(--sidebar)' : 'var(--background)',
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-testid={testId}
    >
      <div style={{ ...OPTION_ICON_STYLE, background: iconBg }}>
        {loading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /> : icon}
      </div>
      <div>
        <p style={OPTION_LABEL_STYLE}>{loading ? 'Creating vault\u2026' : label}</p>
        <p style={OPTION_DESC_STYLE}>{description}</p>
      </div>
    </button>
  )
}

export function WelcomeScreen({ mode, defaultVaultPath, onCreateVault, onCreateNewVault, onOpenFolder, creating, error }: WelcomeScreenProps) {
  const isWelcome = mode === 'welcome'

  return (
    <div style={CONTAINER_STYLE} data-testid="welcome-screen">
      <div style={CARD_STYLE}>
        <div
          style={{
            ...ICON_WRAP_STYLE,
            background: isWelcome ? 'var(--accent-blue-light, #EBF4FF)' : 'var(--accent-yellow-light, #FFF3E0)',
          }}
        >
          {isWelcome
            ? <span style={{ fontSize: 28, color: 'var(--accent-blue)' }}>&#10022;</span>
            : <AlertTriangle size={28} style={{ color: 'var(--accent-orange)' }} />
          }
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={TITLE_STYLE}>
            {isWelcome ? 'Welcome to Laputa' : 'Vault not found'}
          </h1>
          <p style={{ ...SUBTITLE_STYLE, marginTop: 8 }}>
            {isWelcome
              ? 'Wiki-linked knowledge management for deep thinkers.\nChoose how to get started.'
              : 'The vault folder could not be found on disk.\nIt may have been moved or deleted.'
            }
          </p>
        </div>

        <div style={DIVIDER_STYLE} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OptionButton
            icon={<Plus size={18} style={{ color: 'var(--accent-blue)' }} />}
            iconBg="var(--accent-blue-light, #EBF4FF)"
            label="Create a new vault"
            description="Start fresh in a folder you choose"
            onClick={onCreateNewVault}
            disabled={creating}
            testId="welcome-create-new"
          />

          <OptionButton
            icon={<FolderOpen size={18} style={{ color: 'var(--accent-green)' }} />}
            iconBg="var(--accent-green-light, #E8F5E9)"
            label={isWelcome ? 'Open existing vault' : 'Choose a different folder'}
            description="Point to a folder you already have"
            onClick={onOpenFolder}
            disabled={creating}
            testId="welcome-open-folder"
          />

          <OptionButton
            icon={<Rocket size={18} style={{ color: 'var(--accent-purple)' }} />}
            iconBg="var(--accent-purple-light, #F3E8FF)"
            label="Get started with a template"
            description={`A ready-made vault to explore first \u2014 ${defaultVaultPath}`}
            onClick={onCreateVault}
            disabled={creating}
            loading={creating}
            testId="welcome-create-vault"
          />
        </div>

        {error && <p style={ERROR_STYLE} data-testid="welcome-error">{error}</p>}
      </div>
    </div>
  )
}
