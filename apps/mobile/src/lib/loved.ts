import type { Quote } from './api'
import { reactive, watch } from 'vue'
import { api } from './api'
import { quoteCache } from './quoteCache'
import { maybeAskForReview } from './review'
import { state } from './state'
import { readJSON, writeJSON } from './storage'

// The reader's own Loved list. Hearts are also public votes on the API, but the
// list lives on the device (with the quote as it was read) so it works offline.

const KEY = 'bewise.loved'

interface LovedEntry { quote: Quote, at: number }

export const loved = reactive<Record<string, LovedEntry>>(readJSON(KEY, {}))

watch(loved, () => writeJSON(KEY, loved), { deep: true })

export function isLoved(id: string): boolean {
  return id in loved
}

/** Newest first. */
export function lovedQuotes(): Quote[] {
  return Object.values(loved).sort((a, b) => b.at - a.at).map(entry => entry.quote)
}

/** Quotes the API says this reader voted for (before the Loved list existed) join the list. */
export function adoptVote(quote: Quote) {
  if (quote.voted && !isLoved(quote.id))
    loved[quote.id] = { quote, at: Date.now() }
}

const pending = new Set<string>()

/**
 * Love or unlove a quote. Updates at once and rolls back if the API call fails.
 * Returns the vote count to show, or null when the change was rolled back.
 */
export async function setLoved(quote: Quote, on: boolean): Promise<number | null> {
  if (pending.has(quote.id) || isLoved(quote.id) === on)
    return quote.votes
  pending.add(quote.id)
  const previous = loved[quote.id]
  if (on)
    loved[quote.id] = { quote, at: Date.now() }
  else
    delete loved[quote.id]
  try {
    const res = on ? await api.vote(quote.id, state.userId) : await api.unvote(quote.id, state.userId)
    const cached = quoteCache.get(quote.id)
    if (cached)
      quoteCache.set(quote.id, { ...cached, votes: res.votes, voted: on })
    if (on)
      maybeAskForReview()
    return res.votes
  }
  catch {
    if (previous)
      loved[quote.id] = previous
    else
      delete loved[quote.id]
    return null
  }
  finally {
    pending.delete(quote.id)
  }
}
