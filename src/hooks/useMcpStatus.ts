import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export type McpStatus = 'checking' | 'installed' | 'not_installed' | 'no_claude_cli'

function tauriCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/**
 * Detects MCP server status on vault open and provides an install action.
 *
 * Combines the old `useMcpRegistration` functionality (auto-register on vault
 * switch) with new status detection for the status bar indicator.
 */
export function useMcpStatus(
  vaultPath: string,
  onToast: (msg: string) => void,
) {
  const [status, setStatus] = useState<McpStatus>('checking')
  const registeredRef = useRef<string | null>(null)
  const onToastRef = useRef(onToast)
  useEffect(() => { onToastRef.current = onToast })

  // Check MCP status on vault open / vault switch
  useEffect(() => {
    let cancelled = false
    setStatus('checking') // eslint-disable-line react-hooks/set-state-in-effect -- reset to checking on vault switch

    tauriCall<string>('check_mcp_status')
      .then((result) => {
        if (!cancelled) setStatus(result as McpStatus)
      })
      .catch(() => {
        if (!cancelled) setStatus('not_installed')
      })

    return () => { cancelled = true }
  }, [vaultPath])

  // Auto-register on vault switch (preserves old useMcpRegistration behavior)
  useEffect(() => {
    if (registeredRef.current === vaultPath) return
    registeredRef.current = vaultPath

    tauriCall<string>('register_mcp_tools', { vaultPath })
      .then((result) => {
        if (result === 'registered') {
          onToastRef.current('Laputa registered as MCP tool for Claude Code')
        }
        setStatus('installed')
      })
      .catch(() => {
        // Non-critical — status check will show the right state
      })
  }, [vaultPath])

  const install = useCallback(async () => {
    setStatus('checking')
    try {
      await tauriCall<string>('register_mcp_tools', { vaultPath })
      setStatus('installed')
      onToastRef.current('MCP server installed successfully')
    } catch (e) {
      setStatus('not_installed')
      onToastRef.current(`MCP install failed: ${e}`)
    }
  }, [vaultPath])

  return { mcpStatus: status, installMcp: install }
}
