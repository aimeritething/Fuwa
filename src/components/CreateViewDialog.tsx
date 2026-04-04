import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterBuilder } from './FilterBuilder'
import { EmojiPicker } from './EmojiPicker'
import type { FilterGroup, ViewDefinition, VaultEntry } from '../types'

interface CreateViewDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (definition: ViewDefinition) => void
  availableFields: string[]
  /** Returns known values for a given field (for autocomplete). */
  valueSuggestions?: (field: string) => string[]
  /** Vault entries for wikilink autocomplete in filter value fields. */
  entries?: VaultEntry[]
  /** When provided, the dialog operates in edit mode with pre-populated fields. */
  editingView?: ViewDefinition | null
}

export function CreateViewDialog({ open, onClose, onCreate, availableFields, valueSuggestions, entries, editingView }: CreateViewDialogProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [filters, setFilters] = useState<FilterGroup>({
    all: [{ field: 'type', op: 'equals', value: '' }],
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = !!editingView

  useEffect(() => {
    if (open) {
      if (editingView) {
        setName(editingView.name) // eslint-disable-line react-hooks/set-state-in-effect -- populate on dialog open
        setIcon(editingView.icon ?? '') // eslint-disable-line react-hooks/set-state-in-effect -- populate on dialog open
        setFilters(editingView.filters) // eslint-disable-line react-hooks/set-state-in-effect -- populate on dialog open
      } else {
        setName('') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
        setIcon('') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
        setFilters({ all: [{ field: availableFields[0] ?? 'type', op: 'equals', value: '' }] }) // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      }
      setShowEmojiPicker(false) // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, availableFields, editingView])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const definition: ViewDefinition = {
      name: trimmed,
      icon: icon || null,
      color: null,
      sort: null,
      filters,
    }
    onCreate(definition)
    onClose()
  }

  const handleSelectEmoji = useCallback((emoji: string) => {
    setIcon(emoji)
    setShowEmojiPicker(false)
  }, [])

  const handleCloseEmojiPicker = useCallback(() => {
    setShowEmojiPicker(false)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="flex max-h-[80vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit View' : 'Create View'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex gap-2">
            <div className="w-16 space-y-1.5 relative">
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              <button
                type="button"
                className="flex h-9 w-full items-center justify-center rounded-md border border-input bg-background text-xl cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Pick icon"
              >
                {icon || <span className="text-sm text-muted-foreground">📋</span>}
              </button>
              {showEmojiPicker && (
                <EmojiPicker onSelect={handleSelectEmoji} onClose={handleCloseEmojiPicker} />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                ref={inputRef}
                placeholder="e.g. Active Projects, Reading List..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            <label className="text-xs font-medium text-muted-foreground">Filters</label>
            <FilterBuilder
              group={filters}
              onChange={setFilters}
              availableFields={availableFields}
              valueSuggestions={valueSuggestions}
              entries={entries}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>{isEditing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
