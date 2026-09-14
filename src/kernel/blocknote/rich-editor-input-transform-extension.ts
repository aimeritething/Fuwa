import { createArrowLigatureInputTransform } from './arrow-ligatures-extension'
import { createMarkdownHighlightInputTransform } from './markdown-highlight-input-extension'
import { createMathInputTransform } from './math-input-extension'
import { createRichEditorInputTransformExtension } from './rich-editor-input-transform'

export const createRichEditorMarkdownInputTransformExtension = createRichEditorInputTransformExtension({
  createTransforms: () => [
    createArrowLigatureInputTransform(),
    createMarkdownHighlightInputTransform(),
    createMathInputTransform(),
  ],
  key: 'richEditorMarkdownInputTransform',
})
