export type RichEditorPropRunner<T> = (prop: T) => unknown

export type RichEditorSomeProp = <T>(propName: string, run?: RichEditorPropRunner<T>) => unknown
