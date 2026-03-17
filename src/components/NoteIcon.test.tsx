import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NoteIcon } from './NoteIcon'

describe('NoteIcon', () => {
  it('shows add button when no icon is set', () => {
    render(<NoteIcon icon={null} onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    expect(screen.getByTestId('note-icon-add')).toBeInTheDocument()
    expect(screen.queryByTestId('note-icon-display')).not.toBeInTheDocument()
  })

  it('displays the emoji when icon is set', () => {
    render(<NoteIcon icon="🎯" onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    expect(screen.getByTestId('note-icon-display')).toHaveTextContent('🎯')
    expect(screen.queryByTestId('note-icon-add')).not.toBeInTheDocument()
  })

  it('does not display Phosphor icon names as emoji', () => {
    render(<NoteIcon icon="rocket" onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    // Phosphor icon name is not an emoji → shows add button
    expect(screen.getByTestId('note-icon-add')).toBeInTheDocument()
  })

  it('opens emoji picker when add button is clicked', () => {
    render(<NoteIcon icon={null} onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    fireEvent.click(screen.getByTestId('note-icon-add'))
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('shows change/remove menu when existing icon is clicked', () => {
    render(<NoteIcon icon="🔥" onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    fireEvent.click(screen.getByTestId('note-icon-display'))
    expect(screen.getByTestId('note-icon-menu')).toBeInTheDocument()
    expect(screen.getByTestId('note-icon-change')).toBeInTheDocument()
    expect(screen.getByTestId('note-icon-remove')).toBeInTheDocument()
  })

  it('calls onRemoveIcon when Remove is clicked', () => {
    const onRemove = vi.fn()
    render(<NoteIcon icon="🔥" onSetIcon={() => {}} onRemoveIcon={onRemove} />)
    fireEvent.click(screen.getByTestId('note-icon-display'))
    fireEvent.click(screen.getByTestId('note-icon-remove'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('opens picker when Change is clicked from menu', () => {
    render(<NoteIcon icon="🔥" onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    fireEvent.click(screen.getByTestId('note-icon-display'))
    fireEvent.click(screen.getByTestId('note-icon-change'))
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('calls onSetIcon when emoji is selected from picker', () => {
    const onSet = vi.fn()
    render(<NoteIcon icon={null} onSetIcon={onSet} onRemoveIcon={() => {}} />)
    fireEvent.click(screen.getByTestId('note-icon-add'))
    const emojiButtons = screen.getAllByTestId('emoji-option')
    fireEvent.click(emojiButtons[0])
    expect(onSet).toHaveBeenCalledOnce()
  })

  it('hides add button when not editable', () => {
    render(<NoteIcon icon={null} editable={false} onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    expect(screen.queryByTestId('note-icon-add')).not.toBeInTheDocument()
  })

  it('disables icon click when not editable', () => {
    render(<NoteIcon icon="🎯" editable={false} onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    const display = screen.getByTestId('note-icon-display')
    expect(display).toBeDisabled()
  })

  it('opens picker on laputa:open-icon-picker event', () => {
    render(<NoteIcon icon={null} onSetIcon={() => {}} onRemoveIcon={() => {}} />)
    act(() => { window.dispatchEvent(new CustomEvent('laputa:open-icon-picker')) })
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })
})
