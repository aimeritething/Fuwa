import { Download, ExternalLink, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import { restartApp } from '../hooks/useUpdater'

interface UpdateBannerProps {
  status: UpdateStatus
  actions: UpdateActions
}

export function UpdateBanner({ status, actions }: UpdateBannerProps) {
  if (status.state === 'idle' || status.state === 'error') return null

  return (
    <div
      data-testid="update-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        background: '#1a56db',
        borderBottom: 'none',
        fontSize: 13,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {status.state === 'available' && (
        <>
          <Download size={14} style={{ color: '#fff', flexShrink: 0 }} />
          <span>
            <strong>Tolaria {status.version}</strong> is available
          </span>
          <button
            data-testid="update-release-notes"
            onClick={actions.openReleaseNotes}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Release Notes <ExternalLink size={11} />
          </button>
          <button
            data-testid="update-now-btn"
            onClick={actions.startDownload}
            style={{
              marginLeft: 'auto',
              padding: '3px 10px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Update Now
          </button>
          <button
            data-testid="update-dismiss"
            onClick={actions.dismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              display: 'flex',
              padding: 2,
            }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </>
      )}

      {status.state === 'downloading' && (
        <>
          <RefreshCw size={14} style={{ color: '#fff', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          <span>Downloading Tolaria {status.version}...</span>
          <div
            style={{
              flex: 1,
              maxWidth: 200,
              height: 4,
              background: 'rgba(255,255,255,0.3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              data-testid="update-progress"
              style={{
                width: `${Math.round(status.progress * 100)}%`,
                height: '100%',
                background: 'var(--primary)',
                borderRadius: 2,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {Math.round(status.progress * 100)}%
          </span>
        </>
      )}

      {status.state === 'ready' && (
        <>
          <RefreshCw size={14} style={{ color: 'var(--accent-green, #0F7B0F)', flexShrink: 0 }} />
          <span>
            <strong>Tolaria {status.version}</strong> is ready — restart to apply
          </span>
          <button
            data-testid="update-restart-btn"
            onClick={restartApp}
            style={{
              marginLeft: 'auto',
              padding: '3px 10px',
              background: 'var(--accent-green, #0F7B0F)',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Restart Now
          </button>
        </>
      )}
    </div>
  )
}
