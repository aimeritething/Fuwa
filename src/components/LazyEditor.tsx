import { useEffect, useState, type ComponentType } from 'react'
import type { EditorProps } from './Editor'
import { EditorStartupFallback } from './EditorStartupFallback'

export function LazyEditor(props: EditorProps) {
  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null)

  useEffect(() => {
    let active = true
    void import('./Editor').then((module) => {
      if (active) setEditor(() => module.Editor)
    })
    return () => { active = false }
  }, [])

  return Editor ? <Editor {...props} /> : <EditorStartupFallback {...props} />
}
