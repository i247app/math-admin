import type { ParseKeys } from 'i18next'

/** Any key in the translation catalog, e.g. 'nav.users'. */
export type TranslationKey = ParseKeys

/** Data attached to a route via `handle`; read with useMatches(). */
export type RouteHandle = {
  titleKey?: TranslationKey
}
