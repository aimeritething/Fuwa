import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export type McpStatus = 'checking' | 'installed' | 'not_installed'

function tauriCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

function normalizeMcpStatus(value: string | null | undefined): McpStatus {
  return value === 'installed' ? 'installed' : 'not_installed'
}

async function fetchMcpStatus(vaultPath: string): Promise<McpStatus> {
  try {
    const result = await tauriCall<string>('check_mcp_status', { vaultPath })
    return normalizeMcpStatus(result)
  } catch {
    return 'not_installed'
  }
}

function connectSuccessToast(result: string): string {
  return result === 'registered'
    ? 'Tolaria external AI tools connected successfully'
    : 'Tolaria external AI tools setup refreshed successfully'
}

function disconnectSuccessToast(result: string): string {
  return result === 'removed'
    ? 'Tolaria external AI tools disconnected successfully'
    : 'Tolaria external AI tools were already disconnected'
}

/**
 * Detects whether the active vault is explicitly connected to external MCP
 * clients and exposes connect / disconnect actions.
 */
export function useMcpStatus(
  vaultPath: string,
  onToast: (msg: string) => void,
) {
  const [status, setStatus] = useState<McpStatus>('checking')
  const onToastRef = useRef(onToast)
  useEffect(() => { onToastRef.current = onToast })

  const refreshMcpStatus = useCallback(async () => {
    const nextStatus = await fetchMcpStatus(vaultPath)
    setStatus(nextStatus)
    return nextStatus
  }, [vaultPath])

  useEffect(() => {
    let cancelled = false
    setStatus('checking') // eslint-disable-line react-hooks/set-state-in-effect -- reset to checking on vault switch

    fetchMcpStatus(vaultPath).then((nextStatus) => {
      if (!cancelled) setStatus(nextStatus)
    })

    return () => { cancelled = true }
  }, [vaultPath])

  const connectMcp = useCallback(async () => {
    setStatus('checking')
    try {
      const result = await tauriCall<string>('register_mcp_tools', { vaultPath })
      setStatus('installed')
      onToastRef.current(connectSuccessToast(result))
      return true
    } catch (e) {
      setStatus('not_installed')
      onToastRef.current(`External AI tool setup failed: ${e}`)
      return false
    }
  }, [vaultPath])

  const disconnectMcp = useCallback(async () => {
    setStatus('checking')
    try {
      const result = await tauriCall<string>('remove_mcp_tools')
      setStatus('not_installed')
      onToastRef.current(disconnectSuccessToast(result))
      return true
    } catch (e) {
      const nextStatus = await refreshMcpStatus()
      setStatus(nextStatus)
      onToastRef.current(`External AI tool disconnect failed: ${e}`)
      return false
    }
  }, [refreshMcpStatus])

  return { mcpStatus: status, refreshMcpStatus, connectMcp, disconnectMcp }
}
