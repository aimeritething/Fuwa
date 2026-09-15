/* eslint-disable react-refresh/only-export-components -- the two block specs and the preview helper sit next to the views */
import {
  audioParse,
  createAudioBlockConfig,
  createVideoBlockConfig,
  videoParse,
} from '@blocknote/core'
import {
  AudioBlock as BlockNoteAudioBlock,
  AudioToExternalHTML,
  createReactBlockSpec,
  VideoBlock as BlockNoteVideoBlock,
  VideoToExternalHTML,
} from '@blocknote/react'
import type { ComponentProps } from 'react'
import { useExternalMediaPreview } from '@/platform/media-preview-runtime'

// BlockNote's own audio and video blocks, wrapped so that a runtime which
// cannot preview external media (see platform/media-preview-runtime) shows
// the file name instead of a player. The configs are BlockNote's creators.

type AudioBlockProps = ComponentProps<typeof BlockNoteAudioBlock>
type VideoBlockProps = ComponentProps<typeof BlockNoteVideoBlock>
type MediaBlockPreviewProps = {
  block: {
    props: {
      showPreview: boolean
    }
  }
}

export function mediaBlockPropsForPreviewRuntime<T extends MediaBlockPreviewProps>(
  props: T,
  externalMediaPreview: boolean,
): T {
  if (!externalMediaPreview) return props

  return {
    ...props,
    block: {
      ...props.block,
      props: {
        ...props.block.props,
        showPreview: false,
      },
    },
  }
}

export function AudioBlock(props: AudioBlockProps) {
  const externalMediaPreview = useExternalMediaPreview()
  return <BlockNoteAudioBlock {...mediaBlockPropsForPreviewRuntime(props, externalMediaPreview)} />
}

export function VideoBlock(props: VideoBlockProps) {
  const externalMediaPreview = useExternalMediaPreview()
  return <BlockNoteVideoBlock {...mediaBlockPropsForPreviewRuntime(props, externalMediaPreview)} />
}

export const AudioBlockSpec = createReactBlockSpec(
  createAudioBlockConfig,
  (config) => ({
    render: AudioBlock,
    parse: audioParse(config),
    toExternalHTML: AudioToExternalHTML,
    runsBefore: ['file'],
  }),
)

export const VideoBlockSpec = createReactBlockSpec(
  createVideoBlockConfig,
  (config) => ({
    render: VideoBlock,
    parse: videoParse(config),
    toExternalHTML: VideoToExternalHTML,
    runsBefore: ['file'],
  }),
)
