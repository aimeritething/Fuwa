import { memo, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

const REMARK_PLUGINS = [remarkGfm]
const REHYPE_PLUGINS = [rehypeHighlight]

export const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const rendered = useMemo(() => (
    <div className="ai-markdown">
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {content}
      </Markdown>
    </div>
  ), [content])
  return rendered
})
