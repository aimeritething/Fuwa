import { describe, expect, it, vi } from 'vitest'
import {
  clipboardRemoteImages,
  importRemoteImages,
  rawRemoteImagePasteText,
  replaceImportedRemoteImages,
} from './remoteImagePaste'

function clipboardData(data: Record<string, string>): DataTransfer {
  return {
    getData: vi.fn((type: string) => data[type] ?? ''),
    types: Object.keys(data),
  } as unknown as DataTransfer
}

describe('remote image paste', () => {
  it('extracts unique web images, resolving relative sources only from an explicit base', () => {
    const data = clipboardData({
      'text/html': [
        '<base href="https://cdn.example.com/article/">',
        '<img src="https://cdn.example.com/photo.png?size=2">',
        '<img data-src="https://cdn.example.com/lazy.webp" src="data:image/gif;base64,abc">',
        '<img src="relative.png" alt="Relative">',
        '<img src="https://cdn.example.com/photo.png?size=2">',
      ].join(''),
      'text/plain': '![diagram](http://images.example.com/diagram.jpg)',
    })

    expect(clipboardRemoteImages(data)).toEqual([
      { alt: '', url: 'https://cdn.example.com/photo.png?size=2' },
      { alt: '', url: 'https://cdn.example.com/lazy.webp' },
      { alt: 'Relative', url: 'https://cdn.example.com/article/relative.png' },
      { alt: 'diagram', url: 'http://images.example.com/diagram.jpg' },
    ])
  })

  it('adds rich HTML images to raw paste text without duplicating markdown images', () => {
    const data = clipboardData({
      'text/html': '<p>Intro</p><img src="https://cdn.example.com/photo.png" alt="Photo">',
      'text/plain': 'Intro\n\n![Diagram](https://cdn.example.com/diagram.png)',
    })

    expect(rawRemoteImagePasteText(data)).toBe([
      'Intro',
      '',
      '![Diagram](https://cdn.example.com/diagram.png)',
      '',
      '![Photo](https://cdn.example.com/photo.png)',
    ].join('\n'))
  })

  it('keeps failed URLs remote while rewriting successful imports portably', async () => {
    const download = vi.fn()
      .mockResolvedValueOnce('/vault/attachments/123-photo.png')
      .mockRejectedValueOnce(new Error('blocked'))

    const result = await importRemoteImages({
      download,
      images: [
        { alt: 'Photo', url: 'https://cdn.example.com/photo.png' },
        { alt: 'Map', url: 'https://cdn.example.com/map.png' },
      ],
      vaultPath: '/vault',
    })

    expect(result).toEqual({
      failedCount: 1,
      replacements: new Map([
        ['https://cdn.example.com/photo.png', 'attachments/123-photo.png'],
      ]),
      totalCount: 2,
    })
    expect(replaceImportedRemoteImages({
      text: '![Photo](https://cdn.example.com/photo.png) ![Map](https://cdn.example.com/map.png)',
      replacements: result.replacements,
    })).toBe('![Photo](attachments/123-photo.png) ![Map](https://cdn.example.com/map.png)')
  })

  it('rewrites overlapping remote image URLs without corrupting query-specific imports', () => {
    expect(replaceImportedRemoteImages({
      text: [
        '![Full](https://cdn.example.com/photo.png?size=full)',
        '![Thumb](https://cdn.example.com/photo.png)',
      ].join('\n'),
      replacements: new Map([
        ['https://cdn.example.com/photo.png', 'attachments/photo.png'],
        ['https://cdn.example.com/photo.png?size=full', 'attachments/photo-full.png'],
      ]),
    })).toBe([
      '![Full](attachments/photo-full.png)',
      '![Thumb](attachments/photo.png)',
    ].join('\n'))
  })
})
