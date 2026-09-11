import { describe, expect, it } from 'vitest'
import { activeTabPaths, formatFileSize, imageEntryForPath, imageFetchVersion, imageMetadataLabel, isImageFilePath } from './imageFile'

describe('isImageFilePath', () => {
  it('accepts every Image file extension the glossary lists, whatever the case', () => {
    const twelve = ['a.apng', 'a.avif', 'a.bmp', 'a.gif', 'a.ico', 'a.jpeg', 'a.jpg', 'a.png', 'a.svg', 'a.tif', 'a.tiff', 'a.webp']

    expect(twelve.every((path) => isImageFilePath(`/n/${path}`))).toBe(true)
    expect(isImageFilePath('/n/Cover.PNG')).toBe(true)
  })

  it('turns down Documents and everything the Explorer does not list', () => {
    for (const path of ['/n/a.md', '/n/a.pdf', '/n/a.mp4', '/n/png', '/n/a.png.md']) {
      expect(isImageFilePath(path)).toBe(false)
    }
  })
})

describe('imageEntryForPath', () => {
  it('names the file and marks it binary, with no content behind it', () => {
    const entry = imageEntryForPath('/n/Attachments/lake.png')

    expect(entry.path).toBe('/n/Attachments/lake.png')
    expect(entry.filename).toBe('lake.png')
    expect(entry.title).toBe('lake')
    expect(entry.fileKind).toBe('binary')
    expect(entry.fileSize).toBe(0)
  })
})

describe('formatFileSize', () => {
  it('shows one decimal and drops a trailing zero', () => {
    expect(formatFileSize(245_760)).toBe('240 KB')
    expect(formatFileSize(250_000)).toBe('244.1 KB')
    expect(formatFileSize(3_400_000)).toBe('3.2 MB')
    expect(formatFileSize(900)).toBe('900 B')
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('steps up a unit rather than showing a full step of the smaller one', () => {
    expect(formatFileSize(1_048_570)).toBe('1 MB')
  })
})

describe('imageMetadataLabel', () => {
  it('is the dimensions and the size once the natural size is known', () => {
    expect(imageMetadataLabel({ width: 1920, height: 1080 }, 245_760)).toBe('1920 × 1080 · 240 KB')
  })

  it('is nothing at all before the image has loaded', () => {
    expect(imageMetadataLabel(null, 245_760)).toBeNull()
  })
})

describe('activeTabPaths', () => {
  it('names the active Document, or the active Image file, or neither', () => {
    expect(activeTabPaths('/n/a.md')).toEqual({ documentPath: '/n/a.md', imagePath: null })
    expect(activeTabPaths('/n/cover.png')).toEqual({ documentPath: null, imagePath: '/n/cover.png' })
    expect(activeTabPaths(null)).toEqual({ documentPath: null, imagePath: null })
  })
})

describe('imageFetchVersion', () => {
  it('moves when the listing does', () => {
    const before = imageFetchVersion({ modifiedAt: 17, fileSize: 2048 }, 0)

    expect(imageFetchVersion({ modifiedAt: 18, fileSize: 2048 }, 0)).not.toBe(before)
    expect(imageFetchVersion({ modifiedAt: 17, fileSize: 4096 }, 0)).not.toBe(before)
  })

  it('moves on a watcher reload even when the listing has not, seconds being too coarse to tell', () => {
    const before = imageFetchVersion({ modifiedAt: 17, fileSize: 2048 }, 0)

    expect(imageFetchVersion({ modifiedAt: 17, fileSize: 2048 }, 1)).not.toBe(before)
  })

  it('has a version for a picture the Folder does not list', () => {
    expect(imageFetchVersion(null, 0)).toBe('0-0-0')
  })
})
