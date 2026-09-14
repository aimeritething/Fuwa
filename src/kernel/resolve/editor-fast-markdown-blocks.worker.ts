import { tryParseFastMarkdownBlocks } from './editor-fast-markdown-blocks'

self.onmessage = (event: MessageEvent<string>) => {
  self.postMessage(tryParseFastMarkdownBlocks(event.data))
}
