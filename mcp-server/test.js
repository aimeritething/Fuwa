import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  readNote, createNote, searchNotes, appendToNote, findMarkdownFiles,
  editNoteFrontmatter, deleteNote, linkNotes, listNotes, vaultContext,
} from './vault.js'

let tmpDir

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-test-'))

  await fs.mkdir(path.join(tmpDir, 'project'), { recursive: true })
  await fs.mkdir(path.join(tmpDir, 'note'), { recursive: true })

  await fs.writeFile(path.join(tmpDir, 'project', 'test-project.md'), `---
title: Test Project
is_a: Project
status: Active
---

# Test Project

This is a test project for the MCP server.
`)

  await fs.writeFile(path.join(tmpDir, 'note', 'daily-log.md'), `---
title: Daily Log
is_a: Note
---

# Daily Log

Today I worked on the MCP server implementation.
`)

  await fs.writeFile(path.join(tmpDir, 'project', 'second-project.md'), `---
title: Second Project
type: Project
status: Draft
belongs_to:
  - "[[project/test-project]]"
---

# Second Project

Another project for testing list and context.
`)
})

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('findMarkdownFiles', () => {
  it('should find all .md files recursively', async () => {
    const files = await findMarkdownFiles(tmpDir)
    assert.equal(files.length, 3)
    assert.ok(files.some(f => f.endsWith('test-project.md')))
    assert.ok(files.some(f => f.endsWith('daily-log.md')))
    assert.ok(files.some(f => f.endsWith('second-project.md')))
  })
})

describe('readNote', () => {
  it('should read a note by relative path', async () => {
    const content = await readNote(tmpDir, 'project/test-project.md')
    assert.ok(content.includes('Test Project'))
    assert.ok(content.includes('is_a: Project'))
  })

  it('should throw for missing notes', async () => {
    await assert.rejects(
      () => readNote(tmpDir, 'nonexistent.md'),
      { code: 'ENOENT' }
    )
  })
})

describe('createNote', () => {
  it('should create a note with frontmatter', async () => {
    const absPath = await createNote(tmpDir, 'note/new-note.md', 'My New Note', { is_a: 'Note' })
    assert.ok(absPath.endsWith('new-note.md'))

    const content = await fs.readFile(absPath, 'utf-8')
    assert.ok(content.includes('title: My New Note'))
    assert.ok(content.includes('is_a: Note'))
    assert.ok(content.includes('# My New Note'))
  })

  it('should create parent directories', async () => {
    const absPath = await createNote(tmpDir, 'deep/nested/dir/note.md', 'Deep Note')
    const content = await fs.readFile(absPath, 'utf-8')
    assert.ok(content.includes('# Deep Note'))
  })
})

describe('searchNotes', () => {
  it('should find notes matching title', async () => {
    const results = await searchNotes(tmpDir, 'Test Project')
    assert.ok(results.length >= 1)
    assert.equal(results[0].title, 'Test Project')
  })

  it('should find notes matching content', async () => {
    const results = await searchNotes(tmpDir, 'MCP server')
    assert.ok(results.length >= 1)
  })

  it('should return empty for no matches', async () => {
    const results = await searchNotes(tmpDir, 'xyzzy-nonexistent-12345')
    assert.equal(results.length, 0)
  })

  it('should respect limit', async () => {
    const results = await searchNotes(tmpDir, 'project', 1)
    assert.ok(results.length <= 1)
  })
})

describe('appendToNote', () => {
  it('should append text to a note', async () => {
    await appendToNote(tmpDir, 'note/daily-log.md', '## Evening Update\nFinished testing.')
    const content = await readNote(tmpDir, 'note/daily-log.md')
    assert.ok(content.includes('## Evening Update'))
    assert.ok(content.includes('Finished testing.'))
  })
})

