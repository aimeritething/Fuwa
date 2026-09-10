import {
  Article,
  Bug,
  CheckCircle,
  Flask,
  Info,
  Lightbulb,
  ListChecks,
  Note,
  Question,
  Quotes,
  Siren,
  Warning,
  XCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import {
  resolveCalloutDefinition,
  type ObsidianCalloutType,
} from '../utils/calloutCatalog'

const CALLOUT_ICONS: Record<ObsidianCalloutType, PhosphorIcon> = {
  abstract: Article,
  bug: Bug,
  danger: Siren,
  example: Flask,
  failure: XCircle,
  info: Info,
  note: Note,
  question: Question,
  quote: Quotes,
  success: CheckCircle,
  tip: Lightbulb,
  todo: ListChecks,
  warning: Warning,
}

export function calloutIconForType(type: string): PhosphorIcon {
  return CALLOUT_ICONS[resolveCalloutDefinition({ type }).type]
}
