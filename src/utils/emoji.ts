/**
 * Detects whether a string is a single emoji (as opposed to a Phosphor icon name).
 * Used to differentiate emoji note icons from kebab-case Phosphor icon names.
 */
export function isEmoji(value: string): boolean {
  if (!value) return false
  // Phosphor icon names are always lowercase ASCII with hyphens
  if (/^[a-z][a-z0-9-]*$/.test(value)) return false
  // Match a single emoji (including compound emoji with ZWJ, skin tones, variation selectors, flags)
  // Uses Unicode segmentation: a single emoji can be base + modifiers/ZWJ sequences
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\ufe0f)(\u200d(\p{Emoji_Presentation}|\p{Emoji}\ufe0f)|\p{Emoji_Modifier})*$/u
  return emojiRegex.test(value)
}

/** Curated emoji categories for the note icon picker. */
export const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '🥹', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😎', '🤓', '🧐', '🤔', '🤗', '🫡', '🤫', '🫠', '😶', '😑', '😬', '🙄', '😴'],
  },
  {
    name: 'Hands & People',
    emojis: ['👋', '🤚', '✋', '🖐️', '👌', '🤌', '✌️', '🤞', '🫰', '🤙', '👍', '👎', '👏', '🙌', '🫶', '🙏', '💪', '🧠', '👀', '👁️', '👤', '🧑‍💻', '🧑‍🎨', '🧑‍🔬', '🧑‍🚀', '🧑‍🏫', '🧑‍⚕️', '🧑‍🍳', '🏃', '🧘'],
  },
  {
    name: 'Nature',
    emojis: ['🌱', '🌿', '🍀', '🌵', '🌲', '🌳', '🌴', '🌸', '🌺', '🌻', '🌹', '💐', '🍂', '🍁', '🍃', '🌾', '🐝', '🦋', '🐛', '🐞', '🐦', '🦅', '🐺', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸'],
  },
  {
    name: 'Food & Drink',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥝', '🍅', '🥑', '🌽', '🥕', '🧅', '🍞', '🥐', '🧁', '🍰', '🎂', '🍪', '☕', '🍵', '🧃', '🥤', '🍺', '🍷', '🥂'],
  },
  {
    name: 'Activities',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🎮', '🕹️', '🎲', '🧩', '♟️', '🎯', '🎳', '🎸', '🎹', '🎺', '🎨', '🖌️', '📷', '🎬', '🎭', '🎤', '🎧', '📚', '📝', '✏️', '🖊️', '📖'],
  },
  {
    name: 'Travel & Places',
    emojis: ['🏠', '🏡', '🏢', '🏗️', '🏰', '🏛️', '⛪', '🕌', '🗼', '🗽', '⛲', '🎪', '🚀', '✈️', '🚂', '🚗', '🚲', '⛵', '🏔️', '🌋', '🏖️', '🏜️', '🗺️', '🌍', '🌎', '🌏', '🧭', '⛺', '🎡', '🎢'],
  },
  {
    name: 'Objects',
    emojis: ['💡', '🔦', '🕯️', '📱', '💻', '⌨️', '🖥️', '🖨️', '📸', '🔭', '🔬', '🧪', '💊', '🩺', '🔑', '🗝️', '🔒', '🔓', '🧲', '⚙️', '🔧', '🔨', '⛏️', '🪛', '🧰', '📦', '📮', '✉️', '📩', '🏷️'],
  },
  {
    name: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💝', '⭐', '🌟', '✨', '💫', '🔥', '💥', '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '📌', '📍', '🚩', '🏁'],
  },
  {
    name: 'Flags & Signs',
    emojis: ['✅', '❌', '⭕', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '▶️', '⏸️', '⏹️', '⏺️', '⏭️', '🔀', '🔁', '🔂', '🔄', '➡️', '⬅️'],
  },
]
