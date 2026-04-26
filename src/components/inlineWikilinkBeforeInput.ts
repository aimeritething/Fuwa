export function isInsertBeforeInput(nativeEvent: Pick<InputEvent, 'inputType'>) {
  return typeof nativeEvent.inputType === 'string'
    && nativeEvent.inputType.startsWith('insert')
}

export function isPlainTextBeforeInput(
  nativeEvent: Pick<InputEvent, 'data' | 'inputType' | 'isComposing'>,
): nativeEvent is Pick<InputEvent, 'inputType' | 'isComposing'> & { data: string } {
  return nativeEvent.inputType === 'insertText'
    && !nativeEvent.isComposing
    && typeof nativeEvent.data === 'string'
    && nativeEvent.data.length > 0
}