describe('editNoteFrontmatter', () => {
  it('should merge a patch into frontmatter', async () => {
    const updated = await editNoteFrontmatter(tmpDir, 'project/test-project.md', { status: 'Completed', priority: 'High' })
    assert.equal(updated.status, 'Completed')
    assert.equal(updated.priority, 'High')
    assert.equal(updated.title, 'Test Project')
  })

  it('should preserve existing frontmatter fields', async () => {
    const content = await readNote(tmpDir, 'project/test-project.md')
    assert.ok(content.includes('is_a: Project'))
    assert.ok(content.includes('status: Completed'))
  })

  it('should throw for missing file', async () => {
    await assert.rejects(
      () => editNoteFrontmatter(tmpDir, 'nonexistent.md', { foo: 'bar' }),
      { code: 'ENOENT' }
    )
  })
})

describe('deleteNote', () => {
  it('should delete an existing note', async () => {
    const delPath = 'note/to-delete.md'
    await createNote(tmpDir, delPath, 'To Delete')
    const absPath = path.join(tmpDir, delPath)

    // Verify it exists
    await fs.access(absPath)

    await deleteNote(tmpDir, delPath)

    await assert.rejects(
      () => fs.access(absPath),
      { code: 'ENOENT' }
    )
  })

  it('should throw for missing file', async () => {
    await assert.rejects(
      () => deleteNote(tmpDir, 'nonexistent.md'),
      { code: 'ENOENT' }
    )
  })
})

describe('linkNotes', () => {
  it('should add a target to an array property', async () => {
    const linkPath = 'project/link-test.md'
    await createNote(tmpDir, linkPath, 'Link Test', { is_a: 'Project' })

    const result = await linkNotes(tmpDir, linkPath, 'related_to', '[[note/daily-log]]')
    assert.deepEqual(result, ['[[note/daily-log]]'])
  })

  it('should not duplicate existing links', async () => {
    const linkPath = 'project/link-test.md'

    await linkNotes(tmpDir, linkPath, 'related_to', '[[note/daily-log]]')
    const result = await linkNotes(tmpDir, linkPath, 'related_to', '[[note/daily-log]]')
    assert.equal(result.length, 1)
  })

  it('should add multiple distinct links', async () => {
    const linkPath = 'project/link-test.md'

    await linkNotes(tmpDir, linkPath, 'related_to', '[[project/test-project]]')
    const result = await linkNotes(tmpDir, linkPath, 'related_to', '[[project/test-project]]')
    // Should have daily-log and test-project
    assert.ok(result.includes('[[note/daily-log]]'))
    assert.ok(result.includes('[[project/test-project]]'))
    assert.equal(result.length, 2)
  })
})

describe('listNotes', () => {
  it('should list all notes sorted by title', async () => {
    const notes = await listNotes(tmpDir)
    assert.ok(notes.length >= 3)
    // Verify sorted by title
    for (let i = 1; i < notes.length; i++) {
      assert.ok(notes[i - 1].title.localeCompare(notes[i].title) <= 0)
    }
  })

  it('should filter by type', async () => {
    const projects = await listNotes(tmpDir, 'Project')
    assert.ok(projects.length >= 1)
    for (const n of projects) {
      assert.equal(n.type, 'Project')
    }
  })

  it('should return empty for unknown type', async () => {
    const notes = await listNotes(tmpDir, 'UnknownType12345')
    assert.equal(notes.length, 0)
  })

  it('should support mtime sorting', async () => {
    const notes = await listNotes(tmpDir, undefined, 'mtime')
    assert.ok(notes.length >= 1)
    // Just verify it returns results without crashing
    assert.ok(notes[0].path)
    assert.ok(notes[0].title)
  })
})

describe('vaultContext', () => {
  it('should return types, recent notes, and vault path', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(Array.isArray(ctx.types))
    assert.ok(Array.isArray(ctx.recentNotes))
    assert.equal(ctx.vaultPath, tmpDir)
  })

  it('should include known entity types', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(ctx.types.includes('Project'))
    assert.ok(ctx.types.includes('Note'))
  })

  it('should cap recent notes at 20', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(ctx.recentNotes.length <= 20)
  })

  it('should include path and title in recent notes', async () => {
    const ctx = await vaultContext(tmpDir)
    for (const note of ctx.recentNotes) {
      assert.ok(note.path)
      assert.ok(note.title)
    }
  })
})
