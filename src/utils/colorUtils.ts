/** Regex patterns for common CSS color formats. */
const HEX3_RE = /^#[0-9a-f]{3}$/i
const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX8_RE = /^#[0-9a-f]{8}$/i
const RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/
const HSL_RE = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/

/** CSS named colors (lowercase). */
const NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
])

/** Check if a string is a valid CSS color value. */
export function isValidCssColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return HEX3_RE.test(trimmed) || HEX6_RE.test(trimmed) || HEX8_RE.test(trimmed)
    || RGB_RE.test(trimmed) || HSL_RE.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase())
}

/** Expand #rgb to #rrggbb. */
export function expandShortHex(hex: string): string {
  if (!HEX3_RE.test(hex)) return hex
  const r = hex[1], g = hex[2], b = hex[3]
  return `#${r}${r}${g}${g}${b}${b}`
}

/**
 * Convert a valid CSS color to #rrggbb format for use with <input type="color">.
 * Returns null if conversion is not possible without DOM.
 */
export function toHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (HEX6_RE.test(trimmed)) return trimmed.toLowerCase()
  if (HEX3_RE.test(trimmed)) return expandShortHex(trimmed).toLowerCase()
  if (HEX8_RE.test(trimmed)) return trimmed.slice(0, 7).toLowerCase()
  // For rgb/hsl/named, use an offscreen canvas if available
  if (typeof OffscreenCanvas !== 'undefined') {
    return canvasColorToHex(trimmed)
  }
  return null
}

function canvasColorToHex(color: string): string | null {
  try {
    const canvas = new OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000000'
    ctx.fillStyle = color
    const result = ctx.fillStyle
    if (typeof result === 'string' && result.startsWith('#')) {
      return result.toLowerCase()
    }
    return null
  } catch {
    return null
  }
}

/** Check if a property key name suggests a color value. */
export function isColorKeyName(key: string): boolean {
  const lower = key.toLowerCase()
  return lower === 'color' || lower.endsWith('-color') || lower.endsWith('_color')
    || lower.includes('colour') || lower.startsWith('accent')
    || lower === 'background' || lower === 'foreground' || lower === 'border'
    || lower === 'primary' || lower === 'secondary' || lower === 'muted'
    || lower === 'fill' || lower === 'stroke' || lower === 'tint'
}
