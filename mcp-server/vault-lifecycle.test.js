import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { attachVault, cloneVault } from './vault-lifecycle.js'

describe('vault lifecycle', () => {
  it('attaches an existing folder without changing the active vault', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tolaria-vault-attach-'))
    const configPath = path.join(root, 'config', 'vaults.json')
    const activePath = path.join(root, 'Active')
    const attachedPath = path.join(root, 'Attached')
    await mkdir(activePath)
    await mkdir(attachedPath)
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      vaults: [{ label: 'Active', path: activePath, mounted: true }],
      active_vault: activePath,
      default_workspace_path: activePath,
      hidden_defaults: [],
    }))

    try {
      const entry = await attachVault({ path: attachedPath, label: 'Attached' }, { configPath })
      const registry = JSON.parse(await readFile(configPath, 'utf-8'))
      const canonicalAttachedPath = await realpath(attachedPath)
      assert.deepEqual(entry, { label: 'Attached', path: canonicalAttachedPath, mounted: true })
      assert.equal(registry.active_vault, activePath)
      assert.deepEqual(registry.vaults, [
        { label: 'Active', path: activePath, mounted: true },
        entry,
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects attaching a path nested inside a registered vault', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tolaria-vault-nested-'))
    const configPath = path.join(root, 'vaults.json')
    const activePath = path.join(root, 'Active')
    const nestedPath = path.join(activePath, 'nested')
    await mkdir(nestedPath, { recursive: true })
    await writeFile(configPath, JSON.stringify({ vaults: [{ label: 'Active', path: activePath }] }))

    try {
      await assert.rejects(
        () => attachVault({ path: nestedPath }, { configPath }),
        /inside registered vault/i,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('registers a cloned repository only after clone succeeds', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tolaria-vault-clone-'))
    const configPath = path.join(root, 'config', 'vaults.json')
    const destinationPath = path.join(root, 'Cloned')
    const cloneRepository = async (_remoteUrl, targetPath) => {
      await mkdir(path.join(targetPath, '.git'))
    }

    try {
      const entry = await cloneVault({
        remoteUrl: 'https://example.com/team/vault.git',
        destinationPath,
      }, { configPath, cloneRepository })
      const registry = JSON.parse(await readFile(configPath, 'utf-8'))
      assert.equal(entry.label, 'Cloned')
      assert.equal(entry.path, destinationPath)
      assert.deepEqual(registry.vaults, [entry])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
