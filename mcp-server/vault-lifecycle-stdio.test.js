import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MCP_SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
let activeVault
let attachedVault
let configDir

before(async () => {
  activeVault = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-active-'))
  attachedVault = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-attached-'))
  configDir = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-config-'))
})

after(async () => {
  await Promise.all([activeVault, attachedVault, configDir].map(target => (
    rm(target, { recursive: true, force: true })
  )))
})

describe('stdio vault lifecycle', () => {
  it('attaches and lists a vault through the same MCP connection', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['index.js'],
      cwd: MCP_SERVER_DIR,
      env: {
        ...process.env,
        VAULT_PATH: activeVault,
        WS_UI_PORT: '65534',
        XDG_CONFIG_HOME: configDir,
      },
      stderr: 'pipe',
    })
    const client = new Client(
      { name: 'tolaria-vault-lifecycle-test', version: '0.0.0' },
      { capabilities: {} },
    )

    try {
      await client.connect(transport)
      const attached = await client.callTool({
        name: 'attach_vault',
        arguments: { path: attachedVault, label: 'Attached Through MCP' },
      })
      const listed = await client.callTool({ name: 'list_vaults', arguments: {} })
      const canonicalAttachedPath = await realpath(attachedVault)

      assert.equal(JSON.parse(attached.content[0].text).path, canonicalAttachedPath)
      assert.deepEqual(
        JSON.parse(listed.content[0].text).vaults.map(vault => vault.path),
        [activeVault, canonicalAttachedPath],
      )
    } finally {
      await client.close()
    }
  })
})
