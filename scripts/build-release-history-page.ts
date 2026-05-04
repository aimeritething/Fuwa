import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'

import { buildReleaseHistoryPage } from '../src/utils/releaseHistoryPage'

function getArg(flag: string): string {
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : null

  if (!value) {
    throw new Error(`Missing required argument: ${flag}`)
  }

  return value
}

function getOptionalArg(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : null
  return value || null
}

function readReleasePayload(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return []
  }
}

function readReadableReleaseNotes(directoryPath: string | null): Record<string, string> {
  if (directoryPath === null) return {}

  const resolvedDirectory = resolve(directoryPath)
  if (!existsSync(resolvedDirectory)) return {}

  return Object.fromEntries(
    readdirSync(resolvedDirectory)
      .filter(fileName => extname(fileName) === '.md')
      .map(fileName => {
        const filePath = resolve(resolvedDirectory, fileName)
        const tagName = basename(fileName, '.md')
        return [tagName, readFileSync(filePath, 'utf8')]
      }),
  )
}

const releasesJsonPath = resolve(getArg('--releases-json'))
const outputFilePath = resolve(getArg('--output-file'))
const releasesPayload = readReleasePayload(releasesJsonPath)
const readableReleaseNotes = readReadableReleaseNotes(getOptionalArg('--release-notes-dir'))
const html = buildReleaseHistoryPage(releasesPayload, readableReleaseNotes)

mkdirSync(dirname(outputFilePath), { recursive: true })
writeFileSync(outputFilePath, html)

console.log(`Release history page written to ${outputFilePath}`)
