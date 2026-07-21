import { useEffect, useState, type ComponentType } from 'react'
import type { EditorProps } from './Editor'
import { EditorStartupFallback } from './EditorStartupFallback'
import { markStartupPhase } from '../lib/startupPerformance'

function LoadedEditor(props: EditorProps & { Editor: ComponentType<EditorProps> }) {
  const { Editor, ...editorProps } = props
  useEffect(() => { markStartupPhase('editor_committed') }, [])
  return <Editor {...editorProps} />
}

export function LazyEditor(props: EditorProps) {
  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null)

  useEffect(() => {
    if (!props.activeTabPath) return

    let active = true
    markStartupPhase('editor_module_requested')
    void import('./Editor').then((module) => {
      markStartupPhase('editor_module_loaded')
      if (active) setEditor(() => module.Editor)
    })
    return () => { active = false }
  }, [props.activeTabPath])

  return Editor ? <LoadedEditor Editor={Editor} {...props} /> : <EditorStartupFallback {...props} />
}
