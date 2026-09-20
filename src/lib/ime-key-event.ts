type ImeKeyEvent = Pick<KeyboardEvent, 'isComposing' | 'keyCode'>

/**
 * A keydown that belongs to the input method: Enter confirming a candidate,
 * Escape cancelling one, an arrow moving through the candidate window.
 *
 * `isComposing` alone misses the key that ends a composition in WKWebView,
 * where `compositionend` arrives first and the keydown after it reports
 * `isComposing: false`; what still marks it as the IME's is keyCode 229.
 * A React handler passes `event.nativeEvent`.
 */
export function isImeKeyEvent(event: ImeKeyEvent): boolean {
  return event.isComposing || event.keyCode === 229
}
