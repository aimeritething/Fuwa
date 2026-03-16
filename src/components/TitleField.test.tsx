import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TitleField } from './TitleField'

describe('TitleField', () => {
  it('renders the title in the input', () => {
    render(<TitleField title="My Note" filename="my-note.md" onTitleChange={() => {}} />)
    expect(screen.getByTestId('title-field-input')).toHaveValue('My Note')
  })

  it('calls onTitleChange on blur with new value', () => {
    const onChange = vi.fn()
    render(<TitleField title="Old Title" filename="old-title.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('New Title')
  })

  it('does not call onTitleChange if title unchanged', () => {
    const onChange = vi.fn()
    render(<TitleField title="Same Title" filename="same-title.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reverts to original title if input is emptied', () => {
    const onChange = vi.fn()
    render(<TitleField title="Keep This" filename="keep-this.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue('Keep This')
  })

  it('shows filename indicator when slug differs from current filename', () => {
    render(<TitleField title="My Note" filename="wrong-name.md" onTitleChange={() => {}} />)
    expect(screen.getByTestId('title-field-filename')).toHaveTextContent('my-note.md')
  })

  it('does not show filename when slug matches and not editing', () => {
    render(<TitleField title="My Note" filename="my-note.md" onTitleChange={() => {}} />)
    expect(screen.queryByTestId('title-field-filename')).not.toBeInTheDocument()
  })

  it('disables input when editable is false', () => {
    render(<TitleField title="Read Only" filename="read-only.md" editable={false} onTitleChange={() => {}} />)
    expect(screen.getByTestId('title-field-input')).toBeDisabled()
  })

  it('commits title on Enter key', () => {
    const onChange = vi.fn()
    render(<TitleField title="Before" filename="before.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'After' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // In jsdom, blur() after keyDown needs explicit blur event
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('After')
  })

  it('reverts on Escape key', () => {
    const onChange = vi.fn()
    render(<TitleField title="Original" filename="original.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    // Escape reverts value and blurs
    expect(input).toHaveValue('Original')
  })

  it('responds to laputa:focus-editor event with selectTitle', () => {
    render(<TitleField title="Focus Me" filename="focus-me.md" onTitleChange={() => {}} />)
    const input = screen.getByTestId('title-field-input')
    window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))
    expect(document.activeElement).toBe(input)
  })
})
