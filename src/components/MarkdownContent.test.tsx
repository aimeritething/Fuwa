import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownContent } from './MarkdownContent'

describe('MarkdownContent', () => {
  it('renders bold text', () => {
    render(<MarkdownContent content="Hello **world**" />)
    const strong = screen.getByText('world')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders inline code', () => {
    render(<MarkdownContent content="Use `console.log`" />)
    const code = screen.getByText('console.log')
    expect(code.tagName).toBe('CODE')
  })

  it('renders fenced code blocks', () => {
    const { container } = render(<MarkdownContent content={'```js\nconst x = 1\n```'} />)
    const pre = container.querySelector('pre')
    expect(pre).toBeTruthy()
    expect(pre!.textContent).toContain('const x = 1')
  })

  it('renders unordered lists', () => {
    const { container } = render(<MarkdownContent content={'- one\n- two\n- three'} />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toBe('one')
  })

  it('renders ordered lists', () => {
    const { container } = render(<MarkdownContent content={'1. first\n2. second'} />)
    const ol = container.querySelector('ol')
    expect(ol).toBeTruthy()
    expect(ol!.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders headers', () => {
    render(<MarkdownContent content="## Section Title" />)
    const h2 = screen.getByText('Section Title')
    expect(h2.tagName).toBe('H2')
  })

  it('renders links', () => {
    render(<MarkdownContent content="[Click here](https://example.com)" />)
    const link = screen.getByText('Click here') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('renders mixed markdown', () => {
    const { container } = render(<MarkdownContent content={'**Bold** and `code` and\n\n- item'} />)
    expect(screen.getByText('Bold').tagName).toBe('STRONG')
    expect(screen.getByText('code').tagName).toBe('CODE')
    expect(container.querySelector('li')).toBeTruthy()
  })

  it('wraps content in .ai-markdown container', () => {
    const { container } = render(<MarkdownContent content="Hello" />)
    expect(container.querySelector('.ai-markdown')).toBeTruthy()
  })

  it('renders plain text without crashing', () => {
    render(<MarkdownContent content="Just plain text" />)
    expect(screen.getByText('Just plain text')).toBeTruthy()
  })

  it('renders blockquotes', () => {
    const { container } = render(<MarkdownContent content="> A quote" />)
    const bq = container.querySelector('blockquote')
    expect(bq).toBeTruthy()
    expect(bq!.textContent).toContain('A quote')
  })
})
