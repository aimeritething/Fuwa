import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/**
 * Registers Laputa as an MCP server in Claude Code and Cursor config files.
 * Fires once per vault path (skips duplicates).
 */
export function useMcpRegistration(
  vaultPath: string,
  onToast: (msg: string) => void,
) {
  const registeredRef = useRef<string | null>(null)

  useEffect(() => {
    if (registeredRef.current === vaultPath) return
    registeredRef.current = vaultPath

    tauriCall<string>('register_mcp_tools', { vaultPath })
      .then((status) => {
        if (status === 'registered') {
          onToast('Laputa registered as MCP tool for Claude Code')
        }
      })
      .catch(() => {
        // Silently ignore — not critical for app operation
      })
  }, [vaultPath]) // eslint-disable-line react-hooks/exhaustive-deps -- onToast is stable via ref
}
