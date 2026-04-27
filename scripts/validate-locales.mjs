import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = path.join(root, 'src/lib/locales')
const sourcePath = path.join(localesDir, 'en.json')

function readCatalog(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function assertFlatStringCatalog(locale, catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new Error(`${locale}: expected a flat object of translation keys`)
  }

  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== 'string') {
      throw new Error(`${locale}: key "${key}" must map to a string`)
    }
  }
}

const sourceCatalog = readCatalog(sourcePath)
assertFlatStringCatalog('en', sourceCatalog)

const sourceKeys = Object.keys(sourceCatalog).sort()
const localeFiles = fs.readdirSync(localesDir).filter((file) => file.endsWith('.json'))
const issues = []

for (const file of localeFiles) {
  const locale = file.replace(/\.json$/, '')
  const filePath = path.join(localesDir, file)
  const catalog = readCatalog(filePath)

  assertFlatStringCatalog(locale, catalog)

  if (locale === 'en') continue

  const keys = Object.keys(catalog).sort()
  const missing = sourceKeys.filter((key) => !keys.includes(key))
  const extra = keys.filter((key) => !sourceKeys.includes(key))

  if (missing.length > 0) {
    issues.push(`${locale}: missing ${missing.length} key(s)`)
  }
  if (extra.length > 0) {
    issues.push(`${locale}: extra ${extra.length} key(s)`)
  }
}

if (issues.length > 0) {
  console.error('Locale validation failed:')
  for (const issue of issues) {
    console.error(`- ${issue}`)
  }
  process.exit(1)
}

console.log(`Validated ${localeFiles.length} locale catalog(s) against ${sourceKeys.length} English keys.`)
