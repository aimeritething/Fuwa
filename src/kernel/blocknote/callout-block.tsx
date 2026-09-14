import { createReactBlockSpec, type ReactCustomBlockRenderProps } from '@blocknote/react'
import { createElement } from 'react'
import { useAppLocale } from '@/lib/use-app-preferences'
import { translate } from '@/lib/i18n'
import {
  CALLOUT_BLOCK_TYPE,
  calloutHeading,
} from '@/kernel/markdown/callout-markdown'
import { resolveCalloutDefinition } from './callout-catalog'
import { calloutIconForType } from './callout-icons'

const CALLOUT_BLOCK_CONFIG = {
  type: CALLOUT_BLOCK_TYPE,
  propSchema: {
    calloutType: { default: 'note' },
    title: { default: '' },
  },
  content: 'inline',
} as const

type CalloutBlockViewProps = ReactCustomBlockRenderProps<
  typeof CALLOUT_BLOCK_TYPE,
  typeof CALLOUT_BLOCK_CONFIG.propSchema,
  'inline'
>

function CalloutHeading({
  calloutType,
  heading,
}: {
  calloutType: string
  heading: string
}) {
  const icon = createElement(calloutIconForType(calloutType), { 'aria-hidden': true, weight: 'fill' })
  return <>{icon}<span>{heading}</span></>
}

function CalloutBlockView({ block, contentRef }: CalloutBlockViewProps) {
  const locale = useAppLocale()
  const { calloutType, title } = block.props
  const family = resolveCalloutDefinition({ type: calloutType }).family
  const heading = calloutHeading(calloutType, title, translate(locale, 'editor.callout.defaultHeading'))

  return (
    <aside
      className={`fuwa-callout fuwa-callout--${family}`}
      data-callout-type={calloutType}
    >
      <div className="fuwa-callout__header">
        <CalloutHeading
          calloutType={calloutType}
          heading={heading}
        />
      </div>
      <div ref={contentRef} className="fuwa-callout__body" />
    </aside>
  )
}

export const CalloutBlockSpec = createReactBlockSpec(
  CALLOUT_BLOCK_CONFIG,
  { render: CalloutBlockView },
)
