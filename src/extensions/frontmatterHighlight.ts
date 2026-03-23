import { ViewPlugin, Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const frontmatterDelimiter = Decoration.mark({ class: 'cm-frontmatter-delimiter' })
const frontmatterKey = Decoration.mark({ class: 'cm-frontmatter-key' })
const frontmatterValue = Decoration.mark({ class: 'cm-frontmatter-value' })
const markdownHeading = Decoration.mark({ class: 'cm-md-heading' })

function findFrontmatterEnd(doc: { lines: number; line(n: number): { text: string } }): number {
  if (doc.lines < 1) return -1
  const first = doc.line(1).text
  if (first !== '---') return -1
  for (let i = 2; i <= doc.lines; i++) {
    if (doc.line(i).text === '---') return i
  }
  return -1
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const fmEnd = findFrontmatterEnd(doc)

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text

    if (i <= fmEnd) {
      decorateFrontmatterLine(builder, line.from, text, i === 1 || i === fmEnd)
    } else {
      decorateMarkdownLine(builder, line.from, text)
    }
  }

  return builder.finish()
}

function decorateFrontmatterLine(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  text: string,
  isDelimiter: boolean,
): void {
  if (text.length === 0) return

  if (isDelimiter) {
    builder.add(from, from + text.length, frontmatterDelimiter)
    return
  }

  const colonIdx = text.indexOf(':')
  if (colonIdx > 0) {
    builder.add(from, from + colonIdx, frontmatterKey)
    const valueStart = colonIdx + 1
    const valuePart = text.slice(valueStart).trimStart()
    if (valuePart.length > 0) {
      const valueOffset = text.indexOf(valuePart, valueStart)
      builder.add(from + valueOffset, from + text.length, frontmatterValue)
    }
  }
}

function decorateMarkdownLine(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  text: string,
): void {
  if (/^#{1,6}\s/.test(text)) {
    builder.add(from, from + text.length, markdownHeading)
  }
}

export const frontmatterHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export function frontmatterHighlightTheme() {
  const keyColor = '#c9383e'
  const valueColor = '#2a7e4f'
  const delimiterColor = '#c9383e'
  const headingColor = '#0969da'

  return EditorView.baseTheme({
    '.cm-frontmatter-delimiter': { color: delimiterColor, fontWeight: '600' },
    '.cm-frontmatter-key': { color: keyColor },
    '.cm-frontmatter-value': { color: valueColor },
    '.cm-md-heading': { color: headingColor, fontWeight: '600' },
  })
}
