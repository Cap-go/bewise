import type { Quote } from './api'

/** Quotes already shown in a list, so detail pages render instantly during the push transition. */
export const quoteCache = new Map<string, Quote>()
