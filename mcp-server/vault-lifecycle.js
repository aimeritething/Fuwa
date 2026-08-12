import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { preferredVaultsJsonPath, vaultsJsonPath } from './vault-path.js'

let registryWrite = Promise.resolve()

export async function attachVault(args = {}, options = {}) {
  let vaultPath = requiredAbsolutePath(args.path, 'path')
  await assertDirectory(vaultPath)
  vaultPath = await realpath(vaultPath)
  return updateRegistry(vaultPath, args.label, registryPaths(options))
}

export async function cloneVault(args = {}, options = {}) {
  const remoteUrl = requiredString(args.remoteUrl, 'remoteUrl')
  const destinationPath = requiredAbsolutePath(args.destinationPath, 'destinationPath')
  const cloneRepository = options.cloneRepository ?? cloneWithSystemGit
  await assertCloneDestinationAvailable(destinationPath)
  await mkdir(path.dirname(destinationPath), { recursive: true })
  const temporaryPath = await mkdtemp(path.join(
    path.dirname(destinationPath),
    `.${path.basename(destinationPath)}.tolaria-clone-`,
  ))
  try {
    await cloneRepository(remoteUrl, temporaryPath)
    await rename(temporaryPath, destinationPath)
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true })
    throw error
  }
  return updateRegistry(destinationPath, args.label, registryPaths(options))
}

function registryPaths(options) {
  if (options.configPath) return { readPath: options.configPath, writePath: options.configPath }
  return { readPath: vaultsJsonPath(), writePath: preferredVaultsJsonPath() }
}

async function updateRegistry(vaultPath, requestedLabel, { readPath, writePath }) {
  const operation = registryWrite.then(async () => {
    const registry = await readRegistry(readPath)
    await assertNotNested(vaultPath, registry.vaults)
    const existing = registry.vaults.find(entry => normalizedPath(entry.path) === normalizedPath(vaultPath))
    if (existing) return existing

    const entry = {
      label: requiredString(requestedLabel, 'label', path.basename(vaultPath) || vaultPath),
      path: vaultPath,
      mounted: true,
    }
    await writeRegistry(writePath, { ...registry, vaults: [...registry.vaults, entry] })
    return entry
  })
  registryWrite = operation.catch(() => {})
  return operation
}

async function readRegistry(configPath) {
  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf-8'))
    return {
      ...parsed,
      vaults: Array.isArray(parsed.vaults) ? parsed.vaults : [],
      hidden_defaults: Array.isArray(parsed.hidden_defaults) ? parsed.hidden_defaults : [],
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { vaults: [], active_vault: null, hidden_defaults: [] }
    throw new Error(`Could not read Tolaria vault registry: ${error.message}`)
  }
}

async function writeRegistry(configPath, registry) {
  await mkdir(path.dirname(configPath), { recursive: true })
  const temporaryPath = `${configPath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  await rename(temporaryPath, configPath)
}

async function assertNotNested(vaultPath, entries) {
  for (const entry of entries) {
    if (typeof entry?.path !== 'string') continue
    const registeredPath = await canonicalPath(entry.path)
    const candidatePath = normalizedPath(vaultPath)
    if (registeredPath === candidatePath) continue
    if (isInside(registeredPath, candidatePath) || isInside(candidatePath, registeredPath)) {
      throw new Error(`Vault path is inside registered vault or contains one: ${vaultPath}`)
    }
  }
}

async function canonicalPath(value) {
  try {
    return await realpath(value)
  } catch {
    return normalizedPath(value)
  }
}

function isInside(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function normalizedPath(value) {
  return path.resolve(value)
}

async function assertDirectory(vaultPath) {
  try {
    const info = await stat(vaultPath)
    if (!info.isDirectory()) throw new Error('not a directory')
    await access(vaultPath, constants.R_OK)
  } catch (error) {
    throw new Error(`Vault folder is not an accessible directory: ${error.message}`)
  }
}

async function assertCloneDestinationAvailable(destinationPath) {
  try {
    await access(destinationPath)
    throw new Error(`Clone destination already exists: ${destinationPath}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function cloneWithSystemGit(remoteUrl, destinationPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', '--', remoteUrl, destinationPath], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', SSH_ASKPASS_REQUIRE: 'never' },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    })
    let stderr = ''
    child.stderr.setEncoding('utf-8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', error => reject(new Error(`Could not start git clone: ${error.message}`)))
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Git clone failed: ${stderr.trim() || `exit code ${code}`}`))
    })
  })
}

function requiredAbsolutePath(value, name) {
  const candidate = requiredString(value, name)
  if (!path.isAbsolute(candidate)) throw new Error(`${name} must be an absolute path`)
  return path.resolve(candidate)
}

function requiredString(value, name, fallback = '') {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (candidate) return candidate
  if (fallback) return fallback
  throw new Error(`${name} is required`)
}
