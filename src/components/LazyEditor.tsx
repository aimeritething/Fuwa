import { useEffect, useState, type ComponentType } from 'react'
import type { EditorProps } from './Editor'
import { EditorStartupFallback } from './EditorStartupFallback'
import { markStartupPhase, waitForStartupPhase } from '../lib/startupPerformance'

let editorModulePromise: Promise<{ Editor: ComponentType<EditorProps> }> | null = null

function loadEditorModule(): Promise<{ Editor: ComponentType<EditorProps> }> {
  editorModulePromise ??= (() => {
    markStartupPhase('editor_module_requested')
    return import('./Editor').then((module) => {
      markStartupPhase('editor_module_loaded')
      return module
    })
  })()
  return editorModulePromise
}

function LoadedEditor(props: EditorProps & { Editor: ComponentType<EditorProps> }) {
  const { Editor, ...editorProps } = props
  useEffect(() => { markStartupPhase('editor_committed') }, [])
  return <Editor {...editorProps} />
}

export function LazyEditor(props: EditorProps) {
  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      if (!props.activeTabPath) await waitForStartupPhase('react_shell')
      if (!active) return
      const module = await loadEditorModule()
      if (active) setEditor(() => module.Editor)
    })()
    return () => { active = false }
  }, [props.activeTabPath])

  return Editor ? <LoadedEditor Editor={Editor} {...props} /> : <EditorStartupFallback {...props} />
}
