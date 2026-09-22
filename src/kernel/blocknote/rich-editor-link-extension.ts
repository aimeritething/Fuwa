import { Link } from '@tiptap/extension-link'
import { shouldAutoLinkHref } from './editor-link-autolink'

/** BlockNote's own link mark, turned off so the one below is the only one. */
export const RICH_EDITOR_REPLACED_LINK_EXTENSION = 'link'

const HREF_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
// eslint-disable-next-line no-control-regex
const HREF_IGNORED_CHARACTERS = /[\s\u0000-\u001f]/g

/**
 * An href with no scheme is a path, relative to the Document: `docs/a.md`.
 * tiptap 3.19 refuses one that has a `/` after its first segment (the `.-:` in
 * its pattern is a range, and `/` is inside it), so the link was dropped when
 * the Document opened and the next Autosave wrote it out without it. A path
 * cannot carry a script, so every one is allowed; an href that does have a
 * scheme is still tiptap's to judge.
 */
export function isAllowedLinkHref(href: string, tiptapAllows: (href: string) => boolean): boolean {
  if (!HREF_SCHEME_PATTERN.test(href.replace(HREF_IGNORED_CHARACTERS, ''))) return true
  return tiptapAllows(href)
}

/**
 * BlockNote's link mark with two more options. `isAllowedUri` is the rule
 * above. The other is `shouldAutoLink`: tiptap asks it
 * before it links typed text, a pasted URL, or a paste rule's match, so a file
 * name such as `AGENTS.md` (`.md` is a country domain) never becomes a link in
 * the first place. Nothing removes a link afterwards: a link that is already
 * in the Document is the writer's, and stays.
 *
 * The other options are BlockNote's, copied from its `extensions.ts` (as
 * patched): they have to move with it when BlockNote is bumped.
 */
export function createRichEditorLinkExtension() {
  return Link.extend({
    inclusive: false,
  }).configure({
    defaultProtocol: 'https',
    // Plumo routes editor link clicks through its guarded native opener.
    openOnClick: false,
    // Plumo pre-registers BlockNote's non-native protocols before linkify initializes.
    protocols: [],
    isAllowedUri: (href, { defaultValidate }) => isAllowedLinkHref(href, defaultValidate),
    shouldAutoLink: (url) => shouldAutoLinkHref({ raw: url }),
  })
}
