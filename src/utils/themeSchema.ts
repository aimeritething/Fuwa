import themeConfig from '../theme.json'
import { isValidCssColor } from './colorUtils'

export type InputType = 'number' | 'color' | 'text' | 'select'

export interface ThemeProperty {
  /** Flat kebab-case key used in frontmatter, e.g. "editor-font-size" */
  cssVar: string
  /** Human-readable label, e.g. "Font Size" */
  label: string
  /** Default value from theme.json */
  defaultValue: string | number
  inputType: InputType
  /** Unit label shown next to numeric inputs (e.g. "px"). Absent for unitless. */
  unit?: string
  /** Options for select inputs (e.g. font weights). */
  options?: string[]
  /** Minimum allowed value for numeric inputs. */
  min?: number
}

export interface ThemeSubsection {
  id: string
  label: string
  properties: ThemeProperty[]
}

export interface ThemeSection {
  id: string
  label: string
  properties: ThemeProperty[]
  subsections: ThemeSubsection[]
}

const SECTION_LABELS: Record<string, string> = {
  editor: 'Typography',
  headings: 'Headings',
  lists: 'Lists',
  checkboxes: 'Checkboxes',
  inlineStyles: 'Inline Styles',
  codeBlocks: 'Code Blocks',
  blockquote: 'Blockquote',
  table: 'Table',
  horizontalRule: 'Horizontal Rule',
  colors: 'Colors',
}

const SUBSECTION_LABELS: Record<string, string> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  bold: 'Bold',
  italic: 'Italic',
  strikethrough: 'Strikethrough',
  code: 'Inline Code',
  link: 'Link',
  wikilink: 'Wiki Link',
}

/** Keys where the numeric value is unitless (ratios, weights). */
const UNITLESS_KEYS = /weight|lineHeight|opacity/i

/** Keys that should use a select input with predefined options. */
const SELECT_OPTIONS: Record<string, string[]> = {
  fontWeight: ['400', '500', '600', '700'],
  fontStyle: ['normal', 'italic'],
  textDecoration: ['none', 'underline', 'line-through'],
  cursor: ['default', 'pointer', 'text'],
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function camelToTitle(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

function isColorValue(value: unknown, key: string): boolean {
  if (typeof value !== 'string') return false
  if (value.startsWith('#') || value.startsWith('var(--')) return isColorKeyHint(key) || isValidCssColor(value)
  return false
}

function isColorKeyHint(key: string): boolean {
  const lower = key.toLowerCase()
  return lower === 'color' || lower.endsWith('color') || lower === 'background'
    || lower.endsWith('background') || lower === 'fill' || lower === 'tint'
}

function deriveInputType(key: string, value: unknown): { inputType: InputType; unit?: string; options?: string[]; min?: number } {
  // Select options take priority
  for (const [pattern, opts] of Object.entries(SELECT_OPTIONS)) {
    if (key === pattern || key.endsWith(pattern.charAt(0).toUpperCase() + pattern.slice(1))) {
      // Check if current key ends with the select key (e.g. "fontWeight" matches "boldFontWeight")
      if (key === pattern || key.toLowerCase().endsWith(pattern.toLowerCase())) {
        return { inputType: 'select', options: opts }
      }
    }
  }

  if (typeof value === 'number') {
    const isUnitless = UNITLESS_KEYS.test(key)
    return { inputType: 'number', unit: isUnitless ? undefined : 'px', min: 0 }
  }

  if (isColorValue(value, key)) {
    return { inputType: 'color' }
  }

  return { inputType: 'text' }
}

function buildProperty(parentPrefix: string, key: string, value: string | number): ThemeProperty {
  const cssVar = `${parentPrefix}${camelToKebab(key)}`
  const { inputType, unit, options, min } = deriveInputType(key, value)
  return { cssVar, label: camelToTitle(key), defaultValue: value, inputType, unit, options, min }
}

/** Build the full theme schema from theme.json, grouped by section. */
export function buildThemeSchema(): ThemeSection[] {
  const sections: ThemeSection[] = []

  for (const [sectionKey, sectionValue] of Object.entries(themeConfig)) {
    if (typeof sectionValue !== 'object' || sectionValue === null || Array.isArray(sectionValue)) continue
    const sectionObj = sectionValue as Record<string, unknown>
    const sectionPrefix = `${camelToKebab(sectionKey)}-`

    const section: ThemeSection = {
      id: sectionKey,
      label: SECTION_LABELS[sectionKey] ?? camelToTitle(sectionKey),
      properties: [],
      subsections: [],
    }

    for (const [key, value] of Object.entries(sectionObj)) {
      if (Array.isArray(value)) continue // skip arrays like nestedBulletSymbols

      if (typeof value === 'object' && value !== null) {
        // Subsection (e.g. headings.h1, inlineStyles.bold)
        const subPrefix = `${sectionPrefix}${camelToKebab(key)}-`
        const subProperties: ThemeProperty[] = []
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof subValue === 'string' || typeof subValue === 'number') {
            subProperties.push(buildProperty(subPrefix, subKey, subValue))
          }
        }
        if (subProperties.length > 0) {
          section.subsections.push({
            id: key,
            label: SUBSECTION_LABELS[key] ?? camelToTitle(key),
            properties: subProperties,
          })
        }
      } else if (typeof value === 'string' || typeof value === 'number') {
        section.properties.push(buildProperty(sectionPrefix, key, value))
      }
    }

    if (section.properties.length > 0 || section.subsections.length > 0) {
      sections.push(section)
    }
  }

  return sections
}

/** Format a value for storage in theme note frontmatter. */
export function formatValueForFrontmatter(value: string | number, property: ThemeProperty): string {
  if (property.inputType === 'number' && property.unit && typeof value === 'number') {
    return `${value}${property.unit}`
  }
  return String(value)
}

/** Parse a frontmatter value back to its editable form (strip unit suffix). */
export function parseValueFromFrontmatter(raw: string, property: ThemeProperty): string | number {
  if (property.inputType === 'number') {
    const numeric = parseFloat(raw)
    if (!isNaN(numeric)) return numeric
  }
  return raw
}

/** Cached schema — built once from theme.json. */
let cachedSchema: ThemeSection[] | null = null
export function getThemeSchema(): ThemeSection[] {
  if (!cachedSchema) cachedSchema = buildThemeSchema()
  return cachedSchema
}
