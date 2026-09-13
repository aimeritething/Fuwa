import { codeBlockOptions } from '@blocknote/code-block'
import type { CodeBlockOptions } from '@blocknote/core'
import {
  canonicalKnownCodeBlockLanguage,
  codeBlockLanguageOptions,
  EXTRA_CODE_BLOCK_LANGUAGES,
  GO_CODE_BLOCK_LANGUAGE,
} from './codeBlockLanguageCatalog'
import { supportsShikiRegexFeatures } from '@/lib/regexCapabilities'

const LIGHT_CODE_THEME = 'github-light'
const DARK_CODE_THEME = 'github-dark'
const GO_LANGUAGE_REGISTRATION = {
  name: 'go',
  displayName: 'Go',
  scopeName: 'source.go',
  aliases: ['golang'],
  patterns: [
    { include: '#comments' },
    { include: '#strings' },
    { include: '#keywords' },
    { include: '#numbers' },
  ],
  repository: {
    comments: {
      patterns: [
        { begin: '/\\*', end: '\\*/', name: 'comment.block.go' },
        { begin: '//', end: '$', name: 'comment.line.double-slash.go' },
      ],
    },
    keywords: {
      patterns: [
        {
          match: '\\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\\b',
          name: 'keyword.control.go',
        },
      ],
    },
    numbers: {
      patterns: [
        { match: '\\b0[xX][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(\\.\\d[\\d_]*)?\\b', name: 'constant.numeric.go' },
      ],
    },
    strings: {
      patterns: [
        { begin: '"', end: '"', name: 'string.quoted.double.go' },
        { begin: '`', end: '`', name: 'string.quoted.raw.go' },
      ],
    },
  },
}

type CodeHighlighter = Awaited<ReturnType<NonNullable<typeof codeBlockOptions.createHighlighter>>>
type LoadLanguage = CodeHighlighter['loadLanguage']
type LanguageInput = Parameters<LoadLanguage>[number]
type LanguageLoader = () => Promise<LanguageInput[]>
type NamedLanguageRegistration = Record<string, unknown> & {
  name: string
  displayName?: string
  aliases?: string[]
}

const GO_LANGUAGE = codeBlockLanguageOptions([GO_CODE_BLOCK_LANGUAGE]).go
const EXTRA_SUPPORTED_LANGUAGES = codeBlockLanguageOptions(EXTRA_CODE_BLOCK_LANGUAGES)

function currentCodeBlockTheme() {
  if (typeof document === 'undefined') return LIGHT_CODE_THEME

  const root = document.documentElement
  return root.classList.contains('dark') || root.dataset.theme === 'dark'
    ? DARK_CODE_THEME
    : LIGHT_CODE_THEME
}

function prioritizeTheme(themes: string[], theme: string) {
  return [theme, ...themes.filter((candidate) => candidate !== theme)]
}

function languageInputs(languages: readonly LanguageInput[]): LanguageInput[] {
  return [...languages]
}

function languageModuleInputs(languageModule: unknown): LanguageInput[] {
  if (typeof languageModule !== 'object' || languageModule === null) return []

  const defaultExport = (languageModule as { default?: unknown }).default
  return Array.isArray(defaultExport) ? languageInputs(defaultExport as LanguageInput[]) : []
}

async function optionalLanguageInputs(importLanguage: () => Promise<unknown>): Promise<LanguageInput[]> {
  try {
    return languageModuleInputs(await importLanguage())
  } catch {
    return []
  }
}

function namedLanguageRegistration(value: LanguageInput): NamedLanguageRegistration | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return typeof record.name === 'string'
    ? record as NamedLanguageRegistration
    : null
}

function renameLanguageRegistration(
  languages: readonly LanguageInput[],
  sourceName: string,
  nextLanguage: { name: string; displayName: string; aliases: string[] },
): LanguageInput[] {
  return languages.map((language) => {
    const registration = namedLanguageRegistration(language)
    if (!registration || registration.name !== sourceName) return language
    return { ...registration, ...nextLanguage } as LanguageInput
  })
}

