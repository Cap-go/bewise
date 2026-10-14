import { Capacitor } from '@capacitor/core'
import { CapgoInAppReview } from '@capgo/capacitor-in-app-review'
import { readJSON, writeJSON } from './storage'

// Ask for a rating at a happy moment (right after loving a quote), not from a
// buried settings row: after a few loves, a few days in, at most every 4 months.

const KEY = 'bewise.review'
const LOVES_NEEDED = 3
const DAY = 86_400_000

interface ReviewState { firstSeen: number, loves: number, askedAt: number }

function read(): ReviewState {
  return readJSON<ReviewState>(KEY, { firstSeen: Date.now(), loves: 0, askedAt: 0 })
}

/** Call once at startup so "a few days in" counts from the first launch. */
export function trackFirstLaunch() {
  if (!localStorage.getItem(KEY))
    writeJSON(KEY, read())
}

export function maybeAskForReview() {
  const review = read()
  review.loves++
  const ready = review.loves >= LOVES_NEEDED
    && Date.now() - review.firstSeen > 3 * DAY
    && Date.now() - review.askedAt > 120 * DAY
  if (ready && Capacitor.isNativePlatform()) {
    review.askedAt = Date.now()
    // Let the heart animation finish first.
    setTimeout(() => void CapgoInAppReview.requestReview().catch(() => {}), 1200)
  }
  writeJSON(KEY, review)
}

export const STORE_URL = Capacitor.getPlatform() === 'android'
  ? 'https://play.google.com/store/apps/details?id=ee.forgr.bewise'
  : 'https://apps.apple.com/app/id1448918843?action=write-review'
