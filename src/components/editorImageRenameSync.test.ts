import { describe, expect, it } from 'vitest'
import { attachmentRenameRequestForChange } from './editorImageRenameSync'

function imageChange() {
  const url = 'asset://localhost/%2Fvault%2Fattachments%2Fphoto.png'
  return {
    block: { id: 'image-1', props: { caption: '', name: 'renamed.png', url }, type: 'image' },
    prevBlock: { id: 'image-1', props: { caption: '', name: 'photo.png', url }, type: 'image' },
    source: { type: 'local' },
    type: 'update',
  }
}

describe('attachmentRenameRequestForChange', () => {
  it.each(['local', 'undo', 'redo', 'undo-redo'])('detects %s image name changes', (source) => {
    const change = imageChange()
    change.source.type = source
    expect(attachmentRenameRequestForChange(change)).toEqual({
      blockId: 'image-1',
      previousName: 'photo.png',
      requestedName: 'renamed.png',
      sourceUrl: 'asset://localhost/%2Fvault%2Fattachments%2Fphoto.png',
    })
  })

  it('ignores remote, caption, URL, and non-image changes', () => {
    const remoteChange = imageChange()
    remoteChange.source.type = 'yjs-remote'
    expect(attachmentRenameRequestForChange(remoteChange)).toBeNull()
    const captionChange = imageChange()
    captionChange.block.props.name = 'photo.png'
    captionChange.block.props.caption = 'new caption'
    expect(attachmentRenameRequestForChange(captionChange)).toBeNull()
    const urlChange = imageChange()
    urlChange.prevBlock.props.url = 'asset://localhost/old.png'
    expect(attachmentRenameRequestForChange(urlChange)).toBeNull()
    const paragraphChange = imageChange()
    paragraphChange.block.type = 'paragraph'
    expect(attachmentRenameRequestForChange(paragraphChange)).toBeNull()
  })
})