async function loadVbScriptLanguage(): Promise<LanguageInput[]> {
  const language = await optionalLanguageInputs(() => import('@shikijs/langs/vb'))
  return renameLanguageRegistration(language, 'vb', {
    name: 'vbscript',
    displayName: 'VBScript',
    aliases: ['vb', 'vbs', 'vba', 'visual-basic', 'visualbasic'],
  })
}

const EXTRA_LANGUAGE_LOADERS = new Map<string, LanguageLoader>([
  ['powershell', async () => optionalLanguageInputs(() => import('@shikijs/langs/powershell'))],
  ['vbscript', loadVbScriptLanguage],
  ['dart', async () => optionalLanguageInputs(() => import('@shikijs/langs/dart'))],
  ['groovy', async () => optionalLanguageInputs(() => import('@shikijs/langs/groovy'))],
  ['matlab', async () => optionalLanguageInputs(() => import('@shikijs/langs/matlab'))],
  ['perl', async () => optionalLanguageInputs(() => import('@shikijs/langs/perl'))],
  ['elixir', async () => optionalLanguageInputs(() => import('@shikijs/langs/elixir'))],
  ['erlang', async () => optionalLanguageInputs(() => import('@shikijs/langs/erlang'))],
  ['fsharp', async () => optionalLanguageInputs(() => import('@shikijs/langs/fsharp'))],
  ['clojure', async () => optionalLanguageInputs(() => import('@shikijs/langs/clojure'))],
  ['asm', async () => optionalLanguageInputs(() => import('@shikijs/langs/asm'))],
  ['zig', async () => optionalLanguageInputs(() => import('@shikijs/langs/zig'))],
  ['hcl', async () => optionalLanguageInputs(() => import('@shikijs/langs/hcl'))],
  ['terraform', async () => optionalLanguageInputs(() => import('@shikijs/langs/terraform'))],
  ['dockerfile', async () => optionalLanguageInputs(() => import('@shikijs/langs/dockerfile'))],
  ['batch', async () => optionalLanguageInputs(() => import('@shikijs/langs/bat'))],
  ['diff', async () => optionalLanguageInputs(() => import('@shikijs/langs/diff'))],
  ['ini', async () => optionalLanguageInputs(() => import('@shikijs/langs/ini'))],
  ['toml', async () => optionalLanguageInputs(() => import('@shikijs/langs/toml'))],
])

function expandGoLanguage(language: string): LanguageInput[] | null {
  return canonicalKnownCodeBlockLanguage(language) === 'go'
    ? [GO_LANGUAGE_REGISTRATION as LanguageInput]
    : null
}

async function expandExternalLanguage(language: string): Promise<LanguageInput[] | null> {
  const canonicalLanguage = canonicalKnownCodeBlockLanguage(language) ?? language.trim().toLowerCase()
  const loadLanguage = EXTRA_LANGUAGE_LOADERS.get(canonicalLanguage)
  return loadLanguage ? loadLanguage() : null
}

async function expandLanguage(language: LanguageInput): Promise<LanguageInput[]> {
  if (typeof language !== 'string') return [language]
  return expandGoLanguage(language) ?? await expandExternalLanguage(language) ?? [language]
}

async function createCodeHighlighter(): Promise<CodeHighlighter> {
  const highlighter = await codeBlockOptions.createHighlighter()
  return {
    ...highlighter,
    getLoadedThemes: () => prioritizeTheme(highlighter.getLoadedThemes(), currentCodeBlockTheme()),
    loadLanguage: async (...languages) => {
      const expandedLanguages = await Promise.all(languages.map(expandLanguage))
      return highlighter.loadLanguage(...expandedLanguages.flat())
    },
  }
}

export function createCodeBlockOptions(): Partial<CodeBlockOptions> {
  const options: Partial<CodeBlockOptions> = {
    ...codeBlockOptions,
    createHighlighter: createCodeHighlighter,
    defaultLanguage: 'text',
    supportedLanguages: {
      ...codeBlockOptions.supportedLanguages,
      go: GO_LANGUAGE,
      ...EXTRA_SUPPORTED_LANGUAGES,
    },
  }

  if (supportsShikiRegexFeatures()) return options

  delete options.createHighlighter
  return options
}
