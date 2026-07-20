import { createReactBlockSpec, type ReactCustomBlockRenderProps } from '@blocknote/react'
import {
  CaretRight,
} from '@phosphor-icons/react'
import { createElement, useState } from 'react'
import { useAppLocale } from '../hooks/useAppPreferences'
import { translate } from '../lib/i18n'
import {
  CALLOUT_BLOCK_TYPE,
  calloutHeading,
  calloutStartsExpanded,
  type CalloutFold,
} from '../utils/calloutMarkdown'
import { resolveCalloutDefinition } from '../utils/calloutCatalog'
import { calloutIconForType } from './calloutIcons'
import { Button } from './ui/button'

const CALLOUT_BLOCK_CONFIG = {
  type: CALLOUT_BLOCK_TYPE,
  propSchema: {
    calloutType: { default: 'note' },
    fold: { default: '' },
    title: { default: '' },
  },
  content: 'inline',
} as const

type CalloutBlockViewProps = ReactCustomBlockRenderProps<
  typeof CALLOUT_BLOCK_TYPE,
  typeof CALLOUT_BLOCK_CONFIG.propSchema,
  'inline'
>

function normalizedCalloutFold(value: string): CalloutFold {
  return value === '+' || value === '-' ? value : ''
}

function CalloutHeading({
  calloutType,
  expanded,
  fold,
  heading,
  onToggle,
}: {
  calloutType: string
  expanded: boolean
  fold: CalloutFold
  heading: string
  onToggle: () => void
}) {
  const icon = createElement(calloutIconForType(calloutType), { 'aria-hidden': true, weight: 'fill' })
  if (!fold) return <>{icon}<span>{heading}</span></>

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="tolaria-callout__toggle"
      aria-expanded={expanded}
      aria-label={heading}
      onMouseDown={event => event.preventDefault()}
      onClick={onToggle}
    >
      <CaretRight className="tolaria-callout__caret" aria-hidden="true" />
      {icon}
      <span>{heading}</span>
    </Button>
  )
}

function CalloutBlockView({ block, contentRef }: CalloutBlockViewProps) {
  const locale = useAppLocale()
  const { calloutType, fold: foldProp, title } = block.props
  const fold = normalizedCalloutFold(foldProp)
  const [expanded, setExpanded] = useState(calloutStartsExpanded(fold))
  const family = resolveCalloutDefinition({ type: calloutType }).family
  const heading = calloutHeading(calloutType, title, translate(locale, 'editor.callout.defaultHeading'))

  return (
    <aside
      className={`tolaria-callout tolaria-callout--${family}`}
      data-callout-fold={fold || undefined}
      data-callout-type={calloutType}
    >
      <div className="tolaria-callout__header">
        <CalloutHeading
          calloutType={calloutType}
          expanded={expanded}
          fold={fold}
          heading={heading}
          onToggle={() => setExpanded(current => !current)}
        />
      </div>
      <div ref={contentRef} className="tolaria-callout__body" hidden={!expanded} />
    </aside>
  )
}

export const CalloutBlockSpec = createReactBlockSpec(
  CALLOUT_BLOCK_CONFIG,
  { render: CalloutBlockView },
)
