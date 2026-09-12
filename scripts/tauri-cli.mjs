// Thin wrapper around the Tauri CLI: `pnpm tauri dev` runs with the dev
// overlay config (identifier com.aimerite.fuwa.dev) unless a --config flag
// is passed explicitly. Every other subcommand is forwarded untouched.
import { spawn } from 'node:child_process'
import console from 'node:console'
import path from 'node:path'
import process from 'node:process'

export const DEV_TAURI_CONFIG_PATH = path.join('src-tauri', 'tauri.dev.conf.json')

const repoRoot = path.resolve(import.meta.dirname, '..')

export function tauriBinary() {
  return path.join(repoRoot, 'node_modules', '.bin', 'tauri')
}

export function isTauriDevCommand(args) {
  return args[0] === 'dev'
}

export function hasTauriConfigArgument(args) {
  return args.some((arg, index) => (
    arg === '--config'
    || arg.startsWith('--config=')
    || args[index - 1] === '--config'
  ))
}

export function tauriArgs(args) {
  if (!isTauriDevCommand(args) || hasTauriConfigArgument(args)) return args
  return [...args, '--config', DEV_TAURI_CONFIG_PATH]
}

export function runTauriCli(args = process.argv.slice(2)) {
  const child = spawn(tauriBinary(), tauriArgs(args), {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })

  return child
}

if (process.argv[1] === import.meta.filename) {
  runTauriCli()
}
