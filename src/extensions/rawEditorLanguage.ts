import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import type { Extension } from '@codemirror/state'
import { rawEditorLanguageIdForPath, type RawEditorLanguageId } from '../utils/rawEditorLanguage'
import { frontmatterHighlightPlugin, frontmatterHighlightTheme } from './frontmatterHighlight'
import { markdownLanguage, rawEditorSyntaxHighlighting } from './markdownHighlight'

function javascriptLanguage(id: RawEditorLanguageId): Extension {
  if (id === 'typescript') return javascript({ typescript: true })
  if (id === 'tsx') return javascript({ jsx: true, typescript: true })
  if (id === 'jsx') return javascript({ jsx: true })
  return javascript()
}

function highlighted(language: Extension): Extension[] {
  return [language, rawEditorSyntaxHighlighting()]
}

function markupLanguage(id: RawEditorLanguageId): Extension[] | null {
  switch (id) {
    case 'html': return highlighted(html())
    case 'json': return highlighted(json())
    case 'markdown': return [markdownLanguage(), frontmatterHighlightTheme(), frontmatterHighlightPlugin]
    case 'plain': return []
    case 'python': return highlighted(python())
    case 'sql': return highlighted(sql())
    case 'yaml': return highlighted(yaml())
    default: return null
  }
}

function scriptLanguage(id: RawEditorLanguageId): Extension[] {
  switch (id) {
    case 'javascript': return highlighted(javascriptLanguage('javascript'))
    case 'jsx': return highlighted(javascriptLanguage('jsx'))
    case 'tsx': return highlighted(javascriptLanguage('tsx'))
    case 'typescript': return highlighted(javascriptLanguage('typescript'))
    default: return []
  }
}

function rawEditorLanguage(id: RawEditorLanguageId): Extension[] {
  return markupLanguage(id) ?? scriptLanguage(id)
}

export function rawEditorLanguageExtensionsForPath(path?: string | null): Extension[] {
  return rawEditorLanguage(rawEditorLanguageIdForPath(path))
}
