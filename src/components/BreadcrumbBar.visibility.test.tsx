import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BreadcrumbBar } from './BreadcrumbBar'
import './Editor.css'
import type { VaultEntry } from '../types'

const baseEntry: VaultEntry = {
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  template: null,
  sort: null,
  sidebarLabel: null,
  view: null,
  visible: null,
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: false,
}

const defaultProps = {
  wordCount: 100,
  showDiffToggle: false,
  diffMode: false,
  diffLoading: false,
  onToggleDiff: vi.fn(),
}

describe('BreadcrumbBar filename visibility', () => {
  it('keeps the filename visible in the breadcrumb by default', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.getByText('test')).toBeVisible()
  })

  it('keeps the filename visible even when the bar is marked as title-hidden', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    container.querySelector('.breadcrumb-bar')?.setAttribute('data-title-hidden', '')
    expect(screen.getByText('test')).toBeVisible()
  })

  it('keeps breadcrumb action buttons on the zero-padding footprint', () => {
    const editorCss = readFileSync(`${process.cwd()}/src/components/Editor.css`, 'utf8')

    expect(editorCss).toContain(".breadcrumb-bar__actions [data-slot='button']")
    expect(editorCss).toContain('width: auto;')
    expect(editorCss).toContain('height: auto;')
    expect(editorCss).toContain('padding: 0;')
    expect(editorCss).toContain('border-radius: 0;')
  })
})
