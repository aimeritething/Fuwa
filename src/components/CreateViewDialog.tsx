import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterBuilder } from './FilterBuilder'
import type { FilterCondition, ViewDefinition } from '../types'

interface CreateViewDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (definition: ViewDefinition) => void
  availableFields: string[]
}

export function CreateViewDialog({ open, onClose, onCreate, availableFields }: CreateViewDialogProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: 'type', op: 'equals', value: '' },
  ])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setIcon('') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setConditions([{ field: availableFields[0] ?? 'type', op: 'equals', value: '' }]) // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, availableFields])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const validConditions = conditions.filter((c) => c.field)
    const definition: ViewDefinition = {
      name: trimmed,
      icon: icon || null,
      color: null,
      sort: null,
      filters: { all: validConditions },
    }
    onCreate(definition)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create View</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="w-16 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              <Input
                placeholder="📋"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="text-center"
                maxLength={2}
              />
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filters</label>
            <FilterBuilder
              conditions={conditions}
              onChange={setConditions}
              availableFields={availableFields}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
