import { expect, it } from 'vitest'
import { isMissingFileError } from './missing-file'

it('recognises the boundary and the io wordings for a file that has gone', () => {
  expect(isMissingFileError(new Error('File does not exist'))).toBe(true)
  expect(isMissingFileError('File does not exist: /Notes/a.md')).toBe(true)
  expect(isMissingFileError(new Error('No such file or directory (os error 2)'))).toBe(true)
})

it('leaves every other refusal alone', () => {
  expect(isMissingFileError(new Error('Permission denied (os error 13)'))).toBe(false)
  expect(isMissingFileError(new Error('Path must stay inside the active vault'))).toBe(false)
  expect(isMissingFileError(null)).toBe(false)
})
