import { useState, useCallback, useEffect } from 'react'
import { EmojiPicker } from './EmojiPicker'
import { isEmoji } from '../utils/emoji'

interface NoteIconProps {
  icon: string | null
  editable?: boolean
  onSetIcon: (emoji: string) => void
  onRemoveIcon: () => void
}

export function NoteIcon({ icon, editable = true, onSetIcon, onRemoveIcon }: NoteIconProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showRemove, setShowRemove] = useState(false)

  const hasIcon = icon && isEmoji(icon)

  // Listen for command palette "Set Note Icon" event
  useEffect(() => {
    if (!editable) return
    const handler = () => setPickerOpen(true)
    window.addEventListener('laputa:open-icon-picker', handler)
    return () => window.removeEventListener('laputa:open-icon-picker', handler)
  }, [editable])

  const openPicker = useCallback(() => {
    if (!editable) return
    if (hasIcon) {
      setShowRemove(prev => !prev)
    } else {
      setPickerOpen(true)
    }
  }, [editable, hasIcon])

  const handleSelect = useCallback((emoji: string) => {
    onSetIcon(emoji)
    setPickerOpen(false)
    setShowRemove(false)
  }, [onSetIcon])

  const handleRemove = useCallback(() => {
    onRemoveIcon()
    setShowRemove(false)
  }, [onRemoveIcon])

  const handleChangePicker = useCallback(() => {
    setShowRemove(false)
    setPickerOpen(true)
  }, [])

  return (
    <div className="note-icon-area" data-testid="note-icon-area" style={{ position: 'relative' }}>
      {hasIcon ? (
        <button
          className="note-icon-button note-icon-button--active"
          onClick={openPicker}
          data-testid="note-icon-display"
          title={editable ? 'Change or remove icon' : undefined}
          disabled={!editable}
        >
          {icon}
        </button>
      ) : (
        editable && (
          <button
            className="note-icon-button note-icon-button--add"
            onClick={openPicker}
            data-testid="note-icon-add"
            title="Add icon"
          >
            <span className="note-icon-button__plus">+</span>
            <span className="note-icon-button__label">Add icon</span>
          </button>
        )
      )}
      {showRemove && hasIcon && (
        <div className="note-icon-menu" data-testid="note-icon-menu">
          <button
            className="note-icon-menu__item"
            onClick={handleChangePicker}
            data-testid="note-icon-change"
          >
            Change icon
          </button>
          <button
            className="note-icon-menu__item note-icon-menu__item--danger"
            onClick={handleRemove}
            data-testid="note-icon-remove"
          >
            Remove icon
          </button>
        </div>
      )}
      {pickerOpen && (
        <EmojiPicker
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
