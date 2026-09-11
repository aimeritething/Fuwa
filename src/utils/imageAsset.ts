import { convertFileSrc } from '@tauri-apps/api/core'
import { isTauri, mockAssetUrl } from '../mock-tauri'

/**
 * An Image file reaches its Tab through the asset protocol, which the Folder's
 * root is already allowed into (`vaultAssetScope`). The URL carries a version
 * so an image overwritten outside Fuwa is fetched again instead of being
 * served from the webview's cache; the asset handler reads the path and
 * ignores the query. Outside Tauri there is no protocol to serve it, so the
 * browser fixture stands in.
 */
export function imageAssetUrl(path: string, version: string): string | null {
  // The fixture answers with a data URL, whose query would be read as data;
  // its version rides in the fragment, which the browser strips before decoding.
  if (!isTauri()) {
    const mocked = mockAssetUrl(path)
    return mocked === null ? null : `${mocked}#v=${encodeURIComponent(version)}`
  }

  try {
    const url = convertFileSrc(path)
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
  } catch (error) {
    console.warn('[image] Could not prepare the asset URL:', error)
    return null
  }
}
